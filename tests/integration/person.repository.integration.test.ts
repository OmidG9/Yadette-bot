import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { NotFoundError } from '../../src/shared/errors/index.js';
import {
  db,
  disconnectTestDatabase,
  repositories,
  resetDatabase,
  seedPerson,
  seedUser,
} from './helpers/database.js';

const { users, persons } = repositories();

afterAll(disconnectTestDatabase);
beforeEach(resetDatabase);

describe('PrismaPersonRepository (real database)', () => {
  describe('create', () => {
    it('persists the person with nested interests and reminders', async () => {
      const user = await seedUser(users);

      const person = await persons.create({
        userId: user.id,
        name: 'علی',
        birthMonth: 7,
        birthDay: 18,
        birthYear: 1380,
        notes: 'همکار قدیمی',
        interests: ['فوتبال', 'موسیقی'],
        reminderDays: [7, 1, 0],
      });

      expect(person.id).toBeTruthy();
      expect(person.deletedAt).toBeNull();
      expect(person.interests.map((interest) => interest.title)).toEqual(['فوتبال', 'موسیقی']);
      expect(person.reminders.map((reminder) => reminder.daysBefore)).toEqual([7, 1, 0]);
    });

    it('accepts a null birth year and a null note', async () => {
      const user = await seedUser(users);

      const person = await persons.create({
        userId: user.id,
        name: 'نامشخص',
        birthMonth: 1,
        birthDay: 1,
        birthYear: null,
        notes: null,
      });

      expect(person.birthYear).toBeNull();
      expect(person.notes).toBeNull();
    });

    it('rejects a duplicate interest title within one person', async () => {
      const user = await seedUser(users);

      await expect(
        persons.create({
          userId: user.id,
          name: 'تکراری',
          birthMonth: 7,
          birthDay: 18,
          birthYear: 1380,
          interests: ['فوتبال', 'فوتبال'],
        }),
      ).rejects.toThrow();
    });

    it('allows the same interest title on different people', async () => {
      const user = await seedUser(users);
      await seedPerson(persons, user.id, { name: 'علی', interests: ['فوتبال'] });
      await seedPerson(persons, user.id, { name: 'سارا', interests: ['فوتبال'] });

      expect(await db.interest.count({ where: { title: 'فوتبال' } })).toBe(2);
    });
  });

  describe('findByIdForUser — ownership', () => {
    it('returns the person for its owner', async () => {
      const user = await seedUser(users);
      const person = await seedPerson(persons, user.id);

      const found = await persons.findByIdForUser(person.id, user.id);

      expect(found?.name).toBe(person.name);
    });

    it('returns null for a different user', async () => {
      const owner = await seedUser(users);
      const attacker = await seedUser(users);
      const person = await seedPerson(persons, owner.id);

      expect(await persons.findByIdForUser(person.id, attacker.id)).toBeNull();
    });

    it('returns null for a soft-deleted person even for the owner', async () => {
      const user = await seedUser(users);
      const person = await seedPerson(persons, user.id);

      await persons.softDelete(person.id, user.id);

      expect(await persons.findByIdForUser(person.id, user.id)).toBeNull();
    });
  });

  describe('findAllForUser', () => {
    it('orders by name and excludes soft-deleted rows', async () => {
      const user = await seedUser(users);
      const other = await seedUser(users);
      await seedPerson(persons, user.id, { name: 'محمود' });
      await seedPerson(persons, user.id, { name: 'الهام' });
      const hidden = await seedPerson(persons, user.id, { name: 'زهرا' });
      await seedPerson(persons, other.id, { name: 'محرم' });
      await persons.softDelete(hidden.id, user.id);

      const names = (await persons.findAllForUser(user.id)).map((person) => person.name);

      expect(names).toEqual(['الهام', 'محمود']);
    });
  });

  describe('update', () => {
    it('applies a partial update without clearing untouched fields', async () => {
      const user = await seedUser(users);
      const person = await seedPerson(persons, user.id, { notes: 'یادداشت قبلی' });

      const updated = await persons.update(person.id, user.id, { name: 'علی رضایی' });

      expect(updated.name).toBe('علی رضایی');
      expect(updated.notes).toBe('یادداشت قبلی');
      expect(updated.birthMonth).toBe(7);
    });

    it('can clear the birth year back to null', async () => {
      const user = await seedUser(users);
      const person = await seedPerson(persons, user.id);

      const updated = await persons.update(person.id, user.id, { birthYear: null });

      expect(updated.birthYear).toBeNull();
    });

    it('throws NotFoundError when the person belongs to someone else', async () => {
      const owner = await seedUser(users);
      const attacker = await seedUser(users);
      const person = await seedPerson(persons, owner.id);

      await expect(
        persons.update(person.id, attacker.id, { name: ' hijack ' }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('throws NotFoundError for a soft-deleted person', async () => {
      const user = await seedUser(users);
      const person = await seedPerson(persons, user.id);
      await persons.softDelete(person.id, user.id);

      await expect(persons.update(person.id, user.id, { name: 'زنده شدم' })).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe('softDelete', () => {
    it('stamps deletedAt and reports success once', async () => {
      const user = await seedUser(users);
      const person = await seedPerson(persons, user.id);

      expect(await persons.softDelete(person.id, user.id)).toBe(true);
      expect(await persons.softDelete(person.id, user.id)).toBe(false);
    });

    it('refuses when the person belongs to someone else', async () => {
      const owner = await seedUser(users);
      const attacker = await seedUser(users);
      const person = await seedPerson(persons, owner.id);

      expect(await persons.softDelete(person.id, attacker.id)).toBe(false);
      expect(await db.person.count({ where: { id: person.id, deletedAt: null } })).toBe(1);
    });

    it('is excluded from countForUser', async () => {
      const user = await seedUser(users);
      await seedPerson(persons, user.id, { name: 'الف' });
      const second = await seedPerson(persons, user.id, { name: 'ب' });

      expect(await persons.countForUser(user.id)).toBe(2);

      await persons.softDelete(second.id, user.id);

      expect(await persons.countForUser(user.id)).toBe(1);
    });
  });

  describe('addInterests', () => {
    it('appends new titles', async () => {
      const user = await seedUser(users);
      const person = await seedPerson(persons, user.id, { interests: ['کتاب'] });

      const created = await persons.addInterests(person.id, ['موسیقی']);

      expect(created.map((interest) => interest.title)).toEqual(['موسیقی']);
    });

    it('skips duplicates instead of throwing', async () => {
      const user = await seedUser(users);
      const person = await seedPerson(persons, user.id, { interests: ['کتاب'] });

      const created = await persons.addInterests(person.id, ['کتاب', 'موسیقی']);

      expect(created.map((interest) => interest.title)).toEqual(
        expect.arrayContaining(['کتاب', 'موسیقی']),
      );
      expect(await db.interest.count({ where: { personId: person.id } })).toBe(2);
    });

    it('returns nothing for an empty list without touching the database', async () => {
      const user = await seedUser(users);
      const person = await seedPerson(persons, user.id, { interests: ['کتاب'] });

      expect(await persons.addInterests(person.id, [])).toEqual([]);
      expect(await db.interest.count({ where: { personId: person.id } })).toBe(1);
    });
  });

  describe('removeInterest', () => {
    it('deletes an interest belonging to the person', async () => {
      const user = await seedUser(users);
      const person = await seedPerson(persons, user.id, { interests: ['کتاب', 'موسیقی'] });
      const stored = await db.interest.findFirstOrThrow({ where: { personId: person.id } });

      expect(await persons.removeInterest(stored.id, person.id)).toBe(true);
      expect(await db.interest.count({ where: { personId: person.id } })).toBe(1);
    });

    it('refuses to remove an interest from another person', async () => {
      const user = await seedUser(users);
      const mine = await seedPerson(persons, user.id, { interests: ['کتاب'] });
      const theirs = await seedPerson(persons, user.id, { interests: ['فوتبال'] });
      const stored = await db.interest.findFirstOrThrow({ where: { personId: theirs.id } });

      expect(await persons.removeInterest(stored.id, mine.id)).toBe(false);
      expect(await db.interest.count({ where: { id: stored.id } })).toBe(1);
    });
  });

  describe('replaceInterests', () => {
    it('swaps the whole set atomically', async () => {
      const user = await seedUser(users);
      const person = await seedPerson(persons, user.id, { interests: ['کتاب', 'موسیقی'] });

      const replaced = await persons.replaceInterests(person.id, ['فوتبال']);

      expect(replaced.map((interest) => interest.title)).toEqual(['فوتبال']);
      expect(await db.interest.count({ where: { personId: person.id } })).toBe(1);
    });

    it('clears every interest when given an empty list', async () => {
      const user = await seedUser(users);
      const person = await seedPerson(persons, user.id, { interests: ['کتاب', 'موسیقی'] });

      expect(await persons.replaceInterests(person.id, [])).toEqual([]);
      expect(await db.interest.count({ where: { personId: person.id } })).toBe(0);
    });
  });
});
