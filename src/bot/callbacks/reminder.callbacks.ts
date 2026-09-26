import type { AppContext } from '../context.js';
import { ackCallback, editOrSend } from '../helpers.js';
import { reminderKeyboard } from '../keyboards/reminder.js';
import { reminderSettingsText } from '../views/reminder.views.js';
import { ValidationError } from '../../shared/errors/index.js';
import type { Services } from '../../container.js';

/**
 * `reminder:toggle:<personId>:<days>` — inline toggles for a saved person.
 * The service validates the offset and re-reads the person with ownership checks.
 */
export async function handleReminderToggle(
  ctx: AppContext,
  data: { personId?: string; days?: number },
  services: Services,
): Promise<boolean> {
  const lang = ctx.state.lang;
  const userId = ctx.state.user.id;
  const personId = data.personId ?? '';
  const days = data.days;

  if (days === undefined) throw new ValidationError('Missing reminder offset');

  const person = await services.persons.getForUser(userId, personId);
  const current = await services.reminders.listForPerson(userId, person.id);
  const existing = current.find((reminder) => reminder.daysBefore === days);

  const reminders = await services.reminders.setEnabled(userId, person.id, days, !existing?.enabled);

  await ackCallback(ctx);
  await editOrSend(
    ctx,
    reminderSettingsText(person.name, reminders, lang),
    reminderKeyboard(person.id, reminders, lang),
  );
  return true;
}
