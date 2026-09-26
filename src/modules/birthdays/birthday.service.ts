import { UPCOMING_LIST_LIMIT } from '../../shared/constants/index.js';
import type { UserRepository } from '../users/user.types.js';
import type { PersonRepository, PersonWithReminders } from '../people/person.types.js';
import { ageOnBirthday, nextOccurrence, todayFor, type BirthdayRule } from './birthday.calc.js';
import { toBirthdayRule } from './birthday.repository.js';
import type { BirthdayListOptions, UpcomingBirthday } from './birthday.types.js';

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
    const [people, user] = await Promise.all([
      this.people.findAllForUser(userId),
      this.users.findById(userId),
    ]);

    if (!user) return [];

    const today = todayFor(user.timezone, options.now);
    const upcoming = people.map((person) => this.withOccurrence(person, today));

    return upcoming
      .sort((a, b) => a.daysUntil - b.daysUntil || a.person.name.localeCompare(b.person.name, 'fa'))
      .slice(0, options.limit ?? UPCOMING_LIST_LIMIT);
  }

  /** People whose birthday is today (0 days). */
  async getTodayForUser(userId: string, options: BirthdayListOptions = {}): Promise<UpcomingBirthday[]> {
    const upcoming = await this.getUpcomingForUser(userId, options);
    return upcoming.filter((item) => item.daysUntil === 0);
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
