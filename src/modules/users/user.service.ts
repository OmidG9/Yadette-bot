import { env } from '../../config/env.js';
import { isValidTimeZone } from '../../shared/utils/date.js';
import { ValidationError } from '../../shared/errors/index.js';
import type { Language } from '../../shared/i18n/index.js';
import type { UserRecord, UserRepository } from './user.types.js';

export interface TelegramUserProfile {
  telegramId: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

export class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly defaultTimezone: string = env.DEFAULT_TIMEZONE,
  ) {}

  /**
   * Returns the user for a Telegram id, creating it on first contact.
   * `telegramId` is unique, so repeated /start calls never duplicate a user.
   */
  async getOrCreate(profile: TelegramUserProfile): Promise<{ user: UserRecord; created: boolean }> {
    this.assertTelegramId(profile.telegramId);

    const existing = await this.users.findByTelegramId(profile.telegramId);
    if (existing) {
      return { user: existing, created: false };
    }

    const user = await this.users.create({
      telegramId: profile.telegramId,
      username: profile.username ?? null,
      firstName: profile.firstName ?? null,
      lastName: profile.lastName ?? null,
      timezone: this.defaultTimezone,
      language: env.DEFAULT_LANGUAGE,
    });

    return { user, created: true };
  }

  /** Refreshes the cached Telegram profile fields. Never throws on write failure. */
  async syncProfile(userId: string, profile: TelegramUserProfile): Promise<void> {
    await this.users.updateProfile(userId, {
      username: profile.username ?? null,
      firstName: profile.firstName ?? null,
      lastName: profile.lastName ?? null,
    });
  }

  /** Returns null instead of throwing; used by background jobs. */
  async findById(userId: string): Promise<UserRecord | null> {
    return this.users.findById(userId);
  }

  async getById(userId: string): Promise<UserRecord> {
    const user = await this.users.findById(userId);
    if (!user) throw new ValidationError('User not found', { userId });
    return user;
  }

  async updateSettings(
    userId: string,
    input: { timezone?: string; language?: Language; reminderEnabled?: boolean },
  ): Promise<UserRecord> {
    if (input.timezone !== undefined && !isValidTimeZone(input.timezone)) {
      throw new ValidationError('Unknown timezone', { timezone: input.timezone });
    }
    return this.users.updateSettings(userId, input);
  }

  async markSeen(userId: string): Promise<void> {
    await this.users.touchLastSeen(userId);
  }

  /** Best-effort display name for greetings. */
  displayName(user: UserRecord): string {
    return user.firstName?.trim() || user.username?.trim() || 'دوست عزیز';
  }

  private assertTelegramId(telegramId: string): void {
    if (!/^\d{1,32}$/.test(telegramId)) {
      throw new ValidationError('Invalid telegram id');
    }
  }
}
