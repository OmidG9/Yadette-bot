import { prisma } from './database/client.js';
import { env } from './config/env.js';
import { PrismaUserRepository } from './modules/users/user.repository.js';
import { UserService } from './modules/users/user.service.js';
import { PrismaPersonRepository } from './modules/people/person.repository.js';
import { PersonService } from './modules/people/person.service.js';
import { BirthdayService } from './modules/birthdays/birthday.service.js';
import { PrismaReminderRepository } from './modules/reminders/reminder.repository.js';
import { ReminderService } from './modules/reminders/reminder.service.js';
import { PrismaSettingsRepository } from './modules/settings/settings.repository.js';
import { SettingsService } from './modules/settings/settings.service.js';
import { HealthService, type SchedulerProbe } from './modules/health/health.service.js';
import { PrismaFlowStore } from './bot/conversations/flow.store.js';

export interface Services {
  users: UserService;
  persons: PersonService;
  birthdays: BirthdayService;
  reminders: ReminderService;
  settings: SettingsService;
  health: HealthService;
}

export interface Container {
  services: Services;
  flowStore: PrismaFlowStore;
}

/**
 * Composition root.
 *
 * Handlers receive services, services receive repository interfaces, and only
 * this file knows about Prisma. Tests build the same graph with in-memory fakes.
 */
export function createContainer(scheduler?: SchedulerProbe): Container {
  const userRepository = new PrismaUserRepository(prisma);
  const personRepository = new PrismaPersonRepository(prisma);
  const reminderRepository = new PrismaReminderRepository(prisma);
  const settingsRepository = new PrismaSettingsRepository(prisma);
  const flowStore = new PrismaFlowStore(prisma);

  const services: Services = {
    users: new UserService(userRepository, env.DEFAULT_TIMEZONE),
    persons: new PersonService(personRepository),
    birthdays: new BirthdayService(personRepository, userRepository),
    reminders: new ReminderService(reminderRepository, userRepository),
    settings: new SettingsService(settingsRepository),
    // `SELECT 1` is the cheapest statement that still proves the pool can hand
    // out a connection; `$queryRaw` would need a tagged template.
    health: new HealthService({ ping: () => prisma.$queryRaw`SELECT 1` }, scheduler),
  };

  return { services, flowStore };
}
