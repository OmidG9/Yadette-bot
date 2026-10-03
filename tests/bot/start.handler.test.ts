import { describe, expect, it } from 'vitest';
import { handleStart } from '../../src/bot/commands/start.js';
import { parseCallbackData } from '../../src/bot/callbacks/data.js';
import type { AppContext } from '../../src/bot/context.js';
import { fakeUser } from '../helpers/fakes.js';
import type { UserRecord } from '../../src/modules/users/user.types.js';

function ctxFor(
  user: UserRecord,
  isNewUser: boolean,
  match?: string,
): {
  ctx: AppContext;
  sent: { text: string; extra?: Record<string, unknown> }[];
} {
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

function deps(peopleCount: number, buckets: unknown = null): never {
  return {
    services: {
      persons: { countForUser: async () => peopleCount },
      birthdays: { getDashboardForUser: async () => buckets },
    },
    flowStore: { save: async () => undefined, clear: async () => undefined },
  } as never;
}

/** A dashboard projection with one person, for the returning-user path. */
const withBirthdays = {
  today: [],
  thisWeek: [],
  later: [],
  nextBirthday: null,
  totalPeople: 2,
  thisMonthCount: 2,
  jalaliMonth: 8,
};

describe('/start end to end', () => {
  it('gives a new user one complete message with a button per section', async () => {
    const { ctx, sent } = ctxFor(fakeUser({ firstName: 'OmiD' }), true);
    await handleStart(ctx, deps(0));

    const welcome = sent[0];
    expect(welcome?.text).toContain('سلام! من «یادته» هستم');
    expect(welcome?.text).toContain('دکمه‌های زیر');
    expect(welcome?.extra?.parse_mode).toBe('HTML');

    const rows = (welcome?.extra?.reply_markup as { inline_keyboard: { text: string }[][] })
      .inline_keyboard;
    expect(rows.flat().map((button) => button.text)).toEqual([
      '➕ اضافه کردن اولین نفر',
      '🏠 خانه',
      '🎂 تولدها',
      '🔎 جستجو',
      '📅 تقویم',
      '⚙️ تنظیمات',
      'ℹ️ راهنما',
      '📖 درباره‌ی یادته',
    ]);

    // First contact also installs the sticky reply keyboard.
    expect(sent).toHaveLength(2);
  });

  it('gives a returning user a single message with the same buttons', async () => {
    const { ctx, sent } = ctxFor(fakeUser({ firstName: 'OmiD' }), false);
    await handleStart(ctx, deps(2, withBirthdays));

    expect(sent).toHaveLength(1);
    // §3.1 calls the dashboard the main screen, so `/start` lands on it.
    expect(sent[0]?.text).toContain('تولدهای نزدیک');
    expect(sent[0]?.text).toContain('۲ نفر');

    const rows = (
      sent[0]?.extra?.reply_markup as { inline_keyboard: { callback_data?: string }[][] }
    ).inline_keyboard;
    expect(rows.flat().length).toBeGreaterThan(0);
    for (const row of rows) {
      for (const button of row) {
        if (!button.callback_data) continue;
        expect(parseCallbackData(button.callback_data), button.callback_data).not.toBeNull();
      }
    }
  });

  /** Three empty buckets is a worse first impression than the welcome text. */
  it('still greets a returning user who has nobody registered', async () => {
    const { ctx, sent } = ctxFor(fakeUser({ firstName: 'OmiD' }), false);
    await handleStart(ctx, deps(0));

    expect(sent[0]?.text).toContain('خوش اومدی');
  });

  it('falls back to the welcome text if the dashboard cannot be built', async () => {
    const { ctx, sent } = ctxFor(fakeUser({ firstName: 'OmiD' }), false);
    // `null` is what getDashboardForUser returns for a user who no longer exists.
    await handleStart(ctx, deps(2, null));

    expect(sent[0]?.text).toContain('خوش اومدی');
  });

  it('opens the add flow from the deep link without a greeting', async () => {
    const { ctx, sent } = ctxFor(fakeUser(), true, 'add');
    await handleStart(ctx, deps(0));
    expect(sent[0]?.text).toContain('اسمش چیه؟');
  });
});
