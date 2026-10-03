import { describe, expect, it } from 'vitest';
import { dashboardText } from '../../src/bot/views/dashboard.views.js';
import type { BirthdayBuckets } from '../../src/modules/birthdays/dashboard.types.js';
import type { UpcomingBirthday } from '../../src/modules/birthdays/birthday.types.js';
import { fa } from '../../src/shared/i18n/fa.js';
import type { Language } from '../../src/shared/i18n/index.js';

const LANG: Language = 'fa';

function item(name: string, daysUntil: number): UpcomingBirthday {
  return {
    person: {
      id: `id-${name}`,
      userId: 'u1',
      name,
      birthMonth: 8,
      birthDay: 14,
      birthYear: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    },
    rule: { month: 8, day: 14, year: null },
    age: null,
    daysUntil,
  } as unknown as UpcomingBirthday;
}

function buckets(over: Partial<BirthdayBuckets> = {}): BirthdayBuckets {
  return {
    today: [],
    thisWeek: [],
    later: [],
    nextBirthday: null,
    totalPeople: 0,
    thisMonthCount: 0,
    jalaliMonth: 8,
    ...over,
  } as BirthdayBuckets;
}

/**
 * §3.1 asks for three labelled buckets. The view had no test at all, which is
 * how the headings came to be dropped whenever a bucket happened to be empty.
 */
describe('dashboardText', () => {
  it('always shows all three headings, so the screen keeps a stable shape', () => {
    const text = dashboardText(buckets({ totalPeople: 1 }), LANG);

    expect(text).toContain(fa.dashboard.todayHeading);
    expect(text).toContain(fa.dashboard.weekHeading);
    expect(text).toContain(fa.dashboard.laterHeading);
  });

  it('uses each bucket its own empty message instead of dropping the section', () => {
    const text = dashboardText(buckets({ totalPeople: 1 }), LANG);

    expect(text).toContain(fa.dashboard.emptyToday);
    expect(text).toContain(fa.dashboard.emptyWeek);
    expect(text).toContain(fa.dashboard.emptyLater);
  });

  it('does not claim a bucket is empty while listing someone in it', () => {
    const text = dashboardText(
      buckets({ today: [item('امروز', 0)], totalPeople: 1, thisMonthCount: 1 }),
      LANG,
    );

    expect(text).toContain('امروز');
    expect(text).not.toContain(fa.dashboard.emptyToday);
    // The untouched buckets still say so.
    expect(text).toContain(fa.dashboard.emptyWeek);
  });

  it('lists the three numbers the roadmap asks for', () => {
    const text = dashboardText(buckets({ totalPeople: 7, thisMonthCount: 2 }), LANG);

    expect(text).toContain('۷');
    expect(text).toContain('۲');
  });

  it('names the nearest birthday when there is one', () => {
    const text = dashboardText(
      buckets({ totalPeople: 1, thisMonthCount: 1, nextBirthday: item('نزدیک', 2) }),
      LANG,
    );

    expect(text).toContain('نزدیک');
  });

  /** The buckets are meaningless with nobody registered, so the layout changes. */
  it('offers to add a person instead of empty buckets when there is nobody', () => {
    const text = dashboardText(buckets(), LANG);

    expect(text).toContain(fa.dashboard.noneAtAll);
    expect(text).not.toContain(fa.dashboard.todayHeading);
  });
});
