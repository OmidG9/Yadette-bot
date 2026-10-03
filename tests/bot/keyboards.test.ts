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
  snoozeKeyboard,
  snoozeOptionsKeyboard,
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
import {
  birthdayDayKeyboard,
  birthdayMonthKeyboard,
  birthdayYearKeyboard,
} from '../../src/bot/keyboards/birthday.js';
import { interestPresetKeyboard, namePresetKeyboard } from '../../src/bot/keyboards/quick-pick.js';
import { calendarKeyboard } from '../../src/bot/views/calendar.views.js';
import { allFlagsOn, flagsExcept } from '../helpers/feature-flags.js';
import type { UserSettings } from '../../src/modules/settings/settings.repository.js';
import type { ReminderRecord } from '../../src/modules/reminders/reminder.types.js';
import type { InterestRecord, PersonWithReminders } from '../../src/modules/people/person.types.js';
import type { UpcomingBirthday } from '../../src/modules/birthdays/birthday.types.js';
import type { BirthdayMonth } from '../../src/modules/birthdays/calendar.js';

const personId = 'clx1234567890abcdefghijklm';

const settings: UserSettings = {
  timezone: 'Asia/Tehran',
  language: 'fa',
  reminderEnabled: true,
};

const stamp = { createdAt: new Date(0), updatedAt: new Date(0) };

const today = { jy: 1404, jm: 1, jd: 5 };

const januaryMonth: BirthdayMonth = { jalaliYear: 1404, jalaliMonth: 1, days: [], total: 0 };
const decemberMonth: BirthdayMonth = { ...januaryMonth, jalaliMonth: 12 };
const februaryMonth: BirthdayMonth = { ...januaryMonth, jalaliMonth: 2 };

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
function payloads(keyboard: unknown): string[] {  return (keyboard as { inline_keyboard: { callback_data?: string }[][] }).inline_keyboard
    .flat()
    .map((button) => button.callback_data)
    .filter((data): data is string => typeof data === 'string');
}

function labels(keyboard: unknown): string[] {
  return (keyboard as { inline_keyboard: { text: string }[][] }).inline_keyboard.flat().map(
    (button) => button.text,
  );
}

/** Every `.ts` file under a directory, recursively. */
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith('.ts') ? [full] : [];
  });
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
  ['snoozeKeyboard', snoozeKeyboard('log123')],
  ['snoozeOptionsKeyboard', snoozeOptionsKeyboard('log123')],
  ['birthdayMonthKeyboard', birthdayMonthKeyboard('fa')],
  ['birthdayDayKeyboard', birthdayDayKeyboard(1, 'fa')],
  ['birthdayYearKeyboard (first page)', birthdayYearKeyboard(1300, 1404, 'fa')],
  ['birthdayYearKeyboard (later page)', birthdayYearKeyboard(1380, 1404, 'fa')],
  ['namePresetKeyboard', namePresetKeyboard('fa')],
  ['interestPresetKeyboard (none selected)', interestPresetKeyboard([], 'fa')],
  ['interestPresetKeyboard (two selected)', interestPresetKeyboard(['فوتبال', 'موسیقی'], 'fa')],
  ['calendarKeyboard (current month)', calendarKeyboard(januaryMonth, today, 'fa', allFlagsOn())],
  ['calendarKeyboard (paged back)', calendarKeyboard(decemberMonth, today, 'fa', allFlagsOn())],
  ['calendarKeyboard (paged forward)', calendarKeyboard(februaryMonth, today, 'fa', allFlagsOn())],
  ['calendarKeyboard (dashboard flag off)', calendarKeyboard(januaryMonth, today, 'fa', flagsExcept('dashboard'))],
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
 * A button that points at a feature turned off is a button that answers
 * "invalid input" when tapped. `calendarKeyboard` rendered a `nav:dashboard`
 * shortcut that `nav:calendar` never gated, so it was reachable only by luck of
 * the default flags. A flag is checked where the UI is built.
 */
describe('no keyboard renders a button for a disabled feature', () => {
  it('drops the calendar dashboard shortcut when the dashboard flag is off', () => {
    const withDashboard = payloads(calendarKeyboard(januaryMonth, today, 'fa', allFlagsOn()));
    expect(withDashboard).toContain('nav:dashboard');

    const withoutDashboard = payloads(
      calendarKeyboard(januaryMonth, today, 'fa', flagsExcept('dashboard')),
    );
    expect(withoutDashboard).not.toContain('nav:dashboard');
    // The calendar's own controls survive; only the foreign button is gone.
    expect(withoutDashboard).toContain('cal:1404:02');
    expect(withoutDashboard).toContain('nav:menu');
  });

  it('still offers paging backwards on a paged month, dashboard flag or not', () => {
    for (const flags of [allFlagsOn(), flagsExcept('dashboard')]) {
      const data = payloads(calendarKeyboard(decemberMonth, today, 'fa', flags));
      expect(data).toContain('cal:1404:11');
      expect(data).toContain('cal:1405:01');
    }
  });
});

/**
 * Callback strings are a wire format with three coupled sides: the builder that
 * writes it, the parser that reads it, and the dispatcher that acts on it. A
 * hand-typed payload can only break the first two — it parses fine and then does
 * nothing — so nothing short of banning the literal can catch it.
 */
describe('no file builds a callback payload by hand', () => {
  // Only `callbacks/data.ts` may name a payload: it is the single builder. A
  // comparison against `data.kind` elsewhere is the parser's own vocabulary and
  // is excluded, or this test would flag every dispatcher.
  const BUILDER_DIR = join('callbacks', 'data.ts');
  const RAW = /['`](nav:[a-z]+|person:[a-z:]+|flow:[a-z:]+|reminder:[a-z:]+|interest:[a-z:]+|settings:[a-z:]+|snz:[a-z:]+|cal:[a-z:]+)['`]/;

  it('finds no raw payload literals outside callbacks/data.ts', () => {
    const root = join(process.cwd(), 'src', 'bot');
    const offenders: string[] = [];

    for (const file of walk(root)) {
      const relative = file.slice(root.length + 1);
      if (relative === BUILDER_DIR) continue;

      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          // Ignore comment lines: documenting a payload is fine, and several
          // doc comments name one on the same line as the `/**`.
          if (/^\s*(\*|\/\/|\/\*)/.test(line)) return;
          // `data.kind === 'person:edit'` and `case 'person:del:ask':` compare
          // against a parsed kind; that is reading the wire format, not writing
          // it. Only a literal in value position can become a button payload.
          if (/\bkind\b|\bcase\b/.test(line)) return;
          if (RAW.test(line)) offenders.push(`${relative}:${i + 1}  ${line.trim()}`);
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
