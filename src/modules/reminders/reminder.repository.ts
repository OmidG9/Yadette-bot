import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { notificationSlotKey } from './reminder.types.js';
import type {
  NotificationLogRecord,
  ReminderRecord,
  ReminderRepository,
  ReminderWithPerson,
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
  sentAt: Date;
}): NotificationLogRecord {
  return { ...row };
}

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

  /**
   * Every notification this user already got, as a lookup set.
   *
   * One query per scheduler tick instead of one per due reminder, which matters
   * because the "already sent" check runs for every enabled reminder of every
   * user with reminders.
   */
  async findLogKeys(userId: string): Promise<Set<string>> {
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

  async releaseNotification(logId: string): Promise<void> {
    await this.db.notificationLog.deleteMany({ where: { id: logId } });
  }
}
