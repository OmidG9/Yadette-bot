import { describe, expect, it } from 'vitest';
import { toggleChoice } from '../../src/bot/conversations/quick-pick.js';

describe('quick picks', () => {
  it('adds a word and removes it again', () => {
    const first = toggleChoice([], 'کتاب');
    expect(first).toEqual(['کتاب']);

    const second = toggleChoice(first, 'کتاب');
    expect(second).toEqual([]);
  });

  it('compares case-insensitively and trims spaces', () => {
    expect(toggleChoice([], '  فوتبال  ')).toEqual(['  فوتبال  ']);
    expect(toggleChoice(['فوتبال'], 'فوتبال')).toEqual([]);
    expect(toggleChoice(['گیم'], 'گیـم')).toEqual(['گیم', 'گیـم']);
  });

  it('collects multiple interests', () => {
    const step1 = toggleChoice([], 'کتاب');
    const step2 = toggleChoice(step1, 'قهوه');
    expect(step2).toEqual(['کتاب', 'قهوه']);
  });
});
