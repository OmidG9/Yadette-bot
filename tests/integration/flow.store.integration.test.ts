import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  db,
  disconnectTestDatabase,
  repositories,
  resetDatabase,
  seedUser,
} from './helpers/database.js';

const { flowStore } = repositories();

afterAll(disconnectTestDatabase);
beforeEach(resetDatabase);

describe('PrismaFlowStore (real database)', () => {
  it('returns null when the user has no active flow', async () => {
    const user = await seedUser(repositories().users);

    expect(await flowStore.get(user.id)).toBeNull();
  });

  it('saves and reads back the full state', async () => {
    const user = await seedUser(repositories().users);

    await flowStore.save({
      userId: user.id,
      flow: 'add-person',
      step: 'birthday',
      data: { name: 'علی', birthMonth: 7 },
      messageId: 4242,
    });

    expect(await flowStore.get(user.id)).toEqual({
      userId: user.id,
      flow: 'add-person',
      step: 'birthday',
      data: { name: 'علی', birthMonth: 7 },
      messageId: 4242,
    });
  });

  it('upserts instead of failing on a second save', async () => {
    const user = await seedUser(repositories().users);
    const base = {
      userId: user.id,
      flow: 'add-person',
      data: {} as Record<string, unknown>,
      messageId: null,
    };

    await flowStore.save({ ...base, step: 'name', messageId: 1 });
    await flowStore.save({ ...base, step: 'birthday', messageId: 2 });

    const stored = await flowStore.get(user.id);
    expect(stored?.step).toBe('birthday');
    expect(stored?.messageId).toBe(2);
    expect(await db.userFlowState.count({ where: { userId: user.id } })).toBe(1);
  });

  it('keeps only one flow row per user', async () => {
    const user = await seedUser(repositories().users);
    const base = {
      userId: user.id,
      data: {} as Record<string, unknown>,
      messageId: null,
    };

    await flowStore.save({ ...base, flow: 'add-person', step: 'name' });
    await flowStore.save({ ...base, flow: 'edit-person', step: 'name' });

    const rows = await db.userFlowState.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.flow).toBe('edit-person');
  });

  it('survives a process restart because state is in the database', async () => {
    const user = await seedUser(repositories().users);
    await flowStore.save({
      userId: user.id,
      flow: 'add-person',
      step: 'interests',
      data: { name: 'سارا' },
      messageId: 7,
    });

    const rows = await db.userFlowState.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.data).toEqual({ name: 'سارا' });
  });

  it('falls back to an empty object when the stored JSON is not a record', async () => {
    const user = await seedUser(repositories().users);
    await db.userFlowState.create({
      data: { userId: user.id, flow: 'add-person', step: 'name', data: [1, 2, 3] },
    });

    const stored = await flowStore.get(user.id);

    expect(stored?.data).toEqual({});
    expect(stored?.step).toBe('name');
  });

  it('preserves a null messageId', async () => {
    const user = await seedUser(repositories().users);

    await flowStore.save({
      userId: user.id,
      flow: 'add-person',
      step: 'name',
      data: {},
      messageId: null,
    });

    expect((await flowStore.get(user.id))?.messageId).toBeNull();
  });

  describe('clear', () => {
    it('removes the state', async () => {
      const user = await seedUser(repositories().users);
      await flowStore.save({
        userId: user.id,
        flow: 'add-person',
        step: 'name',
        data: {},
        messageId: 1,
      });

      await flowStore.clear(user.id);

      expect(await flowStore.get(user.id)).toBeNull();
    });

    it('is idempotent', async () => {
      const user = await seedUser(repositories().users);

      await expect(flowStore.clear(user.id)).resolves.toBeUndefined();
      await expect(flowStore.clear(user.id)).resolves.toBeUndefined();
    });
  });
});
