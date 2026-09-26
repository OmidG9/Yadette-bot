import type { AppContext } from '../context.js';
import { t } from '../../shared/i18n/index.js';
import { showMainMenu, sendText } from '../helpers.js';

/** `/cancel` — works even when no flow is active (§35). */
export async function handleCancel(ctx: AppContext): Promise<void> {
  await sendText(ctx, t('flow.cancelled', ctx.state.lang));
  await showMainMenu(ctx);
}

/** Keeps the reply keyboard visible after any interaction. */
export async function refreshMainMenu(ctx: AppContext): Promise<void> {
  await showMainMenu(ctx, t('menu.title', ctx.state.lang));
}
