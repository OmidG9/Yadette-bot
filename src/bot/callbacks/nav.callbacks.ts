import { t } from '../../shared/i18n/index.js';
import type { AppContext } from '../context.js';
import { ackCallback, editOrSend } from '../helpers.js';
import { listKeyboard } from '../keyboards/person.js';
import { settingsKeyboard, timezoneKeyboard } from '../keyboards/settings.js';
import { settingsText, timezoneListText } from '../views/settings.views.js';
import { helpText } from '../views/menu.views.js';
import { peopleListText, upcomingListText } from '../views/person.views.js';
import { ValidationError } from '../../shared/errors/index.js';
import type { Services } from '../../container.js';

export interface NavDeps {
  services: Services;
}

/** `nav:*` callbacks: main menu sections. */
export async function handleNavCallback(
  ctx: AppContext,
  target: string,
  deps: NavDeps,
): Promise<boolean> {
  const { services } = deps;
  const lang = ctx.state.lang;

  switch (target) {
    case 'menu':
      await ackCallback(ctx);
      await editOrSend(ctx, t('menu.title', lang), listKeyboard([]));
      return true;

    case 'upcoming': {
      await ackCallback(ctx);
      const items = await services.birthdays.getUpcomingForUser(ctx.state.user.id);
      await editOrSend(ctx, upcomingListText(items, lang), listKeyboard(items));
      return true;
    }

    case 'people': {
      await ackCallback(ctx);
      await showPeopleList(ctx, services);
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

    default:
      return false;
  }
}

/** Shared renderer: people list sorted by next birthday occurrence. */
export async function showPeopleList(ctx: AppContext, services: Services): Promise<void> {
  const items = await services.birthdays.getUpcomingForUser(ctx.state.user.id);
  await editOrSend(ctx, peopleListText(items, ctx.state.lang), listKeyboard(items));
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
      await ctx.reply(t('settings.languageOnlyFa', lang));
      return true;
    }

    default:
      return false;
  }
}
