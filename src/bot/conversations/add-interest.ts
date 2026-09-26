import { z } from 'zod';
import { t } from '../../shared/i18n/index.js';
import { ValidationError } from '../../shared/errors/index.js';
import type { AppContext } from '../context.js';
import { editOrSend } from '../helpers.js';
import { cancelKeyboard, interestsKeyboard } from '../keyboards/reminder.js';
import { interestsText } from '../views/person.views.js';
import type { Services } from '../../container.js';
import type { FlowDefinition, FlowState } from './flow.js';
import type { FlowStore } from './flow.store.js';

const dataSchema = z.object({ personId: z.string().min(1) });

export const ADD_INTEREST_FLOW = 'add-interest';

/** `➕ افزودن علاقه` mini-flow (§12: interests can be changed later too). */
export function createAddInterestFlow(services: Services, store: FlowStore): FlowDefinition {
  return {
    name: ADD_INTEREST_FLOW,
    initialStep: 'add',
    menuSteps: ['add'],
    onCancel: async (ctx, state) => {
      await store.clear(ctx.state.user.id);
      const { personId } = readData(state);
      const person = await services.persons.getForUser(ctx.state.user.id, personId);
      await editOrSend(
        ctx,
        t('flow.cancelled', ctx.state.lang),
        interestsKeyboard(personId, person.interests, ctx.state.lang),
      );
    },

    steps: {
      add: async (ctx, state, text) => {
        const lang = ctx.state.lang;
        const { personId } = readData(state);

        const { person, added } = await services.persons.addInterests(
          ctx.state.user.id,
          personId,
          text,
        );

        if (added.length === 0) {
          await editOrSend(ctx, t('errors.invalidInput', lang), cancelKeyboard(`person:interests:${personId}`, lang));
          return {};
        }

        await store.clear(ctx.state.user.id);
        await editOrSend(
          ctx,
          `${t('interests.added', lang, { title: added.join('، ') })}\n\n${interestsText(person, lang)}`,
          interestsKeyboard(personId, person.interests, lang),
        );
        return { next: null };
      },
    },
  };
}

function readData(state: FlowState): z.infer<typeof dataSchema> {
  const parsed = dataSchema.safeParse(state.data);
  if (!parsed.success) throw new ValidationError('Corrupt add-interest flow state');
  return parsed.data;
}

/** Entry point used by the `flow:interest:add` callback. */
export async function startAddInterest(
  ctx: AppContext,
  store: FlowStore,
  personId: string,
): Promise<void> {
  const lang = ctx.state.lang;
  await store.save({
    userId: ctx.state.user.id,
    flow: ADD_INTEREST_FLOW,
    step: 'add',
    data: { personId },
    messageId: null,
  });
  await editOrSend(ctx, t('interests.askAdd', lang), cancelKeyboard(`person:interests:${personId}`, lang));
}
