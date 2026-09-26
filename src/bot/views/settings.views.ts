import { t, type Language } from '../../shared/i18n/index.js';
import { COMMON_TIMEZONES, isValidTimeZone } from '../../shared/utils/date.js';
import type { UserSettings } from '../../modules/settings/settings.repository.js';

/** §22 — settings screen. */
export function settingsText(settings: UserSettings, lang: Language): string {
  const lines = [
    t('settings.title', lang),
    '',
    settings.reminderEnabled
      ? t('settings.remindersOn', lang)
      : t('settings.remindersOff', lang),
    t('settings.timezoneCurrent', lang, { value: settings.timezone }),
    t('settings.languageCurrent', lang, { value: lang === 'fa' ? 'فارسی' : lang }),
  ];

  return lines.join('\n');
}

export function timezoneListText(current: string, lang: Language): string {
  return [
    t('settings.selectTimezone', lang),
    '',
    ...COMMON_TIMEZONES.filter(isValidTimeZone).map(
      (timezone) => `${timezone === current ? '✅' : '▫️'} ${timezone}`,
    ),
  ].join('\n');
}
