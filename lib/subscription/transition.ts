import {
  CANONICAL_STATUSES,
  CanonicalSubscriptionStatus,
  StripeSubscriptionEvent,
  SubscriptionState,
  Tier,
} from "@/types/subscription";

const ACTIVE_STATUSES: ReadonlySet<CanonicalSubscriptionStatus> = new Set(["active", "trialing"]);

export interface TransitionResult {
  changed: boolean;
  replay: boolean;
  nextState: SubscriptionState;
}

function normalizeStripeStatus(raw: string): CanonicalSubscriptionStatus {
  if ((CANONICAL_STATUSES as readonly string[]).includes(raw)) {
    return raw as CanonicalSubscriptionStatus;
  }
  return "incomplete";
}

function inferTier(status: CanonicalSubscriptionStatus, stripePriceId: string | null, proPriceId: string, fintechPriceId: string): Tier {
  if (!ACTIVE_STATUSES.has(status)) return "free";
  if (stripePriceId === fintechPriceId) return "fintech";
  if (stripePriceId === proPriceId) return "pro";
  return "free";
}

export function applySubscriptionTransition(
  current: SubscriptionState,
  event: StripeSubscriptionEvent,
  pricingConfig: { proPriceId: string; fintechPriceId: string },
): TransitionResult {
  const outOfOrder = event.stripeCreated < current.watermark;
  const sameWatermarkOlderEvent =
    event.stripeCreated === current.watermark &&
    current.lastStripeEventId !== null &&
    event.stripeEventId <= current.lastStripeEventId;

  if (outOfOrder || sameWatermarkOlderEvent) {
    return { changed: false, replay: true, nextState: current };
  }

  const normalizedStatus = normalizeStripeStatus(event.stripeStatus);
  const nextPlan = inferTier(normalizedStatus, event.stripePriceId, pricingConfig.proPriceId, pricingConfig.fintechPriceId);

  const nextState: SubscriptionState = {
    ...current,
    stripeSubscriptionId: event.stripeSubscriptionId,
    stripePriceId: event.stripePriceId,
    subscriptionStatus: normalizedStatus,
    currentPeriodEnd: event.currentPeriodEnd,
    plan: nextPlan,
    watermark: event.stripeCreated,
    lastStripeEventId: event.stripeEventId,
    version: current.version + 1,
  };

  const changed =
    nextState.plan !== current.plan ||
    nextState.subscriptionStatus !== current.subscriptionStatus ||
    nextState.currentPeriodEnd?.toISOString() !== current.currentPeriodEnd?.toISOString() ||
    nextState.stripePriceId !== current.stripePriceId ||
    nextState.stripeSubscriptionId !== current.stripeSubscriptionId;

  return { changed, replay: false, nextState };
}
