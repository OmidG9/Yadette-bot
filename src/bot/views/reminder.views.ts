import { t, type Language } from '../../shared/i18n/index.js';
import { escapeHtml, truncate } from '../../shared/utils/text.js';
import { formatJalali, toPersianDigits } from '../../shared/utils/date.js';
import { reminderLabel } from '../../modules/reminders/reminder.service.js';
import type { ReminderRecord } from '../../modules/reminders/reminder.types.js';
import type { DueNotification } from '../../modules/reminders/reminder.service.js';
import { ageOnBirthday } from '../../modules/birthdays/birthday.calc.js';

/** §14 — reminder settings screen. */
export function reminderSettingsText(
  name: string,
  reminders: ReminderRecord[],
  lang: Language,
): string {
  const parts = [t('reminders.title', lang, { name: escapeHtml(name) }), ''];

  for (const reminder of reminders) {
    parts.push(
      t('reminders.item', lang, {
        mark: reminder.enabled ? t('reminders.on', lang) : t('reminders.off', lang),
        label: reminderLabel(reminder.daysBefore, lang),
      }),
    );
  }

  return parts.join('\n');
}

/** §20 — the actual reminder message. Static template copy, no AI. */
export function reminderNotificationText(due: DueNotification, lang: Language): string {
  const { person, occurrence, daysBefore } = due;
  const name = escapeHtml(truncate(person.name, 60));
  const date = formatJalali(occurrence.jalali.jm, occurrence.jalali.jd);

  if (daysBefore === 0) {
    return [t('notification.today', lang, { name }), '', t('notification.todayBody', lang, { name })].join(
      '\n',
    );
  }

  const age = ageOnBirthday(
    { month: person.birthMonth, day: person.birthDay, year: person.birthYear },
    occurrence.jalaliYear,
  );

  const parts: string[] = [t('notification.upcoming', lang, { name }), ''];

  parts.push(
    t('notification.daysLeft', lang, {
      count: daysBefore === 1 ? '۱ روز' : `${toPersianDigits(daysBefore)} روز`,
    }),
  );
  parts.push(t('notification.date', lang, { date }));

  if (age !== null) {
    parts.push(`🎂 ${toPersianDigits(age)} سال`);
  }

  const interests = person.interests.map((interest) => interest.title);
  if (interests.length > 0) {
    parts.push('', t('notification.interests', lang, { list: interests.join('، ') }));
  }

  parts.push('', t('notification.footer', lang));
  return parts.join('\n');
}
