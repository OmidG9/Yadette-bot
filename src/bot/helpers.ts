import type { InlineKeyboard } from 'grammy';
import { mainMenuKeyboard } from './keyboards/main.js';
import type { AppContext } from './context.js';
import { t } from '../shared/i18n/index.js';

export type KeyboardExtra = {
  parse_mode: 'HTML';
  reply_markup?: InlineKeyboard;
};

/**
 * Telegram helpers.
 *
 * UX rule from the spec: prefer editing the existing message instead of sending
 * a new one, so the chat stays compact.
 */

/** Sends or edits a message, preferring an in-place edit. */
export async function editOrSend(
  ctx: AppContext,
  text: string,
  keyboard?: InlineKeyboard,
): Promise<number | undefined> {
  const extra: KeyboardExtra = {
    parse_mode: 'HTML',
    ...(keyboard ? { reply_markup: keyboard } : {}),
  };

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => undefined);
  }

  const messageId = await editCurrentMessage(ctx, text, extra);
  if (messageId !== undefined) return messageId;

  const sent = await ctx.reply(text, extra);
  return sent.message_id;
}

/** Replaces the message a callback belongs to (or the message just sent). */
export async function editCurrentMessage(
  ctx: AppContext,
  text: string,
  extra: KeyboardExtra,
): Promise<number | undefined> {
  const chatId = ctx.chat?.id;
  const messageId = ctx.callbackQuery?.message?.message_id ?? ctx.message?.message_id;
  if (chatId === undefined || messageId === undefined) return undefined;

  const edited = await editMessageById(ctx, chatId, messageId, text, extra.reply_markup);
  return edited ? messageId : undefined;
}

/** Edits a specific message by id. Returns `false` when Telegram refuses. */
export async function editMessageById(
  ctx: AppContext,
  chatId: number,
  messageId: number,
  text: string,
  keyboard?: InlineKeyboard,
): Promise<boolean> {
  try {
    await ctx.api.editMessageText(chatId, messageId, text, {
      parse_mode: 'HTML',
      ...(keyboard ? { reply_markup: keyboard } : {}),
    });
    return true;
  } catch {
    // Telegram throws when the new text is identical or the message is too old.
    return false;
  }
}

/** Sends the main menu with the reply keyboard attached. */
export async function showMainMenu(ctx: AppContext, text?: string): Promise<void> {
  await ctx.reply(text ?? t('menu.title', ctx.state.lang), {
    reply_markup: mainMenuKeyboard(ctx.state.lang),
  });
}

/** Silently acknowledges a callback query (never let the spinner hang). */
export async function ackCallback(ctx: AppContext): Promise<void> {
  if (!ctx.callbackQuery) return;
  await ctx.answerCallbackQuery().catch(() => undefined);
}
