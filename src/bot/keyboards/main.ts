import { Keyboard } from 'grammy';
import { t, type Language } from '../../shared/i18n/index.js';

/**
 * Main menu as a reply keyboard: three things a user can do, always visible.
 *
 * The list of people is a single screen ("تولدها"), sorted by the next birthday,
 * because a second alphabetical list only confused people.
 */
export function mainMenuKeyboard(lang: Language = 'fa'): Keyboard {
  return new Keyboard()
    .text(t('menu.upcoming', lang))
    .text(t('menu.addPerson', lang))
    .row()
    .text(t('menu.settings', lang))
    .resized()
    .persistent();
}

/** All main-menu labels, used to detect menu presses during a conversation. */
export function mainMenuLabels(lang: Language = 'fa'): string[] {
  return [
    t('menu.upcoming', lang),
    t('menu.addPerson', lang),
    t('menu.settings', lang),
    t('menu.title', lang),
    t('menu.help', lang),
    t('menu.home', lang),
  ];
}
