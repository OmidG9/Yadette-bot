import { z } from 'zod';

// Side-effect import: `env.ts` runs `dotenv/config` and validates the core
// configuration. A flag written in `.env` must be visible even when this module
// happens to be the first thing loaded, so we depend on that load.
import './env.js';

/**
 * Feature flags (roadmap §17).
 *
 * A feature that is not ready must not appear in the UI at all. The flags are
 * read from the environment so a build can be rolled out gradually without a
 * code change, and so a broken feature can be turned off without a redeploy.
 *
 * Two hard rules:
 *
 * 1. A flag is checked where the UI is built, never only inside a handler. A
 *    hidden handler still leaves a dead button behind.
 * 2. Flags never gate business rules. They gate *visibility*: what the user can
 *    reach. Removing a flag must not corrupt data.
 */
const flagDefinitions = {
  /** §3.3 — search people by name, interest or note. */
  search: {
    env: 'SEARCH_ENABLED',
    defaultOn: true,
    description: 'Search people by name, interest or note.',
  },
  /** §3.2 — Jalali month view of birthdays. */
  calendar: {
    env: 'CALENDAR_ENABLED',
    defaultOn: true,
    description: 'Month-by-month Jalali birthday calendar.',
  },
  /** §3.1 — home screen bucketed by today / this week / later. */
  dashboard: {
    env: 'DASHBOARD_ENABLED',
    defaultOn: true,
    description: 'Home screen with today / this week / later buckets.',
  },
  /** §3.5 — postpone a reminder from inside the notification. */
  snooze: {
    env: 'SNOOZE_ENABLED',
    defaultOn: true,
    description: 'Postpone a reminder from the notification keyboard.',
  },
  /** §3.6 — /health command reporting database reachability. */
  healthCheck: {
    env: 'HEALTHCHECK_ENABLED',
    defaultOn: true,
    description: 'Health probe reporting database reachability.',
  },
  /**
   * Phase 2+ seams. Off by default and with no UI at all yet, but declared here
   * so a single place decides whether a phase is reachable.
   */
  gifts: { env: 'GIFTS_ENABLED', defaultOn: false, description: 'Gift ideas, history and wishlist.' },
  groups: { env: 'GROUPS_ENABLED', defaultOn: false, description: 'Group birthdays and announcements.' },
  ai: { env: 'AI_ENABLED', defaultOn: false, description: 'AI gift and message suggestions.' },
} as const;

export const FEATURE_NAMES = Object.keys(flagDefinitions) as readonly (keyof typeof flagDefinitions)[];

export type FeatureName = keyof typeof flagDefinitions;

export interface FeatureFlags {
  isEnabled(name: FeatureName): boolean;
  /** All flags and their state, for `/health` and startup logging. */
  snapshot(): Record<string, boolean>;
}

/**
 * Truthy spellings a human might type in a `.env` file.
 *
 * Case-insensitive: `TRUE` and `on` are what people actually write, and a
 * capitalised value that failed to parse would silently fall back to the
 * default, which is the kind of bug nobody notices until a feature is missing.
 */
const booleanish = z
  .enum(['true', '1', 'yes', 'on', 'false', '0', 'no', 'off', ''])
  .transform((value) => {
    if (value === '') return null;
    return value === 'true' || value === '1' || value === 'yes' || value === 'on';
  });

/** Normalises the raw value before it reaches the enum. */
function readBooleanish(raw: string | undefined): boolean | null {
  const parsed = booleanish.safeParse((raw ?? '').trim().toLowerCase());
  return parsed.success ? parsed.data : null;
}

/**
 * Builds a flag set from an arbitrary source.
 *
 * Takes its input as a parameter (rather than reading `process.env` inline) so
 * tests can assert both states without mutating the environment, and so a future
 * config file or remote config service can replace `process.env` in one place.
 */
export function createFeatureFlags(source: Record<string, string | undefined>): FeatureFlags {
  const resolved = {} as Record<FeatureName, boolean>;

  for (const [name, definition] of Object.entries(flagDefinitions) as [
    FeatureName,
    (typeof flagDefinitions)[FeatureName],
  ][]) {
    const parsed = readBooleanish(source[definition.env]);
    resolved[name] = parsed ?? definition.defaultOn;
  }

  return {
    isEnabled: (name: FeatureName): boolean => resolved[name] === true,
    snapshot: (): Record<string, boolean> => ({ ...resolved }),
  };
}

/**
 * The process-wide flags.
 *
 * `env` is imported for its `dotenv/config` side effect: without it a flag in
 * `.env` would be invisible whenever this module happens to load first.
 */
export const featureFlags: FeatureFlags = createFeatureFlags(process.env);

/** The raw spellings, for documentation and error messages. */
export const FEATURE_FLAG_ENV_KEYS: Record<FeatureName, string> = Object.fromEntries(
  Object.entries(flagDefinitions).map(([name, definition]) => [name, definition.env]),
) as Record<FeatureName, string>;
