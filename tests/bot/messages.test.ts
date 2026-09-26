import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { aboutText, helpText, welcomeText } from '../../src/bot/views/menu.views.js';
import { showMainMenu } from '../../src/bot/helpers.js';
import type { AppContext } from '../../src/bot/context.js';
import { fakeUser } from '../helpers/fakes.js';
import { fa } from '../../src/shared/i18n/fa.js';

const SRC = join(process.cwd(), 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}

function leaves(value: unknown, path: string[] = []): { path: string; text: string }[] {
  if (typeof value === 'string') return [{ path: path.join('.'), text: value }];
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => leaves(child, [...path, key]));
  }
  return [];
}

const allCopy = leaves(fa);

describe('copy safety', () => {
  it('only ever uses <b> as markup, so nothing can leak as a raw tag', () => {
    for (const { path, text } of allCopy) {
      const withoutBold = text.replaceAll('<b>', '').replaceAll('</b>', '');
      expect(withoutBold, `${path} contains markup other than <b>`).not.toMatch(/[<>]/);
    }
  });

  it('balances every <b> in the copy', () => {
    for (const { path, text } of allCopy) {
      const open = text.split('<b>').length - 1;
      const close = text.split('</b>').length - 1;
      expect(open, `${path} has unbalanced <b>`).toBe(close);
    }
  });

  it('leaves no placeholder unreplaced in the rendered copy', () => {
    const rendered = [aboutText('fa'), helpText('fa')].join('\n');
    expect(rendered).not.toContain('{{');
  });
});

describe('messages always carry parse_mode', () => {
  /**
   * Regression: the greeting once reached Telegram without `parse_mode`, so the
   * user saw a literal `<b>OmiD</b>`. Context-bound sends are now funnelled
   * through `sendText`/`editOrSend`/`editMessageById` in `helpers.ts`.
   */
  it('routes every context-bound send through the helpers funnel', () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(SRC)) {
      const relative = file.slice(SRC.length + 1).replaceAll('\\', '/');
      if (relative === 'bot/helpers.ts') continue;

      const source = readFileSync(file, 'utf8');
      for (const pattern of [
        /ctx\.reply\(/g,
        /ctx\.editMessageText\(/g,
        /ctx\.api\.editMessageText\(/g,
      ]) {
        if (pattern.test(source)) offenders.push(relative);
      }
    }

    expect(offenders).toEqual([]);
  });

  /** Jobs have no context, so they call the API directly — but still parse HTML. */
  it('keeps parse_mode on every direct api send', () => {
    for (const file of sourceFiles(SRC)) {
      const source = readFileSync(file, 'utf8');
      if (!/api\.sendMessage\(/.test(source)) continue;
      expect(source, file).toContain('parse_mode');
    }
  });
});

describe('the greeting that leaked raw tags', () => {
  function fakeCtx(): {
    ctx: AppContext;
    sent: { text: string; extra?: Record<string, unknown> }[];
  } {
    const sent: { text: string; extra?: Record<string, unknown> }[] = [];
    const ctx = {
      state: { lang: 'fa', user: fakeUser({ firstName: 'OmiD' }) },
      chat: { id: 1 },
      reply: async (text: string, extra?: Record<string, unknown>) => {
        sent.push({ text, extra });
        return { message_id: sent.length };
      },
    };
    return { ctx: ctx as unknown as AppContext, sent };
  }

  it('sends the returning-user greeting with parse_mode set', async () => {
    const { ctx, sent } = fakeCtx();
    const text = welcomeText(fakeUser({ firstName: 'OmiD' }), false, 3, 'fa');

    await showMainMenu(ctx, text);

    expect(sent).toHaveLength(1);
    expect(sent[0]?.text).toContain('<b>OmiD</b>');
    expect(sent[0]?.extra?.parse_mode).toBe('HTML');
  });

  it('sends the main menu title with parse_mode set', async () => {
    const { ctx, sent } = fakeCtx();

    await showMainMenu(ctx);

    expect(sent[0]?.extra?.parse_mode).toBe('HTML');
    expect(sent[0]?.extra?.reply_markup).toBeDefined();
  });
});

describe('about text', () => {
  it('explains the product, the flow, privacy and the commands', () => {
    const text = aboutText('fa');
    expect(text).toContain('درباره‌ی یادته');
    expect(text).toContain('تولد');
    expect(text).toContain('۷ روز قبل');
    expect(text).toContain('حریم خصوصی');
    expect(text).toContain('/cancel');
    expect(text).toContain('فقط تو می‌بینیش');
  });

  it('stays inside Telegram message limits', () => {
    expect(aboutText('fa').length).toBeLessThan(4096);
  });
});
