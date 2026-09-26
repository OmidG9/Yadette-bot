import { t } from '../../shared/i18n/index.js';
import type { AppContext } from '../context.js';
import { ackCallback, editOrSend, sendText } from '../helpers.js';
import { interestsKeyboard } from '../keyboards/reminder.js';
import { interestsText } from '../views/person.views.js';
import { ValidationError } from '../../shared/errors/index.js';
import {
  ADD_PERSON_FLOW,
  completeAddPerson,
  readAddPersonData,
  renderAddPersonConfirmation,
} from '../conversations/add-person.js';
import { startAddInterest } from '../conversations/add-interest.js';
import { startEditPerson } from '../conversations/edit-person.js';
import type { FlowStore } from '../conversations/flow.store.js';
import type { Services } from '../../container.js';

export interface FlowCallbackDeps {
  services: Services;
  store: FlowStore;
}

const EDIT_FIELDS = new Set(['name', 'birthday', 'notes', 'interests']);

/**
 * Callbacks that drive conversation flows:
 * `reminder:pending:*`, `flow:person:save`, `flow:interest:add:*`, `person:edit*`.
 */
export async function handleFlowCallback(
  ctx: AppContext,
  data: { kind: string; personId?: string; days?: number },
  deps: FlowCallbackDeps,
): Promise<boolean> {
  const { services, store } = deps;
  const lang = ctx.state.lang;
  const userId = ctx.state.user.id;

  if (data.kind === 'reminder:pending') {
    if (data.days === undefined) throw new ValidationError('Missing reminder offset');

    const state = await store.get(userId);
    if (!state || state.flow !== ADD_PERSON_FLOW) {
      await ackCallback(ctx);
      await sendText(ctx, t('flow.notActive', lang));
      return true;
    }

    const current = readAddPersonData(state);
    const days = data.days;
    const selected = current.reminderDays.includes(days)
      ? current.reminderDays.filter((value) => value !== days)
      : [...current.reminderDays, days].sort((a, b) => b - a);

    const updated = { ...current, reminderDays: selected };
    await store.save({ ...state, data: updated });

    await ackCallback(ctx);
    await renderAddPersonConfirmation(ctx, updated);
    return true;
  }

  if (data.kind === 'flow:person:save') {
    const state = await store.get(userId);
    if (!state || state.flow !== ADD_PERSON_FLOW) {
      await ackCallback(ctx);
      await sendText(ctx, t('flow.notActive', lang));
      return true;
    }
    await completeAddPerson(ctx, services, store, state);
    return true;
  }

  if (data.kind === 'flow:interest:add') {
    await startAddInterest(ctx, store, data.personId ?? '');
    return true;
  }

  if (data.kind === 'person:edit') {
    await startEditPerson(ctx, services, store, data.personId ?? '');
    return true;
  }

  if (data.kind.startsWith('person:edit:')) {
    const field = data.kind.split(':')[2] ?? '';
    if (!EDIT_FIELDS.has(field)) return false;
    await startEditPerson(
      ctx,
      services,
      store,
      data.personId ?? '',
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
    `${t('interests.removed', lang, { title: removed.title })}\n\n${interestsText(person, lang)}`,
    interestsKeyboard(personId, person.interests, lang),
  );
  return true;
}
