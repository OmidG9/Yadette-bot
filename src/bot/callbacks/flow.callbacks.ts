import { t } from '../../shared/i18n/index.js';
import type { AppContext } from '../context.js';
import { ackCallback, editOrSend, sendText } from '../helpers.js';
import { interestsKeyboard } from '../keyboards/reminder.js';
import { interestsText } from '../views/person.views.js';
import { escapeHtml } from '../../shared/utils/text.js';
import { ALLOWED_REMINDER_DAYS, DEFAULT_REMINDER_DAYS } from '../../shared/constants/index.js';
import { ValidationError } from '../../shared/errors/index.js';
import {
  ADD_PERSON_FLOW,
  acceptAddPersonStep,
  backAddPersonStep,
  completeAddPerson,
  readAddPersonData,
  renderAddPersonConfirmation,
  skipAddPersonStep,
  type AddPersonData,
} from '../conversations/add-person.js';
import { handleBirthdayPickerCallback } from '../conversations/birthday-picker.js';
import { handleQuickPickCallback } from '../conversations/quick-pick.js';
import { startAddInterest } from '../conversations/add-interest.js';
import { startEditPerson } from '../conversations/edit-person.js';
import type { CallbackData } from './data.js';
import type { FlowState, FlowStore } from '../conversations/flow.js';
import type { Services } from '../../container.js';

export interface FlowCallbackDeps {
  services: Services;
  store: FlowStore;
}

const EDIT_FIELDS = new Set(['name', 'birthday', 'notes', 'interests']);

/** The add-person flow, or `null` when the tap outlived the flow that drew it. */
async function activeAddPerson(
  ctx: AppContext,
  store: FlowStore,
): Promise<FlowState | null> {
  const state = await store.get(ctx.state.user.id);

  if (state && state.flow === ADD_PERSON_FLOW) return state;

  await ackCallback(ctx);
  await sendText(ctx, t('flow.notActive', ctx.state.lang));
  return null;
}

/**
 * Callbacks that drive conversation flows:
 * `bd:*`, `qp:*`, `reminder:pending:*`, `reminder:defaults`, `flow:person:*`,
 * `flow:interest:add:*`, `person:edit*`.
 */
export async function handleFlowCallback(
  ctx: AppContext,
  data: CallbackData,
  deps: FlowCallbackDeps,
): Promise<boolean> {
  const { services, store } = deps;

  // The three screens that collect a date or a word in one tap each. Handled
  // first: they own the whole message the user is looking at, so nothing else
  // may edit it on the way through.
  if (data.kind.startsWith('bd:')) return handleBirthdayPickerCallback(ctx, data, store);
  if (data.kind.startsWith('qp:')) return handleQuickPickCallback(ctx, data, store);

  if (data.kind === 'reminder:pending') {
    const days = data.days as number;

    // Callback data is attacker controlled: a stale or hand-crafted payload must
    // not be able to park an unsupported offset in the flow state.
    if (!(ALLOWED_REMINDER_DAYS as readonly number[]).includes(days)) {
      throw new ValidationError('Unsupported reminder offset', { days });
    }

    const state = await activeAddPerson(ctx, store);
    if (!state) return true;

    const current = readAddPersonData(state);
    const selected = current.reminderDays.includes(days)
      ? current.reminderDays.filter((value) => value !== days)
      : [...current.reminderDays, days].sort((a, b) => b - a);

    const updated = { ...current, reminderDays: selected };
    await store.save({ ...state, data: updated });

    await ackCallback(ctx);
    await renderAddPersonConfirmation(ctx, updated);
    return true;
  }

  // «↩️ پیش‌فرض»: one tap back to the offsets the product ships with, for the
  // screen that is otherwise a grid of twelve toggles the user has to undo.
  if (data.kind === 'reminder:defaults') {
    const state = await activeAddPerson(ctx, store);
    if (!state) return true;

    const updated: AddPersonData = {
      ...readAddPersonData(state),
      reminderDays: [...DEFAULT_REMINDER_DAYS],
    };
    await store.save({ ...state, data: updated });

    await ackCallback(ctx);
    await renderAddPersonConfirmation(ctx, updated);
    return true;
  }

  if (data.kind === 'flow:person:save') {
    const state = await activeAddPerson(ctx, store);
    if (!state) return true;
    await completeAddPerson(ctx, services, store, state);
    return true;
  }

  // «⏭ بعدی», «✅ همین‌ها کافیه» and «⏮ قبلی» move around inside the flow. All three
  // are dispatched here rather than from the flow middleware, which only ever sees
  // text messages.
  if (
    data.kind === 'flow:person:next' ||
    data.kind === 'flow:person:keep' ||
    data.kind === 'flow:person:back'
  ) {
    const state = await activeAddPerson(ctx, store);
    if (!state) return true;

    if (data.kind === 'flow:person:back') {
      await backAddPersonStep(ctx, store, state);
    } else if (data.kind === 'flow:person:keep') {
      await acceptAddPersonStep(ctx, store, state);
    } else {
      await skipAddPersonStep(ctx, store, state);
    }
    return true;
  }

  if (data.kind === 'flow:interest:add') {
    if (!data.personId) return false;
    // Ownership first, exactly like every other person callback: otherwise a
    // stale payload would park the user on a prompt for a person they cannot edit.
    await services.persons.getForUser(ctx.state.user.id, data.personId);
    await startAddInterest(ctx, store, data.personId);
    return true;
  }

  if (data.kind === 'person:edit') {
    if (!data.personId) return false;
    await startEditPerson(ctx, services, store, data.personId);
    return true;
  }

  if (data.kind.startsWith('person:edit:')) {
    const field = data.kind.split(':')[2] ?? '';
    if (!EDIT_FIELDS.has(field) || !data.personId) return false;
    await startEditPerson(
      ctx,
      services,
      store,
      data.personId,
      field as 'name' | 'birthday' | 'notes' | 'interests',
    );
    return true;
  }

  return false;
}

/** `interest:del:<personId>:<interestId>` */
export async function handleInterestDelete(
  ctx: AppContext,
  data: { personId?: string; interestId?: string },
  services: Services,
): Promise<boolean> {
  const lang = ctx.state.lang;
  const userId = ctx.state.user.id;
  const personId = data.personId ?? '';
  const interestId = data.interestId ?? '';

  const removed = await services.persons.removeInterest(userId, personId, interestId);
  const person = await services.persons.getForUser(userId, personId);

  await ackCallback(ctx);
  await editOrSend(
    ctx,
    `${t('interests.removed', lang, { title: escapeHtml(removed.title) })}\n\n${interestsText(person, lang)}`,
    interestsKeyboard(personId, person.interests, lang),
  );
  return true;
}
