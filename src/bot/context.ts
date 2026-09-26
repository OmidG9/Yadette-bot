import { Context } from 'grammy';
import type { Api } from 'grammy';
import type { Update, UserFromGetMe } from 'grammy/types';
import type { UserRecord } from '../modules/users/user.types.js';
import type { Language } from '../shared/i18n/index.js';

export interface AppState {
  /**
   * Resolved Telegram user. Written by the `hydrateUser` middleware before any
   * handler runs, so handlers can rely on it being present.
   */
  user: UserRecord;
  lang: Language;
  /** True when this update is the user's very first contact. */
  isNewUser: boolean;
}

/**
 * grammY does not create `ctx.state` on its own — the property only exists if a
 * custom `Context` class initialises it, which is why the bot has to pass this
 * class as `ContextConstructor`.
 *
 * Without it, `ctx.state` is `undefined` at runtime and the first assignment
 * (`ctx.state.user = ...` in `hydrateUser`) throws.
 */
export class AppContext extends Context {
  declare state: AppState;

  constructor(update: Update, api: Api, me: UserFromGetMe) {
    super(update, api, me);

    // `user` is intentionally absent until `hydrateUser` fills it in: that
    // middleware is the outermost handler, so no handler can observe this
    // object in an unhydrated state.
    this.state = { lang: 'fa', isNewUser: false } as AppState;
  }
}
