import { t, type Language } from '../../shared/i18n/index.js';
import { escapeHtml, truncate } from '../../shared/utils/text.js';

function safe(value: string): string {
  return escapeHtml(value);
}

/**
 * Common reusable state views (Loading / Empty / Error).
 * Designed to match the existing view style (HTML-safe, i18n-based).
 */

export interface EmptyStateOptions {
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
  query?: string;
  maxQueryLength?: number;
}

export function loadingText(lang: Language): string {
  const parts: string[] = [t('states.loading.title', lang)];
  const subtitle = t('states.loading.subtitle', lang);
  if (subtitle) {
    parts.push('', subtitle);
  }
  return parts.join('\n');
}

export function emptyStateText(lang: Language, options: EmptyStateOptions = {}): string {
  const {
    title = t('states.empty.title', lang),
    subtitle = t('states.empty.subtitle', lang),
    ctaLabel = t('states.empty.cta', lang),
    query,
    maxQueryLength = 40,
  } = options;

  const parts: string[] = [title];

  let effectiveSubtitle = subtitle;
  if (query) {
    const q = safe(truncate(query, maxQueryLength));
    effectiveSubtitle = t('search.empty', lang, { query: q });
  }

  if (effectiveSubtitle) {
    parts.push('', effectiveSubtitle);
  }

  if (ctaLabel) {
    parts.push('', `<b>${safe(ctaLabel)}</b>`);
  }

  return parts.join('\n');
}

export interface ErrorStateOptions {
  title?: string;
  subtitle?: string;
  retryLabel?: string;
  error?: unknown;
}

export function errorStateText(lang: Language, options: ErrorStateOptions = {}): string {
  const {
    title = t('states.error.title', lang),
    subtitle = t('states.error.subtitle', lang),
    retryLabel = t('states.error.retry', lang),
  } = options;

  const parts: string[] = [title];
  if (subtitle) {
    parts.push('', subtitle);
  }
  if (retryLabel) {
    parts.push('', `<b>${safe(retryLabel)}</b>`);
  }
  return parts.join('\n');
}

/**
 * Small helper for list states.
 */
export function listEmptyText(lang: Language, fallbackCta = t('states.empty.cta', lang)): string {
  const parts: string[] = [t('states.empty.title', lang)];
  const subtitle = t('states.empty.subtitle', lang);
  if (subtitle) {
    parts.push('', subtitle);
  }
  parts.push('', `<b>${safe(fallbackCta)}</b>`);
  return parts.join('\n');
}
