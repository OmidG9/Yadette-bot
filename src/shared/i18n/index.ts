import { fa, type Dictionary, type ListKey, type TranslationKey, type TranslationParams } from './fa.js';

export type { TranslationKey, TranslationParams, ListKey };

/** Supported languages. Persian only in the MVP — the plumbing is already here. */
export const SUPPORTED_LANGUAGES = ['fa'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

const dictionaries: Record<Language, Dictionary> = { fa };

export const DEFAULT_LANGUAGE: Language = 'fa';

const PLACEHOLDER = /\{\{(\w+)\}\}/g;

function node(dictionary: Dictionary, key: string): unknown {
  let current: unknown = dictionary;

  for (const part of key.split('.')) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function resolve(dictionary: Dictionary, key: string): string | undefined {
  const value = node(dictionary, key);
  return typeof value === 'string' ? value : undefined;
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

/**
 * Same copy with the formatting tags removed, for inline-button labels.
 *
 * The Bot API never HTML-parses `callback_data` button text, so a label taken
 * straight from a message template shows the user literal `<b>` characters.
 */
export function plainText(key: TranslationKey, lang?: Language, params?: TranslationParams): string {
  return t(key, lang, params).replace(/<\/?[a-z][^>]*>/gi, '');
}

/**
 * A whole list of strings, for the copy that has to be rendered as buttons
 * rather than as a sentence (quick picks, suggestions).
 *
 * Falls back to the default locale like `t`, and returns an empty list for a key
 * that holds no list — a caller iterating it then simply renders no buttons,
 * which is the correct behaviour for "no presets configured" and never crashes.
 */
export function tl(key: ListKey, lang: Language = DEFAULT_LANGUAGE): readonly string[] {
  const dictionary = dictionaries[lang] ?? dictionaries[DEFAULT_LANGUAGE];
  const value: unknown = node(dictionary, key);
  // Widened to `unknown[]` before the guard so the return type can be stated
  // instead of leaking the `any[]` that `Array.isArray` narrows to.
  const entries: unknown[] = Array.isArray(value) ? value : [];
  return entries.filter((entry): entry is string => typeof entry === 'string');
}
