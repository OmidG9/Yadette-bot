import { InlineKeyboard } from 'grammy';

/** One button of a generated grid: a label and the payload it sends. */
export interface KeypadButton {
  label: string;
  data: string;
}

/**
 * Fills a keyboard `perRow` buttons at a time.
 *
 * grammY's `.row()` unconditionally starts a new row, so calling it after the
 * last button leaves an empty row at the bottom — Telegram renders that as a
 * strip of dead space under the keyboard, which is exactly what "readable on
 * every client" must avoid. Guarding on "not the last button" is the whole
 * reason this helper exists.
 *
 * The result may end with a partially filled row, so append more rows with
 * `appendRows` rather than `.row()`.
 */
export function grid(buttons: readonly KeypadButton[], perRow: number): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  buttons.forEach((button, index) => {
    keyboard.text(button.label, button.data);
    const startsNewRow = (index + 1) % perRow === 0;
    if (startsNewRow && index + 1 < buttons.length) keyboard.row();
  });

  return keyboard;
}

/**
 * Puts `source`'s rows below `target`'s.
 *
 * The Bot API has no keyboard merging: `reply_markup` is one keyboard. A picker
 * grid and its exit buttons are built separately (the grid because it is
 * generated, the buttons because they are the same in every flow) and stitched
 * together here.
 */
export function appendRows(target: InlineKeyboard, source: InlineKeyboard): InlineKeyboard {
  target.inline_keyboard.push(...source.inline_keyboard);
  return target;
}