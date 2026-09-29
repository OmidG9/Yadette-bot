import { UPCOMING_LIST_LIMIT } from '../../shared/constants/index.js';
import type { UserRepository } from '../users/user.types.js';
import type { PersonRepository, PersonWithReminders } from '../people/person.types.js';
import { ageOnBirthday, nextOccurrence, todayFor, type BirthdayRule } from './birthday.calc.js';
import { buildMonth, type BirthdayMonth } from './calendar.js';
import { toBirthdayRule } from './birthday.repository.js';
import {
  DASHBOARD_LATER_LIMIT,
  DASHBOARD_WEEK_DAYS,
  type BirthdayBuckets,
} from './dashboard.types.js';
import type { BirthdayListOptions, UpcomingBirthday } from './birthday.types.js';
import type { JalaliDate } from '../../shared/utils/date.js';

/** Everything the read model needs, computed once per request. */
interface OccurrenceContext {
  /** All people, sorted by next occurrence. Never truncated. */
  all: UpcomingBirthday[];
  today: ReturnType<typeof todayFor>;
}

/** Ceiling on search results, so one broad query cannot produce a 4000-character message. */
const SEARCH_RESULT_LIMIT = 20;

/** "No limit" — a month has to see every birthday, not just the next twenty. */
const UNLIMITED = Number.MAX_SAFE_INTEGER;

/**
 * Read model for birthdays.
 *
 * Occurrences are always computed in the owner's timezone, never the server's.
 */
export class BirthdayService {
  constructor(
    private readonly people: PersonRepository,
    private readonly users: UserRepository,
  ) {}

  /** Upcoming birthdays for a user, sorted by the next yearly occurrence. */
  async getUpcomingForUser(
    userId: string,
    options: BirthdayListOptions = {},
  ): Promise<UpcomingBirthday[]> {
    const context = await this.occurrencesForUser(userId, options);
    if (!context) return [];
    return context.all.slice(0, options.limit ?? UPCOMING_LIST_LIMIT);
  }

  /**
   * People whose birthday is today.
   *
   * Buckets before slicing: filtering a truncated list would silently hide
   * today's birthday once a user has more people than the list limit.
   */
  async getTodayForUser(userId: string, options: BirthdayListOptions = {}): Promise<UpcomingBirthday[]> {
    const context = await this.occurrencesForUser(userId, options);
    if (!context) return [];
    return context.all.filter((item) => item.daysUntil === 0);
  }

  /** §3.1 — the home screen buckets, plus the summary numbers above them. */
  async getDashboardForUser(
    userId: string,
    options: BirthdayListOptions = {},
  ): Promise<BirthdayBuckets | null> {
    const context = await this.occurrencesForUser(userId, options);
    if (!context) return null;

    const { all, today } = context;

    return {
      today: all.filter((item) => item.daysUntil === 0),
      thisWeek: all.filter((item) => item.daysUntil > 0 && item.daysUntil <= DASHBOARD_WEEK_DAYS),
      later: all.filter((item) => item.daysUntil > DASHBOARD_WEEK_DAYS).slice(0, DASHBOARD_LATER_LIMIT),
      nextBirthday: all[0] ?? null,
      thisMonthCount: all.filter(
        (item) =>
          item.occurrence.jalali.jy === today.jy && item.occurrence.jalali.jm === today.jm,
      ).length,
      totalPeople: await this.people.countForUser(userId),
      jalaliYear: today.jy,
      jalaliMonth: today.jm,
    };
  }

  /**
   * §3.3 — search by name, interest or note, with birthday context attached.
   *
   * Lives here rather than on the people service because a search result is
   * useless without "when is their next birthday" — the whole point of finding
   * someone is to decide what to buy them.
   */
  async searchForUser(
    userId: string,
    query: string,
    options: BirthdayListOptions = {},
  ): Promise<{ items: UpcomingBirthday[]; query: string }> {
    const [people, user] = await Promise.all([
      this.people.searchForUser(userId, query, options.limit ?? SEARCH_RESULT_LIMIT),
      this.users.findById(userId),
    ]);

    if (!user) return { items: [], query };

    const today = todayFor(user.timezone, options.now);
    const items = people
      .map((person) => this.withOccurrence(person, today))
      .sort((a, b) => a.daysUntil - b.daysUntil || a.person.name.localeCompare(b.person.name, 'fa'));

    return { items, query };
  }

  /**
   * §3.2 — a Jalali month of birthdays.
   *
   * Defaults to the owner's current month. Paging is absolute (the caller sends
   * the year and month it wants), so tapping «قبلی» three times and then «بعدی»
   * once lands where the user expects instead of drifting.
   */
  async getCalendarForUser(
    userId: string,
    target?: { year: number; month: number },
    options: BirthdayListOptions = {},
  ): Promise<{ month: BirthdayMonth; today: JalaliDate } | null> {
    const user = await this.users.findById(userId);
    if (!user) return null;

    const today = todayFor(user.timezone, options.now);
    const { year, month } = target ?? { year: today.jy, month: today.jm };

    const items = await this.getUpcomingForUser(userId, { ...options, limit: UNLIMITED });
    return { month: buildMonth(items, year, month), today };
  }

  /** The next occurrence of a single person, in the owner's timezone. */
  async getOccurrenceForPerson(
    userId: string,
    person: PersonWithReminders,
    now?: Date,
  ): Promise<UpcomingBirthday> {
    const user = await this.users.findById(userId);
    const timezone = user?.timezone ?? 'UTC';
    return this.withOccurrence(person, todayFor(timezone, now));
  }

  /**
   * Loads every person with their next occurrence, sorted and untruncated.
   *
   * Returns `null` when the user row is gone (deleted mid-request, or a stale
   * id from a keyboard). Callers treat that as "nothing to show".
   */
  private async occurrencesForUser(
    userId: string,
    options: BirthdayListOptions,
  ): Promise<OccurrenceContext | null> {
    const [people, user] = await Promise.all([
      this.people.findAllForUser(userId),
      this.users.findById(userId),
    ]);

    if (!user) return null;

    const today = todayFor(user.timezone, options.now);
    const all = people
      .map((person) => this.withOccurrence(person, today))
      .sort((a, b) => a.daysUntil - b.daysUntil || a.person.name.localeCompare(b.person.name, 'fa'));

    return { all, today };
  }

  private withOccurrence(person: PersonWithReminders, today: ReturnType<typeof todayFor>): UpcomingBirthday {
    const rule: BirthdayRule = toBirthdayRule(person);
    const occurrence = nextOccurrence(rule, today);
    return {
      person,
      rule,
      occurrence,
      daysUntil: occurrence.daysUntil,
      age: ageOnBirthday(rule, occurrence.jalaliYear),
    };
  }
}
