import { Bot, GrammyError, HttpError } from 'grammy';
import type { ApiClientOptions } from 'grammy';
import { t } from '../shared/i18n/index.js';
import { logger } from '../shared/logger/index.js';
import { toError } from '../shared/errors/index.js';
import { AppContext } from './context.js';
import { errorHandler } from './middleware/error.js';
import { hydrateUser } from './middleware/hydrate-user.js';
import { createFlowMiddleware, type FlowDefinition } from './conversations/flow.js';
import type { FlowStore } from './conversations/flow.store.js';
import { createAddPersonFlow, startAddPerson } from './conversations/add-person.js';
import { createEditPersonFlow } from './conversations/edit-person.js';
import { createAddInterestFlow } from './conversations/add-interest.js';
import { handleStart } from './commands/start.js';
import { handleCancel } from './commands/cancel.js';
import { mainMenuLabels, mainMenuKeyboard } from './keyboards/main.js';
import { settingsKeyboard } from './keyboards/settings.js';
import { parseCallbackData } from './callbacks/data.js';
import { handleNavCallback, handleSettingsCallback, showUpcomingList } from './callbacks/nav.callbacks.js';
import { handlePersonCallback } from './callbacks/person.callbacks.js';
import { handleFlowCallback, handleInterestDelete } from './callbacks/flow.callbacks.js';
import { handleReminderToggle } from './callbacks/reminder.callbacks.js';
import { settingsText } from './views/settings.views.js';
import { helpText, aboutText } from './views/menu.views.js';
import { ackCallback, editOrSend, sendText } from './helpers.js';
import type { Services } from '../container.js';

export interface CreateBotDeps {
  token: string;
  services: Services;
  flowStore: FlowStore;
  /** Passed to grammY; tests use it to answer Telegram calls without a network. */
  client?: ApiClientOptions;
}

/**
 * Telegram layer: it only orchestrates. All business logic lives in the
 * services under `src/modules`, and all persistence in the repositories.
 */
export function createBot({ token, services, flowStore, client }: CreateBotDeps): Bot<AppContext> {
  // `ContextConstructor` is required: grammY never creates `ctx.state` itself.
  const bot = new Bot<AppContext>(token, { ContextConstructor: AppContext, client });

  const flows: FlowDefinition[] = [
    createAddPersonFlow(flowStore),
    createEditPersonFlow(services, flowStore),
    createAddInterestFlow(services, flowStore),
  ];

  bot.use(errorHandler());
  bot.use(hydrateUser(services));
  bot.use(createFlowMiddleware(flowStore, flows));

  registerCommands(bot, services, flowStore);
  registerMenuButtons(bot, services, flowStore);
  registerCallbackHandler(bot, services, flowStore);
  registerFallbacks(bot);
  registerCatch(bot);

  return bot;
}

function registerCommands(bot: Bot<AppContext>, services: Services, flowStore: FlowStore): void {
  bot.command('start', async (ctx) => {
    await handleStart(ctx, { services, flowStore });
  });

  bot.command('help', async (ctx) => {
    await sendText(ctx, helpText(ctx.state.lang), mainMenuKeyboard(ctx.state.lang));
  });

  bot.command('about', async (ctx) => {
    await sendText(ctx, aboutText(ctx.state.lang), mainMenuKeyboard(ctx.state.lang));
  });
}

function registerMenuButtons(bot: Bot<AppContext>, services: Services, flowStore: FlowStore): void {
  bot.hears(mainMenuLabels(), async (ctx) => {
    const lang = ctx.state.lang;
    // grammY sets `ctx.match` to the whole matched string for string triggers,
    // and to a RegExp match array for regex triggers.
    const pressed = typeof ctx.match === 'string' ? ctx.match : (ctx.match[0] ?? '');

    if (pressed === t('menu.addPerson', lang)) {
      await startAddPerson(ctx, flowStore);
      return;
    }

    if (pressed === t('menu.upcoming', lang)) {
      await showUpcomingList(ctx, services);
      return;
    }

    if (pressed === t('menu.settings', lang)) {
      const settings = await services.settings.get(ctx.state.user.id);
      await sendText(ctx, settingsText(settings, lang), settingsKeyboard(settings, lang));
      return;
    }

    if (pressed === t('menu.home', lang)) {
      await sendText(ctx, t('menu.title', lang), mainMenuKeyboard(lang));
      return;
    }

    await sendText(ctx, helpText(lang), mainMenuKeyboard(lang));
  });

  // `/cancel` must work even when no flow is active.
  bot.command('cancel', async (ctx) => {
    await flowStore.clear(ctx.state.user.id);
    await handleCancel(ctx);
  });
}

function registerCallbackHandler(bot: Bot<AppContext>, services: Services, flowStore: FlowStore): void {
  bot.on('callback_query', async (ctx) => {
    const data = parseCallbackData(ctx.callbackQuery.data);

    if (!data) {
      await ackCallback(ctx);
      logger.warn(
        { event: 'bot.callback.invalid', userId: ctx.state.user.id, raw: ctx.callbackQuery.data },
        'rejected invalid callback data',
      );
      return;
    }

    const handled = await dispatchCallback(ctx, data, services, flowStore);

    if (!handled) {
      await ackCallback(ctx);
      await editOrSend(ctx, t('errors.invalidInput', ctx.state.lang));
    }
  });
}

async function dispatchCallback(
  ctx: AppContext,
  data: NonNullable<ReturnType<typeof parseCallbackData>>,
  services: Services,
  flowStore: FlowStore,
): Promise<boolean> {
  if (data.kind.startsWith('nav:')) {
    return handleNavCallback(ctx, data.kind.slice(4), { services, flowStore });
  }

  // `person:edit` and `person:edit:<field>` must be matched before the
  // `person:` prefix below, which would otherwise swallow them.
  if (data.kind === 'person:edit' || data.kind.startsWith('person:edit:')) {
    return handleFlowCallback(ctx, data, { services, store: flowStore });
  }

  if (data.kind.startsWith('person:')) {
    return handlePersonCallback(ctx, data, {
      services,
      flowStore,
      showUpcomingList: (context) => showUpcomingList(context, services),
    });
  }

  if (data.kind === 'interest:del') {
    return handleInterestDelete(ctx, data, services);
  }

  if (data.kind === 'reminder:toggle') {
    return handleReminderToggle(ctx, data, services);
  }

  if (data.kind.startsWith('settings:')) {
    return handleSettingsCallback(ctx, data, { services, flowStore });
  }

  return handleFlowCallback(ctx, data, { services, store: flowStore });
}

/** Anything not understood ends up here, with the main menu restored. */
function registerFallbacks(bot: Bot<AppContext>): void {
  bot.on('message:text', async (ctx) => {
    await sendText(ctx, helpText(ctx.state.lang), mainMenuKeyboard(ctx.state.lang));
  });
}

/** Last line of defence: a crash must never take the process down (§23). */
function registerCatch(bot: Bot<AppContext>): void {
  bot.catch(async (err) => {
    const error = err.error;
    const ctx = err.ctx;

    if (error instanceof GrammyError || error instanceof HttpError) {
      logger.error(
        {
          event: 'bot.telegram.error',
          userId: ctx.state?.user?.id,
          errorCode: telegramErrorCode(error),
          description: telegramErrorDescription(error),
        },
        'telegram api error',
      );
      // Nothing can be delivered right now, but the button still has to stop
      // spinning once Telegram is reachable again. Failure is ignored: a
      // Telegram outage must not turn into a second, unhandled rejection.
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery().catch(() => undefined);
      }
      return;
    }

    logger.error(
      { event: 'bot.update.crashed', userId: ctx.state?.user?.id, err: toError(error) },
      'unhandled bot error',
    );

    if (ctx.callbackQuery) {
      void ctx.answerCallbackQuery().catch(() => undefined);
    }
    void sendText(ctx, t('errors.generic', ctx.state?.lang ?? 'fa')).catch(() => undefined);
  });
}

function telegramErrorCode(error: GrammyError | HttpError): string | undefined {
  return 'error_code' in error ? String(error.error_code) : undefined;
}

function telegramErrorDescription(error: GrammyError | HttpError): string | undefined {
  return 'description' in error ? String(error.description) : undefined;
}
