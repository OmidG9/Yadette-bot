import type { Interest, Person, Prisma, PrismaClient, Reminder } from '@prisma/client';
import { NotFoundError } from '../../shared/errors/index.js';
import type {
  CreatePersonInput,
  InterestRecord,
  PersonRecord,
  PersonRepository,
  PersonWithReminders,
  UpdatePersonInput,
} from './person.types.js';

const personWithRelations = {
  interests: { orderBy: { createdAt: 'asc' } },
  reminders: { orderBy: { daysBefore: 'desc' } },
} satisfies Prisma.PersonInclude;

type PersonRow = Person & { interests: Interest[]; reminders: Reminder[] };

function toInterestRecord(row: Interest): InterestRecord {
  return { id: row.id, personId: row.personId, title: row.title, createdAt: row.createdAt };
}

function toRecord(row: Person): PersonRecord {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    birthMonth: row.birthMonth,
    birthDay: row.birthDay,
    birthYear: row.birthYear,
    notes: row.notes,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toWithRelations(row: PersonRow): PersonWithReminders {
  return {
    ...toRecord(row),
    interests: row.interests.map(toInterestRecord),
    reminders: row.reminders.map((reminder) => ({
      id: reminder.id,
      userId: reminder.userId,
      personId: reminder.personId,
      daysBefore: reminder.daysBefore,
      enabled: reminder.enabled,
      createdAt: reminder.createdAt,
      updatedAt: reminder.updatedAt,
    })),
  };
}

export class PrismaPersonRepository implements PersonRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(input: CreatePersonInput): Promise<PersonWithReminders> {
    const row = await this.db.person.create({
      data: {
        userId: input.userId,
        name: input.name,
        birthMonth: input.birthMonth,
        birthDay: input.birthDay,
        birthYear: input.birthYear,
        notes: input.notes ?? null,
        interests: {
          create: (input.interests ?? []).map((title) => ({ title })),
        },
        reminders: {
          create: (input.reminderDays ?? []).map((daysBefore) => ({
            userId: input.userId,
            daysBefore,
            enabled: true,
          })),
        },
      },
      include: personWithRelations,
    });

    return toWithRelations(row);
  }

  async findByIdForUser(personId: string, userId: string): Promise<PersonWithReminders | null> {
    const row = await this.db.person.findFirst({
      where: { id: personId, userId, deletedAt: null },
      include: personWithRelations,
    });
    return row ? toWithRelations(row) : null;
  }

  async findAllForUser(userId: string): Promise<PersonWithReminders[]> {
    const rows = await this.db.person.findMany({
      where: { userId, deletedAt: null },
      include: personWithRelations,
      orderBy: { name: 'asc' },
    });
    return rows.map(toWithRelations);
  }

  async update(personId: string, userId: string, input: UpdatePersonInput): Promise<PersonRecord> {
    const result = await this.db.person.updateMany({
      where: { id: personId, userId, deletedAt: null },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.birthMonth !== undefined ? { birthMonth: input.birthMonth } : {}),
        ...(input.birthDay !== undefined ? { birthDay: input.birthDay } : {}),
        ...(input.birthYear !== undefined ? { birthYear: input.birthYear } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });

    if (result.count === 0) {
      throw new NotFoundError('Person', { personId });
    }

    const updated = await this.db.person.findUniqueOrThrow({ where: { id: personId } });
    return toRecord(updated);
  }

  async softDelete(personId: string, userId: string): Promise<boolean> {
    const result = await this.db.person.updateMany({
      where: { id: personId, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return result.count > 0;
  }

  async countForUser(userId: string): Promise<number> {
    return this.db.person.count({ where: { userId, deletedAt: null } });
  }

  async addInterests(personId: string, titles: string[]): Promise<InterestRecord[]> {
    if (titles.length === 0) return [];
    await this.db.interest.createMany({
      data: titles.map((title) => ({ personId, title })),
      skipDuplicates: true,
    });
    const created = await this.db.interest.findMany({
      where: { personId, title: { in: titles } },
      orderBy: { createdAt: 'asc' },
    });
    return created.map(toInterestRecord);
  }

  async removeInterest(interestId: string, personId: string): Promise<boolean> {
    const result = await this.db.interest.deleteMany({ where: { id: interestId, personId } });
    return result.count > 0;
  }

  async replaceInterests(personId: string, titles: string[]): Promise<InterestRecord[]> {
    await this.db.$transaction([
      this.db.interest.deleteMany({ where: { personId } }),
      ...(titles.length > 0
        ? [this.db.interest.createMany({ data: titles.map((title) => ({ personId, title })) })]
        : []),
    ]);

    const created = await this.db.interest.findMany({
      where: { personId },
      orderBy: { createdAt: 'asc' },
    });
    return created.map(toInterestRecord);
  }
}
