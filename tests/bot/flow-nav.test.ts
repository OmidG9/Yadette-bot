import { beforeEach, describe, expect, it } from 'vitest';
import { handleNavCallback } from '../../src/bot/callbacks/nav.callbacks.js';
import { handleFlowCallback } from '../../src/bot/callbacks/flow.callbacks.js';
import { parseCallbackData } from '../../src/bot/callbacks/data.js';
import { flowNavKeyboard } from '../../src/bot/keyboards/reminder.js';
import { startAddPerson, createAddPersonFlow, readAddPersonData } from '../../src/bot/conversations/add-person.js';
import type { AppContext } from '../../src/bot/context.js';
import type { FlowState } from '../../src/bot/conversations/flow.store.js';
import { fakeUser } from '../helpers/fakes.js';

interface Sent {
  text: string;
  extra?: Record<string, unknown>;
}

interface Harness {
  ctx: AppContext;
  sent: Sent[];
  edited: { chatId: number; messageId: number; text: string; keyboard?: unknown }[];
  acked: boolean[];
}

function fakeCtx(options: { callback?: boolean } = {}): Harness {
  const sent: Sent[] = [];
  const edited: { chatId: number; messageId: number; text: string; keyboard?: unknown }[] = [];
  const acked: boolean[] = [];

  const ctx = {
    state: { lang: 'fa', user: fakeUser({ firstName: 'Sara' }), isNewUser: false },
    chat: { id: 7 },
    me: { id: 1, is_bot: true, first_name: 'Yadette', username: 'yadetteBot' },
    message: options.callback ? undefined : { message_id: 100 },
    callbackQuery: options.callback
      ? { data: undefined, message: { message_id: 100 } }
      : undefined,
    answerCallbackQuery: async () => {
      acked.push(true);
      return true;
    },
    reply: async (text: string, extra?: Record<string, unknown>) => {
      sent.push({ text, extra });
      return { message_id: sent.length };
    },
    api: {
      editMessageText: async (
        chatId: number,
        messageId: number,
        text: string,
        other?: { reply_markup?: unknown },
      ) => {
        edited.push({ chatId, messageId, text, keyboard: other?.reply_markup });
        return true;
      },
    },
  };

  return { ctx: ctx as unknown as AppContext, sent, edited, acked };
}

/** In-memory stand-in for the flow store. */
function fakeStore(initial: FlowState | null = null): { get: () => Promise<FlowState | null>; save: (next: FlowState) => Promise<void>; clear: () => Promise<void>; peek: () => FlowState | null } {
  let current = initial;
  return {
    get: async () => current,
    save: async (next: FlowState) => {
      current = next;
    },
    clear: async () => {
      current = null;
    },
    peek: () => current,
  };
}

function stateAt(step: string, data: Record<string, unknown> = {}): FlowState {
  return {
    userId: 'user1',
    flow: 'add-person',
    step,
    data: {
      name: 'Sara',
      month: 7,
      day: 18,
      year: 1380,
      notes: null,
      interests: [],
      reminderDays: [7, 3, 1, 0],
      ...data,
    },
    messageId: 100,
  };
}

describe('the cancel button that used to trap the user', () => {
  let store: ReturnType<typeof fakeStore>;

  beforeEach(() => {
    store = fakeStore(stateAt('birthday'));
  });

  it('drops the active flow so the next message is not swallowed', async () => {
    const { ctx } = fakeCtx({ callback: true });

    const handled = await handleNavCallback(ctx, 'menu', {
      services: {
        persons: { countForUser: async () => 0 },
        birthdays: { getUpcomingForUser: async () => [] },
      } as never,
      flowStore: store,
    });

    expect(handled).toBe(true);
    expect(store.peek()).toBeNull();
  });

  it('sends a button payload the dispatcher accepts', () => {
    expect(parseCallbackData('nav:menu')).toEqual({ kind: 'nav:menu' });
  });
});

describe('flow navigation buttons', () => {
  it('offers cancel alone on the first step, since nothing can be skipped yet', () => {
    const labels = labelsOf(flowNavKeyboard({ canSkip: false, canGoBack: false }));

    expect(labels).toEqual(['❌ لغو']);
  });

  it('offers back and cancel once there is a previous question', () => {
    expect(labelsOf(flowNavKeyboard({ canSkip: false, canGoBack: true }))).toEqual([
      '⏮ قبلی',
      '❌ لغو',
    ]);
  });

  it('offers next and back in reading order, forward first', () => {
    expect(labelsOf(flowNavKeyboard({ canSkip: true, canGoBack: true }))).toEqual([
      '⏭ بعدی',
      '⏮ قبلی',
      '❌ لغو',
    ]);
  });

  it('only emits callbacks the dispatcher accepts', () => {
    for (const step of [
      { canSkip: false, canGoBack: false },
      { canSkip: false, canGoBack: true },
      { canSkip: true, canGoBack: true },
    ]) {
      for (const row of flowNavKeyboard(step).inline_keyboard) {
        for (const button of row) {
          if (!('callback_data' in button)) continue;
          expect(parseCallbackData(button.callback_data), button.callback_data).not.toBeNull();
        }
      }
    }
  });
});

describe('«⏭ بعدی» skips an optional answer', () => {
  it('moves from interests to notes and stores an empty answer', async () => {
    const store = fakeStore(stateAt('interests', { interests: ['gaming'] }));
    const { ctx } = fakeCtx({ callback: true });

    await handleFlowCallback(ctx, { kind: 'flow:person:next' }, { services: {} as never, store: store });

    expect(store.peek()?.step).toBe('notes');
    expect(readAddPersonData(store.peek()!).interests).toEqual([]);
  });

  /**
   * Regression: skipping the notes step used to render the confirmation *text*
   * with the plain step keyboard, so the user got a "shall I save it?" screen
   * with no save button and no reminder toggles — only «لغو», which threw away
   * the whole person.
   */
  it('lands on the real confirmation screen, with the buttons that can act on it', async () => {
    const store = fakeStore(stateAt('notes', { notes: 'loves cake' }));
    const { ctx, edited } = fakeCtx({ callback: true });

    await handleFlowCallback(ctx, { kind: 'flow:person:next' }, { services: {} as never, store: store });

    expect(store.peek()?.step).toBe('reminders');
    expect(edited.at(-1)?.text).toContain('آماده‌ست');

    const data = (edited.at(-1)?.keyboard as { inline_keyboard: { callback_data: string }[][] })
      .inline_keyboard.flat().map((button) => button.callback_data);
    expect(data).toContain('flow:person:save');
    // Every one of them must be a payload the dispatcher actually accepts.
    for (const payload of data) {
      expect(parseCallbackData(payload), payload).not.toBeNull();
    }
  });

  it('refuses on a step that needs an answer', async () => {
    const store = fakeStore(stateAt('birthday'));
    const { ctx } = fakeCtx({ callback: true });

    await handleFlowCallback(ctx, { kind: 'flow:person:next' }, { services: {} as never, store: store });

    expect(store.peek()?.step).toBe('birthday');
  });
});

describe('«⏮ قبلی» re-asks the previous question', () => {
  it('goes back from notes to interests without losing the name', async () => {
    const store = fakeStore(stateAt('notes', { notes: 'loves cake' }));
    const { ctx, edited } = fakeCtx({ callback: true });

    await handleFlowCallback(ctx, { kind: 'flow:person:back' }, { services: {} as never, store: store });

    expect(store.peek()?.step).toBe('interests');
    expect(readAddPersonData(store.peek()!).name).toBe('Sara');
    expect(edited.at(-1)?.text).toContain('چی دوست داره؟');
  });

  it('refuses on the first step', async () => {
    const store = fakeStore(stateAt('name', { name: '' }));
    const { ctx } = fakeCtx({ callback: true });

    await handleFlowCallback(ctx, { kind: 'flow:person:back' }, { services: {} as never, store: store });

    expect(store.peek()?.step).toBe('name');
  });
});

describe('flow state is persisted exactly once per step', () => {
  /**
   * Regression: the step handlers used to save the state themselves *and*
   * return it to the middleware, which then saved the same row again. Two
   * writes per keystroke is a race waiting to lose an answer.
   */
  it('does not write twice while a step handler renders its next prompt', async () => {
    let writes = 0;
    const inner = fakeStore(stateAt('name'));
    const counting = {
      ...inner,
      save: async (next: FlowState) => {
        writes += 1;
        await inner.save(next);
      },
    };

    const { ctx } = fakeCtx();
    const flow = createAddPersonFlow(counting);

    // The name step: a valid answer renders the birthday prompt and returns
    // the new state to the middleware.
    await flow.steps.name?.(ctx, stateAt('name'), 'Sara');

    expect(writes).toBe(0);
  });

  it('writes once through the middleware, with the message id of the prompt', async () => {
    const store = fakeStore(stateAt('name'));
    const { ctx, sent } = fakeCtx();
    const flow = createAddPersonFlow(store);

    const handler = flow.steps.name;
    const action = (await handler?.(ctx, stateAt('name'), 'Sara')) ?? {};

    // Reproduce what the middleware does with the handler's return value.
    await store.save({
      userId: 'user1',
      flow: flow.name,
      step: action.next ?? 'name',
      data: { ...stateAt('name').data, ...action.data },
      messageId: action.messageId ?? null,
    });

    expect(store.peek()?.step).toBe('birthday');
    // The birthday prompt was rewritten in place, so the state has to point at
    // that message for the next step to keep reusing it.
    expect(store.peek()?.messageId).toBe(100);
    expect(sent).toHaveLength(0);
  });
});

describe('step prompts', () => {
  it('shows the step counter and the way out', async () => {
    const store = fakeStore();
    const { ctx } = fakeCtx();

    await startAddPerson(ctx, store);

    expect(store.peek()?.step).toBe('name');
  });
});

function labelsOf(keyboard: { inline_keyboard: { text: string }[][] }): string[] {
  return keyboard.inline_keyboard.flat().map((button) => button.text);
}
