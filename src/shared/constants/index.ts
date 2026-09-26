/** Business constants shared across modules. No user-facing text lives here. */

/** Reminder offsets (in days before the birthday) offered in the MVP. */
export const DEFAULT_REMINDER_DAYS = [7, 3, 1, 0] as const;

/** Hard limit for the reminder offsets a user may configure. */
export const ALLOWED_REMINDER_DAYS = [30, 14, 7, 3, 1, 0] as const;

/** How many upcoming birthdays are listed in the "upcoming" views. */
export const UPCOMING_LIST_LIMIT = 20;

/** Maximum number of people shown in the "people" list per page. */
export const PEOPLE_PAGE_SIZE = 8;

/** Maximum number of interests that can be attached to one person. */
export const MAX_INTERESTS_PER_PERSON = 20;

/** Maximum length of a person's name. */
export const MAX_NAME_LENGTH = 60;

/** Maximum length of a free-text note. */
export const MAX_NOTES_LENGTH = 1000;

/** Maximum length of a single interest. */
export const MAX_INTEREST_LENGTH = 40;

/**
 * Year used to store month/day-only birthdays (when the user does not know or
 * want to give the birth year). 2000 is a Gregorian leap year, so 29 February
 * is representable; 1399 is the equivalent Jalali leap year.
 */
export const UNKNOWN_BIRTH_YEAR_GREGORIAN = 2000;
export const UNKNOWN_BIRTH_YEAR_JALALI = 1399;

export const SUPPORTED_LANGUAGES = ['fa'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
