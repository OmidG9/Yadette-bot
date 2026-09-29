/**
 * Persian text normalization for search.
 *
 * Users type on whatever keyboard they have: an Arabic layout produces ي (U+064A)
 * and ك (U+0643) where Persian expects ی (U+06CC) and ک (U+06A9). Half-spaces
 * (ZWNJ) appear and vanish depending on the keyboard. Comparing the raw strings
 * would miss "مادر‌لرز" for "مادر لرز".
 *
 * Applied to the query before it reaches the database, and to stored text on
 * write so the two sides converge on one canonical form.
 */

/** Arabic yeh → Persian yeh. */
const ARABIC_YEH = /\u064A/g;
/** Arabic kaf → Persian kaf. */
const ARABIC_KAF = /\u0643/g;
/** Arabic-Indic digits → ASCII. */
const ARABIC_INDIC_DIGITS = /[\u0660-\u0669]/g;
/** Extended Arabic-Indic digits (used by some keyboards) → ASCII. */
const EXTENDED_ARABIC_INDIC_DIGITS = /[\u06F0-\u06F9]/g;

/** Harakat, tanwin, shadda, sukun, superscript alef — cosmetic, never searched on. */
const ARABIC_DIACRITICS = /[\u064B-\u0652\u0670\u0653-\u0655\u0640]/g;
/** Zero-width non-joiner: the half-space. Removed rather than turned into a space. */
const ZERO_WIDTH_NON_JOINER = /[\u200C\u200D]/g;
/** Any remaining invisible formatting character. */
const OTHER_ZERO_WIDTH = /[\u200B-\u200F\uFEFF]/g;

export function normalizePersian(input: string): string {
  return input
    .normalize('NFKC')
    .replace(ARABIC_YEH, '\u06CC')
    .replace(ARABIC_KAF, '\u06A9')
    .replace(EXTENDED_ARABIC_INDIC_DIGITS, (digit) =>
      String(digit.charCodeAt(0) - 0x06f0),
    )
    .replace(ARABIC_INDIC_DIGITS, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(ARABIC_DIACRITICS, '')
    .replace(ZERO_WIDTH_NON_JOINER, '')
    .replace(OTHER_ZERO_WIDTH, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The canonical blob stored alongside a person, so one indexed column answers
 * "does this person match?" instead of an OR across a join.
 */
export function buildSearchText(parts: Array<string | null | undefined>): string {
  return normalizePersian(parts.filter((part): part is string => Boolean(part)).join(' '));
}

/** Shortest query worth running against the database. */
export const MIN_SEARCH_LENGTH = 2;
