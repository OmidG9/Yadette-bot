import { notificationSlotKey } from '../../src/modules/reminders/reminder.types.js';
import { leaseUntil } from '../../src/modules/reminders/retry.js';
import type {
  DueRetry,
  DueSnooze,
  NotificationLogRecord,
  ReminderRecord,
  ReminderRepository,
  ReminderWithPerson,
  SnoozeRecord,
} from '../../src/modules/reminders/reminder.types.js';
import type { UserRecord, UserRepository, UpsertTelegramUserInput } from '../../src/modules/users/user.types.js';
import type { Language } from '../../src/shared/i18n/index.js';

/** In-memory reminder repository with a unique constraint on the notification log. */
export class FakeReminderRepository implements ReminderRepository {
  private reminders: ReminderRecord[] = [];
  private logs: NotificationLogRecord[] = [];
  private snoozes: SnoozeRecord[] = [];
  private sequence = 0;

  constructor(private readonly defaultDays: number[] = [7, 3, 1, 0]) {}

  seed(
    person: { id: string; userId: string; name: string; birthMonth: number; birthDay: number; birthYear: number | null; notes: string | null },
    days: number[] = this.defaultDays,
  ): ReminderWithPerson[] {
    const created = days.map((daysBefore) => {
      this.sequence += 1;
      const record: ReminderRecord = {
        id: `rem${this.sequence}`,
        userId: person.userId,
        personId: person.id,
        daysBefore,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.reminders.push(record);
      return record;
    });

    return created.map((record) => ({
      ...record,
      person: { ...person, interests: [] },
    }));
  }

  async findForPerson(personId: string, userId: string): Promise<ReminderRecord[]> {
    return this.reminders.filter((item) => item.personId === personId && item.userId === userId);
  }

  async findEnabledForUser(userId: string): Promise<ReminderWithPerson[]> {
    return this.reminders
      .filter((item) => item.userId === userId && item.enabled)
      .map((item) => ({
        ...item,
        person: {
          id: item.personId,
          name: 'Sara',
          birthMonth: 7,
          birthDay: 18,
          birthYear: 1380,
          notes: null,
          interests: [],
        },
      }));
  }

  async setEnabled(
    reminderId: string,
    personId: string,
    userId: string,
    enabled: boolean,
  ): Promise<ReminderRecord | null> {
    const record = this.reminders.find(
      (item) => item.id === reminderId && item.personId === personId && item.userId === userId,
    );
    if (!record) return null;
    record.enabled = enabled;
    return record;
  }

  async ensureForPerson(userId: string, personId: string, daysBefore: number[]): Promise<ReminderRecord[]> {
    const existing = await this.findForPerson(personId, userId);
    const missing = daysBefore.filter(
      (days) => !existing.some((item) => item.daysBefore === days),
    );
    return [...existing, ...this.seed({ id: personId, userId, name: 'Sara', birthMonth: 7, birthDay: 18, birthYear: null, notes: null }, missing)];
  }

  async deleteForPerson(personId: string): Promise<number> {
    const before = this.reminders.length;
    this.reminders = this.reminders.filter((item) => item.personId !== personId);
    return before - this.reminders.length;
  }

  async findLog(
    userId: string,
    personId: string,
    birthdayYear: number,
    daysBefore: number,
  ): Promise<NotificationLogRecord | null> {
    return (
      this.logs.find(
        (log) =>
          log.userId === userId &&
          log.personId === personId &&
          log.birthdayYear === birthdayYear &&
          log.daysBefore === daysBefore,
      ) ?? null
    );
  }

  async findHandledSlotKeys(userId: string): Promise<Set<string>> {
    return new Set(
      this.logs
        .filter((log) => log.userId === userId)
        .map((log) => notificationSlotKey(log.personId, log.birthdayYear, log.daysBefore)),
    );
  }

  async findLogByIdForUser(
    logId: string,
    userId: string,
  ): Promise<NotificationLogRecord | null> {
    return this.logs.find((log) => log.id === logId && log.userId === userId) ?? null;
  }

  async claimNotification(input: {
    userId: string;
    personId: string;
    birthdayYear: number;
    daysBefore: number;
  }): Promise<NotificationLogRecord | null> {
    if (
      await this.findLog(input.userId, input.personId, input.birthdayYear, input.daysBefore)
    ) {
      return null;
    }
    this.sequence += 1;
    const record: NotificationLogRecord = {
      id: `log${this.sequence}`,
      ...input,
      status: 'pending',
      attempts: 1,
      nextAttemptAt: new Date(),
      lastError: null,
      sentAt: null,
    };
    this.logs.push(record);
    return record;
  }

  async markSent(logId: string, sentAt: Date): Promise<void> {
    const log = this.logs.find((item) => item.id === logId);
    if (!log) return;
    log.status = 'sent';
    log.sentAt = sentAt;
    log.lastError = null;
  }

  async scheduleRetry(
    logId: string,
    attempt: number,
    nextAttemptAt: Date,
    error: string,
  ): Promise<void> {
    const log = this.logs.find((item) => item.id === logId);
    if (!log) return;
    log.status = 'pending';
    log.attempts = attempt;
    log.nextAttemptAt = nextAttemptAt;
    log.lastError = error;
  }

  async markFailed(logId: string, error: string): Promise<void> {
    const log = this.logs.find((item) => item.id === logId);
    if (!log) return;
    log.status = 'failed';
    log.lastError = error;
  }

  async findDueRetries(now: Date, limit: number): Promise<DueRetry[]> {
    return this.logs
      .filter((log) => log.status === 'pending' && log.nextAttemptAt <= now)
      .slice(0, limit)
      .map((log) => ({ log, userId: log.userId, person: this.personOf(log.personId) }));
  }

  async leaseRetry(logId: string, now: Date): Promise<boolean> {
    const log = this.logs.find((item) => item.id === logId);
    if (!log || log.status !== 'pending' || log.nextAttemptAt > now) return false;
    log.nextAttemptAt = leaseUntil(now);
    return true;
  }

  async leaseSnooze(snoozeId: string, now: Date): Promise<boolean> {
    const snooze = this.snoozes.find((item) => item.id === snoozeId);
    if (!snooze || snooze.status !== 'pending' || snooze.nextAttemptAt > now) return false;
    snooze.nextAttemptAt = leaseUntil(now);
    return true;
  }

  // --- Snooze ---------------------------------------------------------------

  async upsertSnooze(input: {
    userId: string;
    personId: string;
    birthdayYear: number;
    daysBefore: number;
    deliverAt: Date;
  }): Promise<SnoozeRecord> {
    const existing = await this.findSnooze(input.userId, input.personId, input.birthdayYear, input.daysBefore);

    if (existing) {
      existing.deliverAt = input.deliverAt;
      existing.nextAttemptAt = input.deliverAt;
      existing.status = 'pending';
      existing.attempts = 0;
      existing.lastError = null;
      return existing;
    }

    this.sequence += 1;
    const record: SnoozeRecord = {
      id: `snz${this.sequence}`,
      userId: input.userId,
      personId: input.personId,
      birthdayYear: input.birthdayYear,
      daysBefore: input.daysBefore,
      deliverAt: input.deliverAt,
      status: 'pending',
      attempts: 0,
      nextAttemptAt: input.deliverAt,
      lastError: null,
      sentAt: null,
    };
    this.snoozes.push(record);
    return record;
  }

  async findSnooze(
    userId: string,
    personId: string,
    birthdayYear: number,
    daysBefore: number,
  ): Promise<SnoozeRecord | null> {
    return (
      this.snoozes.find(
        (item) =>
          item.userId === userId &&
          item.personId === personId &&
          item.birthdayYear === birthdayYear &&
          item.daysBefore === daysBefore,
      ) ?? null
    );
  }

  async markSnoozeSent(snoozeId: string, sentAt: Date): Promise<void> {
    const snooze = this.snoozes.find((item) => item.id === snoozeId);
    if (!snooze) return;
    snooze.status = 'sent';
    snooze.sentAt = sentAt;
    snooze.lastError = null;
  }

  async scheduleSnoozeRetry(
    snoozeId: string,
    attempt: number,
    nextAttemptAt: Date,
    error: string,
  ): Promise<void> {
    const snooze = this.snoozes.find((item) => item.id === snoozeId);
    if (!snooze) return;
    snooze.status = 'pending';
    snooze.attempts = attempt;
    snooze.nextAttemptAt = nextAttemptAt;
    snooze.lastError = error;
  }

  async markSnoozeFailed(snoozeId: string, error: string): Promise<void> {
    const snooze = this.snoozes.find((item) => item.id === snoozeId);
    if (!snooze) return;
    snooze.status = 'failed';
    snooze.lastError = error;
  }

  async findDueSnoozes(now: Date, limit: number): Promise<DueSnooze[]> {
    return this.snoozes
      .filter((item) => item.status === 'pending' && item.nextAttemptAt <= now)
      .slice(0, limit)
      .map((snooze) => ({ snooze, person: this.personOf(snooze.personId) }));
  }

  private personOf(personId: string): ReminderWithPerson['person'] {
    return {
      id: personId,
      name: 'Sara',
      birthMonth: 7,
      birthDay: 18,
      birthYear: 1380,
      notes: null,
      interests: [],
    };
  }

  /** Test helper. */
  logCount(): number {
    return this.logs.length;
  }

  /** Test helper: snooze rows currently stored. */
  snoozeCount(): number {
    return this.snoozes.length;
  }
}

export class FakeUserRepository implements UserRepository {
  private sequence = 0;

  constructor(private readonly users: UserRecord[]) {}

  async findById(id: string): Promise<UserRecord | null> {
    return this.users.find((user) => user.id === id) ?? null;
  }

  async findByTelegramId(telegramId: string): Promise<UserRecord | null> {
    return this.users.find((user) => user.telegramId === telegramId) ?? null;
  }

  async create(input: UpsertTelegramUserInput): Promise<UserRecord> {
    this.sequence += 1;
    const user: UserRecord = {
      id: `generated${this.sequence}`,
      telegramId: input.telegramId,
      username: input.username ?? null,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      timezone: input.timezone,
      language: input.language,
      reminderEnabled: true,
      lastSeenAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.push(user);
    return user;
  }

  async updateProfile(): Promise<UserRecord> {
    throw new Error('not used in these tests');
  }

  async updateSettings(): Promise<UserRecord> {
    throw new Error('not used in these tests');
  }

  async touchLastSeen(): Promise<void> {
    // no-op
  }

  /** Test helper: users left in the store. */
  async delete(id: string): Promise<void> {
    const index = this.users.findIndex((user) => user.id === id);
    if (index >= 0) this.users.splice(index, 1);
  }

  /** Test helper. */
  count(): number {
    return this.users.length;
  }

  async findUsersWithRemindersEnabled(): Promise<
    Pick<UserRecord, 'id' | 'timezone' | 'language'>[]
  > {
    return this.users
      .filter((user) => user.reminderEnabled)
      .map((user) => ({ id: user.id, timezone: user.timezone, language: user.language }));
  }
}

export function fakeUser(overrides: Partial<UserRecord> = {}): UserRecord {
  const language: Language = overrides.language ?? 'fa';
  return {
    id: 'user1',
    telegramId: '100200300',
    username: 'sara_user',
    firstName: 'Sara',
    lastName: null,
    timezone: 'Asia/Tehran',
    language,
    reminderEnabled: true,
    lastSeenAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
