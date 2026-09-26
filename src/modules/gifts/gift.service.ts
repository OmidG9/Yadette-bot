/**
 * DISABLED — Phase 2/3 (gift suggestions).
 *
 * The boundary exists so adding this feature later is a small, isolated change.
 * Nothing here is wired into the bot, and no fake behaviour is implemented.
 */
export interface GiftSuggestion {
  title: string;
  reason: string;
}

export interface GiftService {
  /** Phase 2: rule-based suggestions from a person's interests. */
  suggestForPerson(personId: string): Promise<GiftSuggestion[]>;
  /** Phase 3: AI-generated suggestions. */
  suggestWithAi(personId: string): Promise<GiftSuggestion[]>;
}

export const GIFT_MODULE_ENABLED = false;
