import { describe, expect, it } from 'vitest';
import { welcomeText, helpText } from '../../src/bot/views/menu.views.js';
import { welcomeKeyboard, START_ADD_PAYLOAD } from '../../src/bot/keyboards/start.js';
import { mainMenuLabels, mainMenuKeyboard } from '../../src/bot/keyboards/main.js';
import { parseCallbackData } from '../../src/bot/callbacks/data.js';
import { allFlagsOn, flagsExcept } from '../helpers/feature-flags.js';
import type { UserRecord } from '../../src/modules/users/user.types.js';

function user(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: 'usr123',
    telegramId: '708005947',
    username: 'amir_dev',
    firstName: 'امیر',
    lastName: null,
    timezone: 'Asia/Tehran',
    language: 'fa',
    reminderEnabled: true,
    lastSeenAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('first-run welcome', () => {
  it('explains the product and the privacy promise to a brand new user', () => {
    const text = welcomeText(user(), true, 0, 'fa');
    expect(text).toContain('من «یادته» هستم');
    expect(text).toContain('🔒');
    expect(text).not.toContain('{{');
  });

  it('gives a returning user their status and points at the buttons', () => {
    const text = welcomeText(user(), false, 3, 'fa');
    expect(text).toContain('امیر');
    expect(text).toContain('۳ نفر');
    expect(text).toContain('دکمه‌های زیر');
    expect(text).not.toContain('من «یادته» هستم');
  });

  it('tells a returning user with an empty list how to start', () => {
    const text = welcomeText(user(), false, 0, 'fa');
    expect(text).toContain('امیر');
    expect(text).toContain('هنوز کسی اضافه نکردی');
  });

  it('falls back to a friendly name when Telegram gives no name', () => {
    const text = welcomeText(user({ firstName: null, username: null }), false, 3, 'fa');
    expect(text).toContain('دوست عزیز');
  });

  it('escapes a name that contains HTML', () => {
    const text = welcomeText(user({ firstName: '<b>hack</b>' }), false, 3, 'fa');
    expect(text).toContain('&lt;b&gt;hack&lt;/b&gt;');
  });
});

describe('welcome call to action', () => {
  const menu = (
    username: string | undefined,
    flags = allFlagsOn(),
  ): { text: string; callback_data?: string; url?: string }[][] =>
    welcomeKeyboard({ username, lang: 'fa', flags }).inline_keyboard;

  it('builds a deep link into the add-person flow', () => {
    const button = menu('Yadett_bot')[0]?.[0];
    expect(button).toMatchObject({ url: `https://t.me/Yadett_bot?start=${START_ADD_PAYLOAD}` });
  });

  it('falls back to an internal callback without a bot username', () => {
    const button = menu(undefined)[0]?.[0];
    expect(button).toMatchObject({ callback_data: 'nav:add' });
  });

  it('offers a tappable button for every enabled section', () => {
    const rows = menu('Yadett_bot');
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
  });

  /**
   * Regression risk the roadmap calls out in §17: a section that is switched
   * off must not leave a button behind. A dead button is a promise the bot
   * cannot keep.
   */
  it('omits a section whose feature flag is off', () => {
    const rows = menu('Yadett_bot', flagsExcept('search', 'calendar', 'dashboard'))
      .flat()
      .map((button) => button.text);

    expect(rows).not.toContain('🔎 جستجو');
    expect(rows).not.toContain('📅 تقویم');
    expect(rows).not.toContain('🏠 خانه');
    // Settings is not behind a flag and must survive.
    expect(rows).toContain('⚙️ تنظیمات');
  });

  /**
   * Regression: `nav:add` was missing from the known callback targets, so the
   * no-username fallback button was silently ignored by the dispatcher.
   */
  it('only emits callbacks the dispatcher understands', () => {
    for (const username of ['Yadett_bot', undefined]) {
      for (const row of menu(username)) {
        for (const button of row) {
          if (!('callback_data' in button)) continue;
          expect(parseCallbackData(button.callback_data), button.callback_data).not.toBeNull();
        }
      }
    }
  });
});

describe('main menu', () => {
  it('offers exactly one list, so the merged birthday screen is the only one', () => {
    const labels = mainMenuLabels();
    expect(labels.filter((label) => label.includes('تولد'))).toHaveLength(1);
    expect(labels.some((label) => label.includes('افراد من'))).toBe(false);
  });

  it('builds a three button keyboard', () => {
    const keyboard = mainMenuKeyboard();
    expect(keyboard.keyboard.flat()).toHaveLength(3);
  });
});

describe('help text', () => {
  it('lists the sections and accepts every date format the parser does', () => {
    const text = helpText('fa');
    expect(text).toContain('۱۸ مهر ۱۳۸۰');
    expect(text).toContain('۲ آبان');
    expect(text).toContain('2001-10-10');
    expect(text).not.toContain('{{');
  });
});
