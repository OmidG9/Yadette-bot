import { t, type Language } from '../../shared/i18n/index.js';
import { escapeHtml } from '../../shared/utils/text.js';
import type { UserRecord } from '../../modules/users/user.types.js';

function displayName(user: UserRecord): string {
  return escapeHtml(user.firstName ?? user.username ?? 'دوست عزیز');
}

/**
 * First contact gets the full explanation plus a call to action; a returning
 * user with people already in the list only gets a short greeting.
 */
export function welcomeText(
  user: UserRecord,
  created: boolean,
  hasPeople: boolean,
  lang: Language,
): string {
  if (created) return t('start.newUser', lang);
  if (!hasPeople) return t('start.empty', lang, { name: displayName(user) });
  return t('start.returning', lang, { name: displayName(user) });
}

export function helpText(lang: Language): string {
  return t('help.text', lang, { hint: t('hint.keyboard', lang) });
}
