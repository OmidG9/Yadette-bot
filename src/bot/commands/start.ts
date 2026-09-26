import type { AppContext } from '../context.js';
import { showMainMenu } from '../helpers.js';
import { welcomeText } from '../views/menu.views.js';

/** `/start` — the user is already registered by the middleware (§10). */
export async function handleStart(ctx: AppContext): Promise<void> {
  const lang = ctx.state.lang;
  await showMainMenu(ctx, welcomeText(ctx.state.user, ctx.state.isNewUser, lang));
}
