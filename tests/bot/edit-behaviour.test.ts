import { describe, expect, it } from 'vitest';
import { editMessageById, editOrSend } from '../../src/bot/helpers.js';
import type { AppContext } from '../../src/bot/context.js';

/** A context whose only interesting behaviour is how `editMessageText` fails. */
function fakeCtx(
  failure: string | null,
  opts: { promptMessageId?: number; incomingMessageId?: number; callbackMessageId?: number } = {},
): { ctx: AppContext; edits: { chatId: number; messageId: number; text: string }[]; sendCount: () => number } {
  const edits: { chatId: number; messageId: number; text: string }[] = [];
  let sends = 0;

  const ctx = {
    state: {
      lang: 'fa',
      isNewUser: false,
      user: { id: '1', language: 'fa' },
      ...(opts.promptMessageId !== undefined ? { promptMessageId: opts.promptMessageId } : {}),
    },
    chat: { id: 100 },
    message: opts.incomingMessageId !== undefined ? { message_id: opts.incomingMessageId } : undefined,
    callbackQuery:
      opts.callbackMessageId !== undefined ? { message: { message_id: opts.callbackMessageId } } : undefined,
    reply: async () => {
      sends += 1;
      return { message_id: 999 };
    },
    answerCallbackQuery: async () => true,
    api: {
      editMessageText: async (chatId: number, messageId: number, text: string) => {
        edits.push({ chatId, messageId, text });
        if (failure) {
          // grammY's `GrammyError` carries `description` on the error itself.
          throw Object.assign(new Error('Telegram'), { description: failure });
        }
        return true;
      },
    },
  };

  return {
    ctx: ctx as unknown as AppContext,
    edits,
    sendCount: () => sends,
  };
}

describe('editing a message that already shows the text', () => {
  /**
   * Regression: "message is not modified" used to be treated the same as "this
   * message is gone", so pressing a button that re-shows the current screen
   * posted a second copy of it.
   */
  it('does not post a duplicate when the target already shows the text', async () => {
    const { ctx, sendCount } = fakeCtx('Bad Request: message is not modified', {
      callbackMessageId: 55,
    });

    await editOrSend(ctx, 'یادت چیه؟');

    expect(sendCount()).toBe(0);
  });

  it('still posts a replacement when the message can no longer be edited', async () => {
    for (const description of [
      'Bad Request: message to edit not found',
      "Bad Request: message can't be edited",
    ]) {
      const { ctx, sendCount } = fakeCtx(description, { callbackMessageId: 55 });

      await editOrSend(ctx, 'یادت چیه؟');

      expect(sendCount(), description).toBe(1);
    }
  });

  it('rethrows a real Telegram failure instead of hiding it', async () => {
    const { ctx } = fakeCtx('Bad Request: chat not found');

    await expect(editMessageById(ctx, 100, 55, 'x')).rejects.toThrow();
  });
});

describe('which message gets rewritten', () => {
  /**
   * Regression: answering a question used to rewrite the user's own message,
   * deleting the text they had just typed.
   */
  it('rewrites the bot prompt rather than the text the user just sent', async () => {
    const { ctx, edits, sendCount } = fakeCtx(null, {
      promptMessageId: 70,
      incomingMessageId: 71,
    });

    await editOrSend(ctx, 'اسمش چیه؟');

    expect(edits).toEqual([{ chatId: 100, messageId: 70, text: 'اسمش چیه؟' }]);
    expect(sendCount()).toBe(0);
  });

  it('prefers the callback message, because that is the one carrying the buttons', async () => {
    const { ctx, edits } = fakeCtx(null, {
      promptMessageId: 70,
      callbackMessageId: 80,
    });

    await editOrSend(ctx, 'جزئیات');

    expect(edits[0]?.messageId).toBe(80);
  });

  it('remembers the prompt it sent so the next answer can rewrite it', async () => {
    const { ctx } = fakeCtx(null, {});
    let nextId = 42;

    (ctx as unknown as { reply: () => Promise<{ message_id: number }> }).reply = async () => ({
      message_id: nextId++,
    });

    await editOrSend(ctx, 'اول');

    expect(ctx.state.promptMessageId).toBe(42);
  });
});
