import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Update } from 'grammy/types';
import { createBot } from '../../src/bot/bot.js';
import { featureFlags } from '../../src/config/feature-flags.js';
import { UserService } from '../../src/modules/users/user.service.js';
import { PersonService } from '../../src/modules/people/person.service.js';
import { BirthdayService } from '../../src/modules/birthdays/birthday.service.js';
import { ReminderService } from '../../src/modules/reminders/reminder.service.js';
import { SettingsService } from '../../src/modules/settings/settings.service.js';
import { HealthService } from '../../src/modules/health/health.service.js';
import { FakePersonRepository } from '../helpers/fake-person.repository.js';
import { FakeReminderRepository, FakeUserRepository, fakeUser } from '../helpers/fakes.js';
import type { FlowState, FlowStore } from '../../src/bot/conversations/flow.store.js';
import type {
  SettingsRepository,
  UserSettings,
} from '../../src/modules/settings/settings.repository.js';
import type { Services } from '../../src/container.js';
import {
  calendarMonthCallback,
  navCallback,
  parseCallbackData,
  snoozeAskCallback,
  snoozeDoCallback,
} from '../../src/bot/callbacks/data.js';
import { t } from '../../src/shared/i18n/index.js';

/**
 * Roadmap §19 asks for a "Bot Flow" test layer, and §3.7 item 8 for complete
 * tests of the new features. Everything here therefore goes through
 * `bot.handleUpdate`, not a handler called directly.
 *
 * The difference matters: a handler test proves the handler works, while these
 * prove the button actually reaches it. The bugs this catches are the ones that
 * only exist between the layers — a callback kind the parser rejects, a flow that
 * was never registered on the bot, a keyboard that renders a payload the
 * dispatcher does not know.
 */

/** 18 Mehr 1405 — the day `Sara`'s seeded birthday falls on. */
const TODAY = new Date('2026-10-10T06:00:00.000Z');

const CHAT = { id: 7, type: 'private' as const };
const FROM = { id: 100200300, is_bot: false as const, first_name: 'Sara' };

interface ApiCall {
  method: string;
  payload: Record<string, unknown>;
}

interface Button {
  text: string;
  callback_data?: string;
}

/** A Telegram server that records what the bot sent instead of sending it. */
function telegramFake(): {
  fetch: typeof fetch;
  calls: ApiCall[];
  clear: () => void;
  lastText: () => string;
  lastButtons: () => Button[];
} {
  const calls: ApiCall[] = [];
  let nextMessageId = 500;

  const fetchImpl = (async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = url.split('/').pop() ?? '';
    const body = init?.body;
    const payload = (
      typeof body === 'string' && body.length > 0 ? JSON.parse(body) : {}
    ) as Record<string, unknown>;
    calls.push({ method, payload });

    const results: Record<string, unknown> = {
      getMe: {
        id: 42,
        is_bot: true,
        first_name: 'Yadette',
        username: 'yadetteBot',
        can_join_groups: false,
        can_read_all_group_messages: false,
        supports_inline_queries: false,
      },
      sendMessage: {
        message_id: (nextMessageId += 1),
        date: 0,
        chat: { id: Number(payload.chat_id ?? 0), type: 'private' },
        text: payload.text,
      },
      editMessageText: {
        message_id: Number(payload.message_id ?? 0),
        edit_date: 0,
        chat: { id: Number(payload.chat_id ?? 0), type: 'private' },
        text: payload.text,
      },
      answerCallbackQuery: true,
      setMyCommands: true,
    };

    const result = Object.prototype.hasOwnProperty.call(results, method) ? results[method] : true;
    return new Response(JSON.stringify({ ok: true, result }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  /** Text of the last message the bot posted or rewrote. */
  const lastText = (): string => {
    for (let index = calls.length - 1; index >= 0; index -= 1) {
      const call = calls[index];
      if (call && (call.method === 'sendMessage' || call.method === 'editMessageText')) {
        return typeof call.payload.text === 'string' ? call.payload.text : '';
      }
    }
    return '';
  };

  const lastButtons = (): Button[] => {
    for (let index = calls.length - 1; index >= 0; index -= 1) {
      const call = calls[index];
      if (!call || (call.method !== 'sendMessage' && call.method !== 'editMessageText')) continue;
      const markup = call.payload.reply_markup as
        | { inline_keyboard: Button[][] }
        | undefined;
      if (markup?.inline_keyboard) return markup.inline_keyboard.flat();
    }
    return [];
  };

  return { fetch: fetchImpl, calls, clear: () => void (calls.length = 0), lastText, lastButtons };
}

class MemoryFlowStore implements FlowStore {
  private states = new Map<string, FlowState>();

  async get(userId: string): Promise<FlowState | null> {
    return this.states.get(userId) ?? null;
  }

  async save(state: FlowState): Promise<void> {
    this.states.set(state.userId, state);
  }

  async clear(userId: string): Promise<void> {
    this.states.delete(userId);
  }

  /** Test helper: the state a flow left behind, if any. */
  peek(userId: string): FlowState | null {
    return this.states.get(userId) ?? null;
  }
}

class MemorySettingsRepository implements SettingsRepository {
  private rows = new Map<string, UserSettings>();

  async findSettings(userId: string): Promise<UserSettings | null> {
    return this.rows.get(userId) ?? null;
  }

  async updateSettings(userId: string, input: Partial<UserSettings>): Promise<UserSettings> {
    const next: UserSettings = {
      timezone: 'Asia/Tehran',
      language: 'fa',
      reminderEnabled: true,
      ...this.rows.get(userId),
      ...input,
    };
    this.rows.set(userId, next);
    return next;
  }
}

let updateSeq = 0;

function messageUpdate(text: string): Update {
  updateSeq += 1;
  return {
    update_id: updateSeq,
    message: { message_id: updateSeq, date: 0, chat: CHAT, from: FROM, text },
  } as Update;
}

/** A tap on an inline button, carrying the id of the message it sits on. */
function callbackUpdate(data: string, messageId = 900): Update {
  updateSeq += 1;
  return {
    update_id: updateSeq,
    callback_query: {
      id: String(updateSeq),
      from: FROM,
      chat_instance: 'ci',
      data,
      message: { message_id: messageId, date: 0, chat: CHAT },
    },
  } as Update;
}

async function buildBot(): Promise<{
  bot: ReturnType<typeof createBot>;
  telegram: ReturnType<typeof telegramFake>;
  people: FakePersonRepository;
  reminders: FakeReminderRepository;
  flowStore: MemoryFlowStore;
}> {
  const people = new FakePersonRepository();
  const users = new FakeUserRepository([fakeUser()]);
  const reminders = new FakeReminderRepository();
  const flowStore = new MemoryFlowStore();

  const services: Services = {
    users: new UserService(users, 'Asia/Tehran'),
    persons: new PersonService(people),
    birthdays: new BirthdayService(people, users),
    reminders: new ReminderService(reminders, users),
    settings: new SettingsService(new MemorySettingsRepository()),
    health: new HealthService({ ping: async () => 1 }),
  };

  const telegram = telegramFake();
  const bot = createBot({ token: 'test-token', services, flowStore, client: { fetch: telegram.fetch } });
  // `ctx.me` is read by the nav handlers, so the bot has to know itself first.
  await bot.init();

  return { bot, telegram, people, reminders, flowStore };
}

/** A person whose birthday is today, so they land in the «🔴 امروز» bucket. */
async function seedBirthdayToday(people: FakePersonRepository): Promise<void> {
  await people.create({
    userId: 'user1',
    name: 'یاسمن',
    birthMonth: 7,
    birthDay: 18,
    birthYear: null,
    reminderDays: [7, 3, 1, 0],
  });
}

describe('the dashboard button reaches the dashboard', () => {
  beforeEach(() => {
    // Only Date is faked: grammY awaits real promises internally, and faking the
    // timer queue would deadlock the update pipeline instead of fixing it.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(TODAY);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders the urgency buckets instead of the old flat list', async () => {
    const { bot, telegram, people } = await buildBot();
    await seedBirthdayToday(people);

    await bot.handleUpdate(callbackUpdate(navCallback('dashboard')));

    const text = telegram.lastText();
    expect(text).toContain('تولدهای نزدیک');
    expect(text).toContain('🔴 امروز');
    expect(text).toContain('یاسمن');
  });

  it('keeps the section buttons on the dashboard, so it is not a dead end', async () => {
    const { bot, telegram, people } = await buildBot();
    await seedBirthdayToday(people);

    await bot.handleUpdate(callbackUpdate(navCallback('dashboard')));

    expect(telegram.lastButtons().map((button) => button.text)).toEqual(
      expect.arrayContaining(['🔎 جستجو', '📅 تقویم', '⚙️ تنظیمات']),
    );
  });

  /**
   * A user with nobody saved has no buckets to show, so the screen has to say how
   * to start rather than render three empty headings.
   */
  it('tells a user with no people how to add the first one', async () => {
    const { bot, telegram } = await buildBot();

    await bot.handleUpdate(callbackUpdate(navCallback('dashboard')));

    expect(telegram.lastText()).toContain('هنوز کسی ثبت نکردی');
  });

  /**
   * Roadmap §17: a flag is checked where the UI is built. Even so the handler
   * refuses, so a stale inline button from the chat history cannot resurrect a
   * feature somebody switched off.
   */
  it('refuses the dashboard when the feature is switched off', async () => {
    const { bot, telegram, people } = await buildBot();
    await seedBirthdayToday(people);
    vi.spyOn(featureFlags, 'isEnabled').mockImplementation((name) => name !== 'dashboard');

    await bot.handleUpdate(callbackUpdate(navCallback('dashboard')));

    expect(telegram.lastText()).not.toContain('تولدهای نزدیک');
    expect(telegram.lastText()).toContain(t('errors.invalidInput', 'fa'));
  });
});

describe('the calendar pages through months', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(TODAY);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows the current Jalali month with the birthdays in it', async () => {
    const { bot, telegram, people } = await buildBot();
    await seedBirthdayToday(people);

    await bot.handleUpdate(callbackUpdate(navCallback('calendar')));

    const text = telegram.lastText();
    expect(text).toContain('تقویم تولدها');
    expect(text).toContain('مهر');
    expect(text).toContain('یاسمن');
  });

  /**
   * The regression this guards: paging used to be relative, so pressing «بعدی»
   * three times landed back on the first month.
   */
  it('moves to an absolute month and does not wrap back to the start', async () => {
    const { bot, telegram, people } = await buildBot();
    await seedBirthdayToday(people);

    await bot.handleUpdate(callbackUpdate(navCallback('calendar')));
    telegram.clear();

    // Water = 8, Azar = 9, Dey = 10. Three taps forward must land three months
    // on: relative paging wrapped back to Mehr after the eleventh tap.
    for (const [month, expected] of [
      [8, 'آبان'],
      [9, 'آذر'],
      [10, 'دی'],
    ] as const) {
      await bot.handleUpdate(callbackUpdate(calendarMonthCallback(1405, month)));
      expect(telegram.lastText()).toContain(expected);
    }
  });

  it('every paging button carries a payload the dispatcher accepts', async () => {
    const { bot, telegram, people } = await buildBot();
    await seedBirthdayToday(people);

    await bot.handleUpdate(callbackUpdate(navCallback('calendar')));

    const payloads = telegram.lastButtons().flatMap((button) =>
      button.callback_data ? [button.callback_data] : [],
    );
    expect(payloads.length).toBeGreaterThan(0);
    expect(payloads).toEqual(
      expect.arrayContaining([calendarMonthCallback(1405, 8), navCallback('menu')]),
    );
  });

  it('shows an empty month rather than a broken heading', async () => {
    const { bot, telegram } = await buildBot();

    await bot.handleUpdate(callbackUpdate(calendarMonthCallback(1405, 1)));

    expect(telegram.lastText()).toContain('این ماه تولدی ثبت نشده');
  });

  it('refuses the calendar when the feature is switched off', async () => {
    const { bot, telegram } = await buildBot();
    vi.spyOn(featureFlags, 'isEnabled').mockImplementation((name) => name !== 'calendar');

    await bot.handleUpdate(callbackUpdate(navCallback('calendar')));

    expect(telegram.lastText()).toContain(t('errors.invalidInput', 'fa'));
  });
});

describe('search runs as a conversation', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(TODAY);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /**
   * The whole journey in one test: the 🔎 button, the prompt, the typed query and
   * the results. Splitting it hides exactly the wiring bug this is looking for —
   * a flow that was never registered would still pass a test that calls the step
   * handler directly.
   */
  it('opens a prompt, accepts a typed query and renders matches', async () => {
    const { bot, telegram, people, flowStore } = await buildBot();
    await seedBirthdayToday(people);

    await bot.handleUpdate(callbackUpdate(navCallback('search')));
    expect(telegram.lastText()).toContain('جستجوی افراد');
    expect(flowStore.peek('user1')?.flow).toBe('search');

    await bot.handleUpdate(messageUpdate('یاسمن'));

    expect(telegram.lastText()).toContain('یاسمن');
    expect(telegram.lastText()).toContain('نتیجه');
    // The flow ends on results, so the next message is not swallowed as a query.
    expect(flowStore.peek('user1')).toBeNull();
  });

  it('finds a person by their note, not only by name', async () => {
    const { bot, telegram, people } = await buildBot();
    await people.create({
      userId: 'user1',
      name: 'سارا',
      birthMonth: 12,
      birthDay: 3,
      birthYear: null,
      notes: 'عاشق کتاب فروشی',
    });

    await bot.handleUpdate(callbackUpdate(navCallback('search')));
    await bot.handleUpdate(messageUpdate('فروشی'));

    expect(telegram.lastText()).toContain('سارا');
  });

  it('matches across the two keyboard spellings of the same word', async () => {
    const { bot, telegram, people } = await buildBot();
    await people.create({
      userId: 'user1',
      name: 'سارا',
      birthMonth: 12,
      birthDay: 3,
      birthYear: null,
      interests: ['کتاب'],
    });

    await bot.handleUpdate(callbackUpdate(navCallback('search')));
    await bot.handleUpdate(messageUpdate('كتاب'));

    expect(telegram.lastText()).toContain('سارا');
  });

  /**
   * A query too short to match is the one case that keeps the flow open: there is
   * nothing else the user could have meant, so swallowing it would look like the
   * bot ignored them.
   */
  it('asks for more characters and stays in the flow', async () => {
    const { bot, telegram, flowStore } = await buildBot();

    await bot.handleUpdate(callbackUpdate(navCallback('search')));
    telegram.clear();
    await bot.handleUpdate(messageUpdate('م'));

    expect(telegram.lastText()).toContain('حداقل');
    expect(flowStore.peek('user1')?.step).toBe('query');
  });

  it('says so when nothing matches, and still ends the flow', async () => {
    const { bot, telegram, flowStore } = await buildBot();

    await bot.handleUpdate(callbackUpdate(navCallback('search')));
    await bot.handleUpdate(messageUpdate('ناموجود'));

    expect(telegram.lastText()).toContain('پیدا نشد');
    expect(flowStore.peek('user1')).toBeNull();
  });

  it('offers the dashboard again when a search finds nothing', async () => {
    const { bot, telegram } = await buildBot();

    await bot.handleUpdate(callbackUpdate(navCallback('search')));
    await bot.handleUpdate(messageUpdate('ناموجود'));

    // listKeyboard([]) is empty, so the way out is the message body itself.
    expect(telegram.lastText()).toContain('همین‌جا اضافه‌اش کن');
  });

  it('refuses search when the feature is switched off', async () => {
    const { bot, telegram, flowStore } = await buildBot();
    vi.spyOn(featureFlags, 'isEnabled').mockImplementation((name) => name !== 'search');

    await bot.handleUpdate(callbackUpdate(navCallback('search')));

    expect(telegram.lastText()).toContain(t('errors.invalidInput', 'fa'));
    expect(flowStore.peek('user1')).toBeNull();
  });
});

describe('the snooze buttons on a delivered reminder', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(TODAY);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /** A notification that was actually delivered, so it can be snoozed. */
  async function seedDeliveredReminder(reminders: FakeReminderRepository): Promise<string> {
    const log = await reminders.claimNotification({
      userId: 'user1',
      personId: 'person1',
      birthdayYear: 1405,
      daysBefore: 7,
    });
    await reminders.markSent(log!.id, new Date());
    return log!.id;
  }

  it('opens the offset chooser from the snooze button', async () => {
    const { bot, telegram, reminders } = await buildBot();
    const deliveryId = await seedDeliveredReminder(reminders);

    await bot.handleUpdate(callbackUpdate(snoozeAskCallback(deliveryId)));

    expect(telegram.lastText()).toBe(t('snooze.prompt', 'fa'));

    const buttons = telegram.lastButtons();
    expect(buttons.map((button) => button.text)).toEqual([
      '⏰ فردا یادآوری کن',
      '۳ روز دیگه یادآوری کن',
      '۷ روز دیگه یادآوری کن',
      '✖️ بستن',
    ]);

    // A button whose payload the parser rejects is a button that does nothing.
    for (const button of buttons) {
      expect(parseCallbackData(button.callback_data), button.callback_data).not.toBeNull();
    }
  });

  it('records the snooze the user picked', async () => {
    const { bot, telegram, reminders } = await buildBot();
    const deliveryId = await seedDeliveredReminder(reminders);

    await bot.handleUpdate(callbackUpdate(snoozeDoCallback(deliveryId, 3)));

    expect(reminders.snoozeCount()).toBe(1);
    expect(telegram.lastText()).toContain('یادت میارم');
  });

  /**
   * Callback data is attacker controlled and the parser only bounds `days` to
   * 0..365, so a 99-day snooze parses fine. The handler is the only thing that
   * knows which offsets the product offers.
   */
  it('refuses an offset the product never offered', async () => {
    const { bot, telegram, reminders } = await buildBot();
    const deliveryId = await seedDeliveredReminder(reminders);

    await bot.handleUpdate(callbackUpdate(snoozeDoCallback(deliveryId, 99)));

    expect(reminders.snoozeCount()).toBe(0);
    expect(telegram.lastText()).toContain(t('errors.invalidInput', 'fa'));
  });

  /**
   * Beyond the parser's own bound the payload never reaches a handler at all, so
   * nothing is answered — a stale button in the chat history must not turn into a
   * message that looks like the bot understood it.
   */
  it('drops an out-of-range offset without answering at all', async () => {
    const { bot, telegram, reminders } = await buildBot();
    const deliveryId = await seedDeliveredReminder(reminders);

    await bot.handleUpdate(callbackUpdate(snoozeDoCallback(deliveryId, 400)));

    expect(reminders.snoozeCount()).toBe(0);
    expect(telegram.calls.some((call) => call.method === 'sendMessage')).toBe(false);
    // The spinner still has to stop, or the button hangs forever.
    expect(telegram.calls.some((call) => call.method === 'answerCallbackQuery')).toBe(true);
  });

  /**
   * The delivery id is a database id, so it is guessable in principle. A delivery
   * belonging to another user must be indistinguishable from one that does not
   * exist.
   */
  it('will not snooze a reminder that belongs to somebody else', async () => {
    const { bot, telegram, reminders } = await buildBot();
    await reminders.claimNotification({
      userId: 'someoneElse',
      personId: 'person9',
      birthdayYear: 1405,
      daysBefore: 7,
    });

    await bot.handleUpdate(callbackUpdate(snoozeDoCallback('log1', 3)));

    expect(reminders.snoozeCount()).toBe(0);
    expect(telegram.lastText()).toContain('اعتبار نداره');
  });

  /**
   * A button can outlive the row it points at. Answering with a shrug the user
   * can act on beats a button that silently does nothing.
   */
  it('explains a button whose delivery no longer exists', async () => {
    const { bot, telegram, reminders } = await buildBot();

    await bot.handleUpdate(callbackUpdate(snoozeAskCallback('log404')));

    expect(telegram.lastText()).toBe(t('snooze.expired', 'fa'));
    expect(reminders.snoozeCount()).toBe(0);
  });

  it('re-snoozing the same delivery replaces the row instead of stacking', async () => {
    const { bot, reminders } = await buildBot();
    const deliveryId = await seedDeliveredReminder(reminders);

    await bot.handleUpdate(callbackUpdate(snoozeDoCallback(deliveryId, 1)));
    await bot.handleUpdate(callbackUpdate(snoozeDoCallback(deliveryId, 7)));

    // One pending delivery, not two: a second row would send a second reminder.
    expect(reminders.snoozeCount()).toBe(1);
  });

  it('leaves no snooze button behind when the feature is switched off', async () => {
    const { bot, telegram, reminders } = await buildBot();
    const deliveryId = await seedDeliveredReminder(reminders);
    vi.spyOn(featureFlags, 'isEnabled').mockImplementation((name) => name !== 'snooze');

    await bot.handleUpdate(callbackUpdate(snoozeAskCallback(deliveryId)));

    expect(telegram.lastText()).toContain(t('errors.invalidInput', 'fa'));
    expect(telegram.lastButtons()).toEqual([]);
    expect(reminders.snoozeCount()).toBe(0);
  });
});

describe('a callback the bot does not understand', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(TODAY);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('is rejected before it reaches a handler, and the spinner still stops', async () => {
    const { bot, telegram } = await buildBot();

    await bot.handleUpdate(callbackUpdate('nav:secret-admin'));

    expect(telegram.calls.some((call) => call.method === 'answerCallbackQuery')).toBe(true);
    expect(telegram.lastText()).toBe('');
  });

  it('never crashes the update loop', async () => {
    const { bot } = await buildBot();

    await expect(bot.handleUpdate(callbackUpdate('person:view'))).resolves.toBeUndefined();
  });
});
