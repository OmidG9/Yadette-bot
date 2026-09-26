import { InlineKeyboard } from 'grammy';
import { t, type Language } from '../../shared/i18n/index.js';

/** `/start` payload that opens the add-person flow (Telegram deep link). */
export const START_ADD_PAYLOAD = 'add';

/**
 * Welcome screen of the first run: a single call to action that goes straight
 * into the add-person flow through a `?start=add` deep link, so it works even
 * when the button is tapped from a group chat.
 */
export function welcomeKeyboard(username: string | undefined, lang: Language = 'fa'): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const cta = t('start.cta', lang);

  if (username) {
    return keyboard.url(cta, `https://t.me/${username}?start=${START_ADD_PAYLOAD}`);
  }

  // Without a known username the deep link cannot be built; the reply keyboard
  // is still attached by the caller.
  return keyboard.text(cta, 'nav:add');
}
