import { describe, expect, it } from 'vitest';
import { welcomeText, helpText } from '../../src/bot/views/menu.views.js';
import { welcomeKeyboard, START_ADD_PAYLOAD } from '../../src/bot/keyboards/start.js';
import { mainMenuLabels, mainMenuKeyboard } from '../../src/bot/keyboards/main.js';
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
    const text = welcomeText(user(), true, false, 'fa');
    expect(text).toContain('من یادم');
    expect(text).toContain('🔒');
    expect(text).not.toContain('{{');
  });

  it('keeps a returning user with people on a short greeting', () => {
    const text = welcomeText(user(), false, true, 'fa');
    expect(text).toContain('امیر');
    expect(text).not.toContain('من یادم');
  });

  it('nudges a returning user who has no people yet', () => {
    const text = welcomeText(user(), false, false, 'fa');
    expect(text).toContain('امیر');
    expect(text).toContain('هنوز کسی اضافه نکردی');
  });

  it('falls back to a friendly name when Telegram gives no name', () => {
    const text = welcomeText(user({ firstName: null, username: null }), false, true, 'fa');
    expect(text).toContain('دوست عزیز');
  });

  it('escapes a name that contains HTML', () => {
    const text = welcomeText(user({ firstName: '<b>hack</b>' }), false, true, 'fa');
    expect(text).toContain('&lt;b&gt;hack&lt;/b&gt;');
  });
});

describe('welcome call to action', () => {
  it('builds a deep link into the add-person flow', () => {
    const button = welcomeKeyboard('Yadett_bot').inline_keyboard[0]?.[0];
    expect(button).toMatchObject({ url: `https://t.me/Yadett_bot?start=${START_ADD_PAYLOAD}` });
  });

  it('falls back to an internal callback without a bot username', () => {
    const button = welcomeKeyboard(undefined).inline_keyboard[0]?.[0];
    expect(button).toMatchObject({ callback_data: 'nav:add' });
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
