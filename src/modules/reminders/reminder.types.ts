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

/** Delivery state of a notification slot. */
export type DeliveryStatus = 'pending' | 'sent' | 'failed';

export interface NotificationLogRecord {
  id: string;
  userId: string;
  personId: string;
  birthdayYear: number;
  daysBefore: number;
  status: DeliveryStatus;
  attempts: number;
  nextAttemptAt: Date;
  lastError: string | null;
  sentAt: Date | null;
}

/** A postponed notification, awaiting delivery. */
export interface SnoozeRecord {
  id: string;
  userId: string;
  personId: string;
  birthdayYear: number;
  daysBefore: number;
  deliverAt: Date;
  status: DeliveryStatus;
  attempts: number;
  nextAttemptAt: Date;
  lastError: string | null;
  sentAt: Date | null;
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
   * Looks a slot up by its own id, scoped to the owner.
   *
   * The snooze buttons carry the log id, and callback data is attacker
   * controlled — without the `userId` in the query, one user could postpone
   * another user's reminder by guessing an id.
   */
  findLogByIdForUser(logId: string, userId: string): Promise<NotificationLogRecord | null>;
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
  /**
   * §3.6 — slot keys this user already owns a log row for, whatever its status.
   *
   * Deliberately status-agnostic. Once a slot has a row it belongs to the retry
   * pass (or is finished), so the fresh pass must not report it again: a
   * `pending` row is already claimed, and re-claiming it on every tick would
   * just log a duplicate forever.
   */
  findHandledSlotKeys(userId: string): Promise<Set<string>>;

  /** §3.6 — records a successful delivery, closing the slot. */
  markSent(logId: string, sentAt: Date): Promise<void>;
  /**
   * §3.6 — records a failed attempt and pushes the slot into the future.
   *
   * The row is kept rather than deleted: a released claim makes the reminder
   * due again only if its date still matches, which it no longer does, so the
   * reminder would be silently dropped.
   */
  scheduleRetry(logId: string, attempt: number, nextAttemptAt: Date, error: string): Promise<void>;
  /** Marks a slot as permanently undeliverable, keeping it for audit. */
  markFailed(logId: string, error: string): Promise<void>;
  /** Pending slots whose backoff has elapsed, with enough context to re-send. */
  findDueRetries(now: Date, limit: number): Promise<DueRetry[]>;
  /**
   * §3.6 — takes exclusive ownership of a due retry, or reports that another
   * worker already has it.
   *
   * Unlike the fresh pass there is no unique constraint to fall back on,
   * because the row being re-sent already exists. Pushing `nextAttemptAt` past
   * now hides the row from the query above, so exactly one worker wins.
   */
  leaseRetry(logId: string, now: Date): Promise<boolean>;

  /** §3.5 — snoozes. */
  upsertSnooze(input: {
    userId: string;
    personId: string;
    birthdayYear: number;
    daysBefore: number;
    deliverAt: Date;
  }): Promise<SnoozeRecord>;
  findSnooze(
    userId: string,
    personId: string,
    birthdayYear: number,
    daysBefore: number,
  ): Promise<SnoozeRecord | null>;
  markSnoozeSent(snoozeId: string, sentAt: Date): Promise<void>;
  scheduleSnoozeRetry(
    snoozeId: string,
    attempt: number,
    nextAttemptAt: Date,
    error: string,
  ): Promise<void>;
  markSnoozeFailed(snoozeId: string, error: string): Promise<void>;
  findDueSnoozes(now: Date, limit: number): Promise<DueSnooze[]>;
  /** §3.5 — same lease as `leaseRetry`, for the same reason. */
  leaseSnooze(snoozeId: string, now: Date): Promise<boolean>;
}

/** A notification slot waiting for its retry, with everything needed to re-send. */
export interface DueRetry {
  log: NotificationLogRecord;
  userId: string;
  person: ReminderWithPerson['person'];
}

/** A snooze waiting for delivery, with everything needed to render it. */
export interface DueSnooze {
  snooze: SnoozeRecord;
  person: ReminderWithPerson['person'];
}

/**
 * Identity of one notification slot: which person, which Jalali year, which
 * offset. Shared so the "already sent" check and its batch form cannot drift.
 */
export function notificationSlotKey(
  personId: string,
  birthdayYear: number,
  daysBefore: number,
): string {
  return `${personId}:${birthdayYear}:${daysBefore}`;
}
