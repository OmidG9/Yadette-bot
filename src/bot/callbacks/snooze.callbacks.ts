import { t } from '../../shared/i18n/index.js';
import { featureFlags } from '../../config/feature-flags.js';
import { ackCallback, editOrSend } from '../helpers.js';
import { snoozeOptionsKeyboard } from '../keyboards/reminder.js';
import { isSnoozeOption } from '../../modules/reminders/snooze.js';
import { toPersianDigits } from '../../shared/utils/date.js';
import type { AppContext } from '../context.js';
import type { Services } from '../../container.js';

/**
 * §3.5 — `snooze:ask:*` and `snooze:do:*`.
 *
 * Both branches return `false` for anything unresolvable, so the shared
 * dispatcher answers with the generic "invalid input" instead of this screen
 * leaking a half-understood state.
 */
export async function handleSnoozeCallback(
  ctx: AppContext,
  data: { kind: string; deliveryId?: string; days?: number },
  services: Services,
): Promise<boolean> {
  if (!featureFlags.isEnabled('snooze')) return false;

  const lang = ctx.state.lang;
  const deliveryId = data.deliveryId;
  if (!deliveryId) return false;

  const target = await services.reminders.resolveSnoozeTarget(deliveryId, ctx.state.user.id);
  // Unknown, foreign, or already re-snoozed and consumed: all the same to the user.
  if (!target) {
    await ackCallback(ctx);
    await editOrSend(ctx, t('snooze.expired', lang));
    return true;
  }

  if (data.kind === 'snooze:ask') {
    await ackCallback(ctx);
    await editOrSend(ctx, t('snooze.prompt', lang), snoozeOptionsKeyboard(deliveryId, lang));
    return true;
  }

  // The offset is attacker-controlled, so it is checked against the offered set
  // rather than trusted: a 400-day snooze would be a valid-looking message the
  // user never asked for.
  const days = data.days;
  if (days === undefined || !isSnoozeOption(days)) {
    await ackCallback(ctx);
    await editOrSend(ctx, t('errors.invalidInput', lang));
    return true;
  }

  await ackCallback(ctx);
  await services.reminders.snooze({
    userId: ctx.state.user.id,
    ...target,
    days,
  });

  await editOrSend(
    ctx,
    t('snooze.done', lang, {
      when: days === 1 ? t('countdown.tomorrow', lang) : t('countdown.inDays', lang, { count: toPersianDigits(days) }),
    }),
    snoozeOptionsKeyboard(deliveryId, lang),
  );

  return true;
}
