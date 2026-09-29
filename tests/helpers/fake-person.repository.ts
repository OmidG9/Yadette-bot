import {
  buildSearchText,
  MIN_SEARCH_LENGTH,
  normalizePersian,
} from '../../src/shared/utils/persian.js';
import type {
  CreatePersonInput,
  InterestRecord,
  PersonRecord,
  PersonRepository,
  PersonWithReminders,
  UpdatePersonInput,
} from '../../src/modules/people/person.types.js';

/**
 * In-memory person repository that mirrors the real ownership semantics:
 * every read and write is filtered by `userId` and `deletedAt`.
 */
export class FakePersonRepository implements PersonRepository {
  private people = new Map<string, PersonWithReminders>();
  private interests = new Map<string, InterestRecord>();
  private sequence = 0;

  private row(input: CreatePersonInput): PersonWithReminders {
    this.sequence += 1;
    return {
      id: `person${this.sequence}`,
      userId: input.userId,
      name: input.name,
      birthMonth: input.birthMonth,
      birthDay: input.birthDay,
      birthYear: input.birthYear,
      notes: input.notes ?? null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      interests: [],
      reminders: (input.reminderDays ?? []).map((daysBefore, index) => ({
        id: `rem${index}-${input.userId}`,
        userId: input.userId,
        personId: input.userId,
        daysBefore,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    };
  }

  /**
   * The same blob the real `searchText` column holds.
   *
   * The fake rebuilds it on every read rather than storing it, which is only
   * equivalent because the real repository also recomputes it on every write.
   */
  private searchTextOf(person: PersonWithReminders): string {
    return buildSearchText([
      person.name,
      person.notes,
      ...person.interests.map((interest) => interest.title),
    ]);
  }

  async create(input: CreatePersonInput): Promise<PersonWithReminders> {
    const person = this.row(input);
    this.people.set(person.id, person);

    if ((input.interests ?? []).length > 0) {
      await this.addInterests(person.id, input.interests ?? []);
    }
    person.reminders = person.reminders.map((reminder) => ({
      ...reminder,
      personId: person.id,
    }));

    return this.get(person.id, input.userId)!;
  }

  async findByIdForUser(personId: string, userId: string): Promise<PersonWithReminders | null> {
    return this.get(personId, userId);
  }

  async findAllForUser(userId: string): Promise<PersonWithReminders[]> {
    return [...this.people.values()].filter(
      (person) => person.userId === userId && person.deletedAt === null,
    );
  }

  async update(personId: string, userId: string, input: UpdatePersonInput): Promise<PersonRecord> {
    const person = this.get(personId, userId);
    if (!person) throw new Error('Person not found');

    if (input.name !== undefined) person.name = input.name;
    if (input.birthMonth !== undefined) person.birthMonth = input.birthMonth;
    if (input.birthDay !== undefined) person.birthDay = input.birthDay;
    if (input.birthYear !== undefined) person.birthYear = input.birthYear;
    if (input.notes !== undefined) person.notes = input.notes;
    person.updatedAt = new Date();

    return person;
  }

  async softDelete(personId: string, userId: string): Promise<boolean> {
    const person = this.get(personId, userId);
    if (!person) return false;
    person.deletedAt = new Date();
    return true;
  }

  async countForUser(userId: string): Promise<number> {
    return (await this.findAllForUser(userId)).length;
  }

  /** Mirrors the real query: folded query against the folded stored blob. */
  async searchForUser(
    userId: string,
    query: string,
    limit = 20,
  ): Promise<PersonWithReminders[]> {
    const needle = normalizePersian(query);
    if (needle.length < MIN_SEARCH_LENGTH) return [];

    return (await this.findAllForUser(userId))
      .filter((person) => this.searchTextOf(person).includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limit);
  }

  async addInterests(personId: string, titles: string[]): Promise<InterestRecord[]> {
    const created: InterestRecord[] = [];
    for (const title of titles) {
      this.sequence += 1;
      const record: InterestRecord = {
        id: `int${this.sequence}`,
        personId,
        title,
        createdAt: new Date(),
      };
      this.interests.set(record.id, record);
      created.push(record);
    }
    return created;
  }

  async removeInterest(interestId: string, personId: string): Promise<boolean> {
    const interest = this.interests.get(interestId);
    if (!interest || interest.personId !== personId) return false;
    this.interests.delete(interestId);
    return true;
  }

  async replaceInterests(personId: string, titles: string[]): Promise<InterestRecord[]> {
    for (const [id, interest] of this.interests) {
      if (interest.personId === personId) this.interests.delete(id);
    }
    return this.addInterests(personId, titles);
  }

  private get(personId: string, userId: string): PersonWithReminders | null {
    const person = this.people.get(personId);
    if (!person || person.userId !== userId || person.deletedAt !== null) return null;
    // The real repository always re-reads relations; keep the snapshot in sync.
    person.interests = this.interestsOf(personId);
    return person;
  }

  /** Test helper: interests currently stored for a person. */
  interestsOf(personId: string): InterestRecord[] {
    return [...this.interests.values()].filter((item) => item.personId === personId);
  }
}
