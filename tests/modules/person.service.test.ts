import { beforeEach, describe, expect, it } from 'vitest';
import { NotFoundError, ValidationError } from '../../src/shared/errors/index.js';
import { PersonService } from '../../src/modules/people/person.service.js';
import { FakePersonRepository } from '../helpers/fake-person.repository.js';

const ALICE = '1001';
const BOB = '2002';

describe('PersonService', () => {
  let repository: FakePersonRepository;
  let service: PersonService;

  beforeEach(() => {
    repository = new FakePersonRepository();
    service = new PersonService(repository);
  });

  async function createFor(userId: string, name = 'سارا'): Promise<string> {
    const person = await service.create(userId, {
      name,
      birthMonth: 7,
      birthDay: 13,
      birthYear: 1370,
      interests: ['کتاب', 'موسیقی'],
    });
    return person.id;
  }

  describe('create', () => {
    it('cleans the name and applies default reminders', async () => {
      const person = await service.create(ALICE, {
        name: '  سارا  ',
        birthMonth: 7,
        birthDay: 13,
        birthYear: 1370,
      });

      expect(person.name).toBe('سارا');
      // 0 = a reminder on the birthday itself.
      expect(person.reminders.map((item) => item.daysBefore).sort()).toEqual([0, 1, 3, 7]);
      expect(person.userId).toBe(ALICE);
    });

    it('parses interests from a joined list', async () => {
      const person = await service.create(ALICE, {
        name: 'سارا',
        birthMonth: 7,
        birthDay: 13,
        interests: ['کتاب', 'موسیقی'],
      });

      expect(person.interests.map((item) => item.title)).toEqual(['کتاب', 'موسیقی']);
    });

    it('rejects an empty name', async () => {
      await expect(
        service.create(ALICE, { name: '   ', birthMonth: 1, birthDay: 1 }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('rejects an impossible birthday', async () => {
      await expect(
        service.create(ALICE, { name: 'سارا', birthMonth: 13, birthDay: 1 }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('ownership', () => {
    it('lists only the people of the requested user', async () => {
      await createFor(ALICE, 'سارا');
      await createFor(BOB, 'امیر');

      expect(await service.listForUser(ALICE)).toHaveLength(1);
      expect((await service.listForUser(ALICE))[0]!.name).toBe('سارا');
      expect(await service.countForUser(BOB)).toBe(1);
    });

    it('hides another user person behind NotFoundError', async () => {
      const personId = await createFor(ALICE);

      await expect(service.getForUser(BOB, personId)).rejects.toBeInstanceOf(NotFoundError);
      expect(await service.existsForUser(BOB, personId)).toBe(false);
    });

    it('refuses to rename a person owned by someone else', async () => {
      const personId = await createFor(ALICE);

      await expect(service.updateName(BOB, personId, 'هکر')).rejects.toBeInstanceOf(NotFoundError);
      expect((await service.getForUser(ALICE, personId)).name).toBe('سارا');
    });

    it('refuses to change a birthday owned by someone else', async () => {
      const personId = await createFor(ALICE);

      await expect(
        service.updateBirthday(BOB, personId, { month: 1, day: 1 }),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect((await service.getForUser(ALICE, personId)).birthMonth).toBe(7);
    });

    it('refuses to delete a person owned by someone else', async () => {
      const personId = await createFor(ALICE);

      await expect(service.delete(BOB, personId)).rejects.toBeInstanceOf(NotFoundError);
      expect(await service.existsForUser(ALICE, personId)).toBe(true);
    });

    it('refuses to touch interests of a person owned by someone else', async () => {
      const personId = await createFor(ALICE);

      await expect(
        service.replaceInterests(BOB, personId, 'ورزش'),
      ).rejects.toBeInstanceOf(NotFoundError);
      await expect(service.addInterests(BOB, personId, 'ورزش')).rejects.toBeInstanceOf(NotFoundError);
      expect((await service.getForUser(ALICE, personId)).interests).toHaveLength(2);
    });

    it('does not leak interests across users', async () => {
      const alicePerson = await createFor(ALICE);
      const bobPerson = await createFor(BOB, 'امیر');

      await service.replaceInterests(ALICE, alicePerson, 'کتاب');

      expect((await service.getForUser(ALICE, alicePerson)).interests.map((i) => i.title)).toEqual([
        'کتاب',
      ]);
      // Bob keeps his own untouched interests.
      expect((await service.getForUser(BOB, bobPerson)).interests.map((i) => i.title)).toEqual([
        'کتاب',
        'موسیقی',
      ]);
      expect(repository.interestsOf(bobPerson)).toHaveLength(2);
    });
  });

  describe('interests', () => {
    it('ignores duplicates regardless of case', async () => {
      const personId = await createFor(ALICE);

      const { added } = await service.addInterests(ALICE, personId, 'کتاب، سینما');

      expect(added).toEqual(['سینما']);
      expect((await service.getForUser(ALICE, personId)).interests).toHaveLength(3);
    });

    it('rejects an empty interest input', async () => {
      const personId = await createFor(ALICE);

      await expect(service.addInterests(ALICE, personId, '  ')).rejects.toBeInstanceOf(
        ValidationError,
      );
    });

    it('refuses to remove an interest that belongs to another person', async () => {
      const alicePerson = await createFor(ALICE);
      const bobPerson = await createFor(BOB, 'امیر');
      const interest = (await service.getForUser(ALICE, alicePerson)).interests[0]!;

      await expect(
        service.removeInterest(BOB, bobPerson, interest.id),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect((await service.getForUser(ALICE, alicePerson)).interests).toHaveLength(2);
    });
  });

  describe('soft delete', () => {
    it('removes the person from every read path', async () => {
      const personId = await createFor(ALICE);

      await service.delete(ALICE, personId);

      expect(await service.existsForUser(ALICE, personId)).toBe(false);
      expect(await service.listForUser(ALICE)).toHaveLength(0);
      expect(await service.countForUser(ALICE)).toBe(0);
    });
  });
});
