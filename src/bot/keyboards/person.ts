import { InlineKeyboard } from 'grammy';
import { t, type Language } from '../../shared/i18n/index.js';
import { personCallback } from '../callbacks/data.js';
import type { UpcomingBirthday } from '../../modules/birthdays/birthday.types.js';

/** Buttons of the person details screen (§16). */
export function personDetailsKeyboard(
  personId: string,
  lang: Language = 'fa',
  hasInterests: boolean,
): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text(t('buttons.editName', lang), personCallback('edit', personId))
    .text(t('buttons.editBirthday', lang), personCallback('edit:birthday', personId))
    .row();

  if (hasInterests) {
    keyboard.text(t('buttons.editInterests', lang), personCallback('interests', personId));
  }
  keyboard
    .text(t('buttons.editReminders', lang), personCallback('reminders', personId))
    .row()
    .text(t('buttons.delete', lang), personCallback('del:ask', personId))
    .text(t('buttons.back', lang), 'nav:upcoming');

  return keyboard;
}

/** Edit field chooser (§17). */
export function personEditKeyboard(personId: string, lang: Language = 'fa'): InlineKeyboard {
  return new InlineKeyboard()
    .text(t('buttons.editName', lang), personCallback('edit', personId))
    .text(t('buttons.editBirthday', lang), personCallback('edit:birthday', personId))
    .row()
    .text(t('buttons.editInterests', lang), personCallback('interests', personId))
    .text(t('buttons.editNotes', lang), personCallback('edit:notes', personId))
    .row()
    .text(t('buttons.editReminders', lang), personCallback('reminders', personId))
    .row()
    .text(t('buttons.back', lang), personCallback('view', personId));
}

/** Compact keyboard for lists of people. */
export function listKeyboard(items: UpcomingBirthday[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  if (items.length > 0) {
    for (const item of items) {
      keyboard.text(`🎂 ${item.person.name}`, personCallback('view', item.person.id));
    }
    keyboard.row();
  }

  return keyboard.text(t('buttons.home'), 'nav:menu');
}
