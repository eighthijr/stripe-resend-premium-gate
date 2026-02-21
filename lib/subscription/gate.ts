import { SubscriptionState, Tier } from "@/types/subscription";

const ORDER: Record<Tier, number> = { free: 0, pro: 1, fintech: 2 };

export class TierAccessError extends Error {
  statusCode = 403;
}

export function requireTier(profile: SubscriptionState, requiredTier: Tier): void {
  const active = profile.subscriptionStatus === "active";
  const notExpired = profile.currentPeriodEnd !== null && profile.currentPeriodEnd.getTime() > Date.now();
  const allowedPlan = ORDER[profile.plan] >= ORDER[requiredTier];

  if (!(active && notExpired && allowedPlan)) {
    throw new TierAccessError("Forbidden: subscription tier requirement not met.");
  }
}
