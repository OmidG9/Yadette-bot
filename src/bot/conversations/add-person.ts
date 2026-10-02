import { z } from 'zod';
import { t } from '../../shared/i18n/index.js';
import type { Language } from '../../shared/i18n/index.js';
import { cleanName, cleanNotes, parseInterests } from '../../shared/utils/text.js';
import {
  currentJalaliDate,
  parseBirthDate,
  toPersianDigits,
} from '../../shared/utils/date.js';
import { ValidationError } from '../../shared/errors/index.js';
import { escapeHtml } from '../../shared/utils/text.js';
import {
  ALLOWED_REMINDER_DAYS,
  DEFAULT_REMINDER_DAYS,
  MAX_BIRTH_YEAR_JALALI,
  MIN_BIRTH_YEAR_JALALI,
} from '../../shared/constants/index.js';
import type { AppContext } from '../context.js';
import type { InlineKeyboard } from 'grammy';
import { ackCallback, editOrSend, sendText, showMainMenu } from '../helpers.js';
import { flowNavKeyboard, pendingReminderKeyboard } from '../keyboards/reminder.js';
import { interestPresetKeyboard, namePresetKeyboard } from '../keyboards/quick-pick.js';
import {
  birthdayDayKeyboard,
  birthdayMonthKeyboard,
  birthdayYearKeyboard,
  defaultBirthYearPage,
  pickerScreen,
  type BirthdayPick,
} from '../keyboards/birthday.js';
import { birthdayPickerText } from '../views/birthday.views.js';
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

/**
 * What the date picker has collected so far.
 *
 * Kept beside the answer rather than inside it: `month`/`day`/`year` on
 * `AddPersonData` still hold the flow defaults (`1/1/null`) until the picker is
 * finished, so a half-picked date must not be readable as an answer.
 */
const pickSchema = z.object({
  month: z.number().int().min(1).max(12).optional(),
  day: z.number().int().min(1).max(31).optional(),
  /** First year of the year page on screen, so paging back and forth works. */
  page: z
    .number()
    .int()
    .min(MIN_BIRTH_YEAR_JALALI)
    .max(MAX_BIRTH_YEAR_JALALI)
    .optional(),
});

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

/**
 * What the flow has collected so far, for callers that add to it.
 *
 * Exported rather than re-parsed: a second reader of the same `FlowState` would
 * be free to disagree with the first about what is valid.
 */
export function collectedData(state: FlowState): Partial<AddPersonData> {
  return partialData(state);
}

/**
 * The picker's partial answer, or `{}` for anything unreadable.
 *
 * Tolerating a malformed pick rather than throwing is deliberate: the picker can
 * always be restarted from the month screen, so a corrupt row costs the user one
 * screen instead of the whole flow.
 */
export function readBirthdayPick(state: FlowState): BirthdayPick {
  const parsed = pickSchema.safeParse(state.data.birthdayPick);
  return parsed.success ? parsed.data : {};
}

/** The name collected so far, or an empty string before the first step ran. */
export function collectedName(state: FlowState): string {
  return partialData(state).name ?? '';
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
      return [
        t('addPerson.askName', lang),
        progress(step, lang),
        t('addPerson.chipsTitle', lang),
      ].join('\n\n');
    case 'birthday':
      // The picker owns the question; this is exactly its first screen, so a
      // «⏮ قبلی» back onto the birthday step lands somewhere usable.
      return [birthdayPickerText({ screen: 'month', name: data.name }, lang), progress(step, lang)].join(
        '\n\n',
      );
    case 'interests':
      return [
        t('addPerson.askInterests', lang, { name, current: current(data.interests.join('، ')) }),
        progress(step, lang),
        t('addPerson.interestsChipsTitle', lang),
      ].join('\n\n');
    case 'notes':
      return [
        t('addPerson.askNotes', lang, { name, current: current(data.notes) }),
        progress(step, lang),
        t('hint.skip', lang),
      ].join('\n\n');
    case 'reminders':
      return t('addPerson.confirmation', lang, { name });
  }
}

/** `📋 مرحله ۲ از ۵ · ●●○○○` — reassurance that the flow ends, at a glance. */
function progress(step: Step, lang: Language): string {
  return t('addPerson.progress', lang, {
    current: toPersianDigits(STEPS.indexOf(step) + 1),
    total: toPersianDigits(STEPS.length),
    bar: progressBar(STEPS.indexOf(step) + 1, STEPS.length),
  });
}

/**
 * Filled dots for the steps behind the user, hollow ones for what is left.
 *
 * A bare "step 2 of 5" asks the reader to do arithmetic in their head; this
 * answers it before they have to ask the question.
 */
function progressBar(done: number, total: number): string {
  return '●'.repeat(Math.min(Math.max(done, 0), total)) + '○'.repeat(Math.max(total - done, 0));
}

/**
 * The buttons that make sense on a step.
 *
 * Two steps answer with a tap where a tap can be right, so their keyboard is a
 * grid of ready-made answers instead of just navigation — a question whose answer
 * is one of six common things should never require typing it.
 */
function stepKeyboard(step: Step, data: AddPersonData, lang: Language): InlineKeyboard {
  switch (step) {
    case 'name':
      return namePresetKeyboard(lang);
    case 'interests':
      return interestPresetKeyboard(data.interests, lang);
    default: {
      const nav = STEP_NAV[step];
      return flowNavKeyboard(
        { canSkip: nav.skippable, canGoBack: nav.back !== undefined },
        lang,
      );
    }
  }
}

/**
 * Renders a step without touching the store.
 *
 * The flow middleware owns persistence: a handler returns `{ next, data,
 * messageId }` and the middleware writes the state once. The callback entry
 * points (`⏭ بعدی`, `⏮ قبلی`) are not driven by the middleware, so they save the
 * state themselves — see `persistStep`.
 *
 * Two steps are exceptions with their own renderers: the birthday step is the
 * date picker, and the confirmation step is driven by inline buttons rather than
 * by a question. Routing every entry point through here is what keeps «⏭ بعدی»
 * from landing on a screen that has the confirmation text but none of the buttons
 * that can act on it.
 */
async function renderStep(
  ctx: AppContext,
  step: Step,
  data: AddPersonData,
): Promise<number | undefined> {
  const lang = ctx.state.lang;

  if (step === 'birthday') return renderBirthdayPicker(ctx, data, {});
  if (step === 'reminders') return renderAddPersonConfirmation(ctx, data);

  return editOrSend(ctx, stepPrompt(step, data, lang), stepKeyboard(step, data, lang));
}

/**
 * One screen of the Jalali date picker.
 *
 * The grid and the message are chosen together from the same screen, so they can
 * never disagree. `error` is the one thing a screen may add on its own, and only
 * the year screen uses it.
 */
export async function renderBirthdayPicker(
  ctx: AppContext,
  data: { name: string },
  pick: BirthdayPick,
  error?: string,
): Promise<number | undefined> {
  const lang = ctx.state.lang;
  const screen = pickerScreen(pick);
  // The age on each year button and the page the grid opens on both depend on
  // "today" for this user, not for the server.
  const today = currentJalaliDate(ctx.state.user.timezone);

  const text = [
    birthdayPickerText(
      { screen, name: data.name, month: pick.month, day: pick.day, error },
      lang,
    ),
    progress('birthday', lang),
  ].join('\n\n');

  const keyboard =
    screen === 'month'
      ? birthdayMonthKeyboard(lang)
      : screen === 'day'
        ? birthdayDayKeyboard(pick.month ?? 1, lang)
        : birthdayYearKeyboard(pick.page ?? defaultBirthYearPage(today.jy), today.jy, lang);

  return editOrSend(ctx, text, keyboard);
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

/**
 * The name step answered by a preset chip.
 *
 * The chip is the whole answer, so the flow jumps straight to the date picker —
 * asking «تولد کی؟» for a name that is already decided would be noise.
 */
export async function startBirthdayStep(
  ctx: AppContext,
  name: string,
  store: FlowStore,
): Promise<void> {
  await showStep(ctx, 'birthday', { ...initialData(), name }, store);
}

/**
 * The interests step after a chip was toggled.
 *
 * The new list is stored before the redraw so the message id that comes back
 * points at the screen the chips were just relabelled on.
 */
export async function toggleInterestStep(
  ctx: AppContext,
  store: FlowStore,
  state: FlowState,
  interests: string[],
): Promise<void> {
  await store.save({ ...state, data: { ...state.data, interests } });
  await renderStep(ctx, 'interests', {
    ...initialData(),
    ...partialData(state),
    interests,
  });
}

/**
 * Stores a date the picker produced and moves on to interests.
 *
 * Shared by the picker's last screen and by typed input: both end up with the
 * same triple, so both must land on the same next step the same way.
 */
export async function applyBirthdayDate(
  ctx: AppContext,
  store: FlowStore,
  state: FlowState,
  rule: { month: number; day: number; year: number | null },
): Promise<void> {
  const data: AddPersonData = {
    ...initialData(),
    ...partialData(state),
    month: rule.month,
    day: rule.day,
    year: rule.year,
  };

  await showStep(ctx, 'interests', data, store);
}

/**
 * «✅ همین‌ها کافیه»: accepts the chips as the answer and moves on.
 *
 * Separate from `skipAddPersonStep` because next stores "no answer" while this
 * stores what is on screen. Sharing one payload would discard every tap.
 */
export async function acceptAddPersonStep(
  ctx: AppContext,
  store: FlowStore,
  state: FlowState,
): Promise<void> {
  await ackCallback(ctx);

  if (state.step !== 'interests') {
    await sendText(ctx, t('flow.busy', ctx.state.lang));
    return;
  }

  const current = partialData(state);
  const data: AddPersonData = {
    ...initialData(),
    ...current,
    interests: current.interests ?? [],
  };

  await showStep(ctx, 'notes', data, store);
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
          await editOrSend(ctx, t('addPerson.invalidName', lang), namePresetKeyboard(lang));
          return {};
        }

        const data: AddPersonData = { ...initialData(), name };
        return { next: 'birthday', data, messageId: await renderStep(ctx, 'birthday', data) };
      },

      birthday: async (ctx, state, text) => {
        const lang = ctx.state.lang;
        const parsed = parseBirthDate(text);

        if (!parsed.ok) {
          // Back onto the picker rather than onto a bare error line: the user
          // keeps whatever they had already tapped, and the buttons are still
          // there. Typing is an alternative to the grid, not a separate mode.
          await renderBirthdayPicker(
            ctx,
            { name: collectedName(state) },
            readBirthdayPick(state),
            t('addPerson.invalidDate', lang),
          );
          return {};
        }

        await applyBirthdayDate(ctx, store, state, {
          month: parsed.month,
          day: parsed.day,
          year: parsed.year,
        });
        return {};
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

