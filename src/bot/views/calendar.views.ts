import { InlineKeyboard } from 'grammy';
import { t, type Language } from '../../shared/i18n/index.js';
import { calendarMonthCallback, navCallback } from '../callbacks/data.js';
import { escapeHtml, truncate } from '../../shared/utils/text.js';
import { toPersianDigits, type JalaliDate } from '../../shared/utils/date.js';
import { monthName, shiftMonth, type BirthdayMonth } from '../../modules/birthdays/calendar.js';

/** §3.2 — one Jalali month, listed day by day. */
export function calendarText(month: BirthdayMonth, lang: Language): string {
  const parts: string[] = [
    t('calendar.title', lang),
    t('calendar.monthHeading', lang, {
      monthName: monthName(month.jalaliMonth),
      year: toPersianDigits(month.jalaliYear),
    }),
    '',
  ];

  if (month.days.length === 0) {
    parts.push(t('calendar.empty', lang));
  } else {
    for (const day of month.days) {
      parts.push(
        t('calendar.day', lang, {
          day: toPersianDigits(day.day),
          monthName: monthName(month.jalaliMonth),
          names: day.names.map((name) => escapeHtml(truncate(name, 30))).join('، '),
        }),
      );
    }
  }

  parts.push('', t('calendar.legend', lang));
  return parts.join('\n');
}

/**
 * Month paging.
 *
 * The current month gets a shortcut button, and paging back stops at the
 * current month: a birthday calendar has no use for the year the user was born.
 */
export function calendarKeyboard(
  month: BirthdayMonth,
  today: JalaliDate,
  lang: Language,
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const previous = shiftMonth(month.jalaliYear, month.jalaliMonth, -1);
  const isCurrentMonth = month.jalaliYear === today.jy && month.jalaliMonth === today.jm;

  if (isCurrentMonth) {
    keyboard.text(t('calendar.thisMonth', lang), navCallback('dashboard'));
  } else {
    keyboard.text(
      t('calendar.prevMonth', lang),
      calendarMonthCallback(previous.jy, previous.jm),
    );
  }

  const next = shiftMonth(month.jalaliYear, month.jalaliMonth, 1);
  keyboard.text(t('calendar.nextMonth', lang), calendarMonthCallback(next.jy, next.jm));

  return keyboard.row().text(t('buttons.home'), navCallback('menu'));
}
