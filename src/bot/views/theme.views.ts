import type { Language } from '../../shared/i18n/index.js';

export type ThemeMode = 'light' | 'dark' | 'system';

export function themeToggleText(_lang: Language, mode: ThemeMode = 'dark'): string {
  const label = mode === 'dark' ? 'حالت تیره' : mode === 'light' ? 'حالت روشن' : 'حالت سیستم';
  return [
    '<b>تم (' + label + ')</b>',
    '',
    'برای تغییر تم از تنظیمات استفاده کنید.',
  ].join('\n');
}