import { t } from '../../shared/i18n/index.js';
import type { AppContext } from '../context.js';
import { editOrSend, sendText } from '../helpers.js';
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
import type { FlowStore } from '../conversations/flow.store.js';

export interface PersonCallbackDeps {
  services: Services;
  /** Needed to drop flow state when a cancel button lands on a person screen. */
  flowStore?: FlowStore;
  /** Back navigation target: the single birthday list. */
  showUpcomingList: (ctx: AppContext) => Promise<void>;
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
      await deps.flowStore?.clear(userId);
      // Sent, not edited: `showUpcomingList` edits this same message, which would
      // wipe the confirmation of an irreversible action before it can be read.
      await sendText(ctx, personDeletedText(person.name, lang));
      await deps.showUpcomingList(ctx);
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
      // This is also the cancel target of the add-interest prompt, so the flow
      // has to go with it: leaving it behind would save the user's next message
      // as an interest.
      await deps.flowStore?.clear(userId);
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
