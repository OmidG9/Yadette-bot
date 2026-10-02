import { t, type Language } from '../../shared/i18n/index.js';
import { escapeHtml } from '../../shared/utils/text.js';
import { toPersianDigits } from '../../shared/utils/date.js';

function safe(value: string): string {
  return escapeHtml(value);
}

export function thinkingText(lang: Language): string {
  return t('chat.thinking', lang);
}

export function generatingText(lang: Language): string {
  return t('chat.generating', lang);
}

export function streamingText(lang: Language): string {
  return t('chat.streaming', lang);
}

export function sendingText(lang: Language): string {
  return t('chat.sending', lang);
}

export function sentText(lang: Language): string {
  return t('chat.sent', lang);
}

export function failedText(lang: Language, reason?: string): string {
  const base = t('chat.failed', lang);
  if (reason) {
    return `${base}\n${safe(reason)}`;
  }
  return base;
}

export interface MessageMeta {
  author: 'user' | 'bot' | 'system';
  name?: string;
  timestamp?: Date;
  status?: 'sending' | 'sent' | 'failed' | 'retrying';
}

export function formatTimestamp(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${toPersianDigits(h)}:${toPersianDigits(m)}`;
}

export function messageBubbleText(content: string, meta: MessageMeta, lang: Language): string {
  const lines: string[] = [];
  const safeContent = content;
  lines.push(safeContent);

  const metaParts: string[] = [];
  if (meta.timestamp) {
    metaParts.push(formatTimestamp(meta.timestamp));
  }
  if (meta.status === 'sending') {
    metaParts.push(t('chat.sending', lang));
  }
  if (meta.status === 'retrying') {
    metaParts.push(t('chat.retrying', lang));
  }
  if (meta.status === 'failed') {
    metaParts.push(t('chat.failed', lang));
  }
  if (meta.status === 'sent') {
    metaParts.push(t('chat.sent', lang));
  }

  if (metaParts.length > 0) {
    lines.push('', `<i>${safe(metaParts.join(' • '))}</i>`);
  }

  return lines.join('\n');
}
