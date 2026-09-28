import { z } from 'zod';
import { t } from '../../shared/i18n/index.js';
import type { Language } from '../../shared/i18n/index.js';
import { cleanName, cleanNotes, parseInterests } from '../../shared/utils/text.js';
import { parseBirthDate, toPersianDigits } from '../../shared/utils/date.js';
import { ValidationError } from '../../shared/errors/index.js';
import { escapeHtml } from '../../shared/utils/text.js';
import { ALLOWED_REMINDER_DAYS, DEFAULT_REMINDER_DAYS } from '../../shared/constants/index.js';
import type { AppContext } from '../context.js';
import type { InlineKeyboard } from 'grammy';
import { ackCallback, editOrSend, sendText, showMainMenu } from '../helpers.js';
import { flowNavKeyboard, pendingReminderKeyboard } from '../keyboards/reminder.js';
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
  /**
   * Restricted to the offsets the product offers. Callback data is attacker
   * controlled, so without this an unknown offset could be parked in the flow
   * state and later written onto the person record as a reminder.
   */
  reminderDays: z
    .array(z.number().int())
    .refine(
      (days) => days.every((day) => (ALLOWED_REMINDER_DAYS as readonly number[]).includes(day)),
      { message: 'unsupported reminder offset' },
    ),
});

export type AddPersonData = z.infer<typeof dataSchema>;

const SKIP = '-';
export const ADD_PERSON_FLOW = 'add-person';

/** The questions the user walks through, in order. */
const STEPS = ['name', 'birthday', 'interests', 'notes', 'reminders'] as const;
type Step = (typeof STEPS)[number];

/** Where «⏮ قبلی» goes, and what «⏭ بعدی» may skip. */
const STEP_NAV: Record<Step, { back?: Step; skippable: boolean }> = {
  name: { skippable: false },
  birthday: { back: 'name', skippable: false },
  interests: { back: 'birthday', skippable: true },
  notes: { back: 'interests', skippable: true },
  reminders: { back: 'notes', skippable: false },
};

/** Value each step stores when the user taps «⏭ بعدی». */
const STEP_SKIP_DATA: Partial<Record<Step, Record<string, unknown>>> = {
  interests: { interests: [] },
  notes: { notes: null },
};

export function readAddPersonData(state: FlowState): AddPersonData {
  const parsed = dataSchema.safeParse(state.data);
  if (!parsed.success) throw new ValidationError('Corrupt add-person flow state');
  return parsed.data;
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

/**
 * The prompt of a step, rebuilt from whatever has been collected so far.
 *
 * Kept separate from the step handlers on purpose: «⏮ قبلی» has to re-ask a
 * question that was already answered, and it has no way to replay the handler
 * that asked it.
 */
export function stepPrompt(step: Step, data: AddPersonData, lang: Language): string {
  // The name reaches the message as HTML, so it has to be escaped like any view.
  const name = escapeHtml(data.name);
  const current = (value: string | null | undefined): string =>
    value ? t('addPerson.currentAnswer', lang, { value: escapeHtml(value) }) : '';

  switch (step) {
    case 'name':
      return `${t('addPerson.askName', lang)}\n\n${progress(step, lang)}\n\n${t('hint.cancel', lang)}`;
    case 'birthday':
      return `${t('addPerson.askBirthday', lang, { name })}\n\n${progress(step, lang)}`;
    case 'interests':
      return `${t('addPerson.askInterests', lang, { name, current: current(data.interests.join('، ')) })}\n\n${progress(step, lang)}\n\n${t('hint.skip', lang)}`;
    case 'notes':
      return `${t('addPerson.askNotes', lang, { name, current: current(data.notes) })}\n\n${progress(step, lang)}\n\n${t('hint.skip', lang)}`;
    case 'reminders':
      return t('addPerson.confirmation', lang, { name });
  }
}

/** `📋 مرحله ۲ از ۵` — reassurance that the flow ends. */
function progress(step: Step, lang: Language): string {
  return t('addPerson.progress', lang, {
    current: toPersianDigits(STEPS.indexOf(step) + 1),
    total: toPersianDigits(STEPS.length),
  });
}

/** The buttons that make sense on a step: skip, back, and always cancel. */
function stepKeyboard(step: Step, lang: Language): InlineKeyboard {
  const nav = STEP_NAV[step];
  return flowNavKeyboard({ canSkip: nav.skippable, canGoBack: nav.back !== undefined }, lang);
}

/**
 * Renders a step without touching the store.
 *
 * The flow middleware owns persistence: a handler returns `{ next, data,
 * messageId }` and the middleware writes the state once. The callback entry
 * points (`⏭ بعدی`, `⏮ قبلی`) are not driven by the middleware, so they save the
 * state themselves — see `persistStep`.
 *
 * The confirmation step is the exception: it is driven by inline buttons rather
 * than by a question, so it has its own renderer. Routing both entry points
 * through here is what keeps «⏭ بعدی» from landing on a screen that has the
 * confirmation text but none of the buttons that can act on it.
 */
async function renderStep(
  ctx: AppContext,
  step: Step,
  data: AddPersonData,
): Promise<number | undefined> {
  const lang = ctx.state.lang;
  return step === 'reminders'
    ? renderAddPersonConfirmation(ctx, data)
    : editOrSend(ctx, stepPrompt(step, data, lang), stepKeyboard(step, lang));
}

/** Renders a step and records it, for the callback paths the middleware misses. */
async function showStep(
  ctx: AppContext,
  step: Step,
  data: AddPersonData,
  store: FlowStore,
): Promise<number | undefined> {
  const messageId = await renderStep(ctx, step, data);
  await persistStep(ctx, step, data, store, messageId);
  return messageId;
}

async function persistStep(
  ctx: AppContext,
  step: Step,
  data: AddPersonData,
  store: FlowStore,
  messageId: number | undefined,
): Promise<void> {
  await store.save({
    userId: ctx.state.user.id,
    flow: ADD_PERSON_FLOW,
    step,
    data,
    messageId: messageId ?? null,
  });
}

/** «⏭ بعدی»: skips an optional step and moves on. */
export async function skipAddPersonStep(
  ctx: AppContext,
  store: FlowStore,
  state: FlowState,
): Promise<void> {
  await ackCallback(ctx);

  const lang = ctx.state.lang;
  const step = state.step as Step;
  const next = STEPS.indexOf(step) >= 0 ? STEPS[STEPS.indexOf(step) + 1] : undefined;

  if (!STEP_NAV[step]?.skippable || !next) {
    await sendText(ctx, t('flow.busy', lang));
    return;
  }

  const data: AddPersonData = {
    ...initialData(),
    ...partialData(state),
    ...(STEP_SKIP_DATA[step] ?? {}),
  };

  await showStep(ctx, next, data, store);
}

/** «⏮ قبلی»: re-asks the previous question, keeping what was already typed. */
export async function backAddPersonStep(
  ctx: AppContext,
  store: FlowStore,
  state: FlowState,
): Promise<void> {
  await ackCallback(ctx);

  const target = STEP_NAV[state.step as Step]?.back;

  if (!target) {
    await sendText(ctx, t('flow.busy', ctx.state.lang));
    return;
  }

  await showStep(ctx, target, readAddPersonData(state), store);
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
  const enabledReminders = person.reminders.filter((reminder) => reminder.enabled).length;
  await editOrSend(
    ctx,
    `${addPersonSavedText(person.name, enabledReminders, ctx.state.lang)}\n\n${personDetailsText(upcoming, ctx.state.lang)}`,
    personDetailsKeyboard(person.id, ctx.state.lang, person.interests.length > 0),
  );
}

/** Entry point for the `➕ افزودن شخص` button. */
export async function startAddPerson(ctx: AppContext, store: FlowStore): Promise<void> {
  const data = initialData();
  await showStep(ctx, 'name', data, store);

  // Arriving straight from the `?start=add` deep link means no welcome message
  // was sent, so the reply keyboard still has to be installed once.
  if (ctx.state.isNewUser) {
    await showMainMenu(ctx);
  }
}

/**
 * `➕ افزودن شخص`: name → birthday → interests → notes → reminders → confirm.
 * The final step is driven by inline buttons (`reminder:pending:*`, `flow:person:save`).
 */
export function createAddPersonFlow(store: FlowStore): FlowDefinition {
  return {
    name: ADD_PERSON_FLOW,
    initialStep: 'name',
    // Every step is menu-aware: a menu press must never be read as an answer.
    menuSteps: ['name', 'birthday', 'interests', 'notes', 'reminders'],
    onCancel: async (ctx) => {
      await store.clear(ctx.state.user.id);
      await sendText(ctx, t('flow.cancelled', ctx.state.lang));
    },

    steps: {
      name: async (ctx, _state, text) => {
        const lang = ctx.state.lang;
        const name = cleanName(text);

        if (!name) {
          await editOrSend(ctx, t('addPerson.invalidName', lang), stepKeyboard('name', lang));
          return {};
        }

        const data: AddPersonData = { ...initialData(), name };
        return { next: 'birthday', data, messageId: await renderStep(ctx, 'birthday', data) };
      },

      birthday: async (ctx, state, text) => {
        const lang = ctx.state.lang;
        const parsed = parseBirthDate(text);

        if (!parsed.ok) {
          await editOrSend(ctx, t('addPerson.invalidDate', lang), stepKeyboard('birthday', lang));
          return {};
        }

        const data: AddPersonData = {
          ...initialData(),
          ...partialData(state),
          month: parsed.month,
          day: parsed.day,
          year: parsed.year,
        };

        return {
          next: 'interests',
          data,
          messageId: await renderStep(ctx, 'interests', data),
        };
      },

      interests: async (ctx, state, text) => {
        const data: AddPersonData = {
          ...initialData(),
          ...partialData(state),
          interests: text.trim() === SKIP ? [] : parseInterests(text),
        };

        return { next: 'notes', data, messageId: await renderStep(ctx, 'notes', data) };
      },

      notes: async (ctx, state, text) => {
        const data: AddPersonData = {
          ...initialData(),
          ...partialData(state),
          notes: text.trim() === SKIP ? null : cleanNotes(text),
        };

        return {
          next: 'reminders',
          data,
          messageId: await renderStep(ctx, 'reminders', data),
        };
      },

      reminders: async (ctx, state) => {
        // Text input is ignored here: the inline buttons drive this step.
        return { messageId: await renderStep(ctx, 'reminders', readAddPersonData(state)) };
      },
    },
  };
}

