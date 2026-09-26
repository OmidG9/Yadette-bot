import type { MiddlewareFn } from 'grammy';
import { t } from '../../shared/i18n/index.js';
import { toError } from '../../shared/errors/index.js';
import { logger } from '../../shared/logger/index.js';
import { ackCallback } from '../helpers.js';
import type { AppContext } from '../context.js';

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
        const text = t('errors.generic', ctx.state?.lang ?? 'fa');
        if (ctx.callbackQuery?.message) {
          await ctx.editMessageText(text).catch(() => undefined);
        } else {
          await ctx.reply(text).catch(() => undefined);
        }
      } catch {
        // The bot must survive even if Telegram is unreachable.
      }
    }
  };
}
