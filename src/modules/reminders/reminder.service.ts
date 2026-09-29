import { ALLOWED_REMINDER_DAYS } from '../../shared/constants/index.js';
import { NotFoundError, ValidationError } from '../../shared/errors/index.js';
import { t, type Language } from '../../shared/i18n/index.js';
import { MS_PER_DAY, toPersianDigits } from '../../shared/utils/date.js';
import {
  occurrenceInJalaliYear,
  resolveDueOccurrence,
  todayFor,
  type BirthdayOccurrence,
  type BirthdayRule,
} from '../birthdays/birthday.calc.js';
import type { UserRepository } from '../users/user.types.js';
import { hasAttemptsLeft, nextRetryAt } from './retry.js';
import { notificationSlotKey } from './reminder.types.js';
import type {
  NotificationLogRecord,
  ReminderRecord,
  ReminderRepository,
  SnoozeRecord,
} from './reminder.types.js';

/** How many due rows one pass handles, so a backlog cannot stall the tick. */
const RETRY_BATCH_LIMIT = 100;

export interface DueNotification {
  userId: string;
  language: Language;
  timezone: string;
  daysBefore: number;
  person: {
    id: string;
    name: string;
    birthMonth: number;
    birthDay: number;
    birthYear: number | null;
    notes: string | null;
    interests: { id: string; title: string }[];
  };
  occurrence: BirthdayOccurrence;
}

/** A notification that is ready to be delivered, plus its delivery handles. */
export interface ClaimedNotification {
  due: DueNotification;
  log: NotificationLogRecord;
}

/** A snooze that is ready to be delivered, with its recipient resolved. */
export interface DueSnoozeNotification {
  snooze: SnoozeRecord;
  person: DueNotification['person'];
  user: { language: Language; timezone: string };
  /** Mirrored off the snooze row so callers do not have to reach into it. */
  userId: string;
}

/** A slot awaiting a retry: the notification to re-send and its log row. */
export interface DueRetryNotification {
  log: NotificationLogRecord;
  due: DueNotification;
}

export function reminderLabel(daysBefore: number, lang: Language = 'fa'): string {
  return daysBefore === 0
    ? t('reminders.day0', lang)
    : t('reminders.daysBefore', lang, { count: toPersianDigits(daysBefore) });
}

export class ReminderService {
  constructor(
    private readonly reminders: ReminderRepository,
    private readonly users: UserRepository,
  ) {}

  /**
   * Every offset the user can toggle, merged with what is actually stored.
   *
   * This must not create rows: offsets the user never touched have no row at
   * all, and materialising the defaults here would silently turn them on just
   * because the screen was opened.
   */
  async listForPerson(userId: string, personId: string): Promise<ReminderRecord[]> {
    const existing = await this.reminders.findForPerson(personId, userId);
    const enabled = new Map(existing.map((reminder) => [reminder.daysBefore, reminder]));

    return ALLOWED_REMINDER_DAYS.map((daysBefore) => {
      const stored = enabled.get(daysBefore);
      if (stored) return stored;
      return {
        id: '',
        userId,
        personId,
        daysBefore,
        enabled: false,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      };
    });
  }

  /**
   * Enables/disables one reminder offset for a person.
   *
   * A person whose reminders were all switched off has no stored rows, so an
   * offset that is allowed but not present yet is created rather than rejected —
   * that is the user switching one back on.
   */
  async setEnabled(
    userId: string,
    personId: string,
    daysBefore: number,
    enabled: boolean,
  ): Promise<ReminderRecord[]> {
    if (!(ALLOWED_REMINDER_DAYS as readonly number[]).includes(daysBefore)) {
      throw new ValidationError('Unsupported reminder offset', { daysBefore });
    }

    const existing = await this.reminders.findForPerson(personId, userId);
    const current = existing.find((reminder) => reminder.daysBefore === daysBefore);

    // `ensureForPerson` always creates rows enabled, so a freshly created offset
    // still has to be brought to the state the user asked for.
    //
    // It returns *every* row of the person, ordered by offset descending, so the
    // requested row has to be looked up by offset again. Taking the first result
    // would toggle the person's largest offset instead — switching on "3 days
    // before" would silently rewrite whatever 30/14/7-day reminder exists.
    let target = current;
    if (!target) {
      await this.reminders.ensureForPerson(userId, personId, [daysBefore]);
      target = (await this.reminders.findForPerson(personId, userId)).find(
        (reminder) => reminder.daysBefore === daysBefore,
      );
    }

    if (!target) throw new NotFoundError('Reminder', { personId, daysBefore });
    await this.reminders.setEnabled(target.id, personId, userId, enabled);

    return this.listForPerson(userId, personId);
  }

  async deleteForPerson(personId: string): Promise<number> {
    return this.reminders.deleteForPerson(personId);
  }

  /**
   * All notifications that are due right now, evaluated in each user's timezone.
   *
   * Occurrences already recorded in the notification log are excluded here, not
   * in the job: a birthday that is "today" stays due for the whole day, so
   * without this filter every scheduler tick would keep reporting the same
   * reminder forever. Pure business logic: no Telegram, no side effects.
   */
  async findDueNotifications(now: Date = new Date()): Promise<DueNotification[]> {
    const users = await this.users.findUsersWithRemindersEnabled();
    const due: DueNotification[] = [];

    for (const user of users) {
      const today = todayFor(user.timezone, now);
      const handledSlots = await this.reminders.findHandledSlotKeys(user.id);

      for (const reminder of await this.reminders.findEnabledForUser(user.id)) {
        const rule: BirthdayRule = {
          month: reminder.person.birthMonth,
          day: reminder.person.birthDay,
          year: reminder.person.birthYear,
        };
        const occurrence = resolveDueOccurrence(rule, today, reminder.daysBefore);
        if (!occurrence) continue;

        if (
          handledSlots.has(
            notificationSlotKey(reminder.person.id, occurrence.jalaliYear, reminder.daysBefore),
          )
        ) {
          continue;
        }

        due.push({
          userId: user.id,
          language: user.language,
          timezone: user.timezone,
          daysBefore: reminder.daysBefore,
          person: reminder.person,
          occurrence,
        });
      }
    }

    return due.sort((a, b) => a.occurrence.daysUntil - b.occurrence.daysUntil);
  }

  /** Read-only check used before delivery (the claim below is the real guard). */
  async wasSent(due: DueNotification): Promise<boolean> {
    const log = await this.reminders.findLog(
      due.userId,
      due.person.id,
      due.occurrence.jalaliYear,
      due.daysBefore,
    );
    // Only a completed delivery counts. A `pending` row means the slot is being
    // retried, and skipping it here would cancel the very retry being attempted.
    return log?.status === 'sent';
  }

  /**
   * Claims the notification slot. Returns `null` when it was already sent,
   * which makes duplicate delivery impossible even with concurrent runs.
   */
  async claim(due: DueNotification): Promise<ClaimedNotification | null> {
    const log = await this.reminders.claimNotification({
      userId: due.userId,
      personId: due.person.id,
      birthdayYear: due.occurrence.jalaliYear,
      daysBefore: due.daysBefore,
    });

    return log ? { due, log } : null;
  }

  // --- §3.6 delivery outcome ------------------------------------------------

  /** A successful send closes the slot. */
  async markSent(logId: string, sentAt: Date = new Date()): Promise<void> {
    await this.reminders.markSent(logId, sentAt);
  }

  /**
   * A failure that retrying cannot fix, such as a deleted recipient.
   *
   * Deliberately separate from `handleFailure`: the backoff is for transient
   * transport errors, and spending the budget on a permanent one just delays the
   * inevitable. It also stops the row from being re-read on every tick.
   */
  async markFailed(logId: string, error: string): Promise<void> {
    await this.reminders.markFailed(logId, error);
  }

  /**
   * A failed send either schedules another attempt or gives up.
   *
   * Returns whether a retry is still pending, so the caller can log it and the
   * tests can assert the decision without inspecting the database.
   */
  async handleFailure(
    logId: string,
    attemptsSoFar: number,
    error: string,
    now: Date = new Date(),
  ): Promise<{ retrying: boolean; nextAttemptAt: Date | null }> {
    const attempt = attemptsSoFar + 1;

    if (!hasAttemptsLeft(attempt)) {
      await this.reminders.markFailed(logId, error);
      return { retrying: false, nextAttemptAt: null };
    }

    const nextAttemptAt = nextRetryAt(attempt, now);
    await this.reminders.scheduleRetry(logId, attempt, nextAttemptAt, error);
    return { retrying: true, nextAttemptAt };
  }

  /**
   * §3.6 — slots whose backoff has elapsed, ready to be re-sent.
   *
   * The log row travels with the notification so the job can resolve the
   * outcome without a second query, and the occurrence is rebuilt from it
   * rather than stored: the row already pins the Jalali year, so re-deriving
   * keeps one definition of "which birthday is this".
   */
  /**
   * §3.6 — takes exclusive ownership of a due retry before it is re-sent.
   *
   * `false` means another worker got there first, and the caller must not send.
   */
  async leaseRetry(logId: string, now: Date = new Date()): Promise<boolean> {
    return this.reminders.leaseRetry(logId, now);
  }

  /** §3.5 — same lease for a snooze. */
  async leaseSnooze(snoozeId: string, now: Date = new Date()): Promise<boolean> {
    return this.reminders.leaseSnooze(snoozeId, now);
  }

  async findDueRetries(
    now: Date = new Date(),
    limit = RETRY_BATCH_LIMIT,
  ): Promise<DueRetryNotification[]> {
    const due: DueRetryNotification[] = [];

    for (const retry of await this.reminders.findDueRetries(now, limit)) {
      const user = await this.users.findById(retry.userId);
      // No user: nothing to deliver to, and nothing ever will be. `NotificationLog.userId`
      // cascades, so a genuinely deleted user has already taken this row with it and we
      // only get here if the delete is racing us. Close the slot instead of leaving it
      // pending, which would re-read it on every tick for no possible outcome.
      if (!user) {
        await this.reminders.markFailed(retry.log.id, 'notification target no longer exists');
        continue;
      }

      due.push({
        log: retry.log,
        due: {
          userId: retry.userId,
          language: user.language,
          timezone: user.timezone,
          daysBefore: retry.log.daysBefore,
          person: retry.person,
          occurrence: occurrenceInJalaliYear(
            {
              month: retry.person.birthMonth,
              day: retry.person.birthDay,
              year: retry.person.birthYear,
            },
            retry.log.birthdayYear,
          ),
        },
      });
    }

    return due;
  }

  // --- §3.5 snooze ----------------------------------------------------------

  /**
   * Resolves a snooze button's log id to the slot it refers to.
   *
   * Returns `null` for an unknown or foreign id. The ownership check lives in
   * the query, so a guessed id from another user is indistinguishable from one
   * that does not exist.
   */
  async resolveSnoozeTarget(
    logId: string,
    userId: string,
  ): Promise<{ personId: string; birthdayYear: number; daysBefore: number } | null> {
    const log = await this.reminders.findLogByIdForUser(logId, userId);
    if (!log || log.status !== 'sent') return null;
    return { personId: log.personId, birthdayYear: log.birthdayYear, daysBefore: log.daysBefore };
  }

  /**
   * Postpones a delivered reminder.
   *
   * The notification log row is left alone: it stays `sent`, because it was.
   * The snooze row is a separate one-time delivery, so the two states cannot
   * contradict each other and the duplicate-send guard keeps working.
   */
  async snooze(input: {
    userId: string;
    personId: string;
    birthdayYear: number;
    daysBefore: number;
    days: number;
    now?: Date;
  }): Promise<SnoozeRecord> {
    const now = input.now ?? new Date();
    return this.reminders.upsertSnooze({
      userId: input.userId,
      personId: input.personId,
      birthdayYear: input.birthdayYear,
      daysBefore: input.daysBefore,
      deliverAt: new Date(now.getTime() + input.days * MS_PER_DAY),
    });
  }

  async findSnooze(input: {
    userId: string;
    personId: string;
    birthdayYear: number;
    daysBefore: number;
  }): Promise<SnoozeRecord | null> {
    return this.reminders.findSnooze(input.userId, input.personId, input.birthdayYear, input.daysBefore);
  }

  async markSnoozeSent(snoozeId: string, sentAt: Date = new Date()): Promise<void> {
    await this.reminders.markSnoozeSent(snoozeId, sentAt);
  }

  /** The snooze equivalent of `handleFailure`. */
  async handleSnoozeFailure(
    snoozeId: string,
    attemptsSoFar: number,
    error: string,
    now: Date = new Date(),
  ): Promise<{ retrying: boolean; nextAttemptAt: Date | null }> {
    const attempt = attemptsSoFar + 1;

    if (!hasAttemptsLeft(attempt)) {
      await this.reminders.markSnoozeFailed(snoozeId, error);
      return { retrying: false, nextAttemptAt: null };
    }

    const nextAttemptAt = nextRetryAt(attempt, now);
    await this.reminders.scheduleSnoozeRetry(snoozeId, attempt, nextAttemptAt, error);
    return { retrying: true, nextAttemptAt };
  }

  /** §3.5 — snoozes whose moment has arrived. */
  async findDueSnoozes(
    now: Date = new Date(),
    limit = RETRY_BATCH_LIMIT,
  ): Promise<DueSnoozeNotification[]> {
    const due: DueSnoozeNotification[] = [];

    for (const entry of await this.reminders.findDueSnoozes(now, limit)) {
      const user = await this.users.findById(entry.snooze.userId);
      if (!user) continue;
      due.push({
        snooze: entry.snooze,
        person: entry.person,
        user: { language: user.language, timezone: user.timezone },
        userId: entry.snooze.userId,
      });
    }

    return due;
  }
}
