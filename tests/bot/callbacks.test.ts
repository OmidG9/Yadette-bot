import { describe, expect, it } from 'vitest';
import {
  addInterestCallback,
  deleteDataCallback,
  interestDeleteCallback,
  navCallback,
  parseCallbackData,
  personCallback,
  reminderPendingCallback,
  reminderToggleCallback,
  timezoneCallback,
} from '../../src/bot/callbacks/data.js';

const personId = 'clx1234567890abcdefghijklm';

describe('callback data round-trip', () => {
  it('parses simple person actions', () => {
    expect(parseCallbackData(personCallback('view', personId))).toEqual({
      kind: 'person:view',
      personId,
    });
    expect(parseCallbackData(personCallback('del:ask', personId))).toEqual({
      kind: 'person:del:ask',
      personId,
    });
  });

  it('keeps the edit field out of the person id', () => {
    expect(parseCallbackData(personCallback('edit:birthday', personId))).toEqual({
      kind: 'person:edit:birthday',
      personId,
    });
    expect(parseCallbackData(personCallback('edit:name', personId))).toEqual({
      kind: 'person:edit:name',
      personId,
    });
  });

  it('parses timezones that contain a slash', () => {
    expect(parseCallbackData(timezoneCallback('Asia/Tehran'))).toEqual({
      kind: 'settings:tz:set',
      timezone: 'Asia/Tehran',
    });
    expect(parseCallbackData(timezoneCallback('America/New_York'))).toEqual({
      kind: 'settings:tz:set',
      timezone: 'America/New_York',
    });
  });

  it('parses reminder toggles and pending days', () => {
    expect(parseCallbackData(reminderToggleCallback(personId, 7))).toEqual({
      kind: 'reminder:toggle',
      personId,
      days: 7,
    });
    expect(parseCallbackData(reminderPendingCallback(0))).toEqual({
      kind: 'reminder:pending',
      days: 0,
    });
  });

  it('parses interest deletion and flow callbacks', () => {
    expect(parseCallbackData(interestDeleteCallback(personId, 'int123'))).toEqual({
      kind: 'interest:del',
      personId,
      interestId: 'int123',
    });
    expect(parseCallbackData(addInterestCallback(personId))).toEqual({
      kind: 'flow:interest:add',
      personId,
    });
    expect(parseCallbackData('flow:person:save')).toEqual({ kind: 'flow:person:save' });
  });

  it('parses navigation', () => {
    expect(parseCallbackData(navCallback('people'))).toEqual({ kind: 'nav:people' });
  });

  it('parses the data deletion confirmation, keeping the step in the kind', () => {
    expect(parseCallbackData(deleteDataCallback('ask'))).toEqual({ kind: 'settings:data:ask' });
    expect(parseCallbackData(deleteDataCallback('yes'))).toEqual({ kind: 'settings:data:yes' });
    expect(parseCallbackData(deleteDataCallback('no'))).toEqual({ kind: 'settings:data:no' });
  });

  /**
   * Regression: the allow-list was compared against the *whole* kind
   * (`settings:reminders`) instead of the part after the prefix, so every
   * settings button was rejected as unknown and the whole screen was dead.
   */
  it('parses every settings action', () => {
    expect(parseCallbackData('settings:reminders')).toEqual({ kind: 'settings:reminders' });
    expect(parseCallbackData('settings:timezone')).toEqual({ kind: 'settings:timezone' });
    expect(parseCallbackData('settings:language')).toEqual({ kind: 'settings:language' });
  });
});

describe('callback data rejection', () => {
  it('rejects unknown kinds and missing arguments', () => {
    expect(parseCallbackData('nav:secret-admin')).toBeNull();
    expect(parseCallbackData('person:view')).toBeNull();
    expect(parseCallbackData('settings:tz:set')).toBeNull();
    expect(parseCallbackData('reminder:pending')).toBeNull();
    // A confirmation step that is not one of ask/yes/no must never reach a handler.
    expect(parseCallbackData('settings:data:wipe')).toBeNull();
    // A bare `settings:data` is the read-only confirmation screen, not a wipe.
    expect(parseCallbackData('settings:data')).toEqual({ kind: 'settings:data:ask' });
  });

  it('rejects oversized or empty payloads', () => {
    expect(parseCallbackData(undefined)).toBeNull();
    expect(parseCallbackData('')).toBeNull();
    expect(parseCallbackData(`person:view:${'a'.repeat(70)}`)).toBeNull();
  });

  it('rejects values that do not match the schema', () => {
    expect(parseCallbackData('reminder:toggle:abc:notanumber')).toBeNull();
    expect(parseCallbackData('settings:tz:set:RTE%20ATTACK')).toBeNull();
    expect(parseCallbackData('person:view:id; DROP TABLE Person')).toBeNull();
  });
});
