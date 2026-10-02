import { t, type TranslationKey } from '../../shared/i18n/index.js';
import { isValidBirthdayRule } from '../../modules/birthdays/birthday.calc.js';
import { ackCallback, sendText } from '../helpers.js';
import { clampBirthYearPage, daysInJalaliMonth } from '../keyboards/birthday.js';
import {
  ADD_PERSON_FLOW,
  applyBirthdayDate,
  collectedName,
  readBirthdayPick,
  renderBirthdayPicker,
} from './add-person.js';
import type { CallbackData } from '../callbacks/data.js';
import type { AppContext } from '../context.js';
import type { BirthdayPick } from '../keyboards/birthday.js';
import type { FlowState } from './flow.js';
import type { FlowStore } from './flow.store.js';

/** The picker action a `bd:*` payload addresses, without its prefix. */
type PickerAction = 'month' | 'day' | 'year' | 'page' | 'noYear' | 'back';

/** The date the picker has settled on, or the screen it should show next. */
type PickerOutcome =
  | { kind: 'done'; month: number; day: number; year: number | null }
  | { kind: 'screen'; pick: BirthdayPick; error?: TranslationKey };

/**
 * Turns a tap into either a finished date or the next screen.
 *
 * Pure, so the decision can be tested without a Telegram context. Every branch
 * answers with the *whole* pick rather than a patch, because a tap has to be able
 * to drop a previous answer — going back from the year screen to re-pick the day
 * must forget the day, not merge with it.
 */
export function applyBirthdayTap(
  action: PickerAction,
  pick: BirthdayPick,
  value?: number,
): PickerOutcome {
  switch (action) {
    case 'month':
      // A new month invalidates the day: Esfand has 29 or 30 days, the rest 31.
      // Keeping the old one would let the year screen offer a date that cannot exist.
      return { kind: 'screen', pick: { month: value } };

    case 'day': {
      if (pick.month === undefined) return { kind: 'screen', pick };

      return (value ?? 0) > daysInJalaliMonth(pick.month)
        ? { kind: 'screen', pick, error: 'picker.invalidDay' }
        : { kind: 'screen', pick: { month: pick.month, day: value } };
    }

    case 'year': {
      if (pick.month === undefined || pick.day === undefined) return { kind: 'screen', pick };

      const rule = { month: pick.month, day: pick.day, year: value ?? 0 };
      return isValidBirthdayRule(rule)
        ? { kind: 'done', ...rule }
        : { kind: 'screen', pick, error: 'picker.yearMismatch' };
    }

    case 'noYear': {
      if (pick.month === undefined || pick.day === undefined) return { kind: 'screen', pick };
      return { kind: 'done', month: pick.month, day: pick.day, year: null };
    }

    case 'page': {
      // Paging only changes what is drawn. When it arrives before a month and day
      // exist the tap is stale, so the pick is re-rendered untouched.
      if (pick.month === undefined || pick.day === undefined) return { kind: 'screen', pick };
      return { kind: 'screen', pick: { ...pick, page: clampBirthYearPage(value ?? 0) } };
    }

    case 'back': {
      // Year screen → day screen: forget the day, keep the month. Day screen →
      // month screen, and a no-op on the first screen, which has no back button.
      return { kind: 'screen', pick: pick.day !== undefined ? { month: pick.month } : {} };
    }

    default:
      return { kind: 'screen', pick };
  }
}

/** A stale button: the flow moved on, so the tap has nothing left to act on. */
async function rejectStale(ctx: AppContext): Promise<boolean> {
  await ackCallback(ctx);
  await sendText(ctx, t('flow.notActive', ctx.state.lang));
  return true;
}

/** The number a payload carries, whichever of the three fields the parser filled. */
function payloadValue(data: CallbackData): number | undefined {
  if ('month' in data) return data.month;
  if ('day' in data) return data.day;
  if ('year' in data) return data.year;
  return undefined;
}

/**
 * Every `bd:*` tap, from the month grid to «سال ندارم».
 *
 * The screen answers on the same message the button was pressed on, so a user
 * paging through years sees one screen change rather than a new message per page.
 */
export async function handleBirthdayPickerCallback(
  ctx: AppContext,
  data: CallbackData,
  store: FlowStore,
): Promise<boolean> {
  const state: FlowState | null = await store.get(ctx.state.user.id);

  if (!state || state.flow !== ADD_PERSON_FLOW) return rejectStale(ctx);

  const outcome = applyBirthdayTap(
    data.kind.slice(3) as PickerAction,
    readBirthdayPick(state),
    payloadValue(data),
  );

  if (outcome.kind === 'done') {
    await applyBirthdayDate(ctx, store, state, outcome);
    return true;
  }

  // Persisted before the render so the message id below can replace this message,
  // and so a tap on the new screen reads the very pick it was drawn from.
  await store.save({ ...state, data: { ...state.data, birthdayPick: outcome.pick } });
  await ackCallback(ctx);
  await renderBirthdayPicker(
    ctx,
    { name: collectedName(state) },
    outcome.pick,
    outcome.error ? t(outcome.error, ctx.state.lang) : undefined,
  );
  return true;
}