import { describe, expect, it } from 'vitest';
import { handleNavCallback, handleSettingsCallback } from '../../src/bot/callbacks/nav.callbacks.js';
import type { AppContext } from '../../src/bot/context.js';
import { fakeUser } from '../helpers/fakes.js';
import type { UserRecord } from '../../src/modules/users/user.types.js';
import type { UpcomingBirthday } from '../../src/modules/birthdays/birthday.types.js';

function upcoming(name: string): UpcomingBirthday {
  return {
    person: {
      id: 'p1',
      userId: 'user1',
      name,
      birthMonth: 7,
      birthDay: 18,
      birthYear: 1380,
      notes: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      interests: [],
      reminders: [],
    },
    rule: { month: 7, day: 18, year: 1380 },
    occurrence: {
      jalaliYear: 1405,
      jalali: { jy: 1405, jm: 7, jd: 18 },
      civil: { year: 2026, month: 10, day: 10 },
      daysUntil: 3,
    },
    daysUntil: 3,
    age: 25,
  };
}

interface Message {
  text: string;
  keyboard: { inline_keyboard: { text: string; callback_data?: string }[][] } | undefined;
}

function ctxFor(user: UserRecord = fakeUser()): {
  ctx: AppContext;
  edited: Message[];
  sent: Message[];
} {
  const edited: Message[] = [];
  const sent: Message[] = [];

  const ctx = {
    state: { lang: 'fa', user, isNewUser: false },
    chat: { id: 42, type: 'private' },
    from: { id: 708005947, username: 'sara_user', first_name: 'Sara' },
    me: { id: 1, is_bot: true, first_name: 'Yadette', username: 'yadetteBot' },
    callbackQuery: { message: { message_id: 7 } },
    answerCallbackQuery: async () => undefined,
    api: {
      editMessageText: async (
        _chatId: number,
        _messageId: number,
        text: string,
        extra?: { reply_markup?: { inline_keyboard: { text: string; callback_data?: string }[][] } },
      ) => {
        edited.push({ text, keyboard: extra?.reply_markup });
        return true;
      },
    },
    reply: async (
      text: string,
      extra?: { reply_markup?: { inline_keyboard: { text: string; callback_data?: string }[][] } },
    ) => {
      sent.push({ text, keyboard: extra?.reply_markup });
      return { message_id: sent.length };
    },
  };

  return { ctx: ctx as unknown as AppContext, edited, sent };
}

function buttonLabels(message: Message | undefined): string[] {
  return (message?.keyboard?.inline_keyboard ?? []).flat().map((button) => button.text);
}

function deps(services: unknown): { services: never; flowStore: never } {
  // `nav:menu` also drops any active flow, so leaving the screen really exits.
  return {
    services: services as never,
    flowStore: { clear: async () => undefined } as never,
  };
}

const SETTINGS = { timezone: 'Asia/Tehran', language: 'fa', reminderEnabled: true } as const;

describe('the exit button of the settings screen', () => {
  /**
   * Regression, two parts.
   *
   *  1. `nav:menu` used to render `listKeyboard([])`, so leaving settings always
   *     looked like the user had nobody saved.
   *  2. It then kept rendering the birthday list, which made the button labelled
   *     «🏠 منوی اصلی» a no-op, and tapping it twice posted a duplicate list
   *     because the second edit failed with "not modified" and fell back to a
   *     new message.
   *
   * It is the home screen now: one button per section, as the label promises.
   */
  it('shows the home screen with a button per section', async () => {
    const { ctx, edited } = ctxFor();
    const calls: string[] = [];

    const handled = await handleNavCallback(
      ctx,
      'menu',
      deps({
        persons: {
          countForUser: async (id: string) => {
            calls.push(id);
            return 1;
          },
        },
      }),
    );

    expect(handled).toBe(true);
    expect(calls).toEqual(['user1']);
    expect(edited[0]?.text).toContain('۱');
    expect(buttonLabels(edited[0]).length).toBeGreaterThanOrEqual(4);
  });

  it('is not the birthday list', async () => {
    const { ctx, edited } = ctxFor();

    await handleNavCallback(
      ctx,
      'menu',
      deps({
        persons: { countForUser: async () => 1 },
        birthdays: {
          getUpcomingForUser: async () => [upcoming('سارا')],
        },
      }),
    );

    // The person is not on the home screen; the list has its own target.
    expect(edited[0]?.text).not.toContain('سارا');
  });
});

describe('settings:data', () => {
  function deletionDeps(freshUser: UserRecord): {
    deleted: string[];
    touched: string[];
    services: {
      users: {
        deleteAccount: (id: string) => Promise<void>;
        getOrCreate: () => Promise<{ user: UserRecord; created: boolean }>;
        markSeen: (id: string) => Promise<void>;
      };
    };
  } {
    const deleted: string[] = [];
    const touched: string[] = [];

    return {
      deleted,
      touched,
      services: {
        users: {
          deleteAccount: async (id: string) => {
            deleted.push(id);
          },
          getOrCreate: async () => ({ user: freshUser, created: true }),
          markSeen: async (id: string) => {
            touched.push(id);
          },
        },
      },
    };
  }

  it('asks before deleting anything', async () => {
    const { ctx, edited } = ctxFor();
    let deleted = 0;

    await handleSettingsCallback(
      ctx,
      { kind: 'settings:data:ask' },
      deps({
        users: {
          deleteAccount: async () => {
            deleted += 1;
          },
        },
      }),
    );

    expect(deleted).toBe(0);
    expect(edited[0]?.text).toContain('برگشت‌پذیر نیست');
    expect(buttonLabels(edited[0])).toHaveLength(2);
  });

  it('deletes nothing when the user backs out', async () => {
    const { ctx, edited } = ctxFor();
    let deleted = 0;

    await handleSettingsCallback(
      ctx,
      { kind: 'settings:data:no' },
      deps({
        users: {
          deleteAccount: async () => {
            deleted += 1;
          },
        },
        settings: { get: async () => SETTINGS },
      }),
    );

    expect(deleted).toBe(0);
    expect(edited[0]?.text).toContain('⚙️ <b>تنظیمات</b>');
  });

  /**
   * The whole point of the feature: after the wipe the very next message must
   * be greeted as a first contact, with nothing carried over.
   */
  it('erases the data and re-hydrates as a brand new user', async () => {
    const fresh = fakeUser({ id: 'user2', createdAt: new Date() });
    const harness = deletionDeps(fresh);
    const { ctx, edited } = ctxFor();

    const handled = await handleSettingsCallback(
      ctx,
      { kind: 'settings:data:yes' },
      deps(harness.services),
    );

    expect(handled).toBe(true);
    expect(harness.deleted).toEqual(['user1']);
    expect(harness.touched).toEqual(['user2']);

    // The state must point at a live user, not at the deleted row.
    expect(ctx.state.user.id).toBe('user2');
    expect(ctx.state.isNewUser).toBe(true);

    expect(edited[0]?.text).toContain('همه‌ی اطلاعاتت پاک شد');
    expect(edited[0]?.text).toContain('/start');
  });
});

describe('settings actions', () => {
  /**
   * Regression: the language button used to `sendText` a message with no
   * keyboard, leaving the user in a dead end with no way back to settings.
   */
  it('keeps the language answer on the settings screen', async () => {
    const { ctx, edited, sent } = ctxFor();

    await handleSettingsCallback(
      ctx,
      { kind: 'settings:language' },
      deps({ settings: { get: async () => SETTINGS } }),
    );

    expect(sent).toEqual([]);
    expect(edited[0]?.text).toContain('فقط فارسی پشتیبانی می‌شه');
    expect(edited[0]?.text).toContain('⚙️ <b>تنظیمات</b>');
    // The keyboard must survive, otherwise there is no way back to settings.
    expect(buttonLabels(edited[0])).toContain('🏠 منوی اصلی');
  });

  /**
   * Telegram refuses an edit whose text is unchanged, and `editOrSend` then
   * posts a new message — which used to leave a duplicate settings screen
   * behind when re-picking the already active timezone.
   */
  it('confirms the timezone so re-picking it never duplicates the screen', async () => {
    const { ctx, sent } = ctxFor();

    await handleSettingsCallback(
      ctx,
      { kind: 'settings:tz:set', timezone: 'Asia/Tehran' },
      deps({ settings: { setTimezone: async () => SETTINGS } }),
    );

    expect(sent).toEqual([]);
  });

  it('reports a rejected timezone as invalid input', async () => {
    const { ctx } = ctxFor();

    await expect(
      handleSettingsCallback(
        ctx,
        { kind: 'settings:tz:set', timezone: 'Not/AZone' },
        deps({
          settings: {
            setTimezone: async () => {
              throw new Error('Unknown timezone');
            },
          },
        }),
      ),
    ).rejects.toThrow();
  });
});
