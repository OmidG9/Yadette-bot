import { InlineKeyboard } from 'grammy';
import { t, type Language } from '../../shared/i18n/index.js';
import { toPersianDigits } from '../../shared/utils/date.js';
import {
  addInterestCallback,
  flowBackCallback,
  flowNextCallback,
  interestDeleteCallback,
  navCallback,
  personCallback,
  reminderDefaultsCallback,
  reminderPendingCallback,
  reminderToggleCallback,
  saveAddPersonCallback,
  snoozeAskCallback,
  snoozeDoCallback,
} from '../callbacks/data.js';
import { ALLOWED_REMINDER_DAYS } from '../../shared/constants/index.js';
import { SNOOZE_OPTIONS } from '../../modules/reminders/snooze.js';
import { grid } from './layout.js';
import type { ReminderRecord } from '../../modules/reminders/reminder.types.js';
import type { InterestRecord } from '../../modules/people/person.types.js';

// «❌ لغو» and «⏮ قبلی» are constants: a constant string cannot drift, but a
// hand-typed one silently can.
const CANCEL_DATA = navCallback('menu');
const BACK_DATA = flowBackCallback();
const NEXT_DATA = flowNextCallback();

/**
 * Offsets per row in every reminder grid.
 *
 * Two, deliberately. Six Persian labels on one row is unreadable on a phone and
 * Telegram Desktop only spreads them thinner.
 */
const REMINDER_COLUMNS = 2;

/**
 * §3.5 — the snooze button on a delivered reminder.
 *
 * Carries the notification log id, which is what makes the button refer to one
 * specific delivery rather than to "the last reminder", which would be wrong
 * the moment a user has two.
 */
export function snoozeKeyboard(logId: string, lang: Language = 'fa'): InlineKeyboard {
  return new InlineKeyboard()
    .text(t('snooze.title', lang), snoozeAskCallback(logId))
    .row()
    .text(t('buttons.close'), navCallback('menu'));
}

/** The offset chooser shown after tapping the snooze button. */
export function snoozeOptionsKeyboard(logId: string, lang: Language = 'fa'): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const days of SNOOZE_OPTIONS) {
    keyboard.text(
      days === 1
        ? t('snooze.tomorrow', lang)
        : t('snooze.inDays', lang, { count: toPersianDigits(days) }),
      snoozeDoCallback(logId, days),
    );
  }

  return keyboard.row().text(t('buttons.close'), navCallback('menu'));
}

/**
 * Reminder offsets as a toggle grid.
 *
 * Two per row, not six: a row of six Persian labels plus a mark is squeezed
 * until neither the number nor the tick is legible on a phone, and Telegram
 * Desktop stretches the same six into a strip of tiny buttons. Two columns leave
 * room for «✅ ۳۰ روز» on one line on every client.
 *
 * The question above the grid ("کِی یادت بیارم؟") carries the meaning the button
 * drops: «قبل» is redundant once the sentence already asks for a number of days,
 * and dropping it is what buys the width.
 */
function reminderToggleGrid(
  toggles: ReadonlyArray<{ days: number; enabled: boolean }>,
  callbackFor: (days: number) => string,
  lang: Language,
): InlineKeyboard {
  const buttons = toggles.map((toggle) => ({
    label: t('reminders.item', lang, {
      mark: toggle.enabled ? t('reminders.on', lang) : t('reminders.off', lang),
      label: shortReminderLabel(toggle.days, lang),
    }),
    data: callbackFor(toggle.days),
  }));

  return grid(buttons, REMINDER_COLUMNS);
}

/**
 * Button-sized offset label.
 *
 * Day zero is named rather than numbered: "۰ روز" reads as a bug, and the point
 * of that offset is that the birthday day itself is included.
 */
function shortReminderLabel(days: number, lang: Language): string {
  return days === 0
    ? t('reminders.day0', lang)
    : t('reminders.daysShort', lang, { count: toPersianDigits(days) });
}

/** Reminder toggles for a saved person (§14). */
export function reminderKeyboard(
  personId: string,
  reminders: ReminderRecord[],
  lang: Language = 'fa',
): InlineKeyboard {
  const keyboard = reminderToggleGrid(
    reminders.map((reminder) => ({ days: reminder.daysBefore, enabled: reminder.enabled })),
    (days) => reminderToggleCallback(personId, days),
    lang,
  );

  return keyboard.row().text(t('buttons.back', lang), personCallback('view', personId));
}

/**
 * Reminder toggles of the add-person confirmation (person not saved yet).
 *
 * The three actions that end the screen each get their own affordance: saving is
 * the outcome the user came for, so it gets a full-width row of its own, while
 * resetting to the defaults and cancelling share a row away from it — a mis-tap
 * must not throw away the whole person.
 *
 * Every allowed offset is listed, selected or not, so switching one off is
 * reversible: a keyboard that only rendered the selected offsets would delete
 * the button and with it the user's ability to change their mind.
 */
export function pendingReminderKeyboard(
  selected: number[],
  lang: Language = 'fa',
): InlineKeyboard {
  const keyboard = reminderToggleGrid(
    ALLOWED_REMINDER_DAYS.map((days) => ({ days, enabled: selected.includes(days) })),
    reminderPendingCallback,
    lang,
  );

  return keyboard
    .row()
    .text(t('reminders.save', lang), saveAddPersonCallback())
    .row()
    .text(t('nav.back', lang), BACK_DATA)
    .text(t('reminders.resetDefaults', lang), reminderDefaultsCallback())
    .text(t('common.cancel', lang), CANCEL_DATA);
}

/** Interests list with per-item delete buttons. */
export function interestsKeyboard(
  personId: string,
  interests: InterestRecord[],
  lang: Language = 'fa',
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const interest of interests) {
    keyboard.text(`🗑 ${interest.title}`, interestDeleteCallback(personId, interest.id));
  }

  return keyboard
    .row()
    .text(t('interests.add', lang), addInterestCallback(personId))
    .text(t('buttons.editInterests', lang), personCallback('edit:interests', personId))
    .row()
    .text(t('buttons.back', lang), personCallback('view', personId));
}

/** Confirmation + cancel for destructive actions (§18). */
export function confirmKeyboard(yesData: string, noData: string, lang: Language = 'fa'): InlineKeyboard {
  return new InlineKeyboard()
    .text(t('delete.confirmYes', lang), yesData)
    .text(t('delete.confirmNo', lang), noData);
}

export function cancelKeyboard(cancelData = CANCEL_DATA, lang: Language = 'fa'): InlineKeyboard {
  return new InlineKeyboard().text(t('common.cancel', lang), cancelData);
}

/**
 * Navigation of a multi-step flow: «⏭ بعدی» skips an optional answer, «⏮ قبلی»
 * re-asks the previous question, and «❌ لغو» always leaves the flow (§35).
 *
 * The order reads right to left like the Persian UI: forward first, then back,
 * then the way out. Each step only gets the buttons that make sense there —
 * nothing is skippable before a name and a birthday exist, and there is no
 * earlier question before the first one.
 */
export function flowNavKeyboard(
  step: { canSkip: boolean; canGoBack: boolean; skipLabel?: string; skipData?: string },
  lang: Language = 'fa',
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  if (step.canSkip) keyboard.text(step.skipLabel ?? t('nav.next', lang), step.skipData ?? NEXT_DATA);
  if (step.canGoBack) keyboard.text(t('nav.back', lang), BACK_DATA);
  keyboard.text(t('common.cancel', lang), CANCEL_DATA);

  return keyboard;
}
