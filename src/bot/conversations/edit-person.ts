import { z } from 'zod';
import { t } from '../../shared/i18n/index.js';
import { cleanName, cleanNotes, parseInterests } from '../../shared/utils/text.js';
import { formatJalali, parseBirthDate } from '../../shared/utils/date.js';
import { ValidationError } from '../../shared/errors/index.js';
import type { AppContext } from '../context.js';
import { editOrSend, sendText } from '../helpers.js';
import { cancelKeyboard } from '../keyboards/reminder.js';
import { navCallback } from '../callbacks/data.js';
import { personDetailsKeyboard, personEditKeyboard } from '../keyboards/person.js';
import { personDetailsText, personEditedText } from '../views/person.views.js';
import type { Services } from '../../container.js';
import type { FlowDefinition, FlowState } from './flow.js';
import type { FlowStore } from './flow.store.js';

const dataSchema = z.object({
  personId: z.string().min(1),
  field: z.enum(['name', 'birthday', 'notes', 'interests']),
  current: z.string().optional(),
});

type EditField = z.infer<typeof dataSchema>['field'];

const SKIP = '-';
export const EDIT_PERSON_FLOW = 'edit-person';

export function readEditData(state: FlowState): z.infer<typeof dataSchema> {
  const parsed = dataSchema.safeParse(state.data);
  if (!parsed.success) throw new ValidationError('Corrupt edit-person flow state');
  return parsed.data;
}

/** Starts the edit flow; the first step waits for an inline field choice. */
export async function startEditPerson(
  ctx: AppContext,
  services: Services,
  store: FlowStore,
  personId: string,
  field?: EditField,
): Promise<void> {
  const person = await services.persons.getForUser(ctx.state.user.id, personId);
  const lang = ctx.state.lang;

  if (!field) {
    await store.save({
      userId: ctx.state.user.id,
      flow: EDIT_PERSON_FLOW,
      step: 'choose',
      data: { personId, field: 'name' },
      messageId: null,
    });
    await editOrSend(ctx, t('edit.choose', lang), personEditKeyboard(personId, lang));
    return;
  }

  const current =
    field === 'name'
      ? person.name
      : field === 'birthday'
        ? formatJalali(person.birthMonth, person.birthDay, person.birthYear)
        : '';

  const prompt =
    field === 'name'
      ? t('edit.askName', lang, { current })
      : field === 'birthday'
        ? t('edit.askBirthday', lang, { current })
        : field === 'notes'
          ? t('edit.askNotes', lang)
          : t('edit.askInterests', lang);

  // «❌ لغو» has to leave the flow, and `nav:menu` is the only exit that also
  // clears the stored state — a `person:edit` payload would just come back here.
  const messageId = await editOrSend(ctx, prompt, cancelKeyboard(navCallback('menu'), lang));

  await store.save({
    userId: ctx.state.user.id,
    flow: EDIT_PERSON_FLOW,
    step: field,
    data: { personId, field, ...(current ? { current } : {}) },
    messageId: messageId ?? null,
  });
}

async function showDetails(
  ctx: AppContext,
  services: Services,
  personId: string,
  lead: string,
): Promise<void> {
  const person = await services.persons.getForUser(ctx.state.user.id, personId);
  const upcoming = await services.birthdays.getOccurrenceForPerson(ctx.state.user.id, person);

  await editOrSend(
    ctx,
    `${lead}\n\n${personDetailsText(upcoming, ctx.state.lang)}`,
    personDetailsKeyboard(personId, ctx.state.lang, person.interests.length > 0),
  );
}

/** `✏️ ویرایش`: every field is editable without deleting the person (§17). */
export function createEditPersonFlow(services: Services, store: FlowStore): FlowDefinition {
  async function finish(ctx: AppContext, state: FlowState): Promise<void> {
    const { personId } = readEditData(state);
    await store.clear(ctx.state.user.id);
    await showDetails(ctx, services, personId, personEditedText(ctx.state.lang));
  }

  return {
    name: EDIT_PERSON_FLOW,
    initialStep: 'choose',
    menuSteps: ['choose', 'name', 'birthday', 'notes', 'interests'],
    onCancel: async (ctx, state) => {
      await store.clear(ctx.state.user.id);
      const { personId } = readEditData(state);
      await showDetails(ctx, services, personId, t('flow.cancelled', ctx.state.lang));
    },

    steps: {
      // The field chooser is rendered with inline buttons; nothing to read here.
      choose: async (ctx) => {
        await sendText(ctx, t('flow.busy', ctx.state.lang));
        return {};
      },

      name: async (ctx, state, text) => {
        const lang = ctx.state.lang;
        const { personId } = readEditData(state);
        const name = cleanName(text);

        if (!name) {
          await editOrSend(ctx, t('addPerson.invalidName', lang), cancelKeyboard(navCallback('menu'), lang));
          return {};
        }

        await services.persons.updateName(ctx.state.user.id, personId, name);
        await finish(ctx, state);
        return { next: null };
      },

      birthday: async (ctx, state, text) => {
        const lang = ctx.state.lang;
        const { personId } = readEditData(state);
        const parsed = parseBirthDate(text);

        if (!parsed.ok) {
          await editOrSend(ctx, t('addPerson.invalidDate', lang), cancelKeyboard(navCallback('menu'), lang));
          return {};
        }

        await services.persons.updateBirthday(ctx.state.user.id, personId, {
          month: parsed.month,
          day: parsed.day,
          year: parsed.year,
        });
        await finish(ctx, state);
        return { next: null };
      },

      notes: async (ctx, state, text) => {
        const { personId } = readEditData(state);
        const notes = text.trim() === SKIP ? null : cleanNotes(text);
        await services.persons.updateNotes(ctx.state.user.id, personId, notes ?? '');
        await finish(ctx, state);
        return { next: null };
      },

      interests: async (ctx, state, text) => {
        const { personId } = readEditData(state);
        const interests = text.trim() === SKIP ? '' : parseInterests(text).join('، ');

        await services.persons.replaceInterests(ctx.state.user.id, personId, interests);
        await finish(ctx, state);
        return { next: null };
      },
    },
  };
}
