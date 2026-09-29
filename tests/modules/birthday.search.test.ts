import { beforeEach, describe, expect, it } from 'vitest';
import { BirthdayService } from '../../src/modules/birthdays/birthday.service.js';
import { FakePersonRepository } from '../helpers/fake-person.repository.js';
import { FakeUserRepository, fakeUser } from '../helpers/fakes.js';
import { MIN_SEARCH_LENGTH, buildSearchText, normalizePersian } from '../../src/shared/utils/persian.js';

/** 5 Aban 1405. */
const NOW = new Date('2026-11-26T09:00:00.000Z');

const user = fakeUser();

describe('normalizePersian', () => {
  /**
   * People type Arabic keyboards and Persian keyboards interchangeably, and they
   * paste from anywhere. If search compares raw bytes, the same name simply
   * will not be found, which looks like data loss to the user.
   */
  it('folds the Arabic and Persian yeh and kaf onto one spelling', () => {
    expect(normalizePersian('كتاب')).toBe(normalizePersian('کتاب'));
    expect(normalizePersian('ياسمن')).toBe(normalizePersian('یاسمن'));
  });

  it('strips the diacritics Persian input carries freely', () => {
    expect(normalizePersian('مُحَمَّد')).toBe('محمد');
  });

  /** ZWNJ is invisible, so "کتاب" and "ک تاب" must not be different people. */
  it('collapses whitespace including the zero-width non-joiner', () => {
    expect(normalizePersian('میرود')).toBe(normalizePersian('میرود'));
    expect(normalizePersian('  علی   رضا  ')).toBe(normalizePersian('علی رضا'));
  });

  it('converts Arabic-Indic digits so a typed date still matches', () => {
    expect(normalizePersian('۱۳۸۰')).toBe('1380');
    expect(normalizePersian('١٣٨٠')).toBe('1380');
  });

  it('is idempotent, so normalizing twice changes nothing', () => {
    const once = normalizePersian('كِتاب‌ها');
    expect(normalizePersian(once)).toBe(once);
  });

  it('leaves an empty or whitespace-only query empty', () => {
    expect(normalizePersian('')).toBe('');
    expect(normalizePersian('   ')).toBe('');
  });
});

describe('buildSearchText', () => {
  it('joins the searchable fields and ignores the empty ones', () => {
    expect(buildSearchText(['Sara', null, 'chess'])).toBe(normalizePersian('Sara chess'));
  });

  it('does not let a missing field become a stray separator', () => {
    expect(buildSearchText(['Sara', null, null])).toBe(normalizePersian('Sara'));
  });
});

describe('BirthdayService.searchForUser', () => {
  let people: FakePersonRepository;
  let service: BirthdayService;

  beforeEach(() => {
    people = new FakePersonRepository();
    service = new BirthdayService(people, new FakeUserRepository([user]));
  });

  async function add(
    name: string,
    birth: { month: number; day: number },
    extra: { interests?: string[]; notes?: string } = {},
    ownerId = user.id,
  ): Promise<void> {
    await people.create({
      userId: ownerId,
      name,
      birthMonth: birth.month,
      birthDay: birth.day,
      birthYear: null,
      ...extra,
    });
  }

  async function seed(): Promise<void> {
    await add(
      'یاسمن',
      { month: 11, day: 30 },
      { interests: ['کتاب', 'موسیقی'], notes: 'دوست دوران دانشگاه' },
    );
    await add('امیر', { month: 12, day: 5 }, { interests: ['فوتبال'] });
  }

  it('matches on the name', async () => {
    await seed();
    const result = await service.searchForUser(user.id, 'یاسمن', { now: NOW });

    expect(result.items.map((item) => item.person.name)).toEqual(['یاسمن']);
  });

  it('matches on an interest, not only the name', async () => {
    await seed();
    const result = await service.searchForUser(user.id, 'موسیقی', { now: NOW });

    expect(result.items.map((item) => item.person.name)).toEqual(['یاسمن']);
  });

  it('matches on a note', async () => {
    await seed();
    const result = await service.searchForUser(user.id, 'دانشگاه', { now: NOW });

    expect(result.items.map((item) => item.person.name)).toEqual(['یاسمن']);
  });

  it('matches across the Arabic/Persian keyboard spellings of the same word', async () => {
    await seed();
    // Stored with a Persian kaf; the user types the Arabic one.
    const result = await service.searchForUser(user.id, 'كتاب', { now: NOW });

    expect(result.items.map((item) => item.person.name)).toEqual(['یاسمن']);
  });

  it('attaches the next birthday, which is why this lives on the birthday service', async () => {
    await seed();
    const result = await service.searchForUser(user.id, 'یاسمن', { now: NOW });

    expect(result.items[0]!.daysUntil).toBeGreaterThan(0);
    expect(result.items[0]!.occurrence.jalali.jm).toBe(11);
  });

  it('orders results by how soon the birthday is', async () => {
    // Today is Azar 5 1405. A shared interest makes both match, so only the
    // ordering is under test: Azar 6 is tomorrow, Azar 29 is in 24 days.
    await add('b', { month: 9, day: 6 }, { interests: ['مشترک'] });
    await add('a', { month: 9, day: 29 }, { interests: ['مشترک'] });

    const result = await service.searchForUser(user.id, 'مشترک', { now: NOW });

    // The nearer birthday wins even though its name sorts later.
    expect(result.items.map((item) => item.daysUntil)).toEqual([1, 24]);
    expect(result.items.map((item) => item.person.name)).toEqual(['b', 'a']);
  });

  it('returns nothing for a query shorter than the minimum', async () => {
    await seed();
    const result = await service.searchForUser(user.id, 'ب', { now: NOW });

    expect(MIN_SEARCH_LENGTH).toBe(2);
    expect(result.items).toEqual([]);
  });

  it('returns nothing when no one matches', async () => {
    await seed();
    const result = await service.searchForUser(user.id, 'کسی‌نیست', { now: NOW });

    expect(result.items).toEqual([]);
  });

  it('never leaks another user’s people', async () => {
    await add('یاسمن', { month: 11, day: 30 }, {}, 'other');
    await seed();

    const result = await service.searchForUser(user.id, 'یاسمن', { now: NOW });

    // Only the owner's own Yasmine, matched once.
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.person.userId).toBe(user.id);
  });

  it('does not match a soft-deleted person', async () => {
    const person = await people.create({
      userId: user.id, name: 'حذف‌شده', birthMonth: 9, birthDay: 6, birthYear: null,
    });
    await people.softDelete(person.id, user.id);

    const result = await service.searchForUser(user.id, 'حذف', { now: NOW });

    expect(result.items).toEqual([]);
  });
});
