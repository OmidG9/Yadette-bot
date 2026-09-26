/**
 * DISABLED — Phase 2 (user-written birthday messages).
 *
 * The MVP reminder text is static template copy rendered by the bot views.
 * This interface marks where user-authored messages will live later.
 */
export interface BirthdayMessage {
  id: string;
  personId: string;
  text: string;
}

export interface MessageService {
  listForPerson(personId: string): Promise<BirthdayMessage[]>;
  save(personId: string, text: string): Promise<BirthdayMessage>;
}

export const MESSAGE_MODULE_ENABLED = false;
