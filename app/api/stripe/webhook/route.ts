export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getEnv } from "@/lib/env";
import { processStripeSubscriptionEvent } from "@/lib/subscription/processor";
import { StripeSubscriptionEvent } from "@/types/subscription";

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

function toDomainEvent(event: Stripe.Event): StripeSubscriptionEvent | null {
  if (!SUBSCRIPTION_EVENTS.has(event.type)) return null;

  const subscription = event.data.object as Stripe.Subscription;
  const profileId = subscription.metadata.profileId;
  if (!profileId) {
    throw new Error("Missing profileId in Stripe subscription metadata.");
  }

  const firstItem = subscription.items.data[0];

  return {
    profileId,
    stripeEventId: event.id,
    stripeCreated: event.created,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? "",
    stripePriceId: firstItem?.price.id ?? null,
    stripeStatus: subscription.status,
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    eventType: event.type,
  };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;

  try {
    const env = getEnv();
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 400 });
  }

  const domainEvent = toDomainEvent(event);
  if (!domainEvent) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  await processStripeSubscriptionEvent(domainEvent);
  return NextResponse.json({ ok: true });
}
