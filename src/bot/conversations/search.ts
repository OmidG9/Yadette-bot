import { t, type Language } from '../../shared/i18n/index.js';
import { MIN_SEARCH_LENGTH, normalizePersian } from '../../shared/utils/persian.js';
import { toPersianDigits } from '../../shared/utils/date.js';
import { editOrSend, sendText } from '../helpers.js';
import { listKeyboard } from '../keyboards/person.js';
import { searchResultsText } from '../views/search.views.js';
import type { AppContext } from '../context.js';
import type { Services } from '../../container.js';
import type { FlowDefinition } from './flow.js';
import type { FlowStore } from './flow.store.js';

export const SEARCH_FLOW = 'search';
const STEP_QUERY = 'query';

/** Re-opening search from a results screen. */
export async function startSearch(ctx: AppContext, store: FlowStore): Promise<void> {
  const lang = ctx.state.lang;
  const messageId = await editOrSend(ctx, searchPrompt(lang));

  await store.save({
    userId: ctx.state.user.id,
    flow: SEARCH_FLOW,
    step: STEP_QUERY,
    data: {},
    messageId: messageId ?? null,
  });
}

function searchPrompt(lang: Language): string {
  return [t('search.title', lang), '', t('search.prompt', lang), '', t('hint.cancel', lang)].join('\n');
}

/** Runs one query and renders the outcome. Ends the flow either way. */
async function runSearch(ctx: AppContext, services: Services, text: string): Promise<void> {
  const lang = ctx.state.lang;
  const { items, query } = await services.birthdays.searchForUser(ctx.state.user.id, text);
  await editOrSend(ctx, searchResultsText(items, query, lang), listKeyboard(items));
}

/**
 * §3.3 — one typed query, then results.
 *
 * The flow ends after the results rather than looping: staying active would
 * swallow the reply-keyboard buttons, and a user who wants a second search can
 * tap «🔎 جستجو» again. A query too short to match is the one exception — it
 * stays in the step, because there is nothing else the user could have meant.
 */
export function createSearchFlow(store: FlowStore, services: Services): FlowDefinition {
  return {
    name: SEARCH_FLOW,
    initialStep: STEP_QUERY,
    menuSteps: [STEP_QUERY],
    onCancel: async (ctx) => {
      await store.clear(ctx.state.user.id);
      await sendText(ctx, t('flow.cancelled', ctx.state.lang));
    },

    steps: {
      [STEP_QUERY]: async (ctx, _state, text) => {
        const lang = ctx.state.lang;
        const query = normalizePersian(text);

        if (query.length < MIN_SEARCH_LENGTH) {
          await editOrSend(
            ctx,
            t('search.tooShort', lang, { min: toPersianDigits(MIN_SEARCH_LENGTH) }),
          );
          return { messageId: ctx.state.promptMessageId ?? null };
        }

        await runSearch(ctx, services, text);
        return { next: null };
      },
    },
  };
}
