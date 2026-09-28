import { InlineKeyboard } from 'grammy';
import { t, type Language } from '../../shared/i18n/index.js';
import { navCallback } from '../callbacks/data.js';

/** `/start` payload that opens the add-person flow (Telegram deep link). */
export const START_ADD_PAYLOAD = 'add';

/**
 * `/start` screen: a complete message with one tappable button per section, so
 * a brand new user can see everything the bot does and jump straight into it.
 *
 * The add button goes through a `?start=add` deep link, which works even when
 * the button is tapped from a group chat; without a known bot username it falls
 * back to an internal callback.
 */
export function welcomeKeyboard(username: string | undefined, lang: Language = 'fa'): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const cta = t('start.cta', lang);

  if (username) {
    keyboard.url(cta, `https://t.me/${username}?start=${START_ADD_PAYLOAD}`);
  } else {
    // Without a known username the deep link cannot be built.
    keyboard.text(cta, navCallback('add'));
  }

  return keyboard
    .row()
    .text(t('menu.upcoming', lang), navCallback('upcoming'))
    .text(t('menu.settings', lang), navCallback('settings'))
    .row()
    .text(t('menu.help', lang), navCallback('help'))
    .text(t('menu.about', lang), navCallback('about'));
}
