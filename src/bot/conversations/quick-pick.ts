import { t, tl, type ListKey } from '../../shared/i18n/index.js';
import { cleanName } from '../../shared/utils/text.js';
import { ackCallback, sendText } from '../helpers.js';
import {
  ADD_PERSON_FLOW,
  collectedData,
  startBirthdayStep,
  toggleInterestStep,
} from './add-person.js';
import type { CallbackData, QuickPickField } from '../callbacks/data.js';
import type { AppContext } from '../context.js';
import type { FlowStore } from './flow.store.js';

/**
 * Which dictionary list each `qp:*` field reads its wording from.
 *
 * The payload carries a field and an index, never the word, so the Persian label
 * stays in one place. Kept in step with `quick-pick.ts`, which draws the same keys.
 */
const LIST_BY_FIELD = {
  name: 'presets.name',
  interest: 'presets.interest',
} as const satisfies Record<QuickPickField, ListKey>;

/** Persian has no case, but an Arabic ي/ی typed by hand still has to match. */
function sameWord(left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase('fa') === right.trim().toLocaleLowerCase('fa');
}

/**
 * Adds a value to a multi-select, or takes it back out.
 *
 * The comparison ignores case and stray spaces so a chip that is already on is
 * always marked as such — otherwise tapping it twice would add "کتاب" and " کتاب"
 * as two separate interests.
 */
export function toggleChoice(current: readonly string[], value: string): string[] {
  return current.some((entry) => sameWord(entry, value))
    ? current.filter((entry) => !sameWord(entry, value))
    : [...current, value];
}

/**
 * Every `qp:*` tap on either chip screen.
 *
 * The name step advances the flow itself, because a preset name is the whole
 * answer. The interests step never does: interests are a multi-select, so it waits
 * for «✅ همین‌ها کافیه».
 */
export async function handleQuickPickCallback(
  ctx: AppContext,
  data: CallbackData,
  store: FlowStore,
): Promise<boolean> {
  const state = await store.get(ctx.state.user.id);

  if (!state || state.flow !== ADD_PERSON_FLOW) {
    await ackCallback(ctx);
    await sendText(ctx, t('flow.notActive', ctx.state.lang));
    return true;
  }

  const field = data.kind.slice(3) as QuickPickField;
  const preset = tl(LIST_BY_FIELD[field], ctx.state.lang)[data.index as number];

  await ackCallback(ctx);

  // A payload can outlive the dictionary — an old message left open across a
  // deploy — so an index that no longer resolves is dropped rather than stored as
  // an empty name or an empty interest.
  if (!preset) return true;

  if (field === 'name') {
    const name = cleanName(preset);
    // A preset that no longer survives `cleanName` would fail the store's schema,
    // so it is dropped like an unknown index rather than stored as a broken name.
    if (name) await startBirthdayStep(ctx, name, store);
    return true;
  }

  await toggleInterestStep(
    ctx,
    store,
    state,
    toggleChoice(collectedData(state).interests ?? [], preset),
  );
  return true;
}