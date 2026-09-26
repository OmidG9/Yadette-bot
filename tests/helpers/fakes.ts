import type {
  NotificationLogRecord,
  ReminderRecord,
  ReminderRepository,
  ReminderWithPerson,
} from '../../src/modules/reminders/reminder.types.js';
import type { UserRecord, UserRepository } from '../../src/modules/users/user.types.js';
import type { Language } from '../../src/shared/i18n/index.js';

/** In-memory reminder repository with a unique constraint on the notification log. */
export class FakeReminderRepository implements ReminderRepository {
  private reminders: ReminderRecord[] = [];
  private logs: NotificationLogRecord[] = [];
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
      sentAt: new Date(),
    };
    this.logs.push(record);
    return record;
  }

  async releaseNotification(logId: string): Promise<void> {
    this.logs = this.logs.filter((log) => log.id !== logId);
  }

  /** Test helper. */
  logCount(): number {
    return this.logs.length;
  }
}

export class FakeUserRepository implements UserRepository {
  constructor(private readonly users: UserRecord[]) {}

  async findById(id: string): Promise<UserRecord | null> {
    return this.users.find((user) => user.id === id) ?? null;
  }

  async findByTelegramId(telegramId: string): Promise<UserRecord | null> {
    return this.users.find((user) => user.telegramId === telegramId) ?? null;
  }

  async create(): Promise<UserRecord> {
    throw new Error('not used in these tests');
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
