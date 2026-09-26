import type { MiddlewareFn } from 'grammy';
import { logger } from '../../shared/logger/index.js';
import { ValidationError, toError } from '../../shared/errors/index.js';
import type { AppContext } from '../context.js';
import type { UserRecord } from '../../modules/users/user.types.js';
import type { Services } from '../../container.js';

/**
 * Resolves the Telegram user into an application user and publishes it on
 * `ctx.state`. Returns the freshly created user when this is a first contact.
 *
 * Exposed separately from the middleware because a handler that changes the
 * identity itself (erasing all data) must be able to refresh `ctx.state`
 * instead of leaving it pointing at a deleted row.
 */
export async function hydrateContext(ctx: AppContext, services: Services): Promise<UserRecord> {
  const from = ctx.from;
  if (!from) throw new ValidationError('Telegram profile is missing');

  const { user, created } = await services.users.getOrCreate({
    telegramId: String(from.id),
    username: from.username ?? null,
    firstName: from.first_name ?? null,
    lastName: from.last_name ?? null,
  });

  ctx.state.user = user;
  ctx.state.lang = user.language;
  ctx.state.isNewUser = created;

  return user;
}

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

    const user = await hydrateContext(ctx, services);

    if (ctx.state.isNewUser) {
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

