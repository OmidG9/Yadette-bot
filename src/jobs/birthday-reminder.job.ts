import type { Bot, InlineKeyboard } from 'grammy';
import type { AppContext } from '../bot/context.js';
import { logger } from '../shared/logger/index.js';
import { toError } from '../shared/errors/index.js';
import { t } from '../shared/i18n/index.js';
import { reminderNotificationText, snoozeNotificationText } from '../bot/views/reminder.views.js';
import { occurrenceInJalaliYear } from '../modules/birthdays/birthday.calc.js';
import { diffInDays, jalaliToCivil, todayInTimeZone } from '../shared/utils/date.js';
import type { ClaimedNotification, ReminderService } from '../modules/reminders/reminder.service.js';
import type { ScheduledTask } from '../modules/reminders/reminder.scheduler.js';
import { snoozeKeyboard } from '../bot/keyboards/reminder.js';

/** Only what delivery needs from the user module — keeps the job testable. */
export interface NotificationTargets {
  findById(userId: string): Promise<{ telegramId: string } | null>;
}

/**
 * Telegram delivery for due reminders.
 *
 * The birthday calculation lives in `ReminderService`; this file only knows how
 * to look up a chat and send a message. Replacing the scheduler with BullMQ
 * later means calling `run()` from a worker instead — no logic changes.
 */
export interface ReminderJobDeps {
  reminders: ReminderService;
  users: NotificationTargets;
  bot: Bot<AppContext>;
  /** §3.5 — the snooze buttons. Off in a test that does not exercise snoozing. */
  canSnooze?: boolean;
}

export class BirthdayReminderJob implements ScheduledTask {
  readonly name = 'birthday-reminder';

  constructor(private readonly deps: ReminderJobDeps) {}

  async run(): Promise<void> {
    // Retries first: a slot that failed on a previous tick is already
    // promised, whereas a fresh due notification is only just becoming due.
    await this.runRetries();
    await this.runSnoozes();

    const due = await this.deps.reminders.findDueNotifications();
    if (due.length === 0) return;

    logger.info({ event: 'reminder.due', count: due.length }, 'due reminders found');

    for (const notification of due) {
      await this.deliver(notification);
    }
  }

  private async deliver(notification: ClaimedNotification['due']): Promise<void> {
    const { reminders, users, bot } = this.deps;

    // Pre-check (cheap) then atomic claim (authoritative).
    if (await reminders.wasSent(notification)) return;

    const claimed = await reminders.claim(notification);
    if (!claimed) {
      logger.debug(
        {
          event: 'reminder.skipped.duplicate',
          userId: notification.userId,
          personId: notification.person.id,
          daysBefore: notification.daysBefore,
        },
        'notification already sent',
      );
      return;
    }

    try {
      const user = await users.findById(notification.userId);
      if (!user) {
        // Terminal, not retryable. `NotificationLog.userId` cascades, so a user
        // row that is gone has already taken this log with it: there is nothing
        // left to retry. Recording a failure is also what stops the retry pass
        // from re-reading the row on every tick, which would spin.
        await reminders.markFailed(claimed.log.id, 'notification target no longer exists');

        logger.warn(
          { event: 'reminder.user.missing', userId: notification.userId },
          'notification target no longer exists',
        );
        return;
      }

      await bot.api.sendMessage(
        user.telegramId,
        reminderNotificationText(
          {
            person: notification.person,
            jalali: notification.occurrence.jalali,
            jalaliYear: notification.occurrence.jalaliYear,
            daysBefore: notification.daysBefore,
          },
          notification.language,
        ),
        {
          parse_mode: 'HTML',
          ...this.snoozeKeyboardFor(claimed.log.id),
        },
      );

      await reminders.markSent(claimed.log.id);

      logger.info(
        {
          event: 'reminder.sent',
          userId: notification.userId,
          personId: notification.person.id,
          daysBefore: notification.daysBefore,
          birthdayYear: notification.occurrence.jalaliYear,
        },
        'reminder delivered',
      );
    } catch (error) {
      await this.failDelivery(claimed, error);
    }
  }

  /**
   * §3.6 — re-sends notifications whose Telegram call failed earlier.
   *
   * The slot is already `pending` with an elapsed backoff. Leasing it before the
   * send is what stops a second worker from sending the same notification.
   */
  private async runRetries(): Promise<void> {
    const pending = await this.deps.reminders.findDueRetries();
    if (pending.length === 0) return;

    logger.info({ event: 'reminder.retry.batch', count: pending.length }, 'retrying reminders');

    for (const { log, due } of pending) {
      if (!(await this.deps.reminders.leaseRetry(log.id))) {
        logger.debug(
          { event: 'reminder.retry.leased', logId: log.id, userId: due.userId },
          'retry already claimed by another worker',
        );
        continue;
      }

      const user = await this.deps.users.findById(due.userId);

      if (!user) {
        // Terminal, for the same cascade reason as the fresh pass. Leaving the
        // row `pending` would make it reappear in every batch forever.
        await this.deps.reminders.markFailed(log.id, 'notification target no longer exists');
        logger.warn(
          { event: 'reminder.retry.user.missing', userId: due.userId },
          'retry target no longer exists',
        );
        continue;
      }

      try {
        await this.deps.bot.api.sendMessage(
          user.telegramId,
          reminderNotificationText(
            {
              person: due.person,
              jalali: due.occurrence.jalali,
              jalaliYear: due.occurrence.jalaliYear,
              daysBefore: due.daysBefore,
            },
            due.language,
          ),
          { parse_mode: 'HTML', ...this.snoozeKeyboardFor(log.id) },
        );
        await this.deps.reminders.markSent(log.id);

        logger.info(
          {
            event: 'reminder.retry.sent',
            userId: due.userId,
            personId: due.person.id,
            daysBefore: due.daysBefore,
            attempt: log.attempts,
          },
          'reminder retried successfully',
        );
      } catch (error) {
        await this.recordFailure(log, error);
      }
    }
  }

  /** §3.5 — delivers snoozed notifications whose moment has arrived. */
  private async runSnoozes(): Promise<void> {
    const due = await this.deps.reminders.findDueSnoozes();
    if (due.length === 0) return;

    logger.info({ event: 'snooze.due', count: due.length }, 'snoozed reminders are due');

    for (const entry of due) {
      const { snooze, person, user } = entry;

      if (!(await this.deps.reminders.leaseSnooze(snooze.id))) {
        logger.debug(
          { event: 'snooze.leased', snoozeId: snooze.id, userId: snooze.userId },
          'snooze already claimed by another worker',
        );
        continue;
      }

      try {
        const target = await this.deps.users.findById(snooze.userId);
        if (!target) {
          await this.failSnooze(entry, 'notification target no longer exists');
          continue;
        }

        const occurrence = occurrenceInJalaliYear(
          {
            month: person.birthMonth,
            day: person.birthDay,
            year: person.birthYear,
          },
          snooze.birthdayYear,
        );

        /**
         * The stored offset describes the slot that was snoozed, not the moment
         * this message is delivered. Snoozing a "7 days before" reminder for one
         * day has to arrive saying six, and a reminder snoozed on the birthday
         * itself would otherwise greet the user with "today is their birthday"
         * the day after. So the countdown is recomputed from the calendar.
         */
        const daysUntil = diffInDays(
          todayInTimeZone(user.timezone),
          jalaliToCivil(occurrence.jalali),
        );

        if (daysUntil < 0) {
          // The birthday has passed: the reminder the user asked for can no
          // longer be honoured. Dropping it silently is the worst option — the
          // user is waiting for a message that will never come, from a bot whose
          // entire job is not forgetting. Say so, then close the row so it stops
          // reappearing on every tick.
          //
          // A failure here is not retryable: the notice is already obsolete, so
          // re-sending it later would be noise. Log it and close regardless.
          await this.deps.bot.api
            .sendMessage(target.telegramId, t('snooze.expired', user.language), {
              parse_mode: 'HTML',
            })
            .catch((error: unknown) => {
              logger.warn(
                { event: 'snooze.expiry.notice.failed', userId: snooze.userId, err: toError(error) },
                'could not tell the user the reminder expired',
              );
            });

          await this.deps.reminders.markSnoozeSent(snooze.id);
          logger.info(
            {
              event: 'snooze.expired',
              userId: snooze.userId,
              personId: person.id,
              daysUntil,
            },
            'snoozed reminder outlived the birthday, closed it',
          );
          continue;
        }

        await this.deps.bot.api.sendMessage(
          target.telegramId,
          snoozeNotificationText(
            {
              person,
              jalali: occurrence.jalali,
              jalaliYear: occurrence.jalaliYear,
              daysBefore: daysUntil,
            },
            user.language,
          ),
          { parse_mode: 'HTML' },
        );

        await this.deps.reminders.markSnoozeSent(snooze.id);
        logger.info(
          { event: 'snooze.sent', userId: snooze.userId, personId: person.id, daysBefore: daysUntil },
          'snoozed reminder delivered',
        );
      } catch (error) {
        await this.failSnooze(entry, error);
      }
    }
  }

  private async recordFailure(
    log: ClaimedNotification['log'],
    error: unknown,
  ): Promise<void> {
    const reason = toError(error).message.slice(0, 200);
    const outcome = await this.deps.reminders
      .handleFailure(log.id, log.attempts, reason)
      .catch((handleError: unknown) => {
        logger.error(
          { event: 'reminder.failure.record.failed', err: toError(handleError) },
          'could not record the delivery failure',
        );
        return { retrying: false, nextAttemptAt: null };
      });

    logger.error(
      {
        event: outcome.retrying ? 'reminder.retry.scheduled' : 'reminder.failed',
        userId: log.userId,
        personId: log.personId,
        daysBefore: log.daysBefore,
        nextAttemptAt: outcome.nextAttemptAt?.toISOString(),
        err: toError(error),
      },
      outcome.retrying ? 'reminder delivery failed, retry scheduled' : 'reminder delivery gave up',
    );
  }

  private async failDelivery(claimed: ClaimedNotification, error: unknown): Promise<void> {
    await this.recordFailure(claimed.log, error);
  }

  private async failSnooze(
    entry: { snooze: { id: string; attempts: number }; userId: string; person: { id: string } },
    error: unknown,
  ): Promise<void> {
    const reason = toError(error).message.slice(0, 200);
    const outcome = await this.deps.reminders
      .handleSnoozeFailure(entry.snooze.id, entry.snooze.attempts, reason)
      .catch((handleError: unknown) => {
        logger.error(
          { event: 'snooze.failure.record.failed', err: toError(handleError) },
          'could not record the snooze failure',
        );
        return { retrying: false, nextAttemptAt: null };
      });

    logger.error(
      {
        event: 'snooze.failed',
        userId: entry.userId,
        personId: entry.person.id,
        retrying: outcome.retrying,
        nextAttemptAt: outcome.nextAttemptAt?.toISOString(),
        err: toError(error),
      },
      'snoozed reminder delivery failed',
    );
  }

  /**
   * The snooze buttons, or nothing at all.
   *
   * Absent rather than empty when the flag is off: an empty inline keyboard
   * still occupies a row in the message, and the roadmap is explicit that a
   * disabled feature must not appear in the UI.
   */
  private snoozeKeyboardFor(logId: string): { reply_markup?: InlineKeyboard } {
    if (this.deps.canSnooze === false) return {};
    return { reply_markup: snoozeKeyboard(logId) };
  }
}
