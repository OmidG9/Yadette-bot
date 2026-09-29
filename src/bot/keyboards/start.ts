import { InlineKeyboard } from 'grammy';
import { t, type Language } from '../../shared/i18n/index.js';
import type { FeatureFlags } from '../../config/feature-flags.js';
import { navCallback } from '../callbacks/data.js';

/** `/start` payload that opens the add-person flow (Telegram deep link). */
export const START_ADD_PAYLOAD = 'add';

export interface WelcomeKeyboardOptions {
  username: string | undefined;
  lang: Language;
  /**
   * Injected rather than imported so a test can render the menu with a phase-1
   * section switched off, and so this function stays a pure function of its
   * arguments.
   */
  flags: FeatureFlags;
}

/**
 * The main menu: one tappable button per section.
 *
 * A section whose feature flag is off is omitted entirely — roadmap §17 says a
 * feature that is not ready must not appear in the UI, and a dead button is
 * worse than a missing one.
 */
export function welcomeKeyboard({
  username,
  lang,
  flags,
}: WelcomeKeyboardOptions): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const cta = t('start.cta', lang);

  if (username) {
    keyboard.url(cta, `https://t.me/${username}?start=${START_ADD_PAYLOAD}`);
  } else {
    // Without a known username the deep link cannot be built.
    keyboard.text(cta, navCallback('add'));
  }

  // Row 1: the two things a returning user does most.
  const primary: Array<[string, string]> = [];

  if (flags.isEnabled('dashboard')) primary.push([t('menu.dashboard', lang), navCallback('dashboard')]);
  primary.push([t('menu.upcoming', lang), navCallback('upcoming')]);

  for (const [label, payload] of primary) keyboard.text(label, payload);
  keyboard.row();

  // Row 2: discovery.
  const discovery: Array<[string, string]> = [];
  if (flags.isEnabled('search')) discovery.push([t('menu.search', lang), navCallback('search')]);
  if (flags.isEnabled('calendar')) discovery.push([t('menu.calendar', lang), navCallback('calendar')]);
  discovery.push([t('menu.settings', lang), navCallback('settings')]);

  for (const [label, payload] of discovery) keyboard.text(label, payload);
  keyboard.row();

  return keyboard
    .text(t('menu.help', lang), navCallback('help'))
    .text(t('menu.about', lang), navCallback('about'));
}
