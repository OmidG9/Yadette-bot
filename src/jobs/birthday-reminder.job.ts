import type { Bot } from 'grammy';
import type { AppContext } from '../bot/context.js';
import { logger } from '../shared/logger/index.js';
import { toError } from '../shared/errors/index.js';
import { reminderNotificationText } from '../bot/views/reminder.views.js';
import type { ClaimedNotification, ReminderService } from '../modules/reminders/reminder.service.js';
import type { ScheduledTask } from '../modules/reminders/reminder.scheduler.js';

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
}

export class BirthdayReminderJob implements ScheduledTask {
  readonly name = 'birthday-reminder';

  constructor(private readonly deps: ReminderJobDeps) {}

  async run(): Promise<void> {
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
        // The claim is released like any other failure: leaving it consumed
        // would burn this year's reminder for a lookup that may succeed later.
        await this.releaseClaim(claimed.log.id);

        logger.warn(
          { event: 'reminder.user.missing', userId: notification.userId },
          'notification target no longer exists',
        );
        return;
      }

      const text = reminderNotificationText(notification, notification.language);
      await bot.api.sendMessage(user.telegramId, text, { parse_mode: 'HTML' });

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
      // Release the claim so the next tick retries instead of losing the reminder.
      await this.releaseClaim(claimed.log.id);

      logger.error(
        {
          event: 'reminder.failed',
          userId: notification.userId,
          personId: notification.person.id,
          daysBefore: notification.daysBefore,
          err: toError(error),
        },
        'reminder delivery failed',
      );
    }
  }

  /** Never lets a release failure turn into a second unhandled rejection. */
  private async releaseClaim(logId: string): Promise<void> {
    await this.deps.reminders.release(logId).catch((releaseError: unknown) => {
      logger.error(
        { event: 'reminder.release.failed', err: toError(releaseError) },
        'could not release notification claim',
      );
    });
  }
}
