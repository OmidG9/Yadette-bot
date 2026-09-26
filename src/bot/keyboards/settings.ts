import { InlineKeyboard } from 'grammy';
import { t, type Language } from '../../shared/i18n/index.js';
import { navCallback, timezoneCallback } from '../callbacks/data.js';
import { COMMON_TIMEZONES } from '../../shared/utils/date.js';
import type { UserSettings } from '../../modules/settings/settings.repository.js';

/** Settings menu (§22). */
export function settingsKeyboard(settings: UserSettings, lang: Language = 'fa'): InlineKeyboard {
  const reminderLabel = settings.reminderEnabled
    ? t('settings.remindersOn', lang)
    : t('settings.remindersOff', lang);

  return new InlineKeyboard()
    .text(reminderLabel, 'settings:reminders')
    .row()
    .text(t('settings.timezoneCurrent', lang, { value: settings.timezone }), 'settings:timezone')
    .text(t('settings.languageCurrent', lang, { value: lang.toUpperCase() }), 'settings:language')
    .row()
    .text(t('buttons.home', lang), navCallback('menu'));
}

/** Timezone picker (§22). */
export function timezoneKeyboard(
  current: string,
  lang: Language = 'fa',
  options: readonly string[] = COMMON_TIMEZONES,
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const timezone of options) {
    const mark = timezone === current ? '✅ ' : '';
    keyboard.text(`${mark}${timezone}`, timezoneCallback(timezone));
  }

  return keyboard.row().text(t('buttons.back', lang), navCallback('settings'));
}
