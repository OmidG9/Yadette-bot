import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  db,
  disconnectTestDatabase,
  repositories,
  resetDatabase,
  seedPerson,
  seedUser,
  userInput,
} from './helpers/database.js';

const { users, persons, settings } = repositories();

afterAll(disconnectTestDatabase);
beforeEach(resetDatabase);

describe('PrismaUserRepository (real database)', () => {
  describe('create / findByTelegramId', () => {
    it('round-trips a user', async () => {
      const input = userInput({ username: 'ali', firstName: 'علی', lastName: 'رضایی' });

      const created = await users.create(input);
      const found = await users.findByTelegramId(created.telegramId);

      expect(found?.id).toBe(created.id);
      expect(found?.username).toBe('ali');
      expect(found?.reminderEnabled).toBe(true);
    });

    it('rejects a duplicate telegramId', async () => {
      const input = userInput();
      await users.create(input);

      await expect(users.create(input)).rejects.toThrow();
      expect(await db.user.count({ where: { telegramId: input.telegramId } })).toBe(1);
    });

    it('falls back to the default language for an unknown stored value', async () => {
      const input = userInput();
      const created = await users.create(input);
      await db.user.update({ where: { id: created.id }, data: { language: 'en' } });

      const found = await users.findById(created.id);

      expect(found?.language).toBe('fa');
    });

    it('returns null for an unknown id', async () => {
      expect(await users.findById('missing')).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('replaces the profile fields', async () => {
      const user = await seedUser(users);

      const updated = await users.updateProfile(user.id, {
        username: 'sara',
        firstName: 'سارا',
        lastName: null,
      });

      expect(updated.username).toBe('sara');
      expect(updated.firstName).toBe('سارا');
      expect(updated.lastName).toBeNull();
    });
  });

  describe('updateSettings', () => {
    it('updates only the provided keys', async () => {
      const user = await seedUser(users);

      const updated = await users.updateSettings(user.id, { timezone: 'Asia/Tehran' });

      expect(updated.timezone).toBe('Asia/Tehran');
      expect(updated.reminderEnabled).toBe(true);
    });

    it('toggles reminders off and on', async () => {
      const user = await seedUser(users);

      await users.updateSettings(user.id, { reminderEnabled: false });
      expect((await users.findById(user.id))?.reminderEnabled).toBe(false);

      await users.updateSettings(user.id, { reminderEnabled: true });
      expect((await users.findById(user.id))?.reminderEnabled).toBe(true);
    });
  });

  describe('touchLastSeen', () => {
    it('stamps lastSeenAt', async () => {
      const user = await seedUser(users);
      expect((await users.findById(user.id))?.lastSeenAt).toBeNull();

      await users.touchLastSeen(user.id);

      expect((await users.findById(user.id))?.lastSeenAt).toBeInstanceOf(Date);
    });
  });

  describe('delete — data erasure', () => {
    it('cascades to people, interests, reminders, logs and flow state', async () => {
      const user = await seedUser(users);
      const person = await seedPerson(persons, user.id, {
        interests: ['کتاب'],
        reminderDays: [7, 0],
      });
      await db.notificationLog.create({
        data: { userId: user.id, personId: person.id, birthdayYear: 1405, daysBefore: 0 },
      });
      await settings.updateSettings(user.id, { timezone: 'UTC' });
      await db.userFlowState.create({
        data: { userId: user.id, flow: 'add-person', step: 'name', data: {} },
      });

      await users.delete(user.id);

      expect(await db.user.count()).toBe(0);
      expect(await db.person.count()).toBe(0);
      expect(await db.interest.count()).toBe(0);
      expect(await db.reminder.count()).toBe(0);
      expect(await db.notificationLog.count()).toBe(0);
      expect(await db.userFlowState.count()).toBe(0);
    });

    it('is idempotent', async () => {
      const user = await seedUser(users);

      await users.delete(user.id);

      await expect(users.delete(user.id)).resolves.toBeUndefined();
    });

    it('leaves other users untouched', async () => {
      const erased = await seedUser(users);
      const survivor = await seedUser(users);
      await seedPerson(persons, survivor.id);

      await users.delete(erased.id);

      expect(await db.user.count({ where: { id: survivor.id } })).toBe(1);
      expect(await persons.countForUser(survivor.id)).toBe(1);
    });
  });

  describe('findUsersWithRemindersEnabled', () => {
    it('returns only users whose reminders are on', async () => {
      const enabled = await seedUser(users);
      const disabled = await seedUser(users);
      await users.updateSettings(disabled.id, { reminderEnabled: false });

      const result = await users.findUsersWithRemindersEnabled();

      expect(result.map((user) => user.id)).toEqual([enabled.id]);
    });

    it('returns only the three scheduler-relevant fields', async () => {
      await seedUser(users);

      const [row] = await users.findUsersWithRemindersEnabled();

      expect(Object.keys(row!).sort()).toEqual(['id', 'language', 'timezone']);
    });
  });
});

describe('PrismaSettingsRepository (real database)', () => {
  it('reads the settings columns', async () => {
    const user = await seedUser(users);

    const found = await settings.findSettings(user.id);

    expect(found).toEqual({ timezone: 'Asia/Tehran', language: 'fa', reminderEnabled: true });
  });

  it('returns null for an unknown user', async () => {
    expect(await settings.findSettings('missing')).toBeNull();
  });

  it('applies a partial update and leaves other keys alone', async () => {
    const user = await seedUser(users);

    const updated = await settings.updateSettings(user.id, { reminderEnabled: false });

    expect(updated.reminderEnabled).toBe(false);
    expect(updated.timezone).toBe('Asia/Tehran');
  });

  it('changes the timezone without touching reminders', async () => {
    const user = await seedUser(users);

    const updated = await settings.updateSettings(user.id, { timezone: 'Europe/Berlin' });

    expect(updated.timezone).toBe('Europe/Berlin');
    expect(updated.reminderEnabled).toBe(true);
  });
});
