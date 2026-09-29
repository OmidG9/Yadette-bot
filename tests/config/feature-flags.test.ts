import { describe, expect, it } from 'vitest';
import {
  FEATURE_FLAG_ENV_KEYS,
  FEATURE_NAMES,
  createFeatureFlags,
} from '../../src/config/feature-flags.js';

describe('createFeatureFlags', () => {
  it('ships Phase 1 on and later phases off', () => {
    const flags = createFeatureFlags({});

    // The Phase 1 features are the reason this release exists.
    for (const name of ['search', 'calendar', 'dashboard', 'snooze', 'healthCheck'] as const) {
      expect(flags.isEnabled(name), name).toBe(true);
    }
    // Phase 2 has no UI at all yet; enabling it would only expose dead ends.
    for (const name of ['gifts', 'groups', 'ai'] as const) {
      expect(flags.isEnabled(name), name).toBe(false);
    }
  });

  it('reads every spelling a human might type in a .env file', () => {
    for (const value of ['true', '1', 'yes', 'on', 'TRUE', 'ON']) {
      expect(createFeatureFlags({ SEARCH_ENABLED: value }).isEnabled('search'), value).toBe(true);
    }
    for (const value of ['false', '0', 'no', 'off', 'FALSE', 'OFF']) {
      expect(createFeatureFlags({ SEARCH_ENABLED: value }).isEnabled('search'), value).toBe(false);
    }
  });

  /**
   * A typo must not silently ship a feature. Falling back to the default would
   * hide the mistake, so an unparseable value keeps the default *and* the
   * operator is expected to see it in the startup snapshot.
   */
  it('falls back to the default for a value it cannot read', () => {
    expect(createFeatureFlags({ SEARCH_ENABLED: 'maybe' }).isEnabled('search')).toBe(true);
    // A Phase 2 feature with a typo stays off rather than appearing by accident.
    expect(createFeatureFlags({ GIFTS_ENABLED: 'maybe' }).isEnabled('gifts')).toBe(false);
  });

  it('treats an empty value as unset', () => {
    expect(createFeatureFlags({ SEARCH_ENABLED: '' }).isEnabled('search')).toBe(true);
    expect(createFeatureFlags({ GIFTS_ENABLED: '' }).isEnabled('gifts')).toBe(false);
  });

  it('lets an operator turn a shipped feature off without a redeploy', () => {
    const flags = createFeatureFlags({ SNOOZE_ENABLED: 'false' });

    expect(flags.isEnabled('snooze')).toBe(false);
    // Only the named flag moves; the rest are untouched.
    expect(flags.isEnabled('dashboard')).toBe(true);
  });

  it('reports every flag for the startup log and /health', () => {
    const flags = createFeatureFlags({ CALENDAR_ENABLED: 'off' });
    const snapshot = flags.snapshot();

    // A flag missing from the snapshot would be invisible to an operator.
    expect(Object.keys(snapshot).sort()).toEqual([...FEATURE_NAMES].sort());
    expect(snapshot.calendar).toBe(false);
  });

  it('does not hand out a mutable view of its state', () => {
    const flags = createFeatureFlags({});
    const snapshot = flags.snapshot();
    snapshot.search = false;

    // A caller editing the snapshot must not disable the feature for everyone.
    expect(flags.isEnabled('search')).toBe(true);
  });

  it('maps every feature to its own environment variable', () => {
    const keys = Object.values(FEATURE_FLAG_ENV_KEYS);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/_ENABLED$/);
  });
});
