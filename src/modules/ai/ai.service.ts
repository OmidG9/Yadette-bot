/**
 * DISABLED — Phase 3 (AI features).
 *
 * Yadette's MVP is explicitly AI-free. This file only documents the seam: when AI
 * arrives it will be a new module implementing `AIService`, injected next to the
 * existing services. No provider, key, or call exists in this codebase.
 */
export interface AIRequestContext {
  personName: string;
  interests: string[];
  notes?: string | null;
}

export interface AIService {
  /** Phase 3: gift ideas derived from interests. */
  generateGiftIdeas(context: AIRequestContext): Promise<never>;
  /** Phase 3: personalized birthday message. */
  generateBirthdayMessage(context: AIRequestContext): Promise<never>;
}

export const AI_MODULE_ENABLED = false;
