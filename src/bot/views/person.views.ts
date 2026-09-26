import { t, type Language } from '../../shared/i18n/index.js';
import { escapeHtml, truncate } from '../../shared/utils/text.js';
import { formatDaysUntil, formatJalali, toPersianDigits } from '../../shared/utils/date.js';
import type { UpcomingBirthday } from '../../modules/birthdays/birthday.types.js';
import type { PersonWithReminders } from '../../modules/people/person.types.js';
import { reminderLabel } from '../../modules/reminders/reminder.service.js';
import { MAIN_MENU_HINT } from './hint.js';

/** `<b>` is the only formatting used, so user text is escaped, not stripped. */
function safe(value: string): string {
  return escapeHtml(value);
}

export function birthdayDateLine(item: UpcomingBirthday, lang: Language): string {
  const base = formatJalali(item.rule.month, item.rule.day);
  return item.age === null
    ? t('person.birthday', lang, { date: base })
    : t('person.age', lang, { date: base, age: toPersianDigits(item.age) });
}

export function countdownLine(item: UpcomingBirthday, lang: Language): string {
  return t('person.countdown', lang, { countdown: formatDaysUntil(item.daysUntil) });
}

/** §15 — upcoming birthdays, sorted by the next occurrence. */
export function upcomingListText(items: UpcomingBirthday[], lang: Language): string {
  if (items.length === 0) return t('upcoming.empty', lang);

  const lines = items.map((item, index) =>
    t('upcoming.item', lang, {
      index: toPersianDigits(index + 1),
      name: safe(truncate(item.person.name, 40)),
      date: formatJalali(item.rule.month, item.rule.day),
      countdown: formatDaysUntil(item.daysUntil),
    }),
  );

  return [t('upcoming.title', lang), '', ...lines].join('\n');
}

export function peopleListText(items: UpcomingBirthday[], lang: Language): string {
  if (items.length === 0) return t('people.empty', lang);

  const lines = items.map((item, index) =>
    t('people.item', lang, {
      index: toPersianDigits(index + 1),
      name: safe(truncate(item.person.name, 40)),
      date: formatJalali(item.rule.month, item.rule.day),
      countdown: formatDaysUntil(item.daysUntil),
    }),
  );

  return [t('people.title', lang), '', ...lines].join('\n');
}

/** §16 — person details. Notes stay private to the owner. */
export function personDetailsText(item: UpcomingBirthday, lang: Language): string {
  const person = item.person;
  const parts: string[] = [t('person.title', lang, { name: safe(person.name) }), ''];

  parts.push(birthdayDateLine(item, lang));
  parts.push(countdownLine(item, lang));

  if (person.interests.length > 0) {
    parts.push('', t('person.interests', lang));
    for (const interest of person.interests) {
      parts.push(t('interests.item', lang, { title: safe(interest.title) }));
    }
  }

  if (person.notes) {
    parts.push('', `${t('person.notes', lang)}`, safe(truncate(person.notes, 400)));
  }

  const enabled = person.reminders.filter((reminder) => reminder.enabled);
  parts.push(
    '',
    t('person.reminders', lang, {
      value: enabled.length
        ? enabled.map((reminder) => reminderLabel(reminder.daysBefore, lang)).join('، ')
        : t('common.unknown', lang),
    }),
  );

  return parts.join('\n');
}

export function personDeleteConfirmText(name: string, lang: Language): string {
  return t('delete.confirm', lang, { name: safe(name) });
}

export function personDeletedText(name: string, lang: Language): string {
  return t('delete.done', lang, { name: safe(name) });
}

/** §11 — final step of the add-person flow. */
export function addPersonConfirmationText(
  data: { name: string; month: number; day: number; year: number | null; notes: string | null },
  interests: string[],
  lang: Language,
): string {
  const parts: string[] = [
    t('addPerson.confirmation', lang, { name: safe(data.name) }),
    '',
    t('person.birthday', lang, { date: formatJalali(data.month, data.day, data.year) }),
  ];

  if (interests.length > 0) {
    parts.push('', t('person.interests', lang));
    parts.push(interests.map((title) => t('interests.item', lang, { title: safe(title) })).join('\n'));
  }

  if (data.notes) {
    parts.push('', `${t('person.notes', lang)}`, safe(truncate(data.notes, 300)));
  }

  parts.push('', MAIN_MENU_HINT);
  return parts.join('\n');
}

export function addPersonSavedText(name: string, lang: Language): string {
  return t('addPerson.saved', lang, { name: safe(name) });
}

export function personEditedText(lang: Language): string {
  return t('edit.updatedField', lang);
}

export function interestsText(
  person: PersonWithReminders,
  lang: Language,
): string {
  const parts = [t('interests.title', lang, { name: safe(person.name) }), ''];

  if (person.interests.length === 0) {
    parts.push(t('interests.empty', lang));
  } else {
    for (const interest of person.interests) {
      parts.push(t('interests.item', lang, { title: safe(interest.title) }));
    }
  }

  return parts.join('\n');
}
