import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BirthdayReminderJob } from '../../src/jobs/birthday-reminder.job.js';
import { ReminderService } from '../../src/modules/reminders/reminder.service.js';
import { FakeReminderRepository, FakeUserRepository, fakeUser } from '../helpers/fakes.js';
import type { DueRetry, DueSnooze } from '../../src/modules/reminders/reminder.types.js';
import { t } from '../../src/shared/i18n/index.js';
import { toPersianDigits } from '../../src/shared/utils/date.js';

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

interface SentMessage {
  chatId: string;
  text: string;
  /**
   * The third argument is where the snooze keyboard lives. It used to be
   * dropped by this fake, which meant §3.5's "the buttons are on the message"
   * had no test at all and could not have had one.
   */
  options?: { parse_mode?: string; reply_markup?: unknown };
}

function makeJob(
  users: { telegramId: string }[] | null,
  canSnooze?: boolean,
): {
  job: BirthdayReminderJob;
  service: ReminderService;
  sent: SentMessage[];
} {
  const reminders = new FakeReminderRepository();
  reminders.seed(person);
  const userRepo = new FakeUserRepository([fakeUser()]);
  const service = new ReminderService(reminders, userRepo);

  const sent: SentMessage[] = [];
  const bot = {
    api: {
      sendMessage: async (chatId: string, text: string, options?: SentMessage['options']) => {
        sent.push({ chatId, text, options });
        return { message_id: 1 };
      },
    },
  };

  const job = new BirthdayReminderJob({
    reminders: service,
    users: { findById: async () => (users === null ? null : { telegramId: '42' }) },
    bot: bot as never,
    canSnooze,
  });

  return { job, service, sent };
}

/** Flattens an inline keyboard to the callback payloads it carries. */
function snoozePayloads(message: SentMessage): string[] {
  const markup = message.options?.reply_markup as
    | { inline_keyboard?: { callback_data?: string }[][] }
    | undefined;
  return (markup?.inline_keyboard ?? []).flat().map((button) => button.callback_data ?? '');
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
   * §3.5 — the snooze buttons have to travel with the notification. Nothing
   * asserted this, so the feature could have shipped with the keyboard missing
   * and every other snooze test would still have passed.
   *
   * The delivered message carries the entry button, which names the log row of
   * this specific delivery; the 1/3/7 offsets arrive on the follow-up screen.
   */
  describe('snooze buttons on the delivered message', () => {
    it('offers a snooze button bound to this notification', async () => {
      const { job, sent } = makeJob([{ telegramId: '42' }], true);

      await job.run();

      const payloads = snoozePayloads(sent[0]!);
      const ask = payloads.find((payload) => payload.startsWith('snz:ask:'));

      expect(ask).toBeDefined();
      // Bound to one log row, not "the last reminder": wrong the moment the
      // user has two notifications outstanding.
      expect(ask).toMatch(/^snz:ask:log\d+$/);
    });

    it('renders as HTML, or the bold formatting in the text shows as literal tags', async () => {
      const { job, sent } = makeJob([{ telegramId: '42' }], true);

      await job.run();

      expect(sent[0]?.options?.parse_mode).toBe('HTML');
    });

    /** A disabled feature must not leave an empty button row behind. */
    it('sends no keyboard at all when snoozing is turned off', async () => {
      const { job, sent } = makeJob([{ telegramId: '42' }], false);

      await job.run();

      expect(sent).toHaveLength(1);
      expect(sent[0]?.options?.reply_markup).toBeUndefined();
    });
  });

  /**
   * Regression: when the user row had disappeared, the job returned after
   * claiming the slot and left it claimed forever. The claim is what makes
   * delivery exactly-once, so a swallowed slot means that birthday is never
   * notified.
   *
   * The slot must now reach a terminal state rather than spin. A missing user
   * is not a transport hiccup: `NotificationLog.userId` cascades, so the row
   * cannot outlive the user, and no number of retries would deliver anything.
   */
  it('retires a slot whose target user is gone instead of spinning on it', async () => {
    const { job, service, sent } = makeJob(null);

    await job.run();
    await job.run();

    // Never reported as fresh again, and never re-entered as a retry: the
    // second run has nothing to pick up, which is what stops the busy loop.
    expect(await service.findDueNotifications(birthday)).toHaveLength(0);
    expect(await service.findDueRetries(new Date(birthday.getTime() + 86_400_000))).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });
});

/**
 * Two workers, one notification.
 *
 * The fresh pass is safe by construction — a unique constraint means the second
 * insert loses. A retry is not: the row it re-sends already exists, so two
 * workers reading the same due row would both send. That is the bug the lease
 * exists to prevent.
 *
 * Proving it needs both workers to hold the *same* row before either writes, so
 * this fake snapshots the due list and parks both readers there. Run the
 * concurrency loosely and the test passes for the wrong reason: the second
 * worker would simply find a `sent` row and skip, which is the bug the test is
 * supposed to be about.
 */
describe('two workers racing the same delivery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(birthday);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Releases once `parties` readers have arrived, so none can write first. */
  class Latch {
    private arrivals = 0;
    private waiting: (() => void)[] = [];

    constructor(private readonly parties: number) {}

    arrive(): Promise<void> {
      this.arrivals += 1;
      if (this.arrivals >= this.parties) {
        const open = this.waiting;
        this.waiting = [];
        for (const release of open) release();
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => this.waiting.push(resolve));
    }
  }

  /** Freezes the due list so both readers see one pre-write snapshot. */
  class BarrierRepository extends FakeReminderRepository {
    private retryGate: Latch | null = null;
    private snoozeGate: Latch | null = null;
    private retrySnapshot: DueRetry[] | null = null;
    private snoozeSnapshot: DueSnooze[] | null = null;

    armRetries(): void {
      this.retryGate = new Latch(2);
      this.retrySnapshot = null;
    }

    armSnoozes(): void {
      this.snoozeGate = new Latch(2);
      this.snoozeSnapshot = null;
    }

    override async findDueRetries(now: Date, limit: number): Promise<DueRetry[]> {
      if (!this.retryGate) return super.findDueRetries(now, limit);
      this.retrySnapshot ??= await super.findDueRetries(now, limit);
      await this.retryGate.arrive();
      return this.retrySnapshot;
    }

    override async findDueSnoozes(now: Date, limit: number): Promise<DueSnooze[]> {
      if (!this.snoozeGate) return super.findDueSnoozes(now, limit);
      this.snoozeSnapshot ??= await super.findDueSnoozes(now, limit);
      await this.snoozeGate.arrive();
      return this.snoozeSnapshot;
    }
  }

  function makeWorkers(): {
    reminders: BarrierRepository;
    service: ReminderService;
    sent: { chatId: string; text: string }[];
    worker: () => BirthdayReminderJob;
    failNextSend: () => void;
  } {
    const reminders = new BarrierRepository();
    reminders.seed(person);
    const service = new ReminderService(reminders, new FakeUserRepository([fakeUser()]));

    const sent: { chatId: string; text: string }[] = [];
    let failNext = false;

    const bot = {
      api: {
        sendMessage: async (chatId: string, text: string) => {
          if (failNext) {
            failNext = false;
            throw new Error('telegram unreachable');
          }
          sent.push({ chatId, text });
          return { message_id: 1 };
        },
      },
    };

    const worker = (): BirthdayReminderJob =>
      new BirthdayReminderJob({
        reminders: service,
        users: { findById: async () => ({ telegramId: '42' }) },
        bot: bot as never,
      });

    return {
      reminders,
      service,
      sent,
      worker,
      failNextSend: () => {
        failNext = true;
      },
    };
  }

  it('sends a retried notification once, not once per worker', async () => {
    const { reminders, sent, worker, failNextSend } = makeWorkers();

    // Prime the failure that creates a pending retry in the first place.
    failNextSend();
    await worker().run();
    expect(sent).toHaveLength(0);

    // Past the backoff, so the retry is genuinely due. Six hours clears the
    // capped backoff without making any other slot due: the fresh pass only
    // matches a slot whose own date is today.
    const afterBackoff = new Date(birthday.getTime() + 6 * 60 * 60_000);
    vi.setSystemTime(afterBackoff);
    expect(await reminders.findDueRetries(afterBackoff, 10)).toHaveLength(1);

    reminders.armRetries();
    await Promise.all([worker().run(), worker().run()]);

    expect(sent).toHaveLength(1);
  });

  it('sends a due snooze once, not once per worker', async () => {
    const { reminders, service, sent, worker } = makeWorkers();

    // Lands two days before the birthday, so it is a live reminder rather than
    // one that has outlived its date.
    const deliverAt = new Date(birthday.getTime() - 2 * 86_400_000);
    await service.snooze({
      userId: 'user1',
      personId: 'person1',
      birthdayYear: 1405,
      daysBefore: 0,
      days: 1,
      now: new Date(deliverAt.getTime() - 86_400_000),
    });
    vi.setSystemTime(deliverAt);

    reminders.armSnoozes();
    await Promise.all([worker().run(), worker().run()]);

    expect(sent).toHaveLength(1);
  });
});

/**
 * A snooze stores the offset of the slot it came from, but that offset describes
 * the past, not the future: a "7 days before" reminder postponed by a day is a
 * "6 days before" notification. Sending the stored number would tell the user
 * the wrong countdown, and a reminder postponed across the birthday itself would
 * announce a birthday that has already happened.
 */
describe('a snoozed reminder is re-dated when it is delivered', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(birthday);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const countdown = (days: number): string =>
    t('countdown.daysCount', 'fa', { count: toPersianDigits(days) });

  it('uses the days actually remaining, not the offset that was snoozed', async () => {
    const { job, service, sent } = makeJob([{ telegramId: '42' }]);

    // Snooze the "7 days before" slot so that it lands two days out.
    const deliverAt = new Date(birthday.getTime() - 2 * 86_400_000);
    await service.snooze({
      userId: 'user1',
      personId: 'person1',
      birthdayYear: 1405,
      daysBefore: 7,
      days: 1,
      now: new Date(deliverAt.getTime() - 86_400_000),
    });

    vi.setSystemTime(deliverAt);
    await job.run();

    expect(sent).toHaveLength(1);
    expect(sent[0]?.text).toContain(countdown(2));
    expect(sent[0]?.text).not.toContain(countdown(7));
  });

  it('tells the user a reminder whose birthday has already passed, then drops it', async () => {
    const { job, service, sent } = makeJob([{ telegramId: '42' }]);

    // The birthday slot itself, postponed by a day: now a day too late.
    await service.snooze({
      userId: 'user1',
      personId: 'person1',
      birthdayYear: 1405,
      daysBefore: 0,
      days: 1,
      now: birthday,
    });

    vi.setSystemTime(new Date(birthday.getTime() + 86_400_000));
    await job.run();
    await job.run();

    // The user is told why no reminder came — silence would look like a bug in
    // a bot whose only job is not forgetting — and the row does not come back on
    // the next tick, so the notice is not sent twice.
    expect(sent).toHaveLength(1);
    expect(sent[0]?.text).toBe(t('snooze.expired', 'fa'));
  });
});
