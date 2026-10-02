import type { InlineKeyboard, Keyboard } from 'grammy';
import { mainMenuKeyboard } from './keyboards/main.js';
import type { AppContext } from './context.js';
import { t } from '../shared/i18n/index.js';

export type MessageExtra = {
  parse_mode: 'HTML';
  reply_markup?: InlineKeyboard;
};

/**
 * Telegram helpers.
 *
 * UX rule from the spec: prefer editing the existing message instead of sending
 * a new one, so the chat stays compact.
 *
 * Every user-facing message goes through `sendText` or `editOrSend`. Both always
 * set `parse_mode: 'HTML'`, so the `<b>` in the copy renders as bold instead of
 * leaking as raw tags — there is deliberately no way to send a message without
 * it.
 */

/** The only way user-facing text reaches Telegram. */
export async function sendText(
  ctx: AppContext,
  text: string,
  keyboard?: InlineKeyboard | Keyboard,
): Promise<number> {
  const sent = await ctx.reply(text, {
    parse_mode: 'HTML',
    ...(keyboard ? { reply_markup: keyboard } : {}),
  });
  return sent.message_id;
}

/** Sends or edits a message, preferring an in-place edit. */
export async function editOrSend(
  ctx: AppContext,
  text: string,
  keyboard?: InlineKeyboard,
): Promise<number | undefined> {
  const extra: MessageExtra = {
    parse_mode: 'HTML',
    ...(keyboard ? { reply_markup: keyboard } : {}),
  };

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => undefined);
  }

  const messageId = await editCurrentMessage(ctx, text, extra);
  if (messageId !== undefined) return messageId;

  const sent = await ctx.reply(text, extra);
  ctx.state.promptMessageId = sent.message_id;
  return sent.message_id;
}

/**
 * Replaces the message that should be rewritten in place.
 *
 * Order matters: the bot's own previous prompt comes first, because editing
 * `ctx.message` would replace the text the user just typed. A callback query
 * carries its own message, which is the right target for a button press.
 */
export async function editCurrentMessage(
  ctx: AppContext,
  text: string,
  extra: MessageExtra,
): Promise<number | undefined> {
  const chatId = ctx.chat?.id;
  const messageId =
    ctx.callbackQuery?.message?.message_id ??
    ctx.state.promptMessageId ??
    ctx.message?.message_id;
  if (chatId === undefined || messageId === undefined) return undefined;

  const outcome = await editMessageById(ctx, chatId, messageId, text, extra.reply_markup);
  // `unchanged` still counts as success: the requested screen is already up.
  return outcome === 'unavailable' ? undefined : messageId;
}

/** Outcome of trying to rewrite a message in place. */
export type EditOutcome =
  /** Telegram accepted the edit. */
  | 'edited'
  /**
   * The target already shows exactly this text. The screen the user asked for is
   * already there, so posting a new message would be a visible duplicate.
   */
  | 'unchanged'
  /**
   * The message is gone or can no longer be edited (it predates the bot, the
   * user deleted it, …). Only this case justifies sending a replacement.
   */
  | 'unavailable';

/**
 * Edits a specific message by id, reporting what happened instead of collapsing
 * it into a boolean.
 *
 * Anything else — the bot was blocked, the chat is gone, we are rate limited —
 * is rethrown, because swallowing it would hide the real cause from the logs.
 */
export async function editMessageById(
  ctx: AppContext,
  chatId: number,
  messageId: number,
  text: string,
  keyboard?: InlineKeyboard,
): Promise<EditOutcome> {
  try {
    await ctx.api.editMessageText(chatId, messageId, text, {
      parse_mode: 'HTML',
      ...(keyboard ? { reply_markup: keyboard } : {}),
    });
    return 'edited';
  } catch (error) {
    const outcome = classifyEditError(error);
    if (outcome !== null) return outcome;
    throw error;
  }
}

/**
 * The two failures that Telegram reports while editing, mapped to what the
 * caller should do about them.
 */
function classifyEditError(error: unknown): EditOutcome | null {
  const description = (error as { description?: string } | null)?.description ?? '';
  if (description.includes('message is not modified')) return 'unchanged';
  if (
    description.includes('message to edit not found') ||
    description.includes("message can't be edited")
  ) {
    return 'unavailable';
  }
  return null;
}

/** Sends the main menu with the reply keyboard attached. */
export async function showMainMenu(ctx: AppContext, text?: string): Promise<void> {
  await sendText(
    ctx,
    text ?? t('menu.title', ctx.state.lang),
    mainMenuKeyboard(ctx.state.lang),
  );
}

/** Silently acknowledges a callback query (never let the spinner hang). */
export async function ackCallback(ctx: AppContext): Promise<void> {
  if (!ctx.callbackQuery) return;
  await ctx.answerCallbackQuery().catch(() => undefined);
}

export async function answerCallbackQueryWithToast(
  ctx: AppContext,
  text?: string,
  showAlert = false,
): Promise<void> {
  try {
    await ctx.answerCallbackQuery({
      text: text ?? undefined,
      show_alert: showAlert,
    });
  } catch {
    // ignore
  }
}
export async function withChatAction(
  ctx: AppContext,
  action: 'typing' | 'upload_photo' | 'record_video' | 'upload_video' | 'record_voice' | 'upload_voice' | 'upload_document' | 'choose_sticker' | 'find_location' | 'record_video_note' | 'upload_video_note',
  fn: () => Promise<void>,
): Promise<void> {
  try {
    await ctx.api.sendChatAction(ctx.chat?.id ?? 0, action);
  } catch {
    // ignore chat action errors
  }
  await fn();
}