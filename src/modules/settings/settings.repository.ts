import type { PrismaClient } from '@prisma/client';
import { DEFAULT_LANGUAGE, isSupportedLanguage, type Language } from '../../shared/i18n/index.js';

export interface UserSettings {
  timezone: string;
  language: Language;
  reminderEnabled: boolean;
}

export interface SettingsRepository {
  findSettings(userId: string): Promise<UserSettings | null>;
  updateSettings(userId: string, input: Partial<UserSettings>): Promise<UserSettings>;
}

function toLanguage(value: string): Language {
  return isSupportedLanguage(value) ? value : DEFAULT_LANGUAGE;
}

/** Settings live on the `User` row; this repository owns only those columns. */
export class PrismaSettingsRepository implements SettingsRepository {
  constructor(private readonly db: PrismaClient) {}

  async findSettings(userId: string): Promise<UserSettings | null> {
    const row = await this.db.user.findUnique({
      where: { id: userId },
      select: { timezone: true, language: true, reminderEnabled: true },
    });
    if (!row) return null;
    return {
      timezone: row.timezone,
      language: toLanguage(row.language),
      reminderEnabled: row.reminderEnabled,
    };
  }

  async updateSettings(userId: string, input: Partial<UserSettings>): Promise<UserSettings> {
    const row = await this.db.user.update({
      where: { id: userId },
      data: {
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.language !== undefined ? { language: input.language } : {}),
        ...(input.reminderEnabled !== undefined ? { reminderEnabled: input.reminderEnabled } : {}),
      },
      select: { timezone: true, language: true, reminderEnabled: true },
    });

    return {
      timezone: row.timezone,
      language: toLanguage(row.language),
      reminderEnabled: row.reminderEnabled,
    };
  }
}
