import type { PrismaClient, User } from '@prisma/client';
import { DEFAULT_LANGUAGE, isSupportedLanguage, type Language } from '../../shared/i18n/index.js';
import type {
  UpdateUserSettingsInput,
  UpsertTelegramUserInput,
  UserRecord,
  UserRepository,
} from './user.types.js';

type UserRow = User;

function toLanguage(value: string): Language {
  return isSupportedLanguage(value) ? value : DEFAULT_LANGUAGE;
}

function toRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    telegramId: row.telegramId,
    username: row.username,
    firstName: row.firstName,
    lastName: row.lastName,
    timezone: row.timezone,
    language: toLanguage(row.language),
    reminderEnabled: row.reminderEnabled,
    lastSeenAt: row.lastSeenAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly db: PrismaClient) {}

  async findById(id: string): Promise<UserRecord | null> {
    const row = await this.db.user.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async findByTelegramId(telegramId: string): Promise<UserRecord | null> {
    const row = await this.db.user.findUnique({ where: { telegramId } });
    return row ? toRecord(row) : null;
  }

  async create(input: UpsertTelegramUserInput): Promise<UserRecord> {
    const row = await this.db.user.create({
      data: {
        telegramId: input.telegramId,
        username: input.username ?? null,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        timezone: input.timezone,
        language: input.language,
      },
    });
    return toRecord(row);
  }

  async updateProfile(
    id: string,
    input: Pick<UpsertTelegramUserInput, 'username' | 'firstName' | 'lastName'>,
  ): Promise<UserRecord> {
    const row = await this.db.user.update({
      where: { id },
      data: {
        username: input.username ?? null,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
      },
    });
    return toRecord(row);
  }

  async updateSettings(id: string, input: UpdateUserSettingsInput): Promise<UserRecord> {
    const row = await this.db.user.update({
      where: { id },
      data: {
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.language !== undefined ? { language: input.language } : {}),
        ...(input.reminderEnabled !== undefined ? { reminderEnabled: input.reminderEnabled } : {}),
      },
    });
    return toRecord(row);
  }

  async touchLastSeen(id: string): Promise<void> {
    await this.db.user.update({ where: { id }, data: { lastSeenAt: new Date() } });
  }

  /**
   * `deleteMany` instead of `delete`: erasing your data twice must not explode.
   * The foreign keys cascade, so one statement wipes every dependent row.
   */
  async delete(id: string): Promise<void> {
    await this.db.user.deleteMany({ where: { id } });
  }

  async findUsersWithRemindersEnabled(): Promise<Pick<UserRecord, 'id' | 'timezone' | 'language'>[]> {
    const rows = await this.db.user.findMany({
      where: { reminderEnabled: true },
      select: { id: true, timezone: true, language: true },
    });
    return rows.map((row) => ({
      id: row.id,
      timezone: row.timezone,
      language: toLanguage(row.language),
    }));
  }
}
