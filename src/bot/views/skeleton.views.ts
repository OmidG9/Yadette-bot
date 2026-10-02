import { t, type Language } from '../../shared/i18n/index.js';

export function skeletonList(lang: Language): string {
  return [
    t('states.loading.title', lang),
    '',
    '• ░░░░░░░',
    '• ░░░░░░░',
    '• ░░░░░░░',
    '',
    t('states.loading.subtitle', lang),
  ].join('\n');
}

export function skeletonChat(lang: Language): string {
  return [
    t('states.loading.title', lang),
    '',
    '░░░░░░░░░░░░░░░',
    '░░░░░░░░░░░░░',
    '',
    t('states.loading.subtitle', lang),
  ].join('\n');
}