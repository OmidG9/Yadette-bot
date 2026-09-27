import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BirthdayReminderJob } from '../../src/jobs/birthday-reminder.job.js';
import { ReminderService } from '../../src/modules/reminders/reminder.service.js';
import type { DueNotification } from '../../src/modules/reminders/reminder.service.js';
import { FakeReminderRepository, FakeUserRepository, fakeUser } from '../helpers/fakes.js';

const person = {
  id: 'person1',
  userId: 'user1',
  name: 'مادر',
  birthMonth: 7,
  birthDay: 18,
  birthYear: 1380,
  notes: null,
};

/** Mehr 18 1405, the "0 days before" slot. */
const birthday = new Date('2026-10-10T06:00:00.000Z');

function dueFor(due: DueNotification): DueNotification {
  return due;
}

function makeJob(users: { telegramId: string }[] | null) {
  const reminders = new FakeReminderRepository();
  reminders.seed(person);
  const userRepo = new FakeUserRepository([fakeUser()]);
  const service = new ReminderService(reminders, userRepo);

  const sent: { chatId: string; text: string }[] = [];
  const bot = {
    api: {
      sendMessage: async (chatId: string, text: string) => {
        sent.push({ chatId, text });
        return { message_id: 1 };
      },
    },
  };

  const job = new BirthdayReminderJob({
    reminders: service,
    users: { findById: async () => (users === null ? null : { telegramId: '42' }) },
    bot: bot as never,
  });

  return { job, service, sent };
}

describe('delivering a birthday reminder', () => {
  // The job reads the wall clock, so the test has to own it.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(birthday);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends the reminder and records the slot', async () => {
    const { job, service, sent } = makeJob([{ telegramId: '42' }]);

    await job.run();

    expect(sent).toHaveLength(1);
    expect(sent[0]?.chatId).toBe('42');

    // The slot is now spent: the next tick must stay quiet.
    const due = await service.findDueNotifications(birthday);
    expect(due).toHaveLength(0);
  });

  it('is idempotent across repeated runs on the same day', async () => {
    const { job, sent } = makeJob([{ telegramId: '42' }]);

    await job.run();
    await job.run();
    await job.run();

    expect(sent).toHaveLength(1);
  });

  /**
   * Regression: when the user row had disappeared, the job returned after
   * claiming the slot without releasing it. The claim is what makes delivery
   * exactly-once, so a swallowed slot means that birthday is never notified.
   */
  it('releases the claim when the target user is gone', async () => {
    const { job, service } = makeJob(null);

    await job.run();

    // The slot must still be deliverable rather than silently consumed.
    const due = await service.findDueNotifications(birthday);
    expect(due).toHaveLength(1);
    expect(dueFor(due[0]!).daysBefore).toBe(0);
  });
});
