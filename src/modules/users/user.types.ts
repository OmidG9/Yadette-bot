import type { Language } from '../../shared/i18n/index.js';

/** Persistence-facing shape of a user. */
export interface UserRecord {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  timezone: string;
  language: Language;
  reminderEnabled: boolean;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertTelegramUserInput {
  telegramId: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  timezone: string;
  language: Language;
}

export interface UpdateUserSettingsInput {
  timezone?: string;
  language?: Language;
  reminderEnabled?: boolean;
}

export interface UserRepository {
  findById(id: string): Promise<UserRecord | null>;
  findByTelegramId(telegramId: string): Promise<UserRecord | null>;
  create(input: UpsertTelegramUserInput): Promise<UserRecord>;
  updateProfile(
    id: string,
    input: Pick<UpsertTelegramUserInput, 'username' | 'firstName' | 'lastName'>,
  ): Promise<UserRecord>;
  updateSettings(id: string, input: UpdateUserSettingsInput): Promise<UserRecord>;
  touchLastSeen(id: string): Promise<void>;
  /**
   * Removes the user row. Every child table hangs off it with
   * `ON DELETE CASCADE`, so this also erases people, interests, reminders,
   * notification logs and conversation state. Must be idempotent.
   */
  delete(id: string): Promise<void>;
  /** Users with reminders globally enabled, used by the scheduler. */
  findUsersWithRemindersEnabled(): Promise<Pick<UserRecord, 'id' | 'timezone' | 'language'>[]>;
}
