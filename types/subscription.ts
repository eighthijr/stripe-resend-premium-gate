export const CANONICAL_STATUSES = [
  "incomplete",
  "incomplete_expired",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
] as const;

export type CanonicalSubscriptionStatus = (typeof CANONICAL_STATUSES)[number];

export const TIERS = ["free", "pro", "fintech"] as const;
export type Tier = (typeof TIERS)[number];

export interface SubscriptionState {
  profileId: string;
  plan: Tier;
  subscriptionStatus: CanonicalSubscriptionStatus;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  currentPeriodEnd: Date | null;
  watermark: number;
  lastStripeEventId: string | null;
  version: number;
}

export interface StripeSubscriptionEvent {
  profileId: string;
  stripeEventId: string;
  stripeCreated: number;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  stripePriceId: string | null;
  stripeStatus: string;
  currentPeriodEnd: Date | null;
  eventType: string;
}
