import type { AppContext } from '../context.js';
import { showMainMenu, sendText } from '../helpers.js';
import { welcomeText } from '../views/menu.views.js';
import { welcomeKeyboard, START_ADD_PAYLOAD } from '../keyboards/start.js';
import { startAddPerson } from '../conversations/add-person.js';
import { t } from '../../shared/i18n/index.js';
import { featureFlags } from '../../config/feature-flags.js';
import type { Services } from '../../container.js';
import type { FlowStore } from '../conversations/flow.store.js';

export interface StartDeps {
  services: Services;
  flowStore: FlowStore;
}

/**
 * `/start` (§10).
 *
 * One complete message, whatever the user already has: a brand new user gets the
 * explanation, a returning user gets their status. Either way the message
 * carries one tappable button per section, so nothing is hidden behind a guess.
 *
 *  - `?start=add` deep link from the welcome button → straight into the flow.
 */
export async function handleStart(ctx: AppContext, deps: StartDeps): Promise<void> {
  const lang = ctx.state.lang;
  const user = ctx.state.user;

  if (ctx.match === START_ADD_PAYLOAD) {
    await startAddPerson(ctx, deps.flowStore);
    return;
  }

  const peopleCount = await deps.services.persons.countForUser(user.id);
  const text = welcomeText(user, ctx.state.isNewUser, peopleCount, lang);
  const username = ctx.me.username;
  const body = username ? text : `${text}\n\n${t('start.ctaFallback', lang)}`;

  await sendText(ctx, body, welcomeKeyboard({ username, lang, flags: featureFlags }));

  // The reply keyboard is sticky in the client, so it is only installed on the
  // very first contact; later `/start` presses keep the chat to a single message.
  if (ctx.state.isNewUser) {
    await showMainMenu(ctx);
  }
}
