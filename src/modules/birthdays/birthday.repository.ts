import type { PersonRecord } from '../people/person.types.js';
import type { BirthdayRule } from './birthday.calc.js';

/**
 * The boundary between persisted rows and the birthday domain.
 *
 * Birthdays are stored as a Jalali month/day rule, so this is the only place
 * that knows how a `Person` row becomes a `BirthdayRule`.
 */
export function toBirthdayRule(person: Pick<PersonRecord, 'birthMonth' | 'birthDay' | 'birthYear'>): BirthdayRule {
  return { month: person.birthMonth, day: person.birthDay, year: person.birthYear };
}
