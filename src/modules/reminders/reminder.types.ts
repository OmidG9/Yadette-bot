export interface ReminderRecord {
  id: string;
  userId: string;
  personId: string;
  daysBefore: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReminderWithPerson extends ReminderRecord {
  person: {
    id: string;
    name: string;
    birthMonth: number;
    birthDay: number;
    birthYear: number | null;
    notes: string | null;
    interests: { id: string; title: string }[];
  };
}

export interface NotificationLogRecord {
  id: string;
  userId: string;
  personId: string;
  birthdayYear: number;
  daysBefore: number;
  sentAt: Date;
}

export interface ReminderRepository {
  findForPerson(personId: string, userId: string): Promise<ReminderRecord[]>;
  findEnabledForUser(userId: string): Promise<ReminderWithPerson[]>;
  setEnabled(
    reminderId: string,
    personId: string,
    userId: string,
    enabled: boolean,
  ): Promise<ReminderRecord | null>;
  ensureForPerson(userId: string, personId: string, daysBefore: number[]): Promise<ReminderRecord[]>;
  deleteForPerson(personId: string): Promise<number>;

  /** Notification log: the duplicate-send guard. */
  findLog(
    userId: string,
    personId: string,
    birthdayYear: number,
    daysBefore: number,
  ): Promise<NotificationLogRecord | null>;
  /**
   * Atomically claims a notification slot. Returns `null` when the unique
   * constraint proves it was already claimed (by this or a concurrent run).
   */
  claimNotification(input: {
    userId: string;
    personId: string;
    birthdayYear: number;
    daysBefore: number;
  }): Promise<NotificationLogRecord | null>;
  /** Releases a claim when delivery failed, so the next tick can retry. */
  releaseNotification(logId: string): Promise<void>;
}
