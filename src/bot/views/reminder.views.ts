import { t, type Language } from '../../shared/i18n/index.js';
import { escapeHtml, truncate } from '../../shared/utils/text.js';
import { formatJalali, toPersianDigits, type JalaliDate } from '../../shared/utils/date.js';
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

/**
 * §20 — the actual reminder message. Static template copy, no AI.
 *
 * Takes a narrowed input rather than `DueNotification`: a snoozed delivery has
 * no occurrence of its own, only the birthday it belongs to, and the two must
 * render identically.
 */
export function reminderNotificationText(
  due: ReminderMessageInput,
  lang: Language,
): string {
  const { person, jalali, jalaliYear, daysBefore } = due;
  const name = escapeHtml(truncate(person.name, 60));
  const date = formatJalali(jalali.jm, jalali.jd);

  if (daysBefore === 0) {
    return [t('notification.today', lang, { name }), '', t('notification.todayBody', lang)].join('\n');
  }

  const age = ageOnBirthday(
    { month: person.birthMonth, day: person.birthDay, year: person.birthYear },
    jalaliYear,
  );

  const parts: string[] = [t('notification.upcoming', lang, { name }), ''];

  parts.push(
    t('notification.daysLeft', lang, {
      count: t('countdown.daysCount', lang, { count: toPersianDigits(daysBefore) }),
    }),
  );
  parts.push(t('notification.date', lang, { date }));

  if (age !== null) {
    parts.push(t('notification.age', lang, { age: toPersianDigits(age) }));
  }

  // Every interpolated value reaches Telegram as HTML, so user text is escaped.
  const interests = person.interests.map((interest) => escapeHtml(interest.title));
  if (interests.length > 0) {
    parts.push('', t('notification.interests', lang, { list: interests.join('، ') }));
  }

  parts.push('', t('notification.footer', lang));
  return parts.join('\n');
}

/** Everything a reminder message needs, independent of how delivery found it. */
export interface ReminderMessageInput {
  person: DueNotification['person'];
  /** The resolved birthday this message is about. */
  jalali: JalaliDate;
  jalaliYear: number;
  daysBefore: number;
}

/**
 * §3.5 — the postponed notification.
 *
 * Identical wording on purpose: a snoozed delivery is the same reminder, late.
 */
export function snoozeNotificationText(
  due: Pick<ReminderMessageInput, 'person' | 'jalali' | 'jalaliYear' | 'daysBefore'>,
  lang: Language,
): string {
  return reminderNotificationText(due, lang);
}
