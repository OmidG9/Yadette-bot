import type { InlineKeyboard } from 'grammy';
import { t, tl, type Language, type ListKey } from '../../shared/i18n/index.js';
import { flowKeepCallback, quickPickCallback, type QuickPickField } from '../callbacks/data.js';
import { flowNavKeyboard } from './reminder.js';
import { appendRows, grid, type KeypadButton } from './layout.js';

/** Three chips per row: the widest Persian preset («تکنولوژی») still fits. */
const PRESET_COLUMNS = 3;

/**
 * Which dictionary list a `qp:*` payload addresses.
 *
 * The payload carries the field name and an index, never the word itself: the
 * label is Persian, so putting it in a 64-byte payload would spend half the
 * budget on two bytes per character and freeze the wording into the wire format.
 */
const LIST_BY_FIELD = {
  name: 'presets.name',
  interest: 'presets.interest',
} as const satisfies Record<QuickPickField, ListKey>;

function isChosen(selected: readonly string[], value: string): boolean {
  const needle = value.toLocaleLowerCase('fa');
  return selected.some((entry) => entry.toLocaleLowerCase('fa') === needle);
}

/**
 * One-tap answers for a step that has a handful of common values.
 *
 * A chip that is already on is marked, so a multi-select (interests) never shows
 * a duplicate of a choice the user already made, and tapping it again takes the
 * choice back — the button is never deleted, only relabelled.
 */
function presetKeyboard(
  field: QuickPickField,
  selected: readonly string[],
  lang: Language,
  navigation: InlineKeyboard,
): InlineKeyboard {
  const values = tl(LIST_BY_FIELD[field], lang);

  const buttons: KeypadButton[] = values.map((value, index) => ({
    label: isChosen(selected, value) ? `${t('reminders.on', lang)} ${value}` : value,
    data: quickPickCallback(field, index),
  }));

  return appendRows(grid(buttons, PRESET_COLUMNS), navigation);
}

/** The name step: picking a chip is the whole answer, so it moves on by itself. */
export function namePresetKeyboard(lang: Language = 'fa'): InlineKeyboard {
  return presetKeyboard(
    'name',
    [],
    lang,
    flowNavKeyboard({ canSkip: false, canGoBack: false }, lang),
  );
}

/**
 * The interests step: chips accumulate, so the "done" button only says "these are
 * enough" once something is actually on.
 *
 * With nothing chosen it stays the plain «⏭ بعدی», which stores "no interests" —
 * exactly what it does. With something chosen it becomes «✅ همین‌ها کافیه» on a
 * separate payload, because next would throw the chips away.
 */
export function interestPresetKeyboard(
  selected: readonly string[],
  lang: Language = 'fa',
): InlineKeyboard {
  const hasChoices = selected.length > 0;

  const navigation = hasChoices
    ? flowNavKeyboard(
        {
          canSkip: true,
          canGoBack: true,
          skipLabel: t('addPerson.interestsDone', lang),
          skipData: flowKeepCallback(),
        },
        lang,
      )
    : flowNavKeyboard({ canSkip: true, canGoBack: true }, lang);

  return presetKeyboard('interest', selected, lang, navigation);
}