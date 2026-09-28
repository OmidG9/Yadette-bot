import { ALLOWED_REMINDER_DAYS } from '../../shared/constants/index.js';
import { NotFoundError, ValidationError } from '../../shared/errors/index.js';
import { t, type Language } from '../../shared/i18n/index.js';
import { toPersianDigits } from '../../shared/utils/date.js';
import {
  resolveDueOccurrence,
  todayFor,
  type BirthdayOccurrence,
  type BirthdayRule,
} from '../birthdays/birthday.calc.js';
import type { UserRepository } from '../users/user.types.js';
import { notificationSlotKey } from './reminder.types.js';
import type {
  NotificationLogRecord,
  ReminderRecord,
  ReminderRepository,
} from './reminder.types.js';

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
      const sentSlots = await this.reminders.findLogKeys(user.id);

      for (const reminder of await this.reminders.findEnabledForUser(user.id)) {
        const rule: BirthdayRule = {
          month: reminder.person.birthMonth,
          day: reminder.person.birthDay,
          year: reminder.person.birthYear,
        };
        const occurrence = resolveDueOccurrence(rule, today, reminder.daysBefore);
        if (!occurrence) continue;

        if (
          sentSlots.has(
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
    return log !== null;
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

  /** Un-claims a slot after a failed delivery so it can be retried. */
  async release(logId: string): Promise<void> {
    await this.reminders.releaseNotification(logId);
  }
}
