import { describe, expect, it } from 'vitest';
import type { Update, UserFromGetMe } from 'grammy/types';
import { AppContext } from '../../src/bot/context.js';

// Only `id`, `is_bot` and the names are read by the bot, so the rest of
// `UserFromGetMe` is irrelevant here.
const me = { id: 1, is_bot: true, first_name: 'Yadette', username: 'yadette_bot' } as UserFromGetMe;

function context(): AppContext {
  const update = {
    update_id: 1,
    message: {
      message_id: 1,
      date: 0,
      chat: { id: 1, type: 'private' },
      from: { id: 1, is_bot: false, first_name: 'Test' },
      text: '/start',
    },
  } as unknown as Update;

  // `api` is only stored by the base class, never used here.
  const api = {} as never;
  return new AppContext(update, api, me);
}

describe('AppContext', () => {
  /**
   * grammY never creates `ctx.state` by itself, so the first middleware write
   * (`ctx.state.user = ...`) used to throw
   * "Cannot set properties of undefined".
   */
  it('initialises state in the constructor', () => {
    const ctx = context();

    expect(ctx.state).toBeTypeOf('object');
    expect(ctx.state).not.toBeNull();
  });

  it('provides safe defaults until hydrateUser fills the state', () => {
    const ctx = context();

    expect(ctx.state.lang).toBe('fa');
    expect(ctx.state.isNewUser).toBe(false);
    expect(ctx.state.user).toBeUndefined();
  });

  it('keeps the same state object across writes', () => {
    const ctx = context();
    const first = ctx.state;

    ctx.state.isNewUser = true;
    ctx.state.lang = 'fa';

    expect(ctx.state).toBe(first);
    expect(ctx.state.isNewUser).toBe(true);
  });
});
