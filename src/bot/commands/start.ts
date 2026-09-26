import type { AppContext } from '../context.js';
import { showMainMenu } from '../helpers.js';
import { welcomeText } from '../views/menu.views.js';
import { welcomeKeyboard, START_ADD_PAYLOAD } from '../keyboards/start.js';
import { startAddPerson } from '../conversations/add-person.js';
import { t } from '../../shared/i18n/index.js';
import type { Services } from '../../container.js';
import type { FlowStore } from '../conversations/flow.store.js';

export interface StartDeps {
  services: Services;
  flowStore: FlowStore;
}

/**
 * `/start` (§10).
 *
 * Three cases:
 *  - `?start=add` deep link from the welcome button → straight into the flow;
 *  - first contact → explanation plus the call-to-action button;
 *  - anything else → short greeting, and the same call to action while the
 *    user still has nobody in the list.
 */
export async function handleStart(ctx: AppContext, deps: StartDeps): Promise<void> {
  const lang = ctx.state.lang;
  const user = ctx.state.user;

  if (ctx.match === START_ADD_PAYLOAD) {
    await startAddPerson(ctx, deps.flowStore);
    return;
  }

  const hasPeople = (await deps.services.persons.countForUser(user.id)) > 0;
  const text = welcomeText(user, ctx.state.isNewUser, hasPeople, lang);
  const keyboard = hasPeople ? undefined : welcomeKeyboard(ctx.me.username, lang);

  if (keyboard) {
    const username = ctx.me.username;
    await ctx.reply(username ? text : `${text}\n\n${t('start.ctaFallback', lang)}`, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
    await showMainMenu(ctx);
    return;
  }

  await showMainMenu(ctx, text);
}
