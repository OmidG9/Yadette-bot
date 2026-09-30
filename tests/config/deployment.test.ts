import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FEATURE_FLAG_ENV_KEYS, FEATURE_NAMES } from '../../src/config/feature-flags.js';

/**
 * §21 requires a feature flag to be configurable. A flag that is only read from
 * `process.env` is not configurable in Docker: compose passes a variable into a
 * container only when it is listed under `environment`, so `SEARCH_ENABLED=false`
 * in `.env` would be silently ignored and the feature would stay on. Nothing in
 * the running code can catch that, because inside the container the flag simply
 * has its default value.
 */
const compose = readFileSync('docker-compose.yml', 'utf8');
const envExample = readFileSync('.env.example', 'utf8');

/** The `bot:` service only — the `db` and `migrate` services must not be matched. */
function botServiceBlock(): string {
  const lines = compose.split(/\r?\n/);
  const start = lines.findIndex((line) => /^ {2}bot:\s*$/.test(line));
  expect(start, 'docker-compose.yml has no `bot:` service').toBeGreaterThan(-1);

  const end = lines.findIndex((line, index) => index > start && /^volumes:\s*$/.test(line));
  return lines.slice(start, end === -1 ? undefined : end).join('\n');
}

describe('feature flags are configurable in a deployed environment', () => {
  const block = botServiceBlock();

  for (const name of FEATURE_NAMES) {
    const envKey = FEATURE_FLAG_ENV_KEYS[name];

    it(`passes ${envKey} into the bot container`, () => {
      expect(block).toMatch(new RegExp(`^\\s+${envKey}:`, 'm'));
    });

    it(`documents ${envKey} in .env.example`, () => {
      expect(envExample).toContain(`${envKey}=`);
    });
  }
});

describe('the deployable image', () => {
  it('keeps CI config and local env files out of the build context', () => {
    const dockerignore = readFileSync('.dockerignore', 'utf8').split(/\r?\n/);
    expect(dockerignore).toContain('.github');
    expect(dockerignore).toContain('.env');
    // `.env.example` is documentation, and must stay reachable by that negation.
    expect(dockerignore).toContain('!.env.example');
  });
});
