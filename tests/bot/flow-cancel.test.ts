import { describe, expect, it } from 'vitest';
import { handlePersonCallback } from '../../src/bot/callbacks/person.callbacks.js';
import { createFlowMiddleware } from '../../src/bot/conversations/flow.js';
import { startAddInterest } from '../../src/bot/conversations/add-interest.js';
import { parseCallbackData } from '../../src/bot/callbacks/data.js';
import type { AppContext } from '../../src/bot/context.js';
import type { FlowDefinition, FlowState } from '../../src/bot/conversations/flow.js';
import { fakeUser } from '../helpers/fakes.js';

const personId = 'clx1234567890abcdefghijklm';

function fakeStore(initial: FlowState | null = null) {
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

function fakeCtx(text?: string): { ctx: AppContext; replied: string[] } {
  const replied: string[] = [];
  const ctx = {
    state: { lang: 'fa', user: fakeUser(), isNewUser: false },
    chat: { id: 7 },
    message: text === undefined ? undefined : { message_id: 100, text },
    callbackQuery: undefined,
    answerCallbackQuery: async () => true,
    reply: async (value: string) => {
      replied.push(value);
      return { message_id: replied.length };
    },
    api: {
      editMessageText: async () => true,
      editMessageReplyMarkup: async () => true,
    },
  };
  return { ctx: ctx as unknown as AppContext, replied };
}

const person = {
  id: personId,
  userId: 'user1',
  name: 'Sara',
  birthMonth: 7,
  birthDay: 18,
  birthYear: 1380,
  notes: null,
  deletedAt: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  interests: [],
  reminders: [],
};

const services = {
  persons: { getForUser: async () => person },
} as never;

/**
 * Regression: the add-interest prompt's «❌ لغو» pointed at `person:interests`,
 * which never touched the flow store. The user believed they had cancelled,
 * and their next ordinary message was silently saved as an interest.
 */
describe('cancelling the add-interest prompt', () => {
  it('drops the flow, so the next message is not saved as an interest', async () => {
    const store = fakeStore();
    const { ctx } = fakeCtx();

    await startAddInterest(ctx, store, personId);
    expect(store.peek()?.flow).toBe('add-interest');

    const handled = await handlePersonCallback(
      ctx,
      { kind: 'person:interests', personId },
      { services, flowStore: store, showUpcomingList: async () => {} },
    );

    expect(handled).toBe(true);
    expect(store.peek()).toBeNull();
  });

  it('emits a payload the parser accepts', () => {
    expect(parseCallbackData(`person:interests:${personId}`)).toEqual({
      kind: 'person:interests',
      personId,
    });
  });
});

/**
 * Regression: the flow middleware is installed before the command handlers and
 * treated every text message as an answer, so `/start` typed mid-flow was read
 * as the answer to the open question — and `cleanName('/start')` passes.
 */
describe('commands are never read as flow answers', () => {
  const flow: FlowDefinition = {
    name: 'test-flow',
    initialStep: 'ask',
    steps: {
      ask: async (ctx, _state, text) => {
        await ctx.reply(`answer:${text}`);
        return { next: null };
      },
    },
  };

  it('passes /start through to the command handlers', async () => {
    const store = fakeStore({
      userId: 'user1',
      flow: 'test-flow',
      step: 'ask',
      data: {},
      messageId: 100,
    });
    const { ctx, replied } = fakeCtx('/start');
    let passedThrough = false;

    await createFlowMiddleware(store, [flow])(ctx, async () => {
      passedThrough = true;
    });

    expect(passedThrough).toBe(true);
    expect(replied).toEqual([]);
  });

  it('still reads a normal message as the answer', async () => {
    const store = fakeStore({
      userId: 'user1',
      flow: 'test-flow',
      step: 'ask',
      data: {},
      messageId: 100,
    });
    const { ctx, replied } = fakeCtx('Sara');
    let passedThrough = false;

    await createFlowMiddleware(store, [flow])(ctx, async () => {
      passedThrough = true;
    });

    expect(passedThrough).toBe(false);
    expect(replied).toEqual(['answer:Sara']);
  });
});
