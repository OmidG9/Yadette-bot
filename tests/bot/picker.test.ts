import { describe, expect, it } from 'vitest';
import { applyBirthdayTap } from '../../src/bot/conversations/birthday-picker.js';

describe('Jalali birthday picker', () => {
  it('moves month → day and drops a stale day', () => {
    const outcome = applyBirthdayTap('month', { month: 1, day: 31 }, 12);

    expect(outcome).toEqual({ kind: 'screen', pick: { month: 12 } });
  });

  it('rejects Esfand 31, keeping the pick and returning an error key', () => {
    const outcome = applyBirthdayTap('day', { month: 12 }, 31);

    expect(outcome.kind).toBe('screen');
    if (outcome.kind === 'screen') {
      expect(outcome.pick).toEqual({ month: 12 });
      expect(outcome.error).toBe('picker.invalidDay');
    }
  });

  it('moves day → year when the date exists (non-leap)', () => {
    const outcome = applyBirthdayTap('day', { month: 1 }, 15);

    expect(outcome).toEqual({ kind: 'screen', pick: { month: 1, day: 15 } });
  });

  it('finishes with no year', () => {
    const outcome = applyBirthdayTap('noYear', { month: 7, day: 18 });

    expect(outcome).toEqual({ kind: 'done', month: 7, day: 18, year: null });
  });

  it('rejects an invalid leap-day combination and surfaces the error', () => {
    const outcome = applyBirthdayTap('year', { month: 12, day: 30 }, 1401);

    expect(outcome.kind).toBe('screen');
    if (outcome.kind === 'screen') {
      expect(outcome.error).toBe('picker.yearMismatch');
    }
  });

  it('accepts Esfand 30 in a leap year', () => {
    const outcome = applyBirthdayTap('year', { month: 12, day: 30 }, 1403);

    expect(outcome).toEqual({ kind: 'done', month: 12, day: 30, year: 1403 });
  });

  it('pages the year grid without losing the date', () => {
    const outcome = applyBirthdayTap('page', { month: 7, day: 18 }, 1420);

    expect(outcome).toEqual({ kind: 'screen', pick: { month: 7, day: 18, page: 1420 } });
  });

  it('goes back from year → day (forgetting day) and from day → month', () => {
    const backFromYear = applyBirthdayTap('back', { month: 7, day: 18 });
    expect(backFromYear).toEqual({ kind: 'screen', pick: { month: 7 } });

    const backFromDay = applyBirthdayTap('back', { month: 7 });
    expect(backFromDay).toEqual({ kind: 'screen', pick: {} });
  });
});
