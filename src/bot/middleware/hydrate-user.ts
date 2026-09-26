import type { MiddlewareFn } from 'grammy';
import { logger } from '../../shared/logger/index.js';
import { toError } from '../../shared/errors/index.js';
import type { AppContext } from '../context.js';
import type { Services } from '../../container.js';

/**
 * Resolves the Telegram user into an application user and puts it on `ctx.state`.
 *
 * Runs first for every update: the bot only works in private chats, and every
 * later handler can rely on `ctx.state.user` existing.
 */
export function hydrateUser(services: Services): MiddlewareFn<AppContext> {
  return async (ctx, next) => {
    if (ctx.chat?.type !== 'private' || !ctx.from) {
      // Silent in the chat, but visible in the logs: a bot that "does nothing"
      // in groups is otherwise impossible to diagnose.
      logger.warn(
        { event: 'bot.update.ignored', chatType: ctx.chat?.type, updateId: ctx.update.update_id },
        'ignoring update: Yadette only works in a private chat with @BotFather',
      );
      return;
    }

    const { user, created } = await services.users.getOrCreate({
      telegramId: String(ctx.from.id),
      username: ctx.from.username ?? null,
      firstName: ctx.from.first_name ?? null,
      lastName: ctx.from.last_name ?? null,
    });

    ctx.state.user = user;
    ctx.state.lang = user.language;
    ctx.state.isNewUser = created;

    if (created) {
      logger.info({ event: 'user.created', userId: user.id }, 'new user registered');
    }

    await services.users.markSeen(user.id).catch((error: unknown) => {
      logger.warn(
        { event: 'user.touch.failed', userId: user.id, err: toError(error) },
        'lastSeenAt update failed',
      );
    });

    await next();
  };
}
