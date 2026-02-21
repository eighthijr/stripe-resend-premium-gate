export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getStripe, derivePriceIdForTier } from "@/lib/stripe";
import { Tier } from "@/types/subscription";
import { getEnv } from "@/lib/env";

interface CheckoutBody {
  tier: Tier;
  profileId: string;
  customerId?: string;
}

function assertPaidTier(input: string): asserts input is Exclude<Tier, "free"> {
  if (input !== "pro" && input !== "fintech") {
    throw new Error("Invalid paid tier requested.");
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json()) as CheckoutBody;
  assertPaidTier(body.tier);

  const priceId = derivePriceIdForTier(body.tier);

  const env = getEnv();
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${env.NEXT_PUBLIC_APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.NEXT_PUBLIC_APP_URL}/billing/cancel`,
    metadata: { profileId: body.profileId, tier: body.tier },
    customer: body.customerId,
  });

  return NextResponse.json({ checkoutUrl: session.url });
}
