import type { MiddlewareFn } from 'grammy';
import type { AppContext } from '../context.js';
import { t } from '../../shared/i18n/index.js';
import type { Language } from '../../shared/i18n/index.js';
import { sendText } from '../helpers.js';
import { mainMenuLabels } from '../keyboards/main.js';
import { logger } from '../../shared/logger/index.js';
import { toError } from '../../shared/errors/index.js';
import type { FlowState, FlowStore } from './flow.store.js';

export type { FlowState, FlowStore } from './flow.store.js';

export interface FlowAction {
  /** Next step. Omit to stay on the current one (retry), `null` to end the flow. */
  next?: string | null;
  /** Merged into the flow data. */
  data?: Record<string, unknown>;
  /** Message to edit on the next step instead of sending a new one. */
  messageId?: number | null;
}

export type FlowStepHandler = (
  ctx: AppContext,
  state: FlowState,
  text: string,
) => Promise<FlowAction>;

export interface FlowDefinition {
  name: string;
  /** Step a fresh flow starts in. */
  initialStep: string;
  /**
   * Steps that are driven by inline keyboards. Reply-keyboard taps are refused
   * while the user is in one of them, so the menu never swallows a flow.
   */
  menuSteps?: string[];
  steps: Record<string, FlowStepHandler>;
  onCancel?: (ctx: AppContext, state: FlowState) => Promise<void>;
  onFinish?: (ctx: AppContext, state: FlowState) => Promise<void>;
}

/**
 * Ways out of a flow (§35).
 *
 * The visible label is the dictionary's, so the button and this check can never
 * drift apart. The remaining entries are the spellings a user is likely to type
 * instead of tapping, and are kept next to the label on purpose.
 */
function cancelTexts(lang: Language): string[] {
  return [t('common.cancel', lang), t('flow.cancelWord', lang), 'cancel', '/cancel'];
}

/**
 * Conversation middleware.
 *
 * Order matters: it runs before the menu buttons, so any text received while a
 * flow is active is treated as an answer instead of a menu command. The user can
 * always escape with «❌ لغو» and is never trapped (§35).
 */
export function createFlowMiddleware(
  store: FlowStore,
  flows: FlowDefinition[],
): MiddlewareFn<AppContext> {
  const flowMap = new Map(flows.map((flow) => [flow.name, flow]));

  return async (ctx, next) => {
    const text = ctx.message?.text;
    if (!text) {
      await next();
      return;
    }

    // A command is never an answer. This middleware is installed before the
    // command handlers, so without this guard `/start` would be read as the
    // answer to whatever question is open — and `cleanName('/start')` passes,
    // which would name the person `/start`.
    if (text.startsWith('/')) {
      await next();
      return;
    }

    const state = await store.get(ctx.state.user.id);
    if (!state) {
      await next();
      return;
    }

    const flow = flowMap.get(state.flow);
    if (!flow) {
      // Orphaned state (e.g. a flow was removed in a release): clean it up.
      logger.warn(
        { event: 'flow.orphan', userId: ctx.state.user.id, flow: state.flow },
        'dropping unknown flow state',
      );
      await store.clear(ctx.state.user.id);
      await next();
      return;
    }

    const lang = ctx.state.lang;
    // The prompt the user is answering, so the next step rewrites that message
    // instead of the text they just typed.
    ctx.state.promptMessageId = state.messageId ?? undefined;

    if (cancelTexts(lang).includes(text.trim())) {
      await store.clear(ctx.state.user.id);
      // `onCancel` owns the reply, so a flow can show a useful keyboard again.
      if (flow.onCancel) {
        await flow.onCancel(ctx, state);
      } else {
        await sendText(ctx, t('flow.cancelled', lang));
      }
      return;
    }

    if (flow.menuSteps?.includes(state.step) && mainMenuLabels().includes(text.trim())) {
      await sendText(ctx, t('flow.busy', lang));
      return;
    }

    const handler = flow.steps[state.step];
    if (!handler) {
      logger.error(
        {
          event: 'flow.step.missing',
          userId: ctx.state.user.id,
          flow: flow.name,
          step: state.step,
        },
        'flow step not found',
      );
      await store.clear(ctx.state.user.id);
      await sendText(ctx, t('flow.notActive', lang));
      return;
    }

    try {
      const action = await handler(ctx, state, text);
      const nextStep = action.next === undefined ? state.step : action.next;

      if (nextStep === null) {
        await store.clear(ctx.state.user.id);
        await flow.onFinish?.(ctx, { ...state, data: { ...state.data, ...action.data } });
        return;
      }

      await store.save({
        userId: state.userId,
        flow: flow.name,
        step: nextStep,
        data: { ...state.data, ...action.data },
        messageId: action.messageId ?? state.messageId,
      });
    } catch (error) {
      // A bad answer must not kill the flow: the user can retry or cancel.
      logger.error(
        {
          event: 'flow.step.failed',
          userId: ctx.state.user.id,
          flow: flow.name,
          step: state.step,
          err: toError(error),
        },
        'flow step failed',
      );
      await sendText(ctx, t('errors.generic', lang));
    }
  };
}
