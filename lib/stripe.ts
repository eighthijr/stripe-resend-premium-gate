import Stripe from "stripe";
import { getEnv } from "@/lib/env";
import { Tier } from "@/types/subscription";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeClient) return stripeClient;

  const env = getEnv();
  stripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2024-06-20",
  });

  return stripeClient;
}

export function derivePriceIdForTier(tier: Tier): string {
  if (tier === "free") {
    throw new Error("Free tier does not map to a Stripe checkout price.");
  }

  const env = getEnv();
  const tierToPrice: Readonly<Record<Exclude<Tier, "free">, string>> = {
    pro: env.STRIPE_PRICE_PRO,
    fintech: env.STRIPE_PRICE_FINTECH,
  };

  return tierToPrice[tier];
}
