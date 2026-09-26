import { t } from '../../shared/i18n/index.js';
import type { AppContext } from '../context.js';
import { ackCallback, editOrSend, sendText } from '../helpers.js';
import { listKeyboard } from '../keyboards/person.js';
import { settingsKeyboard, timezoneKeyboard } from '../keyboards/settings.js';
import { settingsText, timezoneListText } from '../views/settings.views.js';
import { helpText, aboutText } from '../views/menu.views.js';
import { upcomingListText } from '../views/person.views.js';
import { ValidationError } from '../../shared/errors/index.js';
import { startAddPerson } from '../conversations/add-person.js';
import type { FlowStore } from '../conversations/flow.store.js';
import type { Services } from '../../container.js';

export interface NavDeps {
  services: Services;
  flowStore: FlowStore;
}

/** `nav:*` callbacks: main menu sections. */
export async function handleNavCallback(
  ctx: AppContext,
  target: string,
  deps: NavDeps,
): Promise<boolean> {
  const { services, flowStore } = deps;
  const lang = ctx.state.lang;

  switch (target) {
    case 'menu':
      await ackCallback(ctx);
      await editOrSend(ctx, t('menu.title', lang), listKeyboard([]));
      return true;

    // `people` used to be a second, alphabetical list. Inline keyboards in the
    // chat history may still send it, so it maps to the same screen.
    case 'upcoming':
    case 'people': {
      await ackCallback(ctx);
      await showUpcomingList(ctx, services);
      return true;
    }

    // Fallback target of the welcome call-to-action when no deep link is
    // possible (see `welcomeKeyboard`).
    case 'add': {
      await ackCallback(ctx);
      await startAddPerson(ctx, flowStore);
      return true;
    }

    case 'settings': {
      await ackCallback(ctx);
      const settings = await services.settings.get(ctx.state.user.id);
      await editOrSend(ctx, settingsText(settings, lang), settingsKeyboard(settings, lang));
      return true;
    }

    case 'help': {
      await ackCallback(ctx);
      await editOrSend(ctx, helpText(lang));
      return true;
    }

    // The long read: what the bot is, how it works, and what it stores.
    case 'about': {
      await ackCallback(ctx);
      await editOrSend(ctx, aboutText(lang));
      return true;
    }

    default:
      return false;
  }
}

/** Shared renderer: people sorted by their next birthday occurrence. */
export async function showUpcomingList(ctx: AppContext, services: Services): Promise<void> {
  const items = await services.birthdays.getUpcomingForUser(ctx.state.user.id);
  await editOrSend(ctx, upcomingListText(items, ctx.state.lang), listKeyboard(items));
}

/** `settings:*` callbacks. */
export async function handleSettingsCallback(
  ctx: AppContext,
  data: { kind: string; timezone?: string },
  deps: NavDeps,
): Promise<boolean> {
  const { services } = deps;
  const lang = ctx.state.lang;
  const userId = ctx.state.user.id;

  switch (data.kind) {
    case 'settings:reminders': {
      const settings = await services.settings.toggleReminders(userId);
      await editOrSend(ctx, settingsText(settings, lang), settingsKeyboard(settings, lang));
      return true;
    }

    case 'settings:timezone': {
      const settings = await services.settings.get(userId);
      await editOrSend(
        ctx,
        timezoneListText(settings.timezone, lang),
        timezoneKeyboard(settings.timezone, lang),
      );
      return true;
    }

    case 'settings:tz:set': {
      if (!data.timezone) throw new ValidationError('Missing timezone');
      const settings = await services.settings.setTimezone(userId, data.timezone);
      await editOrSend(ctx, settingsText(settings, lang), settingsKeyboard(settings, lang));
      return true;
    }

    case 'settings:language': {
      await ackCallback(ctx);
      await sendText(ctx, t('settings.languageOnlyFa', lang));
      return true;
    }

    default:
      return false;
  }
}
