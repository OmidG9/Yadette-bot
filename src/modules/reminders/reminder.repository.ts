import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { notificationSlotKey } from './reminder.types.js';
import { leaseUntil } from './retry.js';
import type {
  DeliveryStatus,
  DueRetry,
  DueSnooze,
  NotificationLogRecord,
  ReminderRecord,
  ReminderRepository,
  ReminderWithPerson,
  SnoozeRecord,
} from './reminder.types.js';

function toReminderRecord(row: {
  id: string;
  userId: string;
  personId: string;
  daysBefore: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ReminderRecord {
  return { ...row };
}

function toLogRecord(row: {
  id: string;
  userId: string;
  personId: string;
  birthdayYear: number;
  daysBefore: number;
  status: string;
  attempts: number;
  nextAttemptAt: Date;
  lastError: string | null;
  sentAt: Date | null;
}): NotificationLogRecord {
  return {
    ...row,
    status: row.status as DeliveryStatus,
  };
}

function toSnoozeRecord(row: {
  id: string;
  userId: string;
  personId: string;
  birthdayYear: number;
  daysBefore: number;
  deliverAt: Date;
  status: string;
  attempts: number;
  nextAttemptAt: Date;
  lastError: string | null;
  sentAt: Date | null;
}): SnoozeRecord {
  return {
    ...row,
    status: row.status as DeliveryStatus,
  };
}

/**
 * The person fields a notification needs to render itself.
 *
 * Shared by the retry pass, the snooze pass and the main send: a delivery that
 * cannot name the person is not worth retrying, and three copies of this list
 * would eventually disagree.
 */
const personForDelivery = {
  select: {
    id: true,
    name: true,
    birthMonth: true,
    birthDay: true,
    birthYear: true,
    notes: true,
    // `as const` so the literal order survives the `satisfies` widening.
    interests: { select: { id: true, title: true }, orderBy: { createdAt: 'asc' as const } },
  },
} satisfies Prisma.PersonDefaultArgs;

export class PrismaReminderRepository implements ReminderRepository {
  constructor(private readonly db: PrismaClient) {}

  async findForPerson(personId: string, userId: string): Promise<ReminderRecord[]> {
    const rows = await this.db.reminder.findMany({
      where: { personId, userId },
      orderBy: { daysBefore: 'desc' },
    });
    return rows.map(toReminderRecord);
  }

  async findEnabledForUser(userId: string): Promise<ReminderWithPerson[]> {
    const rows = await this.db.reminder.findMany({
      where: { userId, enabled: true, person: { deletedAt: null } },
      orderBy: { daysBefore: 'desc' },
      include: {
        person: {
          select: {
            id: true,
            name: true,
            birthMonth: true,
            birthDay: true,
            birthYear: true,
            notes: true,
            interests: { select: { id: true, title: true }, orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });

    return rows.map((row) => ({ ...toReminderRecord(row), person: row.person }));
  }

  async setEnabled(
    reminderId: string,
    personId: string,
    userId: string,
    enabled: boolean,
  ): Promise<ReminderRecord | null> {
    const result = await this.db.reminder.updateMany({
      where: { id: reminderId, personId, userId },
      data: { enabled },
    });
    if (result.count === 0) return null;
    const row = await this.db.reminder.findUnique({ where: { id: reminderId } });
    return row ? toReminderRecord(row) : null;
  }

  async ensureForPerson(
    userId: string,
    personId: string,
    daysBefore: number[],
  ): Promise<ReminderRecord[]> {
    if (daysBefore.length === 0) return [];
    await this.db.reminder.createMany({
      data: daysBefore.map((days) => ({ userId, personId, daysBefore: days, enabled: true })),
      skipDuplicates: true,
    });
    const rows = await this.db.reminder.findMany({
      where: { personId, userId },
      orderBy: { daysBefore: 'desc' },
    });
    return rows.map(toReminderRecord);
  }

  async deleteForPerson(personId: string): Promise<number> {
    const result = await this.db.reminder.deleteMany({ where: { personId } });
    return result.count;
  }

  async findLog(
    userId: string,
    personId: string,
    birthdayYear: number,
    daysBefore: number,
  ): Promise<NotificationLogRecord | null> {
    const row = await this.db.notificationLog.findUnique({
      where: { userId_personId_birthdayYear_daysBefore: { userId, personId, birthdayYear, daysBefore } },
    });
    return row ? toLogRecord(row) : null;
  }

  async findLogByIdForUser(
    logId: string,
    userId: string,
  ): Promise<NotificationLogRecord | null> {
    const row = await this.db.notificationLog.findFirst({ where: { id: logId, userId } });
    return row ? toLogRecord(row) : null;
  }

  /**
   * Every notification this user already got, as a lookup set.
   *
   * Only `sent` rows count. A `pending` row is a delivery in flight or awaiting
   * retry, and treating it as "already sent" would make the reminder disappear
   * exactly when the retry pass is about to deliver it.
   *
   * One query per scheduler tick instead of one per due reminder, which matters
   * because the "already sent" check runs for every enabled reminder of every
   * user with reminders.
   */
  async findHandledSlotKeys(userId: string): Promise<Set<string>> {
    const rows = await this.db.notificationLog.findMany({
      where: { userId },
      select: { personId: true, birthdayYear: true, daysBefore: true },
    });
    return new Set(
      rows.map((row) => notificationSlotKey(row.personId, row.birthdayYear, row.daysBefore)),
    );
  }

  async claimNotification(input: {
    userId: string;
    personId: string;
    birthdayYear: number;
    daysBefore: number;
  }): Promise<NotificationLogRecord | null> {
    try {
      const row = await this.db.notificationLog.create({ data: input });
      return toLogRecord(row);
    } catch (error) {
      // Unique constraint violation => another run already claimed this notification.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return null;
      }
      throw error;
    }
  }

  async markSent(logId: string, sentAt: Date): Promise<void> {
    await this.db.notificationLog.updateMany({
      where: { id: logId },
      data: { status: 'sent', sentAt, lastError: null },
    });
  }

  async scheduleRetry(
    logId: string,
    attempt: number,
    nextAttemptAt: Date,
    error: string,
  ): Promise<void> {
    await this.db.notificationLog.updateMany({
      where: { id: logId },
      data: { status: 'pending', attempts: attempt, nextAttemptAt, lastError: error },
    });
  }

  async markFailed(logId: string, error: string): Promise<void> {
    await this.db.notificationLog.updateMany({
      where: { id: logId },
      data: { status: 'failed', lastError: error },
    });
  }

  /**
   * Pending slots whose backoff has elapsed.
   *
   * The person is joined in because a retry has to re-render the message: the
   * log row alone knows a person id, not a name or a birthday.
   */
  async findDueRetries(now: Date, limit: number): Promise<DueRetry[]> {
    const rows = await this.db.notificationLog.findMany({
      where: { status: 'pending', nextAttemptAt: { lte: now } },
      include: { person: personForDelivery },
      orderBy: { nextAttemptAt: 'asc' },
      take: limit,
    });

    return rows.map((row) => ({
      log: toLogRecord(row),
      userId: row.userId,
      person: row.person,
    }));
  }

  // --- Snooze (§3.5) --------------------------------------------------------

  async upsertSnooze(input: {
    userId: string;
    personId: string;
    birthdayYear: number;
    daysBefore: number;
    deliverAt: Date;
  }): Promise<SnoozeRecord> {
    // Re-snoozing replaces the pending row rather than stacking a second one:
    // the user is changing their mind, not queueing two messages.
    return toSnoozeRecord(
      await this.db.snooze.upsert({
        where: {
          userId_personId_birthdayYear_daysBefore: {
            userId: input.userId,
            personId: input.personId,
            birthdayYear: input.birthdayYear,
            daysBefore: input.daysBefore,
          },
        },
        create: { ...input, nextAttemptAt: input.deliverAt },
        update: {
          deliverAt: input.deliverAt,
          nextAttemptAt: input.deliverAt,
          status: 'pending',
          // A fresh snooze gets a fresh attempt budget; the previous failure
          // was about the old delivery time, not the user's decision to delay.
          attempts: 0,
          lastError: null,
        },
      }),
    );
  }

  async findSnooze(
    userId: string,
    personId: string,
    birthdayYear: number,
    daysBefore: number,
  ): Promise<SnoozeRecord | null> {
    const row = await this.db.snooze.findUnique({
      where: { userId_personId_birthdayYear_daysBefore: { userId, personId, birthdayYear, daysBefore } },
    });
    return row ? toSnoozeRecord(row) : null;
  }

  /**
   * Takes exclusive ownership of a due retry.
   *
   * The predicate repeats the one `findDueRetries` filtered on, which is what
   * makes this safe: two workers can both read the row, but the second `UPDATE`
   * matches nothing because the first already moved `nextAttemptAt` into the
   * future. No new column and no explicit lock — the same timestamp the query
   * reads doubles as the lock.
   */
  async leaseRetry(logId: string, now: Date): Promise<boolean> {
    const { count } = await this.db.notificationLog.updateMany({
      where: { id: logId, status: 'pending', nextAttemptAt: { lte: now } },
      data: { nextAttemptAt: leaseUntil(now) },
    });
    return count === 1;
  }

  async leaseSnooze(snoozeId: string, now: Date): Promise<boolean> {
    const { count } = await this.db.snooze.updateMany({
      where: { id: snoozeId, status: 'pending', nextAttemptAt: { lte: now } },
      data: { nextAttemptAt: leaseUntil(now) },
    });
    return count === 1;
  }

  async markSnoozeSent(snoozeId: string, sentAt: Date): Promise<void> {
    await this.db.snooze.updateMany({
      where: { id: snoozeId },
      data: { status: 'sent', sentAt, lastError: null },
    });
  }

  async scheduleSnoozeRetry(
    snoozeId: string,
    attempt: number,
    nextAttemptAt: Date,
    error: string,
  ): Promise<void> {
    await this.db.snooze.updateMany({
      where: { id: snoozeId },
      data: { status: 'pending', attempts: attempt, nextAttemptAt, lastError: error },
    });
  }

  async markSnoozeFailed(snoozeId: string, error: string): Promise<void> {
    await this.db.snooze.updateMany({
      where: { id: snoozeId },
      data: { status: 'failed', lastError: error },
    });
  }

  async findDueSnoozes(now: Date, limit: number): Promise<DueSnooze[]> {
    const rows = await this.db.snooze.findMany({
      where: { status: 'pending', nextAttemptAt: { lte: now } },
      include: { person: personForDelivery },
      orderBy: { nextAttemptAt: 'asc' },
      take: limit,
    });

    return rows.map((row) => ({ snooze: toSnoozeRecord(row), person: row.person }));
  }
}
