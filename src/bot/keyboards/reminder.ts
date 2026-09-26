import { InlineKeyboard } from 'grammy';
import { t, type Language } from '../../shared/i18n/index.js';
import { interestDeleteCallback, personCallback } from '../callbacks/data.js';
import { reminderLabel } from '../../modules/reminders/reminder.service.js';
import type { ReminderRecord } from '../../modules/reminders/reminder.types.js';
import type { InterestRecord } from '../../modules/people/person.types.js';

const CONFIRM_DATA = 'flow:person:save';
const CANCEL_DATA = 'nav:menu';

/** Reminder toggles for a saved person (§14). */
export function reminderKeyboard(
  personId: string,
  reminders: ReminderRecord[],
  lang: Language = 'fa',
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const reminder of reminders) {
    keyboard.text(
      t('reminders.item', lang, {
        mark: reminder.enabled ? t('reminders.on', lang) : t('reminders.off', lang),
        label: reminderLabel(reminder.daysBefore, lang),
      }),
      `reminder:toggle:${personId}:${reminder.daysBefore}`,
    );
  }

  return keyboard.row().text(t('buttons.back', lang), personCallback('view', personId));
}

/** Reminder toggles of the add-person confirmation (person not saved yet). */
export function pendingReminderKeyboard(
  selected: number[],
  lang: Language = 'fa',
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const daysBefore of selected) {
    keyboard.text(
      t('reminders.item', lang, {
        mark: t('reminders.on', lang),
        label: reminderLabel(daysBefore, lang),
      }),
      `reminder:pending:${daysBefore}`,
    );
  }

  return keyboard
    .row()
    .text(t('common.confirm', lang), CONFIRM_DATA)
    .text(t('common.cancel', lang), CANCEL_DATA);
}

/** Interests list with per-item delete buttons. */
export function interestsKeyboard(
  personId: string,
  interests: InterestRecord[],
  lang: Language = 'fa',
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const interest of interests) {
    keyboard.text(`🗑 ${interest.title}`, interestDeleteCallback(personId, interest.id));
  }

  return keyboard
    .row()
    .text(t('interests.add', lang), `flow:interest:add:${personId}`)
    .text(t('buttons.editInterests', lang), personCallback('edit:interests', personId))
    .row()
    .text(t('buttons.back', lang), personCallback('view', personId));
}

/** Confirmation + cancel for destructive actions (§18). */
export function confirmKeyboard(yesData: string, noData: string, lang: Language = 'fa'): InlineKeyboard {
  return new InlineKeyboard()
    .text(t('delete.confirmYes', lang), yesData)
    .text(t('delete.confirmNo', lang), noData);
}

export function cancelKeyboard(cancelData = CANCEL_DATA, lang: Language = 'fa'): InlineKeyboard {
  return new InlineKeyboard().text(t('common.cancel', lang), cancelData);
}
