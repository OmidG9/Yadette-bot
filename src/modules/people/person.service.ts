import { DEFAULT_REMINDER_DAYS, MAX_INTERESTS_PER_PERSON } from '../../shared/constants/index.js';
import { NotFoundError, ValidationError } from '../../shared/errors/index.js';
import { cleanName, cleanNotes, parseInterests } from '../../shared/utils/text.js';
import { isValidBirthdayRule, type BirthdayRule } from '../birthdays/birthday.calc.js';
import type {
  InterestRecord,
  PersonRecord,
  PersonRepository,
  PersonWithInterests,
  PersonWithReminders,
} from './person.types.js';

export interface CreatePersonRequest {
  name: string;
  birthMonth: number;
  birthDay: number;
  birthYear?: number | null;
  notes?: string | null;
  interests?: string[];
  reminderDays?: number[];
}

export interface UpdatePersonRequest {
  name?: string;
  birthMonth?: number;
  birthDay?: number;
  birthYear?: number | null;
  notes?: string | null;
}

export class PersonService {
  constructor(private readonly people: PersonRepository) {}

  /**
   * Creates a person together with their interests and default reminders.
   * All inputs are validated here so Telegram handlers stay dumb.
   */
  async create(userId: string, request: CreatePersonRequest): Promise<PersonWithReminders> {
    const name = cleanName(request.name);
    if (!name) throw new ValidationError('Invalid person name');

    const rule: BirthdayRule = {
      month: request.birthMonth,
      day: request.birthDay,
      year: request.birthYear ?? null,
    };
    if (!isValidBirthdayRule(rule)) {
      throw new ValidationError('Invalid birthday', { rule });
    }

    const interests = parseInterests(request.interests?.join('،') ?? '');
    if (interests.length > MAX_INTERESTS_PER_PERSON) {
      throw new ValidationError('Too many interests');
    }

    const reminderDays = request.reminderDays ?? [...DEFAULT_REMINDER_DAYS];

    return this.people.create({
      userId,
      name,
      birthMonth: rule.month,
      birthDay: rule.day,
      birthYear: rule.year,
      notes: request.notes ? cleanNotes(request.notes) : null,
      interests,
      reminderDays,
    });
  }

  /** Throws `NotFoundError` when the person does not belong to the user. */
  async getForUser(userId: string, personId: string): Promise<PersonWithReminders> {
    const person = await this.people.findByIdForUser(personId, userId);
    if (!person) throw new NotFoundError('Person', { personId });
    return person;
  }

  async existsForUser(userId: string, personId: string): Promise<boolean> {
    return (await this.people.findByIdForUser(personId, userId)) !== null;
  }

  async listForUser(userId: string): Promise<PersonWithReminders[]> {
    return this.people.findAllForUser(userId);
  }

  async listWithInterestsForUser(userId: string): Promise<PersonWithInterests[]> {
    return this.people.findAllForUser(userId);
  }

  async countForUser(userId: string): Promise<number> {
    return this.people.countForUser(userId);
  }

  async updateName(userId: string, personId: string, rawName: string): Promise<PersonRecord> {
    const name = cleanName(rawName);
    if (!name) throw new ValidationError('Invalid person name');
    return this.update(userId, personId, { name });
  }

  async updateBirthday(
    userId: string,
    personId: string,
    input: { month: number; day: number; year?: number | null },
  ): Promise<PersonRecord> {
    const current = await this.getForUser(userId, personId);
    const rule: BirthdayRule = {
      month: input.month,
      day: input.day,
      year: input.year ?? null,
    };
    if (!isValidBirthdayRule(rule)) {
      throw new ValidationError('Invalid birthday', { rule, previous: current.id });
    }

    return this.update(userId, personId, {
      birthMonth: rule.month,
      birthDay: rule.day,
      birthYear: rule.year,
    });
  }

  async updateNotes(userId: string, personId: string, rawNotes: string): Promise<PersonRecord> {
    return this.update(userId, personId, { notes: cleanNotes(rawNotes) });
  }

  async update(userId: string, personId: string, input: UpdatePersonRequest): Promise<PersonRecord> {
    // Ensures ownership before writing, so a foreign personId is rejected.
    await this.getForUser(userId, personId);
    return this.people.update(personId, userId, input);
  }

  async delete(userId: string, personId: string): Promise<PersonRecord> {
    const person = await this.getForUser(userId, personId);
    const deleted = await this.people.softDelete(personId, userId);
    if (!deleted) throw new NotFoundError('Person', { personId });
    return person;
  }

  // --- Interests ---------------------------------------------------------

  async addInterests(
    userId: string,
    personId: string,
    rawTitles: string,
  ): Promise<{ person: PersonWithReminders; added: string[] }> {
    const person = await this.getForUser(userId, personId);
    const titles = parseInterests(rawTitles);
    if (titles.length === 0) throw new ValidationError('No interests provided');

    const existing = new Set(person.interests.map((item) => item.title.toLocaleLowerCase('fa')));
    const fresh = titles.filter((title) => !existing.has(title.toLocaleLowerCase('fa')));
    if (fresh.length === 0) {
      return { person, added: [] };
    }

    if (person.interests.length + fresh.length > MAX_INTERESTS_PER_PERSON) {
      throw new ValidationError('Too many interests');
    }

    await this.people.addInterests(personId, fresh);
    return { person: await this.getForUser(userId, personId), added: fresh };
  }

  async removeInterest(userId: string, personId: string, interestId: string): Promise<InterestRecord> {
    const person = await this.getForUser(userId, personId);
    const interest = person.interests.find((item) => item.id === interestId);
    if (!interest) throw new NotFoundError('Interest', { interestId });
    await this.people.removeInterest(interestId, personId);
    return interest;
  }

  async replaceInterests(
    userId: string,
    personId: string,
    rawTitles: string,
  ): Promise<PersonWithReminders> {
    await this.getForUser(userId, personId);
    const titles = parseInterests(rawTitles);
    await this.people.replaceInterests(personId, titles);
    return this.getForUser(userId, personId);
  }
}
