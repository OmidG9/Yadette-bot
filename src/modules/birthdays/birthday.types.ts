import type { BirthdayOccurrence, BirthdayRule } from './birthday.calc.js';
import type { PersonWithReminders } from '../people/person.types.js';

/** A person plus their next yearly occurrence, in the owner's timezone. */
export interface UpcomingBirthday {
  person: PersonWithReminders;
  rule: BirthdayRule;
  occurrence: BirthdayOccurrence;
  /** Days until the next occurrence (0 = today). */
  daysUntil: number;
  /** Age in Jalali years, or `null` when the birth year is unknown. */
  age: number | null;
}

export interface BirthdayListOptions {
  limit?: number;
  now?: Date;
}
