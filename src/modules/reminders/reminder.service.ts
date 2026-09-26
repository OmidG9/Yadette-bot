import { ALLOWED_REMINDER_DAYS, DEFAULT_REMINDER_DAYS } from '../../shared/constants/index.js';
import { NotFoundError, ValidationError } from '../../shared/errors/index.js';
import { t, type Language } from '../../shared/i18n/index.js';
import { toPersianDigits } from '../../shared/utils/date.js';
import {
  ageOnBirthday,
  resolveDueOccurrence,
  todayFor,
  type BirthdayOccurrence,
  type BirthdayRule,
} from '../birthdays/birthday.calc.js';
import type { UserRepository } from '../users/user.types.js';
import type { NotificationLogRecord, ReminderRecord, ReminderRepository } from './reminder.types.js';

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

  /** Creates the default reminders (7/3/1/0 days before) if the person has none. */
  async ensureDefaults(userId: string, personId: string): Promise<ReminderRecord[]> {
    return this.reminders.ensureForPerson(userId, personId, [...DEFAULT_REMINDER_DAYS]);
  }

  async listForPerson(userId: string, personId: string): Promise<ReminderRecord[]> {
    const existing = await this.reminders.findForPerson(personId, userId);
    if (existing.length > 0) return existing;
    return this.reminders.ensureForPerson(userId, personId, [...DEFAULT_REMINDER_DAYS]);
  }

  /**
   * Enables/disables one reminder offset for a person.
   * Unknown-but-allowed offsets are created on demand.
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
    if (existing.length === 0) throw new NotFoundError('Reminder', { personId });

    const current = existing.find((reminder) => reminder.daysBefore === daysBefore);
    if (!current) return existing;

    await this.reminders.setEnabled(current.id, personId, userId, enabled);
    return this.reminders.findForPerson(personId, userId);
  }

  async deleteForPerson(personId: string): Promise<number> {
    return this.reminders.deleteForPerson(personId);
  }

  /**
   * All notifications that are due right now, evaluated in each user's timezone.
   * Pure business logic: no Telegram, no side effects.
   */
  async findDueNotifications(now: Date = new Date()): Promise<DueNotification[]> {
    const users = await this.users.findUsersWithRemindersEnabled();
    const due: DueNotification[] = [];

    for (const user of users) {
      const today = todayFor(user.timezone, now);

      for (const reminder of await this.reminders.findEnabledForUser(user.id)) {
        const rule: BirthdayRule = {
          month: reminder.person.birthMonth,
          day: reminder.person.birthDay,
          year: reminder.person.birthYear,
        };
        const occurrence = resolveDueOccurrence(rule, today, reminder.daysBefore);
        if (!occurrence) continue;

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

  ageFor(due: DueNotification): number | null {
    return ageOnBirthday(
      { month: due.person.birthMonth, day: due.person.birthDay, year: due.person.birthYear },
      due.occurrence.jalaliYear,
    );
  }
}
