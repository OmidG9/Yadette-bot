import { t, type Language } from '../../shared/i18n/index.js';
import { escapeHtml } from '../../shared/utils/text.js';

function safe(v: string): string {
  return escapeHtml(v);
}

export function toastSaved(lang: Language): string {
  return t('feedback.saved', lang);
}

export function toastUpdated(lang: Language): string {
  return t('feedback.updated', lang);
}

export function toastDeleted(lang: Language): string {
  return t('feedback.deleted', lang);
}

export function toastCopied(lang: Language): string {
  return t('feedback.copied', lang);
}

export function toastDone(lang: Language): string {
  return t('feedback.done', lang);
}

export function toastWorking(lang: Language): string {
  return t('feedback.working', lang);
}

export function inlineError(lang: Language, msg?: string): string {
  const base = t('feedback.failed', lang);
  if (msg) return base + '\n' + safe(msg);
  return base;
}