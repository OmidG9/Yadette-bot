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

  const section = (heading: string, items: UpcomingBirthday[]): void => {
    if (items.length === 0) return;
    parts.push(heading);
    for (const item of items) parts.push(itemLine(item, lang));
    parts.push('');
  };

  section(t('dashboard.todayHeading', lang), buckets.today);
  section(t('dashboard.weekHeading', lang), buckets.thisWeek);

  if (buckets.later.length > 0) {
    parts.push(t('dashboard.laterHeading', lang));
    for (const item of buckets.later) parts.push(itemLine(item, lang));
    parts.push('');
  }

  // Only nag about an empty bucket when there is nothing else to say.
  if (buckets.today.length === 0 && buckets.thisWeek.length === 0) {
    parts.push(`${t('dashboard.todayHeading', lang)} ${t('dashboard.emptyToday', lang)}`, '');
  }

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
