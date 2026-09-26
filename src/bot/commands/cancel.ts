import type { AppContext } from '../context.js';
import { t } from '../../shared/i18n/index.js';
import { showMainMenu } from '../helpers.js';
import { mainMenuKeyboard } from '../keyboards/main.js';

/** `/cancel` — works even when no flow is active (§35). */
export async function handleCancel(ctx: AppContext): Promise<void> {
  const lang = ctx.state.lang;
  await ctx.reply(t('addPerson.cancelled', lang));
  await showMainMenu(ctx);
}

/** Keeps the reply keyboard visible after any interaction. */
export async function refreshMainMenu(ctx: AppContext): Promise<void> {
  await ctx.reply(t('menu.title', ctx.state.lang), { reply_markup: mainMenuKeyboard(ctx.state.lang) });
}
