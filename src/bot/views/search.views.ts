import { t, type Language } from '../../shared/i18n/index.js';
import { escapeHtml, truncate } from '../../shared/utils/text.js';
import { formatDaysUntil, formatJalali, toPersianDigits } from '../../shared/utils/date.js';
import type { UpcomingBirthday } from '../../modules/birthdays/birthday.types.js';

/** §3.3 — search results, each with the birthday that made the match useful. */
export function searchResultsText(
  items: UpcomingBirthday[],
  query: string,
  lang: Language,
): string {
  if (items.length === 0) return t('search.empty', lang, { query: escapeHtml(truncate(query, 40)) });

  const lines = items.map((item) =>
    t('search.item', lang, {
      name: escapeHtml(truncate(item.person.name, 40)),
      date: formatJalali(item.rule.month, item.rule.day, item.rule.year),
      countdown: formatDaysUntil(item.daysUntil, lang),
    }),
  );

  return [
    t('search.resultsTitle', lang, { query: escapeHtml(truncate(query, 40)) }),
    t('search.resultsCount', lang, { count: toPersianDigits(items.length) }),
    '',
    ...lines,
    '',
    t('search.hint', lang),
  ].join('\n');
}
