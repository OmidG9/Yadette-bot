import { z } from 'zod';
import { t } from '../../shared/i18n/index.js';
import { cleanName, cleanNotes, parseInterests } from '../../shared/utils/text.js';
import { parseBirthDate } from '../../shared/utils/date.js';
import { ValidationError } from '../../shared/errors/index.js';
import { DEFAULT_REMINDER_DAYS } from '../../shared/constants/index.js';
import type { AppContext } from '../context.js';
import { editOrSend } from '../helpers.js';
import { cancelKeyboard, pendingReminderKeyboard } from '../keyboards/reminder.js';
import { personDetailsKeyboard } from '../keyboards/person.js';
import {
  addPersonConfirmationText,
  addPersonSavedText,
  personDetailsText,
} from '../views/person.views.js';
import type { Services } from '../../container.js';
import type { FlowDefinition, FlowState } from './flow.js';
import type { FlowStore } from './flow.store.js';

const dataSchema = z.object({
  name: z.string().min(1),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(30),
  year: z.number().int().nullable(),
  notes: z.string().nullable(),
  interests: z.array(z.string()),
  reminderDays: z.array(z.number().int()),
});

export type AddPersonData = z.infer<typeof dataSchema>;

const SKIP = '-';
export const ADD_PERSON_FLOW = 'add-person';

export function readAddPersonData(state: FlowState): AddPersonData {
  const parsed = dataSchema.safeParse(state.data);
  if (!parsed.success) throw new ValidationError('Corrupt add-person flow state');
  return parsed.data;
}

/** Reads the name typed in an earlier step (flow data is persisted per step). */
function readName(state: FlowState): string {
  const name = state.data['name'];
  return typeof name === 'string' ? name : '';
}

/** Merges whatever the flow has collected so far with defaults. */
function partialData(state: FlowState): Partial<AddPersonData> {
  const parsed = dataSchema.partial().safeParse(state.data);
  return parsed.success ? parsed.data : {};
}

function initialData(): AddPersonData {
  return {
    name: '',
    month: 1,
    day: 1,
    year: null,
    notes: null,
    interests: [],
    reminderDays: [...DEFAULT_REMINDER_DAYS],
  };
}

/** Confirmation screen: reminder toggles + save/cancel. */
export async function renderAddPersonConfirmation(
  ctx: AppContext,
  data: AddPersonData,
): Promise<number | undefined> {
  return editOrSend(
    ctx,
    addPersonConfirmationText(data, data.interests, ctx.state.lang),
    pendingReminderKeyboard(data.reminderDays, ctx.state.lang),
  );
}

/** Persists the collected data. Called by the `flow:person:save` callback. */
export async function completeAddPerson(
  ctx: AppContext,
  services: Services,
  store: FlowStore,
  state: FlowState,
): Promise<void> {
  const data = readAddPersonData(state);

  const person = await services.persons.create(ctx.state.user.id, {
    name: data.name,
    birthMonth: data.month,
    birthDay: data.day,
    birthYear: data.year,
    notes: data.notes,
    interests: data.interests,
    reminderDays: data.reminderDays,
  });

  await store.clear(ctx.state.user.id);

  const upcoming = await services.birthdays.getOccurrenceForPerson(ctx.state.user.id, person);
  await editOrSend(
    ctx,
    `${addPersonSavedText(person.name, ctx.state.lang)}\n\n${personDetailsText(upcoming, ctx.state.lang)}`,
    personDetailsKeyboard(person.id, ctx.state.lang, person.interests.length > 0),
  );
}

/** Entry point for the `➕ افزودن شخص` button. */
export async function startAddPerson(ctx: AppContext, store: FlowStore): Promise<void> {
  const lang = ctx.state.lang;
  await store.save({
    userId: ctx.state.user.id,
    flow: ADD_PERSON_FLOW,
    step: 'name',
    data: { ...initialData() },
    messageId: null,
  });
  await ctx.reply(t('addPerson.askName', lang), { reply_markup: cancelKeyboard('nav:menu', lang) });
}

/**
 * `➕ افزودن شخص`: name → birthday → interests → notes → reminders → confirm.
 * The final step is driven by inline buttons (`reminder:pending:*`, `flow:person:save`).
 */
export function createAddPersonFlow(store: FlowStore): FlowDefinition {
  return {
    name: ADD_PERSON_FLOW,
    initialStep: 'name',
    onCancel: async (ctx) => {
      await store.clear(ctx.state.user.id);
      await ctx.reply(t('addPerson.cancelled', ctx.state.lang));
    },

    steps: {
      name: async (ctx, _state, text) => {
        const lang = ctx.state.lang;
        const name = cleanName(text);

        if (!name) {
          await editOrSend(ctx, t('addPerson.invalidName', lang), cancelKeyboard('nav:menu', lang));
          return {};
        }

        const messageId = await editOrSend(
          ctx,
          t('addPerson.askBirthday', lang, { name }),
          cancelKeyboard('nav:menu', lang),
        );

        return { next: 'birthday', data: { name }, messageId };
      },

      birthday: async (ctx, _state, text) => {
        const lang = ctx.state.lang;
        const parsed = parseBirthDate(text);

        if (!parsed.ok) {
          await editOrSend(ctx, t('addPerson.invalidDate', lang), cancelKeyboard('nav:menu', lang));
          return {};
        }

        const messageId = await editOrSend(
          ctx,
          `${t('addPerson.askInterests', lang)}\n\n${t('flow.hint', lang)}`,
          cancelKeyboard('nav:menu', lang),
        );

        return {
          next: 'interests',
          data: { month: parsed.month, day: parsed.day, year: parsed.year },
          messageId,
        };
      },

      interests: async (ctx, state, text) => {
        const lang = ctx.state.lang;
        const interests = text.trim() === SKIP ? [] : parseInterests(text);
        const name = readName(state);

        const messageId = await editOrSend(
          ctx,
          `${t('addPerson.askNotes', lang, { name })}\n\n${t('flow.hint', lang)}`,
          cancelKeyboard('nav:menu', lang),
        );

        return { next: 'notes', data: { interests }, messageId };
      },

      notes: async (ctx, state, text) => {
        const notes = text.trim() === SKIP ? null : cleanNotes(text);
        const data: AddPersonData = { ...initialData(), ...partialData(state), notes };

        const messageId = await renderAddPersonConfirmation(ctx, data);
        return { next: 'reminders', data: { notes }, messageId };
      },

      reminders: async (ctx, state) => {
        // Text input is ignored here: the inline buttons drive this step.
        const data = readAddPersonData(state);
        const messageId = await renderAddPersonConfirmation(ctx, data);
        return { messageId };
      },
    },
  };
}
