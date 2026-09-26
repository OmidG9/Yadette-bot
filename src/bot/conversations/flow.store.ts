import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';

/** Persisted conversation state for one user (only one flow at a time). */
export interface FlowState {
  userId: string;
  flow: string;
  step: string;
  data: Record<string, unknown>;
  /** Telegram message id of the last prompt, so prompts can be edited in place. */
  messageId: number | null;
}

export interface FlowStore {
  get(userId: string): Promise<FlowState | null>;
  save(state: FlowState): Promise<void>;
  clear(userId: string): Promise<void>;
}

const dataSchema = z.record(z.string(), z.unknown());

/**
 * Conversation state in PostgreSQL instead of process memory (§36).
 * The `FlowStore` interface is intentionally tiny so a Redis-backed
 * implementation can replace this one later.
 */
export class PrismaFlowStore implements FlowStore {
  constructor(private readonly db: PrismaClient) {}

  async get(userId: string): Promise<FlowState | null> {
    const row = await this.db.userFlowState.findUnique({ where: { userId } });
    if (!row) return null;

    const parsed = dataSchema.safeParse(row.data);
    return {
      userId: row.userId,
      flow: row.flow,
      step: row.step,
      data: parsed.success ? parsed.data : {},
      messageId: row.messageId,
    };
  }

  async save(state: FlowState): Promise<void> {
    const data = state.data as object;
    await this.db.userFlowState.upsert({
      where: { userId: state.userId },
      create: {
        userId: state.userId,
        flow: state.flow,
        step: state.step,
        data,
        messageId: state.messageId,
      },
      update: { flow: state.flow, step: state.step, data, messageId: state.messageId },
    });
  }

  async clear(userId: string): Promise<void> {
    await this.db.userFlowState.deleteMany({ where: { userId } });
  }
}
