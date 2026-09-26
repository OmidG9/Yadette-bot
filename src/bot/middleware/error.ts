import type { MiddlewareFn } from 'grammy';
import { t, type Language } from '../../shared/i18n/index.js';
import { AppError, toError } from '../../shared/errors/index.js';
import { logger } from '../../shared/logger/index.js';
import { ackCallback, editMessageById, sendText } from '../helpers.js';
import type { AppContext } from '../context.js';

/**
 * A specific message when the failure is understandable, a generic one
 * otherwise. Anything technical stays in the logs.
 */
function userFacingText(error: AppError, lang: Language): string {
  switch (error.code) {
    case 'NOT_FOUND':
      return t('errors.notFound', lang);
    case 'FORBIDDEN':
      return t('errors.forbidden', lang);
    case 'VALIDATION_ERROR':
    case 'CONFLICT':
      return t('errors.invalidInput', lang);
    default:
      return t('errors.generic', lang);
  }
}

/**
 * Central error handling (§23).
 *
 * Users only ever see a friendly message; the real cause goes to the logs.
 * Stack traces, SQL and internal ids never reach Telegram.
 */
export function errorHandler(): MiddlewareFn<AppContext> {
  return async (ctx, next) => {
    try {
      await next();
    } catch (error) {
      const err = toError(error);
      const userId = ctx.state?.user?.id;

      logger.error(
        {
          event: 'bot.update.failed',
          userId,
          chatId: ctx.chat?.id,
          updateId: ctx.update.update_id,
          err,
        },
        'unhandled error while processing update',
      );

      await ackCallback(ctx);

      try {
        const lang = ctx.state?.lang ?? 'fa';
        const text = error instanceof AppError ? userFacingText(error, lang) : t('errors.generic', lang);
        const chatId = ctx.chat?.id;
        const messageId = ctx.callbackQuery?.message?.message_id ?? ctx.message?.message_id;

        if (chatId !== undefined && messageId !== undefined) {
          await editMessageById(ctx, chatId, messageId, text);
        } else {
          await sendText(ctx, text);
        }
      } catch {
        // The bot must survive even if Telegram is unreachable.
      }
    }
  };
}
