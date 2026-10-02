import { t, type Language } from '../../shared/i18n/index.js';
import { escapeHtml } from '../../shared/utils/text.js';
import { JALALI_MONTH_NAMES, toPersianDigits } from '../../shared/utils/date.js';
import type { PickerScreen } from '../keyboards/birthday.js';

export interface PickerTextInput {
  screen: PickerScreen;
  /** The name entered in the first step; the title keeps the screens tied to it. */
  name: string;
  /** Jalali month chosen so far. Present on the day and year screens. */
  month?: number;
  /** Jalali day chosen so far. Present on the year screen. */
  day?: number;
  /** Shown above the year grid when the tapped year cannot exist with that date. */
  error?: string;
}

function monthName(month: number): string {
  return JALALI_MONTH_NAMES[month - 1] ?? String(month);
}

/** `۲ از ۳` — how far through the picker the user is, in Persian digits. */
function pickerStep(screen: PickerScreen, lang: Language): string {
  const done = screen === 'month' ? 0 : screen === 'day' ? 1 : 2;
  return t('picker.subtitle', lang, { done: toPersianDigits(done) });
}

/**
 * The message of a date-picker screen.
 *
 * Three things are on every screen, in this order: which person the date belongs
 * to, exactly what is being asked right now, and what has already been chosen.
 * The "or just type it" line closes each screen, because typing a date is still
 * supported everywhere and must never look forbidden.
 */
export function birthdayPickerText(input: PickerTextInput, lang: Language): string {
  const parts: string[] = [
    t('picker.title', lang, { name: escapeHtml(input.name) }),
    pickerStep(input.screen, lang),
    '',
  ];

  switch (input.screen) {
    case 'month':
      parts.push(t('picker.askMonth', lang));
      break;
    case 'day':
      parts.push(
        t('picker.askDay', lang, { month: monthName(input.month as number) }),
        '',
        t('picker.typeHint', lang),
      );
      break;
    case 'year':
      parts.push(
        t('picker.chosenSoFar', lang, {
          date: `${toPersianDigits(input.day as number)} ${monthName(input.month as number)}`,
        }),
        t('picker.askYear', lang),
      );
      if (input.error) parts.push('', input.error);
      break;
  }

  return parts.join('\n');
}