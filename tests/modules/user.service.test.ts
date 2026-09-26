import { beforeEach, describe, expect, it } from 'vitest';
import { UserService } from '../../src/modules/users/user.service.js';
import { FakeUserRepository, fakeUser } from '../helpers/fakes.js';
import type { UserRecord } from '../../src/modules/users/user.types.js';

const TELEGRAM_ID = '708005947';

describe('UserService.deleteAccount', () => {
  let repository: FakeUserRepository;
  let service: UserService;

  beforeEach(() => {
    repository = new FakeUserRepository([fakeUser({ id: 'user1', telegramId: TELEGRAM_ID })]);
    service = new UserService(repository, 'Asia/Tehran');
  });

  it('removes the user so nothing identifies them any more', async () => {
    await service.deleteAccount('user1');

    expect(repository.count()).toBe(0);
    await expect(service.findById('user1')).resolves.toBeNull();
  });

  /**
   * The confirm button is one tap away from a duplicate send, and Telegram
   * delivers callbacks at-least-once: erasing twice must not throw.
   */
  it('is idempotent, so a double tap cannot fail', async () => {
    await service.deleteAccount('user1');
    await expect(service.deleteAccount('user1')).resolves.toBeUndefined();
  });

  it('leaves other users untouched', async () => {
    repository = new FakeUserRepository([
      fakeUser({ id: 'user1', telegramId: TELEGRAM_ID }),
      fakeUser({ id: 'user2', telegramId: '708005948' }),
    ]);
    service = new UserService(repository, 'Asia/Tehran');

    await service.deleteAccount('user1');

    expect(repository.count()).toBe(1);
    await expect(service.findById('user2')).resolves.toMatchObject({ id: 'user2' });
  });

  it('lets the same Telegram id start over as a brand new user', async () => {
    await service.deleteAccount('user1');

    const { user, created } = await service.getOrCreate({
      telegramId: TELEGRAM_ID,
      firstName: 'Sara',
    });

    expect(created).toBe(true);
    expect(user.id).not.toBe('user1');
    expect(user.timezone).toBe('Asia/Tehran');
    expect(user.reminderEnabled).toBe(true);
  });
});

describe('UserService.getOrCreate', () => {
  it('rejects a telegram id that is not numeric', async () => {
    const service = new UserService(new FakeUserRepository([]), 'Asia/Tehran');
    await expect(service.getOrCreate({ telegramId: 'not-an-id' })).rejects.toThrow();
  });

  it('never duplicates a user on repeated /start', async () => {
    const existing: UserRecord = fakeUser({ id: 'user1', telegramId: TELEGRAM_ID });
    const service = new UserService(new FakeUserRepository([existing]), 'Asia/Tehran');

    const first = await service.getOrCreate({ telegramId: TELEGRAM_ID, firstName: 'Changed' });
    const second = await service.getOrCreate({ telegramId: TELEGRAM_ID, firstName: 'Changed' });

    expect(first.created).toBe(false);
    expect(second.created).toBe(false);
    expect(second.user.id).toBe('user1');
  });
});
