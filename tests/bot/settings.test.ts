import { describe, expect, it } from 'vitest';
import type { InlineKeyboard } from 'grammy';
import { settingsText, timezoneListText, deleteDataConfirmText, dataErasedText } from '../../src/bot/views/settings.views.js';
import { settingsKeyboard, timezoneKeyboard, deleteDataKeyboard } from '../../src/bot/keyboards/settings.js';
import { deleteDataCallback, parseCallbackData } from '../../src/bot/callbacks/data.js';
import { AVAILABLE_TIMEZONES } from '../../src/shared/utils/date.js';
import type { UserSettings } from '../../src/modules/settings/settings.repository.js';

function settings(overrides: Partial<UserSettings> = {}): UserSettings {
  return {
    timezone: 'Asia/Tehran',
    language: 'fa',
    reminderEnabled: true,
    ...overrides,
  };
}

function labels(keyboard: InlineKeyboard): string[] {
  return keyboard.inline_keyboard.flat().map((button) => button.text);
}

function callbackData(keyboard: InlineKeyboard): string[] {
  return keyboard.inline_keyboard.flat().map((button) =>
    'callback_data' in button ? button.callback_data : '',
  );
}

describe('settings screen', () => {
  /**
   * Regression: the language button used to render the raw code `FA` while the
   * screen text said `فارسی`, so the same value looked like two languages.
   *
   * The button label is the message template with its tags stripped: the Bot API
   * does not HTML-parse button text, so the tags used to reach the user raw.
   */
  it('names the language the same way in the text and on the button', () => {
    const text = settingsText(settings(), 'fa');
    const button = labels(settingsKeyboard(settings(), 'fa')).find((label) =>
      label.includes('زبان'),
    );

    expect(text).toContain('🗣 زبان: <b>فارسی</b>');
    expect(button).toBe('🗣 زبان: فارسی');
    expect(text).not.toContain('FA');
  });

  it('never puts an HTML tag in a button label', () => {
    const timezoneButton = labels(settingsKeyboard(settings(), 'fa')).find((label) =>
      label.includes('منطقه'),
    );

    expect(timezoneButton).toBe('🌍 منطقه زمانی: Asia/Tehran');
  });

  it('shows the current reminder state and timezone', () => {
    expect(settingsText(settings(), 'fa')).toContain('🔔 یادآوری‌ها: روشن');
    expect(settingsText(settings({ reminderEnabled: false }), 'fa')).toContain(
      '🔕 یادآوری‌ها: خاموش',
    );
    expect(settingsText(settings({ timezone: 'Europe/Berlin' }), 'fa')).toContain(
      '🌍 منطقه زمانی: <b>Europe/Berlin</b>',
    );
  });

  it('leaves no placeholder unreplaced', () => {
    expect(settingsText(settings(), 'fa')).not.toContain('{{');
    expect(settingsText(settings(), 'fa', '✅ ذخیره شد.')).not.toContain('{{');
  });

  it('appends the action notice only when one is given', () => {
    expect(settingsText(settings(), 'fa')).not.toContain('ذخیره شد');
    expect(settingsText(settings(), 'fa', '✅ ذخیره شد.')).toContain('✅ ذخیره شد.');
  });

  it('points at the data deletion section', () => {
    expect(settingsText(settings(), 'fa')).toContain('دکمه‌ی پایین رو بزن');
  });
});

describe('settings keyboard', () => {
  it('puts the destructive action on its own row, away from home', () => {
    const rows = settingsKeyboard(settings(), 'fa').inline_keyboard;
    const dataRow = rows.findIndex((row) => row.some((b) => b.text.includes('حذف همه‌ی اطلاعات')));
    const homeRow = rows.findIndex((row) => row.some((b) => b.text.includes('منوی اصلی')));

    expect(dataRow).toBeGreaterThanOrEqual(0);
    // Never share a row with the way out: one mis-tap must not delete anything.
    expect(dataRow).not.toBe(homeRow);
  });

  it('emits only callbacks the dispatcher understands', () => {
    for (const data of callbackData(settingsKeyboard(settings(), 'fa'))) {
      expect(parseCallbackData(data), data).not.toBeNull();
    }
    for (const data of callbackData(timezoneKeyboard('Asia/Tehran', 'fa'))) {
      expect(parseCallbackData(data), data).not.toBeNull();
    }
    for (const data of callbackData(deleteDataKeyboard('fa'))) {
      expect(parseCallbackData(data), data).not.toBeNull();
    }
  });

  it('marks the active timezone in the picker', () => {
    const row = timezoneKeyboard('Asia/Tehran', 'fa').inline_keyboard.find((buttons) =>
      buttons.some((button) => 'callback_data' in button && button.callback_data === 'settings:tz:set:Asia/Tehran'),
    );

    expect(row?.[0]?.text).toContain('✅');
  });
});

describe('timezone picker', () => {
  it('lists exactly the zones the keyboard offers', () => {
    const text = timezoneListText('Asia/Tehran', 'fa');
    const buttons = labels(timezoneKeyboard('Asia/Tehran', 'fa'));

    for (const zone of AVAILABLE_TIMEZONES) {
      expect(text).toContain(zone);
      expect(buttons.some((label) => label.includes(zone)), zone).toBe(true);
    }
  });

  it('always states the current zone, even outside the curated list', () => {
    expect(timezoneListText('Australia/Sydney', 'fa')).toContain('Australia/Sydney');
  });
});

describe('data deletion', () => {
  it('asks for confirmation before anything is destroyed', () => {
    const text = deleteDataConfirmText('fa');

    expect(text).toContain('حذف همه‌ی اطلاعات');
    expect(text).toContain('برگشت‌پذیر نیست');
    expect(text).not.toContain('{{');
  });

  it('offers both answers and each one is a known callback', () => {
    const keyboard = deleteDataKeyboard('fa');
    expect(labels(keyboard)).toHaveLength(2);
    expect(callbackData(keyboard)).toEqual([deleteDataCallback('yes'), deleteDataCallback('no')]);
  });

  it('confirms the wipe and tells the user how to start over', () => {
    const text = dataErasedText('fa');

    expect(text).toContain('همه‌ی اطلاعاتت پاک شد');
    expect(text).toContain('/start');
    expect(text).not.toContain('{{');
  });
});
