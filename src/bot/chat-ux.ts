import type { AppContext } from './context.js';
import { thinkingText,  } from './views/chat.views.js';
import { editOrSend, sendText } from './helpers.js';

export interface ThinkingHandle {
  update: (text: string) => Promise<void>;
  done: (finalText: string) => Promise<void>;
  fail: (errorText: string) => Promise<void>;
  cancel: () => Promise<void>;
}

export async function startThinking(ctx: AppContext, lang: string): Promise<ThinkingHandle> {
  await sendText(ctx, thinkingText(lang as "fa"));
  let active = true;

  return {
    async update(text: string) {
      if (!active) return;
      try {
        await editOrSend(ctx, text);
      } catch {
        // ignore
      }
    },
    async done(finalText: string) {
      if (!active) return;
      active = false;
      try {
        await editOrSend(ctx, finalText);
      } catch {
        // ignore
      }
    },
    async fail(errorText: string) {
      if (!active) return;
      active = false;
      try {
        await editOrSend(ctx, errorText);
      } catch {
        // ignore
      }
    },
    async cancel() {
      active = false;
    },
  };
}