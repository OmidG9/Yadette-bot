import { t, type Language } from '../../shared/i18n/index.js';
import {
  JALALI_MONTH_NAMES,
  formatDaysUntil,
  formatJalali,
  toPersianDigits,
} from '../../shared/utils/date.js';
import { escapeHtml, truncate } from '../../shared/utils/text.js';
import type { BirthdayBuckets } from '../../modules/birthdays/dashboard.types.js';
import type { UpcomingBirthday } from '../../modules/birthdays/birthday.types.js';

function safe(value: string): string {
  return escapeHtml(value);
}

function itemLine(item: UpcomingBirthday, lang: Language): string {
  return t('dashboard.item', lang, {
    name: safe(truncate(item.person.name, 40)),
    date: formatJalali(item.rule.month, item.rule.day, item.rule.year),
    age: item.age === null ? '' : t('dashboard.ageSuffix', lang, { age: toPersianDigits(item.age) }),
  });
}

/**
 * §3.1 — the home screen.
 *
 * Three urgency buckets, then the three numbers the roadmap asks for. The
 * numbers come from the same projection as the buckets, so the header can never
 * claim "3 birthdays this month" while a bucket shows something else.
 */
export function dashboardText(buckets: BirthdayBuckets, lang: Language): string {
  if (buckets.totalPeople === 0) return t('dashboard.noneAtAll', lang);

  const monthName = JALALI_MONTH_NAMES[buckets.jalaliMonth - 1] ?? toPersianDigits(buckets.jalaliMonth);
  const parts: string[] = [t('dashboard.title', lang), ''];

  /**
   * Every bucket keeps its heading, even when empty. Dropping the heading made
   * the screen change shape as birthdays came and went, so "no birthdays this
   * week" was indistinguishable from a section that had been forgotten.
   */
  const section = (heading: string, items: UpcomingBirthday[], empty: string): void => {
    parts.push(heading);
    if (items.length === 0) parts.push(empty);
    for (const item of items) parts.push(itemLine(item, lang));
    parts.push('');
  };

  section(t('dashboard.todayHeading', lang), buckets.today, t('dashboard.emptyToday', lang));
  section(t('dashboard.weekHeading', lang), buckets.thisWeek, t('dashboard.emptyWeek', lang));
  section(t('dashboard.laterHeading', lang), buckets.later, t('dashboard.emptyLater', lang));

  if (buckets.nextBirthday) {
    parts.push(
      t('dashboard.nextUp', lang, {
        name: safe(truncate(buckets.nextBirthday.person.name, 40)),
        countdown: formatDaysUntil(buckets.nextBirthday.daysUntil, lang),
      }),
      '',
    );
  }

  parts.push(
    t('dashboard.summary', lang, {
      people: toPersianDigits(buckets.totalPeople),
      monthCount: toPersianDigits(buckets.thisMonthCount),
      monthName,
    }),
  );

  return parts.join('\n').trimEnd();
}
