import type { Interest, Person, Prisma, PrismaClient, Reminder } from '@prisma/client';
import { NotFoundError } from '../../shared/errors/index.js';
import { MIN_SEARCH_LENGTH, buildSearchText, normalizePersian } from '../../shared/utils/persian.js';
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

/** How many rows a search returns before it is cut off. */
const SEARCH_RESULT_LIMIT = 20;

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

/**
 * The canonical blob that `searchForUser` matches against.
 *
 * Every write path funnels through here so the column can never drift from the
 * text it mirrors. Adding a field to search means adding it here and in the
 * backfill migration, nothing else.
 */
function searchTextOf(
  name: string,
  notes: string | null,
  interests: string[],
): string {
  return buildSearchText([name, notes, ...interests]);
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
        searchText: searchTextOf(input.name, input.notes ?? null, input.interests ?? []),
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
    // Read first: the search blob is a fold over name, notes *and* interests, so
    // it cannot be rebuilt from the partial update alone.
    const current = await this.db.person.findFirst({
      where: { id: personId, userId, deletedAt: null },
      include: { interests: { select: { title: true } } },
    });
    if (!current) throw new NotFoundError('Person', { personId });

    const name = input.name ?? current.name;
    const notes = input.notes === undefined ? current.notes : input.notes;
    const interestTitles = current.interests.map((interest) => interest.title);

    const result = await this.db.person.updateMany({
      where: { id: personId, userId, deletedAt: null },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.birthMonth !== undefined ? { birthMonth: input.birthMonth } : {}),
        ...(input.birthDay !== undefined ? { birthDay: input.birthDay } : {}),
        ...(input.birthYear !== undefined ? { birthYear: input.birthYear } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        searchText: searchTextOf(name, notes, interestTitles),
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

  /**
   * §3.3 — name, interests or notes.
   *
   * The query is folded before it reaches SQL and matched against `searchText`,
   * which holds the same folding of the person's name, notes and interests. Both
   * sides have to be canonical: comparing a folded query to raw stored text
   * silently misses "كتاب" for a person stored as "کتاب", which looks exactly
   * like the person not existing.
   */
  async searchForUser(
    userId: string,
    query: string,
    limit = SEARCH_RESULT_LIMIT,
  ): Promise<PersonWithReminders[]> {
    const needle = normalizePersian(query);
    if (needle.length < MIN_SEARCH_LENGTH) return [];

    const rows = await this.db.person.findMany({
      where: {
        userId,
        deletedAt: null,
        // `searchText` is already lowercased on write, so the default comparison
        // is enough; `insensitive` would only paper over an un-maintained column.
        searchText: { contains: needle },
      },
      include: personWithRelations,
      orderBy: { name: 'asc' },
      take: limit,
    });

    return rows.map(toWithRelations);
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
    await this.refreshSearchText(personId);
    return created.map(toInterestRecord);
  }

  async removeInterest(interestId: string, personId: string): Promise<boolean> {
    const result = await this.db.interest.deleteMany({ where: { id: interestId, personId } });
    if (result.count > 0) await this.refreshSearchText(personId);
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
    await this.refreshSearchText(personId);
    return created.map(toInterestRecord);
  }

  /**
   * Recomputes `searchText` from the person's current text and interests.
   *
   * Called after every interest mutation: an interest is searchable, so removing
   * one has to remove it from the blob too, or the person stays findable by a
   * word the user has already deleted.
   */
  private async refreshSearchText(personId: string): Promise<void> {
    const [person, interests] = await Promise.all([
      this.db.person.findUnique({ where: { id: personId }, select: { name: true, notes: true } }),
      this.db.interest.findMany({ where: { personId }, select: { title: true } }),
    ]);
    // The person can be gone (deleted mid-request); nothing to keep in sync then.
    if (!person) return;

    await this.db.person.update({
      where: { id: personId },
      data: { searchText: searchTextOf(person.name, person.notes, interests.map((row) => row.title)) },
    });
  }
}
