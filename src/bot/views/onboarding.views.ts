import { t, type Language } from '../../shared/i18n/index.js';
import { escapeHtml } from '../../shared/utils/text.js';

function safe(v: string): string {
  return escapeHtml(v);
}

export function onboardingWelcome(lang: Language): string {
  const parts: string[] = [
    t('start.newUser', lang),
    '',
    '<b>' + safe(t('start.cta', lang)) + '</b>',
  ];
  return parts.join('\n');
}

export function onboardingFirstCharacterHint(lang: Language): string {
  return [
    '<b>' + safe(t('addPerson.askName', lang)) + '</b>',
    '',
    t('hint.skip', lang),
  ].join('\n');
}

export function onboardingFirstChatHint(lang: Language): string {
  return [
    t('upcoming.empty', lang),
    '',
    '<b>' + safe(t('states.empty.cta', lang)) + '</b>',
  ].join('\n');
}