import { InlineKeyboard } from 'grammy';
import { t, type Language } from '../../shared/i18n/index.js';
import { JALALI_MONTH_NAMES, jalaliMonthLength, toPersianDigits } from '../../shared/utils/date.js';
import {
  BIRTH_YEAR_PAGE_SIZE,
  MAX_BIRTH_YEAR_JALALI,
  MIN_BIRTH_YEAR_JALALI,
  UNKNOWN_BIRTH_YEAR_JALALI,
} from '../../shared/constants/index.js';
import {
  birthdayBackCallback,
  birthdayDayCallback,
  birthdayMonthCallback,
  birthdayNoYearCallback,
  birthdayPageCallback,
  birthdayYearCallback,
  flowBackCallback,
  navCallback,
} from '../callbacks/data.js';
import { appendRows, grid, type KeypadButton } from './layout.js';

/** Which of the picker's three screens is showing. */
export type PickerScreen = 'month' | 'day' | 'year';

/** What the user has tapped so far. Both fields are optional by construction. */
export interface BirthdayPick {
  month?: number;
  day?: number;
  /**
   * First year of the year page on screen.
   *
   * Not part of the answer, only of what is drawn — but it has to survive a round
   * trip through the database, otherwise every page flip would snap the grid back
   * to the default page and «‹ قبلی» after «بعدی ›» would be a dead button.
   */
  page?: number;
}

/** Three months per row: wide enough for «اردیبهشت» without wrapping on a phone. */
const MONTH_COLUMNS = 3;
/** Seven days per row, the layout every calendar app uses. */
const DAY_COLUMNS = 7;
/** Four years per row, so a year fits next to its age on the same row. */
const YEAR_COLUMNS = 4;

/** The screen implied by what has been chosen so far. */
export function pickerScreen(pick: BirthdayPick): PickerScreen {
  if (!pick.month) return 'month';
  if (!pick.day) return 'day';
  return 'year';
}

/**
 * Days offered for a Jalali month.
 *
 * Esfand keeps all 30 even though the year is picked *after* the day: the domain
 * rule accepts Esfand 30 with an unknown birth year and already observes it on
 * the 29th in common years. Choosing a common year for an Esfand-30 birthday is
 * the single combination that is refused, and the year screen says so instead of
 * silently dropping the day.
 */
export function daysInJalaliMonth(month: number): number {
  if (month < 1 || month > 12) return 0;
  return month === 12 ? 30 : jalaliMonthLength(UNKNOWN_BIRTH_YEAR_JALALI, month);
}

/** First year of every page of the year grid. */
export function birthYearPageStarts(): number[] {
  const starts: number[] = [];
  for (let start = MIN_BIRTH_YEAR_JALALI; start <= MAX_BIRTH_YEAR_JALALI; start += BIRTH_YEAR_PAGE_SIZE) {
    starts.push(start);
  }
  return starts;
}

/** Snaps any year to the page that contains it, so a forged payload cannot escape. */
export function clampBirthYearPage(value: number): number {
  const starts = birthYearPageStarts();
  let nearest = starts[0] ?? MIN_BIRTH_YEAR_JALALI;
  let distance = Number.POSITIVE_INFINITY;

  for (const start of starts) {
    const delta = Math.abs(start - value);
    if (delta < distance) {
      distance = delta;
      nearest = start;
    }
  }

  return nearest;
}

/** Years actually rendered on a page: the tail page is trimmed at the upper bound. */
export function birthYearPage(pageStart: number): number[] {
  const start = clampBirthYearPage(pageStart);
  const years: number[] = [];
  for (let year = start; year < start + BIRTH_YEAR_PAGE_SIZE; year += 1) {
    if (year > MAX_BIRTH_YEAR_JALALI) break;
    years.push(year);
  }
  return years;
}

/**
 * The page the picker opens on.
 *
 * Twenty-five years back is the modal birth year, so the common case is zero
 * taps of paging and only an unusually old or young person has to move.
 */
export function defaultBirthYearPage(todayYear: number): number {
  const target = Math.min(Math.max(todayYear - 25, MIN_BIRTH_YEAR_JALALI), MAX_BIRTH_YEAR_JALALI);
  const starts = birthYearPageStarts();
  let page = starts[0] ?? MIN_BIRTH_YEAR_JALALI;

  for (const start of starts) {
    if (start > target) break;
    page = start;
  }

  return page;
}

/**
 * Exit row of a picker screen.
 *
 * «↩️ یه قدم عقب» walks the picker back one screen and disappears on the first
 * screen, where there is nothing behind it — a button that does nothing is worse
 * than no button. «✏️ اسم» is the way all the way back to the name question
 * without losing anything, and «❌ لغو» leaves the flow entirely.
 */
function pickerFooter(screen: PickerScreen, lang: Language): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  if (screen !== 'month') {
    keyboard.text(t('picker.backScreen', lang), birthdayBackCallback());
  }
  keyboard
    .text(t('picker.editName', lang), flowBackCallback())
    .row()
    .text(t('picker.footerCancel', lang), navCallback('menu'));

  return keyboard;
}

/** Screen 1 of 3: the twelve Jalali months. */
export function birthdayMonthKeyboard(lang: Language = 'fa'): InlineKeyboard {
  const buttons: KeypadButton[] = JALALI_MONTH_NAMES.map((monthName, index) => ({
    label: monthName,
    data: birthdayMonthCallback(index + 1),
  }));

  return appendRows(grid(buttons, MONTH_COLUMNS), pickerFooter('month', lang));
}

/** Screen 2 of 3: the days of the chosen month. */
export function birthdayDayKeyboard(month: number, lang: Language = 'fa'): InlineKeyboard {
  const total = daysInJalaliMonth(month);
  const buttons: KeypadButton[] = Array.from({ length: total }, (_unused, index) => ({
    label: toPersianDigits(index + 1),
    data: birthdayDayCallback(index + 1),
  }));

  return appendRows(grid(buttons, DAY_COLUMNS), pickerFooter('day', lang));
}

/**
 * Screen 3 of 3: the birth year, paged.
 *
 * Each button carries the age it would produce, because the hard part of picking
 * a Jalali year is knowing which number is "my" year. A year older than the user
 * themselves has no meaningful age, so it is rendered as the bare year.
 */
export function birthdayYearKeyboard(
  pageStart: number,
  todayYear: number,
  lang: Language = 'fa',
): InlineKeyboard {
  const start = clampBirthYearPage(pageStart);

  const buttons: KeypadButton[] = birthYearPage(start).map((year) => {
    const age = todayYear - year;
    const year_ = toPersianDigits(year);
    if (age < 0 || age > 120) return { label: year_, data: birthdayYearCallback(year) };
    return {
      label: `${year_}\n${toPersianDigits(age)} ${t('picker.ageUnit', lang)}`,
      data: birthdayYearCallback(year),
    };
  });

  const nav = new InlineKeyboard();

  if (start - BIRTH_YEAR_PAGE_SIZE >= MIN_BIRTH_YEAR_JALALI) {
    nav.text(t('picker.prevPage', lang), birthdayPageCallback(start - BIRTH_YEAR_PAGE_SIZE));
  }

  nav.text(t('picker.noYear', lang), birthdayNoYearCallback());

  if (start + BIRTH_YEAR_PAGE_SIZE <= MAX_BIRTH_YEAR_JALALI) {
    nav.text(t('picker.nextPage', lang), birthdayPageCallback(start + BIRTH_YEAR_PAGE_SIZE));
  }

  return appendRows(appendRows(grid(buttons, YEAR_COLUMNS), nav), pickerFooter('year', lang));
}