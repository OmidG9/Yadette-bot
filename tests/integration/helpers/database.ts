import { PrismaClient } from '@prisma/client';

import { PrismaFlowStore } from '../../../src/bot/conversations/flow.store.js';
import { PrismaPersonRepository } from '../../../src/modules/people/person.repository.js';
import { PrismaReminderRepository } from '../../../src/modules/reminders/reminder.repository.js';
import { PrismaSettingsRepository } from '../../../src/modules/settings/settings.repository.js';
import { PrismaUserRepository } from '../../../src/modules/users/user.repository.js';
import type { PersonRepository } from '../../../src/modules/people/person.types.js';
import type { ReminderRepository } from '../../../src/modules/reminders/reminder.types.js';
import type {
  UserRepository,
  UpsertTelegramUserInput,
} from '../../../src/modules/users/user.types.js';

/**
 * A real Prisma client for integration tests.
 *
 * The repositories under test are the production classes, so these tests cover
 * the parts unit tests with fakes cannot: unique-constraint races, cascade
 * deletes, `skipDuplicates` semantics, and transaction behaviour.
 */
export const db = new PrismaClient();

export async function disconnectTestDatabase(): Promise<void> {
  await db.$disconnect();
}

/** Tables in dependency-safe order; `CASCADE` makes the order irrelevant. */
const TABLES = [
  'NotificationLog',
  'Reminder',
  'Interest',
  'UserFlowState',
  'Person',
  'User',
] as const;

/**
 * Wipes every row so each test case starts from a known-empty database.
 *
 * This is why `resolveTestDatabaseUrl` refuses to run when the test URL and
 * `DATABASE_URL` name the same database.
 */
export async function resetDatabase(): Promise<void> {
  await db.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((table) => `"${table}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
}

let telegramIdCounter = 0;

/** Distinct `telegramId` per call, since `User.telegramId` is unique. */
export function nextTelegramId(): string {
  telegramIdCounter += 1;
  return `9000000${telegramIdCounter.toString().padStart(4, '0')}`;
}

export function userInput(
  overrides: Partial<UpsertTelegramUserInput> = {},
): UpsertTelegramUserInput {
  return {
    telegramId: nextTelegramId(),
    username: null,
    firstName: null,
    lastName: null,
    timezone: 'Asia/Tehran',
    language: 'fa',
    ...overrides,
  };
}

/** Real repositories, wired to the test database. */
export function repositories(): {
  users: UserRepository;
  persons: PersonRepository;
  reminders: ReminderRepository;
  settings: PrismaSettingsRepository;
  flowStore: PrismaFlowStore;
} {
  return {
    users: new PrismaUserRepository(db),
    persons: new PrismaPersonRepository(db),
    reminders: new PrismaReminderRepository(db),
    settings: new PrismaSettingsRepository(db),
    flowStore: new PrismaFlowStore(db),
  };
}

/** Creates a user and returns the record, for tests that need an owner. */
export async function seedUser(
  users: UserRepository,
  overrides: Partial<UpsertTelegramUserInput> = {},
): Promise<{ id: string; telegramId: string }> {
  const created = await users.create(userInput(overrides));
  return { id: created.id, telegramId: created.telegramId };
}

/** Creates a person plus the given enabled reminder offsets. */
export async function seedPerson(
  persons: PersonRepository,
  userId: string,
  overrides: Partial<{
    name: string;
    birthMonth: number;
    birthDay: number;
    birthYear: number | null;
    notes: string | null;
    interests: string[];
    reminderDays: number[];
  }> = {},
): Promise<{ id: string; name: string }> {
  const created = await persons.create({
    userId,
    name: 'علی',
    birthMonth: 7,
    birthDay: 18,
    birthYear: 1380,
    notes: null,
    interests: [],
    reminderDays: [],
    ...overrides,
  });
  return { id: created.id, name: created.name };
}
