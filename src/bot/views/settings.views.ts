import { t, languageDisplayName, type Language } from '../../shared/i18n/index.js';
import { AVAILABLE_TIMEZONES } from '../../shared/utils/date.js';
import { escapeHtml } from '../../shared/utils/text.js';
import type { UserSettings } from '../../modules/settings/settings.repository.js';

/**
 * §22 — settings screen.
 *
 * `notice` is the confirmation of the action that just ran. It is not cosmetic:
 * Telegram refuses an edit whose text is unchanged, and `editOrSend` then falls
 * back to posting a brand new message, which would leave a duplicate settings
 * screen behind (e.g. re-picking the timezone that is already active).
 */
export function settingsText(settings: UserSettings, lang: Language, notice?: string): string {
  const lines = [
    t('settings.title', lang),
    '',
    settings.reminderEnabled
      ? t('settings.remindersOn', lang)
      : t('settings.remindersOff', lang),
    t('settings.timezoneCurrent', lang, { value: escapeHtml(settings.timezone) }),
    t('settings.languageCurrent', lang, { value: languageDisplayName(lang) }),
    '',
    t('settings.dataHint', lang),
  ];

  if (notice) {
    lines.push('', notice);
  }

  return lines.join('\n');
}

export function timezoneListText(current: string, lang: Language): string {
  return [
    t('settings.selectTimezone', lang, { value: escapeHtml(current) }),
    '',
    ...AVAILABLE_TIMEZONES.map((timezone) => `${timezone === current ? '✅' : '▫️'} ${timezone}`),
  ].join('\n');
}

/** Two-step confirmation before erasing everything (§ privacy). */
export function deleteDataConfirmText(lang: Language): string {
  return [t('settings.dataTitle', lang), '', t('settings.dataBody', lang)].join('\n');
}

/** Shown right after the data is gone: confirms the wipe and how to start over. */
export function dataErasedText(lang: Language): string {
  return t('settings.dataErased', lang);
}
