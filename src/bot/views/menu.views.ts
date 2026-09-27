import { t, type Language } from '../../shared/i18n/index.js';
import { toPersianDigits } from '../../shared/utils/date.js';
import { escapeHtml } from '../../shared/utils/text.js';
import type { UserRecord } from '../../modules/users/user.types.js';

function displayName(user: UserRecord): string {
  return escapeHtml(user.firstName ?? user.username ?? t('user.dear'));
}

/**
 * First contact gets the full explanation; a returning user gets a complete
 * status line. Both are followed by one tappable button per section, so the
 * whole bot is reachable from the very first message.
 */
export function welcomeText(
  user: UserRecord,
  created: boolean,
  peopleCount: number,
  lang: Language,
): string {
  if (created) return t('start.newUser', lang);
  return t(peopleCount > 0 ? 'start.returning' : 'start.empty', lang, {
    name: displayName(user),
    count: toPersianDigits(peopleCount),
  });
}

export function helpText(lang: Language): string {
  return t('help.text', lang, { hint: t('hint.keyboard', lang) });
}

/** The full story behind the bot, readable at any time via /about. */
export function aboutText(lang: Language): string {
  return t('about.text', lang);
}
