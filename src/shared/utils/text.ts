import {
  MAX_INTERESTS_PER_PERSON,
  MAX_INTEREST_LENGTH,
  MAX_NAME_LENGTH,
  MAX_NOTES_LENGTH,
} from '../constants/index.js';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
};

/** Telegram sends plain text, but keep an escape helper for future HTML mode. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>]/g, (char) => HTML_ESCAPES[char] ?? char);
}

export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function truncate(value: string, maxLength: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

// Built from strings so the sanitizer can target control codes on purpose.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f]', 'g');
const INVISIBLE_CHARS = new RegExp('[\\u200b-\\u200f\\u2028-\\u202f\\u2060-\\u206f\\ufeff]', 'g');

/** Cleans a person's name: no control/invisible characters, bounded length. */
export function cleanName(raw: string): string | null {
  const value = collapseWhitespace(raw.replace(CONTROL_CHARS, ' ').replace(INVISIBLE_CHARS, ''));
  if (value.length === 0 || value.length > MAX_NAME_LENGTH) return null;
  return value;
}

const INTEREST_SEPARATORS = /[,،;؛\n\r\t|/]+/u;

/**
 * Parses a free-text interest list such as `گیم، فوتبال، قهوه`.
 * Deduplicated case-insensitively, with length and count limits.
 */
export function parseInterests(raw: string): string[] {
  const parts = raw
    .split(INTEREST_SEPARATORS)
    .map((part) => collapseWhitespace(part))
    .filter((part) => part.length > 0);

  const seen = new Set<string>();
  const result: string[] = [];

  for (const part of parts) {
    const value = truncate(part, MAX_INTEREST_LENGTH);
    const key = value.toLocaleLowerCase('fa');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
    if (result.length >= MAX_INTERESTS_PER_PERSON) break;
  }

  return result;
}

export function cleanNotes(raw: string): string | null {
  const value = raw.trim();
  if (value.length === 0) return null;
  return truncate(value, MAX_NOTES_LENGTH);
}

/** Validates identifiers that arrive from Telegram callback data. */
export function isSafeId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(value);
}
