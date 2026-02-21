import Stripe from "stripe";
import { env } from "@/lib/env";
import { Tier } from "@/types/subscription";

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

const TIER_TO_PRICE: Readonly<Record<Exclude<Tier, "free">, string>> = {
  pro: env.STRIPE_PRICE_PRO,
  fintech: env.STRIPE_PRICE_FINTECH,
};

export function derivePriceIdForTier(tier: Tier): string {
  if (tier === "free") {
    throw new Error("Free tier does not map to a Stripe checkout price.");
  }
  return TIER_TO_PRICE[tier];
}

export { stripe };
