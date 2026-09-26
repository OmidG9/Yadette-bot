import { env } from '../../config/env.js';
import { NotFoundError, ValidationError } from '../../shared/errors/index.js';
import { isSupportedLanguage } from '../../shared/i18n/index.js';
import { isValidTimeZone } from '../../shared/utils/date.js';
import type { SettingsRepository, UserSettings } from './settings.repository.js';

export class SettingsService {
  constructor(private readonly settings: SettingsRepository) {}

  async get(userId: string): Promise<UserSettings> {
    const value = await this.settings.findSettings(userId);
    if (!value) throw new NotFoundError('User settings', { userId });
    return value;
  }

  async setTimezone(userId: string, timezone: string): Promise<UserSettings> {
    if (!isValidTimeZone(timezone)) {
      throw new ValidationError('Unknown timezone', { timezone });
    }
    return this.settings.updateSettings(userId, { timezone });
  }

  async setLanguage(userId: string, language: string): Promise<UserSettings> {
    if (!isSupportedLanguage(language)) {
      throw new ValidationError('Unsupported language', { language });
    }
    return this.settings.updateSettings(userId, { language });
  }

  async setRemindersEnabled(userId: string, enabled: boolean): Promise<UserSettings> {
    return this.settings.updateSettings(userId, { reminderEnabled: enabled });
  }

  async toggleReminders(userId: string): Promise<UserSettings> {
    const current = await this.get(userId);
    return this.setRemindersEnabled(userId, !current.reminderEnabled);
  }

  defaultTimezone(): string {
    return env.DEFAULT_TIMEZONE;
  }
}
