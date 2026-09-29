import { z } from 'zod';

const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const daysSchema = z.coerce.number().int().min(0).max(365);
const timezoneSchema = z.string().min(1).max(64).regex(/^[A-Za-z_+\-/0-9]+$/);
/** Jalali year, bounded to a range no human will leave. */
const jalaliYearSchema = z.coerce.number().int().min(1300).max(1500);
const jalaliMonthSchema = z.coerce.number().int().min(1).max(12);

/**
 * Validated shape of any callback payload.
 * Untrusted Telegram data never reaches a handler without passing through here.
 */
const RawCallbackSchema = z
  .object({
    kind: z.string().min(1).max(48),
    personId: idSchema.optional(),
    interestId: idSchema.optional(),
    deliveryId: idSchema.optional(),
    days: daysSchema.optional(),
    year: jalaliYearSchema.optional(),
    month: jalaliMonthSchema.optional(),
    timezone: timezoneSchema.optional(),
  })
  .strict();

export type CallbackData = z.infer<typeof RawCallbackSchema>;

const NAV_TARGETS = [
  'menu',
  'upcoming',
  'people',
  'settings',
  'help',
  'add',
  'about',
  'dashboard',
  'search',
  'calendar',
  'health',
] as const;

const PERSON_ACTIONS = [
  'view',
  'edit',
  'edit:name',
  'edit:birthday',
  'edit:notes',
  'edit:interests',
  'del:ask',
  'del:yes',
  'del:no',
  'reminders',
  'interests',
] as const;

/**
 * The field part of `person:edit:<field>:<personId>`.
 *
 * It doubles as the disambiguator: `person:edit` alone carries a person id, and
 * so does `person:edit:<field>`. Ids are `^[A-Za-z0-9_-]{1,64}$` and none of
 * these words is a legal id, so the two shapes can never be confused.
 */
const EDIT_FIELDS = ['name', 'birthday', 'notes', 'interests'] as const;

/** Prefix of every settings callback; `SETTINGS_ACTIONS` is stored without it. */
const SETTINGS_PREFIX = 'settings:';

const SETTINGS_ACTIONS = [
  'reminders',
  'timezone',
  'tz:set',
  'language',
  'data:ask',
  'data:yes',
  'data:no',
] as const;

function isOneOf<T extends readonly string[]>(value: string, options: T): boolean {
  return (options as readonly string[]).includes(value);
}

/** `flow:person:*` — the person is a fixed-length id, so it never appears here. */
function toCandidate(raw: string): Record<string, unknown> {
  const [head, a, b, c] = raw.split(':');

  switch (head) {
    case 'nav':
      return { kind: `nav:${a ?? ''}` };
    case 'person':
      if (a === 'del') {
        // person:del:<ask|yes|no>:<personId>
        return { kind: `person:del:${b ?? ''}`, personId: c };
      }
      if (a === 'edit') {
        // person:edit:<personId> | person:edit:<field>:<personId>
        // — the field is part of the kind when one is given.
        if (b === undefined) return { kind: 'person:edit' };
        return isOneOf(b, EDIT_FIELDS)
          ? { kind: `person:edit:${b}`, personId: c }
          : { kind: 'person:edit', personId: b };
      }
      // person:<action>:<personId>
      return { kind: `person:${a ?? ''}`, personId: b };
    case 'interest':
      // interest:del:<personId>:<interestId>
      return { kind: 'interest:del', personId: b, interestId: c };
    case 'flow': {
      // flow:person:save | flow:person:back | flow:person:next
      // | flow:interest:add:<personId>
      const kind = a === 'person' ? `flow:person:${b ?? ''}` : `flow:${a ?? ''}:${b ?? ''}`;
      return { kind, personId: c };
    }
    case 'reminder':
      // reminder:toggle:<personId>:<days> | reminder:pending:<days>
      return a === 'pending'
        ? { kind: 'reminder:pending', days: b }
        : { kind: 'reminder:toggle', personId: b, days: c };
    case 'settings':
      // settings:tz:set:<Area/City> — the zone may contain slashes, never colons.
      if (a === 'tz') return { kind: 'settings:tz:set', timezone: c };
      // settings:data:<ask|yes|no> — a two-step destructive confirmation.
      if (a === 'data') return { kind: `settings:data:${b ?? 'ask'}` };
      return { kind: `settings:${a ?? ''}` };
    case 'cal':
      // cal:<jalaliYear>:<jalaliMonth> — absolute, so paging back and forth works.
      return { kind: 'cal:month', year: a, month: b };
    case 'snz':
      // snz:ask:<deliveryId> | snz:do:<deliveryId>:<days>
      return a === 'do' ? { kind: 'snooze:do', deliveryId: b, days: c } : { kind: 'snooze:ask', deliveryId: b };
    default:
      return { kind: head ?? '' };
  }
}

/** Parses untrusted callback data. Returns `null` for anything unexpected. */
export function parseCallbackData(raw: string | undefined): CallbackData | null {
  if (!raw || raw.length > 64) return null;

  const parsed = RawCallbackSchema.safeParse(toCandidate(raw));
  if (!parsed.success) return null;

  const data = parsed.data;

  const isKnown =
    (data.kind.startsWith('nav:') && isOneOf(data.kind.slice(4), NAV_TARGETS)) ||
    (data.kind.startsWith('person:') &&
      isOneOf(data.kind.slice(7), PERSON_ACTIONS) &&
      data.personId !== undefined) ||
    (data.kind === 'interest:del' && data.personId !== undefined && data.interestId !== undefined) ||
    (data.kind === 'flow:interest:add' && data.personId !== undefined) ||
    (data.kind === 'flow:person:save') ||
    (data.kind === 'flow:person:back') ||
    (data.kind === 'flow:person:next') ||
    (data.kind === 'reminder:toggle' && data.personId !== undefined && data.days !== undefined) ||
    (data.kind === 'reminder:pending' && data.days !== undefined) ||
    (data.kind.startsWith(SETTINGS_PREFIX) &&
      isOneOf(data.kind.slice(SETTINGS_PREFIX.length), SETTINGS_ACTIONS) &&
      data.kind !== `${SETTINGS_PREFIX}tz:set`) ||
    (data.kind === `${SETTINGS_PREFIX}tz:set` && data.timezone !== undefined) ||
    (data.kind === 'cal:month' && data.year !== undefined && data.month !== undefined) ||
    (data.kind === 'snooze:ask' && data.deliveryId !== undefined) ||
    (data.kind === 'snooze:do' && data.deliveryId !== undefined && data.days !== undefined);

  return isKnown ? data : null;
}

// --- Builders (Telegram allows 64 bytes of callback data) ------------------

export const personCallback = (action: string, personId: string): string =>
  `person:${action}:${personId}`;

export const interestDeleteCallback = (personId: string, interestId: string): string =>
  `interest:del:${personId}:${interestId}`;

export const reminderToggleCallback = (personId: string, days: number): string =>
  `reminder:toggle:${personId}:${days}`;

export const reminderPendingCallback = (days: number): string => `reminder:pending:${days}`;

export const timezoneCallback = (timezone: string): string => `settings:tz:set:${timezone}`;

export const deleteDataCallback = (action: 'ask' | 'yes' | 'no'): string => `settings:data:${action}`;

export const navCallback = (
  target:
    | 'menu'
    | 'upcoming'
    | 'people'
    | 'settings'
    | 'help'
    | 'add'
    | 'about'
    | 'dashboard'
    | 'search'
    | 'calendar'
    | 'health',
): string => `nav:${target}`;

/** `cal:<year>:<month>` — an absolute Jalali month, so paging is stateless. */
export const calendarMonthCallback = (year: number, month: number): string =>
  `cal:${year}:${String(month).padStart(2, '0')}`;

/** `snz:ask:<deliveryId>` — the snooze submenu. */
export const snoozeAskCallback = (deliveryId: string): string => `snz:ask:${deliveryId}`;

/** `snz:do:<deliveryId>:<days>` — confirm a snooze of `days`. */
export const snoozeDoCallback = (deliveryId: string, days: number): string =>
  `snz:do:${deliveryId}:${days}`;

export const saveAddPersonCallback = (): string => 'flow:person:save';

export const addInterestCallback = (personId: string): string => `flow:interest:add:${personId}`;

/** `flow:person:back` — «⏮ قبلی», re-asks the previous question. */
export const flowBackCallback = (): string => 'flow:person:back';

/** `flow:person:next` — «⏭ بعدی», skips an optional answer. */
export const flowNextCallback = (): string => 'flow:person:next';

/** `settings:<section>` — the settings screen sections. */
export const settingsCallback = (section: 'reminders' | 'timezone' | 'language'): string =>
  `settings:${section}`;
