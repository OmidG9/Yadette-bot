import {
  createFeatureFlags,
  FEATURE_FLAG_ENV_KEYS,
  type FeatureFlags,
  type FeatureName,
} from '../../src/config/feature-flags.js';

/**
 * Feature flags for a test.
 *
 * `createFeatureFlags({})` yields the shipped defaults, which is what a test
 * should assume unless it is specifically about a flag.
 */
export function allFlagsOn(): FeatureFlags {
  return createFeatureFlags({});
}

/** Everything at its default except the named features, forced off. */
export function flagsExcept(...off: FeatureName[]): FeatureFlags {
  return createFeatureFlags(
    Object.fromEntries(off.map((name) => [FEATURE_FLAG_ENV_KEYS[name], 'false'])),
  );
}
