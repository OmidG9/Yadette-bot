import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCallbackData } from '../../src/bot/callbacks/data.js';
import {
  cancelKeyboard,
  confirmKeyboard,
  flowNavKeyboard,
  interestsKeyboard,
  pendingReminderKeyboard,
  reminderKeyboard,
} from '../../src/bot/keyboards/reminder.js';
import {
  listKeyboard,
  personDetailsKeyboard,
  personEditKeyboard,
} from '../../src/bot/keyboards/person.js';
import {
  deleteDataKeyboard,
  settingsKeyboard,
  timezoneKeyboard,
} from '../../src/bot/keyboards/settings.js';
import { welcomeKeyboard } from '../../src/bot/keyboards/start.js';
import { allFlagsOn } from '../helpers/feature-flags.js';
import type { UserSettings } from '../../src/modules/settings/settings.repository.js';
import type { ReminderRecord } from '../../src/modules/reminders/reminder.types.js';
import type { InterestRecord, PersonWithReminders } from '../../src/modules/people/person.types.js';
import type { UpcomingBirthday } from '../../src/modules/birthdays/birthday.types.js';

const personId = 'clx1234567890abcdefghijklm';

const settings: UserSettings = {
  timezone: 'Asia/Tehran',
  language: 'fa',
  reminderEnabled: true,
};

const stamp = { createdAt: new Date(0), updatedAt: new Date(0) };

const reminder = (daysBefore: number, enabled: boolean): ReminderRecord => ({
  id: `rem${daysBefore}`,
  userId: 'user1',
  personId,
  daysBefore,
  enabled,
  ...stamp,
});

const interest = (id: string, title: string): InterestRecord => ({
  id,
  personId,
  title,
  createdAt: new Date(0),
});

const upcoming = (id: string, name: string): UpcomingBirthday => {
  const person: PersonWithReminders = {
    id,
    userId: 'user1',
    name,
    birthMonth: 1,
    birthDay: 1,
    birthYear: 1380,
    notes: null,
    deletedAt: null,
    ...stamp,
    interests: [],
    reminders: [reminder(7, true)],
  };
  return {
    person,
    rule: { month: 1, day: 1, year: null },
    occurrence: {
      jalaliYear: 1404,
      jalali: { jy: 1404, jm: 1, jd: 1 },
      civil: { year: 2025, month: 3, day: 21 },
      daysUntil: 3,
    },
    daysUntil: 3,
    age: 24,
  };
};

/** URL buttons carry no `callback_data` and never reach the parser. */
function payloads(keyboard: unknown): string[] {
  return (keyboard as { inline_keyboard: { callback_data?: string }[][] }).inline_keyboard
    .flat()
    .map((button) => button.callback_data)
    .filter((data): data is string => typeof data === 'string');
}

function labels(keyboard: unknown): string[] {
  return (keyboard as { inline_keyboard: { text: string }[][] }).inline_keyboard.flat().map(
    (button) => button.text,
  );
}

const KEYBOARDS: [string, unknown][] = [
  ['welcomeKeyboard (deep link)', welcomeKeyboard({ username: 'yadetteBot', lang: 'fa', flags: allFlagsOn() })],
  ['welcomeKeyboard (no username)', welcomeKeyboard({ username: undefined, lang: 'fa', flags: allFlagsOn() })],
  ['personDetailsKeyboard (with interests)', personDetailsKeyboard(personId, 'fa', true)],
  ['personDetailsKeyboard (without interests)', personDetailsKeyboard(personId, 'fa', false)],
  ['personEditKeyboard', personEditKeyboard(personId)],
  ['listKeyboard (empty)', listKeyboard([])],
  ['listKeyboard (three people)', listKeyboard([upcoming('a1', 'سارا'), upcoming('b2', 'امیر'), upcoming('c3', 'نگار')])],
  ['reminderKeyboard (mixed)', reminderKeyboard(personId, [reminder(7, true), reminder(0, false)])],
  ['pendingReminderKeyboard', pendingReminderKeyboard([7, 3, 1, 0])],
  ['interestsKeyboard (empty)', interestsKeyboard(personId, [])],
  ['interestsKeyboard', interestsKeyboard(personId, [interest('i1', 'فوتبال')])],
  ['settingsKeyboard', settingsKeyboard(settings)],
  ['timezoneKeyboard', timezoneKeyboard('Asia/Tehran')],
  ['deleteDataKeyboard', deleteDataKeyboard()],
  ['confirmKeyboard', confirmKeyboard('settings:data:yes', 'settings:data:no')],
  ['cancelKeyboard', cancelKeyboard()],
  ['flowNavKeyboard (next + back)', flowNavKeyboard({ canSkip: true, canGoBack: true })],
  ['flowNavKeyboard (back only)', flowNavKeyboard({ canSkip: false, canGoBack: true })],
  ['flowNavKeyboard (next only)', flowNavKeyboard({ canSkip: true, canGoBack: false })],
];

/**
 * Regression guard: `person:edit:<personId>` was emitted by two keyboards but
 * rejected by `parseCallbackData`, so the main edit button and the edit prompts'
 * only exit button did nothing at all. A keyboard test that only checks its
 * shape can never catch that; only a round-trip can.
 */
describe('every keyboard button is a payload the parser accepts', () => {
  it.each(KEYBOARDS)('%s', (_name, keyboard) => {
    const bad = payloads(keyboard).filter((data) => parseCallbackData(data) === null);
    expect(bad).toEqual([]);
  });
});

describe('button labels', () => {
  it('never contains HTML tags, which the Bot API does not parse on buttons', () => {
    for (const [name, keyboard] of KEYBOARDS) {
      const offending = labels(keyboard).filter((label) => /<[^>]+>/.test(label));
      expect(`${name}: ${offending.join(' | ')}`).toBe(`${name}: `);
    }
  });
});

/**
 * Callback strings are a wire format with three coupled sides: the builder that
 * writes it, the parser that reads it, and the dispatcher that acts on it. A
 * hand-typed payload can only break the first two — it parses fine and then does
 * nothing — so nothing short of banning the literal can catch it.
 */
describe('keyboards never hand-type a callback payload', () => {
  const RAW = /['`](nav:[a-z]+|person:[a-z:]+|flow:[a-z:]+|reminder:[a-z:]+|interest:[a-z:]+|settings:[a-z:]+)['`]/;

  it('finds no raw payload literals in src/bot/keyboards', () => {
    const dir = join(process.cwd(), 'src', 'bot', 'keyboards');
    const offenders: string[] = [];

    for (const file of readdirSync(dir).filter((name) => name.endsWith('.ts'))) {
      const full = join(dir, file);
      readFileSync(full, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          // Ignore comment lines: documenting a payload is fine.
          if (/^\s*(\*|\/\/)/.test(line)) return;
          if (RAW.test(line)) offenders.push(`${file}:${i + 1}  ${line.trim()}`);
        });
    }

    expect(offenders).toEqual([]);
  });

  it('round-trips every builder through the parser', () => {
    for (const [name, keyboard] of KEYBOARDS) {
      for (const data of payloads(keyboard)) {
        expect(parseCallbackData(data), `${name}: ${data}`).not.toBeNull();
        // And back out again, so the builder cannot encode something the parser
        // silently reinterprets.
        expect(data.length, `${name}: ${data}`).toBeLessThanOrEqual(64);
      }
    }
  });
});
