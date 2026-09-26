import { fa, type Dictionary, type TranslationKey, type TranslationParams } from './fa.js';

export type { TranslationKey, TranslationParams };

/** Supported languages. Persian only in the MVP — the plumbing is already here. */
export const SUPPORTED_LANGUAGES = ['fa'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

const dictionaries: Record<Language, Dictionary> = { fa };

export const DEFAULT_LANGUAGE: Language = 'fa';

const PLACEHOLDER = /\{\{(\w+)\}\}/g;

function resolve(dictionary: Dictionary, key: string): string | undefined {
  let current: unknown = dictionary;

  for (const part of key.split('.')) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === 'string' ? current : undefined;
}

function interpolate(template: string, params?: TranslationParams): string {
  return template.replace(PLACEHOLDER, (match, name: string) => {
    if (!params || !(name in params)) return match;
    return String(params[name]);
  });
}

/**
 * Translates a dot-path key for the given language.
 * Unknown keys fall back to the key itself so missing copy is visible in tests.
 */
export function t(key: TranslationKey, lang: Language = DEFAULT_LANGUAGE, params?: TranslationParams): string {
  const dictionary = dictionaries[lang] ?? dictionaries[DEFAULT_LANGUAGE];
  const template = resolve(dictionary, key) ?? resolve(dictionaries[DEFAULT_LANGUAGE], key);
  if (template === undefined) return key;
  return interpolate(template, params);
}

export function isSupportedLanguage(value: string): value is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export function languageDisplayName(lang: Language): string {
  return lang === 'fa' ? 'فارسی' : lang;
}
