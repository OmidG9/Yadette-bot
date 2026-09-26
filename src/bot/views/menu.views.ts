import { t, type Language } from '../../shared/i18n/index.js';
import { escapeHtml } from '../../shared/utils/text.js';
import type { UserRecord } from '../../modules/users/user.types.js';

export function welcomeText(user: UserRecord, created: boolean, lang: Language): string {
  if (created) return t('start.newUser', lang);
  return t('start.returning', lang, { name: escapeHtml(user.firstName ?? user.username ?? 'دوست عزیز') });
}

export function helpText(lang: Language): string {
  return t('help.text', lang);
}

export function settingsUpdatedText(lang: Language): string {
  return t('settings.updated', lang);
}
