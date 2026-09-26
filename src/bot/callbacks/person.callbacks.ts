import { t } from '../../shared/i18n/index.js';
import type { AppContext } from '../context.js';
import { editOrSend } from '../helpers.js';
import { personDetailsKeyboard } from '../keyboards/person.js';
import { confirmKeyboard, interestsKeyboard, reminderKeyboard } from '../keyboards/reminder.js';
import { reminderSettingsText } from '../views/reminder.views.js';
import {
  personDeletedText,
  personDetailsText,
  interestsText,
} from '../views/person.views.js';
import { escapeHtml } from '../../shared/utils/text.js';
import type { Services } from '../../container.js';

export interface PersonCallbackDeps {
  services: Services;
  showPeopleList: (ctx: AppContext) => Promise<void>;
}

/** All `person:*` inline callbacks. Ownership is enforced inside the services. */
export async function handlePersonCallback(
  ctx: AppContext,
  data: { kind: string; personId?: string },
  deps: PersonCallbackDeps,
): Promise<boolean> {
  const { services } = deps;
  const lang = ctx.state.lang;
  const personId = data.personId ?? '';
  const userId = ctx.state.user.id;

  switch (data.kind) {
    case 'person:view': {
      await showPerson(ctx, personId);
      return true;
    }

    case 'person:del:ask': {
      const person = await services.persons.getForUser(userId, personId);
      await editOrSend(
        ctx,
        t('delete.confirm', lang, { name: escapeHtml(person.name) }),
        confirmKeyboard(`person:del:yes:${person.id}`, `person:del:no:${person.id}`, lang),
      );
      return true;
    }

    case 'person:del:yes': {
      const person = await services.persons.delete(userId, personId);
      await services.reminders.deleteForPerson(person.id);
      await editOrSend(ctx, personDeletedText(person.name, lang));
      await deps.showPeopleList(ctx);
      return true;
    }

    case 'person:del:no': {
      await showPerson(ctx, personId);
      return true;
    }

    case 'person:reminders': {
      const person = await services.persons.getForUser(userId, personId);
      const reminders = await services.reminders.listForPerson(userId, person.id);
      await editOrSend(
        ctx,
        reminderSettingsText(person.name, reminders, lang),
        reminderKeyboard(person.id, reminders, lang),
      );
      return true;
    }

    case 'person:interests': {
      const person = await services.persons.getForUser(userId, personId);
      await editOrSend(
        ctx,
        interestsText(person, lang),
        interestsKeyboard(person.id, person.interests, lang),
      );
      return true;
    }

    default:
      return false;
  }

  async function showPerson(context: AppContext, id: string): Promise<void> {
    const person = await services.persons.getForUser(context.state.user.id, id);
    const upcoming = await services.birthdays.getOccurrenceForPerson(context.state.user.id, person);
    await editOrSend(
      context,
      personDetailsText(upcoming, context.state.lang),
      personDetailsKeyboard(person.id, context.state.lang, person.interests.length > 0),
    );
  }
}

export function isPersonCallback(kind: string): boolean {
  return kind.startsWith('person:');
}
