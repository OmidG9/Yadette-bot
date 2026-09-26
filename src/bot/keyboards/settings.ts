import { InlineKeyboard } from 'grammy';
import { t, languageDisplayName, type Language } from '../../shared/i18n/index.js';
import { deleteDataCallback, navCallback, timezoneCallback } from '../callbacks/data.js';
import { AVAILABLE_TIMEZONES } from '../../shared/utils/date.js';
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
    .text(t('settings.languageCurrent', lang, { value: languageDisplayName(lang) }), 'settings:language')
    .row()
    // Destructive action on its own row, deliberately away from the exit button.
    .text(t('settings.dataButton', lang), deleteDataCallback('ask'))
    .row()
    .text(t('buttons.home', lang), navCallback('menu'));
}

/** Timezone picker (§22). */
export function timezoneKeyboard(
  current: string,
  lang: Language = 'fa',
  options: readonly string[] = AVAILABLE_TIMEZONES,
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const timezone of options) {
    const mark = timezone === current ? '✅ ' : '';
    keyboard.text(`${mark}${timezone}`, timezoneCallback(timezone));
  }

  return keyboard.row().text(t('buttons.back', lang), navCallback('settings'));
}

/** Yes/no for the irreversible "delete all my data" action. */
export function deleteDataKeyboard(lang: Language = 'fa'): InlineKeyboard {
  return new InlineKeyboard()
    .text(t('settings.dataConfirmYes', lang), deleteDataCallback('yes'))
    .text(t('settings.dataConfirmNo', lang), deleteDataCallback('no'));
}
