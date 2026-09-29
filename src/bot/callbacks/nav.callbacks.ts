import { t } from '../../shared/i18n/index.js';
import { logger } from '../../shared/logger/index.js';
import type { AppContext } from '../context.js';
import { ackCallback, editOrSend } from '../helpers.js';
import { listKeyboard } from '../keyboards/person.js';
import { welcomeKeyboard } from '../keyboards/start.js';
import { deleteDataKeyboard, settingsKeyboard, timezoneKeyboard } from '../keyboards/settings.js';
import {
  dataErasedText,
  deleteDataConfirmText,
  settingsText,
  timezoneListText,
} from '../views/settings.views.js';
import { helpText, aboutText, welcomeText } from '../views/menu.views.js';
import { upcomingListText } from '../views/person.views.js';
import { dashboardText } from '../views/dashboard.views.js';
import { calendarKeyboard, calendarText } from '../views/calendar.views.js';
import { healthText, type HealthReport } from '../../modules/health/health.service.js';
import { featureFlags } from '../../config/feature-flags.js';
import { toError } from '../../shared/errors/index.js';
import { startAddPerson } from '../conversations/add-person.js';
import { startSearch } from '../conversations/search.js';
import { hydrateContext } from '../middleware/hydrate-user.js';
import type { FlowStore } from '../conversations/flow.store.js';
import type { Services } from '../../container.js';

export interface NavDeps {
  services: Services;
  flowStore: FlowStore;
  /**
   * Optional so a test can exercise the nav handler without a live database.
   * Without it the `health` section reports the database as unknown.
   */
  health?: { check(now?: Date): Promise<HealthReport> };
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
    // The real home screen: one button per section, exactly what the
    // «🏠 منوی اصلی» buttons promise. It used to render the birthday list,
    // which made that button a no-op — and tapping it twice in a row posted a
    // duplicate list, because the second edit failed with "not modified" and
    // fell back to sending a new message.
    //
    // It is also the target of the «❌ لغو» button inside a flow and where
    // `/cancel` lands, so the flow state has to go with it — otherwise the next
    // message is still eaten as an answer and the user is stuck (§35).
    case 'menu': {
      await ackCallback(ctx);
      await flowStore.clear(ctx.state.user.id);
      const user = ctx.state.user;
      const peopleCount = await services.persons.countForUser(user.id);
      const username = ctx.me.username;
      const text = welcomeText(user, false, peopleCount, lang);
      const body = username ? text : `${text}\n\n${t('start.ctaFallback', lang)}`;
      await editOrSend(
        ctx,
        body,
        welcomeKeyboard({ username, lang, flags: featureFlags }),
      );
      return true;
    }

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

    // §3.1 — the home screen. Kept behind its own flag: with the flag off the
    // button is gone too, so `dashboard` is unreachable and the branch is inert.
    case 'dashboard': {
      if (!featureFlags.isEnabled('dashboard')) return false;
      await ackCallback(ctx);
      const buckets = await services.birthdays.getDashboardForUser(ctx.state.user.id);
      if (!buckets) {
        await editOrSend(ctx, welcomeText(ctx.state.user, false, 0, lang), welcomeKeyboard({
          username: ctx.me.username,
          lang,
          flags: featureFlags,
        }));
        return true;
      }
      await editOrSend(ctx, dashboardText(buckets, lang), welcomeKeyboard({
        username: ctx.me.username,
        lang,
        flags: featureFlags,
      }));
      return true;
    }

    // §3.3 — search needs a typed query, so it hands over to a conversation.
    case 'search': {
      if (!featureFlags.isEnabled('search')) return false;
      await ackCallback(ctx);
      await startSearch(ctx, flowStore);
      return true;
    }

    // §3.2 — birthdays by Jalali month.
    case 'calendar': {
      if (!featureFlags.isEnabled('calendar')) return false;
      await ackCallback(ctx);
      await showCalendar(ctx, services);
      return true;
    }

    // Operational probe, deliberately reachable from the menu so a problem can
    // be diagnosed without shell access.
    case 'health': {
      if (!featureFlags.isEnabled('healthCheck')) return false;
      await ackCallback(ctx);
      await showHealth(ctx, deps);
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

/** §3.2 — the current Jalali month of birthdays. */
export async function showCalendar(
  ctx: AppContext,
  services: Services,
  target?: { year: number; month: number },
): Promise<void> {
  const result = await services.birthdays.getCalendarForUser(ctx.state.user.id, target);
  if (!result) {
    await editOrSend(ctx, t('errors.generic', ctx.state.lang));
    return;
  }

  await editOrSend(
    ctx,
    calendarText(result.month, ctx.state.lang),
    calendarKeyboard(result.month, result.today, ctx.state.lang),
  );
}

/**
 * §3.6 — health probe.
 *
 * A failed probe is reported, never thrown: a health check that takes the bot
 * down while it is diagnosing a problem is worse than no health check.
 */
async function showHealth(ctx: AppContext, deps: NavDeps): Promise<void> {
  const lang = ctx.state.lang;

  if (!deps.health) {
    await editOrSend(ctx, t('health.degraded', lang));
    return;
  }

  try {
    const report = await deps.health.check();
    await editOrSend(ctx, healthText(report, lang), listKeyboard([]));
  } catch (error) {
    logger.error({ event: 'health.check.failed', err: toError(error) }, 'health probe threw');
    await editOrSend(ctx, t('health.degraded', lang));
  }
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
      await editOrSend(
        ctx,
        settingsText(settings, lang, t('settings.saved', lang)),
        settingsKeyboard(settings, lang),
      );
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
      // `parseCallbackData` guarantees a timezone for this kind.
      const settings = await services.settings.setTimezone(userId, data.timezone as string);
      await editOrSend(
        ctx,
        settingsText(
          settings,
          lang,
          t('settings.savedTimezone', lang, { value: settings.timezone }),
        ),
        settingsKeyboard(settings, lang),
      );
      return true;
    }

    // Only Persian exists so far, but the answer stays on the settings screen:
    // a bare message with no keyboard used to be a dead end.
    case 'settings:language': {
      const settings = await services.settings.get(userId);
      await editOrSend(
        ctx,
        settingsText(settings, lang, t('settings.languageOnlyFa', lang)),
        settingsKeyboard(settings, lang),
      );
      return true;
    }

    case 'settings:data:ask': {
      await editOrSend(ctx, deleteDataConfirmText(lang), deleteDataKeyboard(lang));
      return true;
    }

    case 'settings:data:no': {
      const settings = await services.settings.get(userId);
      await editOrSend(ctx, settingsText(settings, lang), settingsKeyboard(settings, lang));
      return true;
    }

    case 'settings:data:yes': {
      await eraseAllData(ctx, services);
      return true;
    }

    default:
      return false;
  }
}

/**
 * Right to be forgotten.
 *
 * Deleting the `User` row cascades to people, interests, reminders, notification
 * logs and conversation state, so nothing is left behind. `telegramId` is
 * unique, so re-hydrating immediately creates a brand new user: the very next
 * message is greeted like a first contact, with an empty list and default
 * settings, exactly as if this user had never existed.
 */
async function eraseAllData(ctx: AppContext, services: Services): Promise<void> {
  const deletedId = ctx.state.user.id;

  await services.users.deleteAccount(deletedId);

  // `ctx.state` still points at the deleted row, and a second tap on the
  // confirm button must land on a live user rather than fail.
  const user = await hydrateContext(ctx, services);
  await services.users.markSeen(user.id).catch((error: unknown) => {
    logger.warn(
      { event: 'user.touch.failed', userId: user.id, err: toError(error) },
      'lastSeenAt update failed after data erasure',
    );
  });

  logger.info({ event: 'user.data_erased', userId: user.id }, 'user erased all their data');

  await editOrSend(ctx, dataErasedText(ctx.state.lang));
}
