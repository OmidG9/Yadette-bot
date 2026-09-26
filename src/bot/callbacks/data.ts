import { z } from 'zod';

const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const daysSchema = z.coerce.number().int().min(0).max(365);
const timezoneSchema = z.string().min(1).max(64).regex(/^[A-Za-z_+\-/0-9]+$/);

/**
 * Validated shape of any callback payload.
 * Untrusted Telegram data never reaches a handler without passing through here.
 */
const RawCallbackSchema = z
  .object({
    kind: z.string().min(1).max(48),
    personId: idSchema.optional(),
    interestId: idSchema.optional(),
    days: daysSchema.optional(),
    timezone: timezoneSchema.optional(),
  })
  .strict();

export type CallbackData = z.infer<typeof RawCallbackSchema>;

const NAV_TARGETS = ['menu', 'upcoming', 'people', 'settings', 'help', 'add', 'about'] as const;

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

const SETTINGS_ACTIONS = ['reminders', 'timezone', 'tz:set', 'language'] as const;

function isOneOf<T extends readonly string[]>(value: string, options: T): boolean {
  return (options as readonly string[]).includes(value);
}

/** Turns `action:arg1:arg2` segments into a candidate payload. */
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
      if (a === 'edit' && b) {
        // person:edit:<field>:<personId> — the field is part of the kind.
        return { kind: `person:edit:${b}`, personId: c };
      }
      // person:<action>:<personId>
      return { kind: `person:${a ?? ''}`, personId: b };
    case 'interest':
      // interest:del:<personId>:<interestId>
      return { kind: 'interest:del', personId: b, interestId: c };
    case 'flow':
      // flow:person:save | flow:interest:add:<personId>
      return { kind: `flow:${a ?? ''}:${b ?? ''}`, personId: c };
    case 'reminder':
      // reminder:toggle:<personId>:<days> | reminder:pending:<days>
      return a === 'pending'
        ? { kind: 'reminder:pending', days: b }
        : { kind: 'reminder:toggle', personId: b, days: c };
    case 'settings':
      // settings:tz:set:<Area/City> — the zone may contain slashes, never colons.
      return a === 'tz'
        ? { kind: 'settings:tz:set', timezone: c }
        : { kind: `settings:${a ?? ''}` };
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
    (data.kind === 'reminder:toggle' && data.personId !== undefined && data.days !== undefined) ||
    (data.kind === 'reminder:pending' && data.days !== undefined) ||
    (isOneOf(data.kind, SETTINGS_ACTIONS) && data.kind !== 'settings:tz:set') ||
    (data.kind === 'settings:tz:set' && data.timezone !== undefined);

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

export const navCallback = (
  target: 'menu' | 'upcoming' | 'people' | 'settings' | 'help' | 'add' | 'about',
): string => `nav:${target}`;

export const saveAddPersonCallback = (): string => 'flow:person:save';

export const addInterestCallback = (personId: string): string => `flow:interest:add:${personId}`;
