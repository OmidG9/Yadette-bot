import type { ReminderRecord } from '../reminders/reminder.types.js';

export interface PersonRecord {
  id: string;
  userId: string;
  name: string;
  birthMonth: number;
  birthDay: number;
  birthYear: number | null;
  notes: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InterestRecord {
  id: string;
  personId: string;
  title: string;
  createdAt: Date;
}

export interface PersonWithInterests extends PersonRecord {
  interests: InterestRecord[];
}

export interface PersonWithReminders extends PersonWithInterests {
  reminders: ReminderRecord[];
}

export interface CreatePersonInput {
  userId: string;
  name: string;
  birthMonth: number;
  birthDay: number;
  birthYear: number | null;
  notes?: string | null;
  interests?: string[];
  /** Reminder offsets (days before) to create enabled; defaults come from the caller. */
  reminderDays?: number[];
}

export interface UpdatePersonInput {
  name?: string;
  birthMonth?: number;
  birthDay?: number;
  birthYear?: number | null;
  notes?: string | null;
}

export interface PersonRepository {
  create(input: CreatePersonInput): Promise<PersonWithReminders>;
  /** Ownership is part of the query — a user can never read another user's person. */
  findByIdForUser(personId: string, userId: string): Promise<PersonWithReminders | null>;
  findAllForUser(userId: string): Promise<PersonWithReminders[]>;
  update(personId: string, userId: string, input: UpdatePersonInput): Promise<PersonRecord>;
  /** Soft delete: the row stays but never shows up in user-facing queries. */
  softDelete(personId: string, userId: string): Promise<boolean>;
  countForUser(userId: string): Promise<number>;

  addInterests(personId: string, titles: string[]): Promise<InterestRecord[]>;
  removeInterest(interestId: string, personId: string): Promise<boolean>;
  replaceInterests(personId: string, titles: string[]): Promise<InterestRecord[]>;
}
