import { describe, expect, it } from 'vitest';
import { handleStart } from '../../src/bot/commands/start.js';
import { parseCallbackData } from '../../src/bot/callbacks/data.js';
import type { AppContext } from '../../src/bot/context.js';
import { fakeUser } from '../helpers/fakes.js';
import type { UserRecord } from '../../src/modules/users/user.types.js';

function ctxFor(user: UserRecord, isNewUser: boolean, match?: string) {
  const sent: { text: string; extra?: Record<string, unknown> }[] = [];
  const ctx = {
    state: { lang: 'fa', user, isNewUser },
    match,
    me: { username: 'yadetteBot' },
    chat: { id: 42 },
    reply: async (text: string, extra?: Record<string, unknown>) => {
      sent.push({ text, extra });
      return { message_id: sent.length };
    },
  };
  return { ctx: ctx as unknown as AppContext, sent };
}

function deps(peopleCount: number) {
  return {
    services: { persons: { countForUser: async () => peopleCount } },
    flowStore: { save: async () => undefined, clear: async () => undefined },
  } as never;
}

describe('/start end to end', () => {
  it('gives a new user one complete message with a button per section', async () => {
    const { ctx, sent } = ctxFor(fakeUser({ firstName: 'OmiD' }), true);
    await handleStart(ctx, deps(0));

    const welcome = sent[0];
    expect(welcome?.text).toContain('سلام! من یادم');
    expect(welcome?.text).toContain('دکمه‌های زیر');
    expect(welcome?.extra?.parse_mode).toBe('HTML');

    const rows = (welcome?.extra?.reply_markup as { inline_keyboard: { text: string }[][] })
      .inline_keyboard;
    expect(rows.flat().map((button) => button.text)).toEqual([
      '➕ اضافه کردن اولین نفر',
      '🎂 تولدها',
      '⚙️ تنظیمات',
      'ℹ️ راهنما',
      '📖 درباره یادت',
    ]);

    // First contact also installs the sticky reply keyboard.
    expect(sent).toHaveLength(2);
  });

  it('gives a returning user a single message with the same buttons', async () => {
    const { ctx, sent } = ctxFor(fakeUser({ firstName: 'OmiD' }), false);
    await handleStart(ctx, deps(2));

    expect(sent).toHaveLength(1);
    expect(sent[0]?.text).toContain('خوش اومدی');
    expect(sent[0]?.text).toContain('۲ نفر');

    const rows = (sent[0]?.extra?.reply_markup as { inline_keyboard: { callback_data?: string }[][] })
      .inline_keyboard;
    for (const row of rows) {
      for (const button of row) {
        if (!button.callback_data) continue;
        expect(parseCallbackData(button.callback_data), button.callback_data).not.toBeNull();
      }
    }
  });

  it('opens the add flow from the deep link without a greeting', async () => {
    const { ctx, sent } = ctxFor(fakeUser(), true, 'add');
    await handleStart(ctx, deps(0));
    expect(sent[0]?.text).toContain('اسمش چیه؟');
  });
});
