import { PoolClient } from "pg";
import { env } from "@/lib/env";
import { queueEmailJob } from "@/lib/email/outbox";
import { withSerializableTransaction } from "@/lib/db";
import { applySubscriptionTransition } from "@/lib/subscription/transition";
import { StripeSubscriptionEvent, SubscriptionState } from "@/types/subscription";

interface ProcessResult {
  replay: boolean;
}

function mapTemplate(status: string): "subscription_activated" | "subscription_canceled" | "subscription_updated" {
  if (status === "active" || status === "trialing") return "subscription_activated";
  if (status === "canceled" || status === "unpaid") return "subscription_canceled";
  return "subscription_updated";
}

export async function processStripeSubscriptionEvent(event: StripeSubscriptionEvent): Promise<ProcessResult> {
  return withSerializableTransaction(async (client) => {
    const inserted = await insertStripeEvent(client, event);
    if (!inserted) {
      return { replay: true };
    }

    const current = await getOrCreateProfileForUpdate(client, event.profileId);
    const transition = applySubscriptionTransition(current, event, {
      proPriceId: env.STRIPE_PRICE_PRO,
      fintechPriceId: env.STRIPE_PRICE_FINTECH,
    });

    if (transition.replay) {
      return { replay: true };
    }

    await persistProfile(client, transition.nextState);

    await queueEmailJob(client, {
      profileId: event.profileId,
      stripeEventId: event.stripeEventId,
      template: mapTemplate(transition.nextState.subscriptionStatus),
      payload: {
        to: `profile-${event.profileId}@example.com`,
        subject: `Subscription update: ${transition.nextState.plan}`,
        html: `<p>Your plan is now <strong>${transition.nextState.plan}</strong>.</p>`,
      },
    });

    return { replay: false };
  });
}

async function insertStripeEvent(client: PoolClient, event: StripeSubscriptionEvent): Promise<boolean> {
  const result = await client.query(
    `
      INSERT INTO stripe_events (
        id, profile_id, stripe_created, type, payload
      ) VALUES ($1, $2, to_timestamp($3), $4, $5::jsonb)
      ON CONFLICT (id) DO NOTHING
    `,
    [event.stripeEventId, event.profileId, event.stripeCreated, event.eventType, JSON.stringify(event)],
  );
  return result.rowCount === 1;
}

async function getOrCreateProfileForUpdate(client: PoolClient, profileId: string): Promise<SubscriptionState> {
  await client.query(
    `
      INSERT INTO profiles (id)
      VALUES ($1)
      ON CONFLICT (id) DO NOTHING
    `,
    [profileId],
  );

  const row = await client.query<{
    id: string;
    plan: SubscriptionState["plan"];
    subscription_status: SubscriptionState["subscriptionStatus"];
    stripe_subscription_id: string | null;
    stripe_price_id: string | null;
    current_period_end: Date | null;
    watermark: number;
    last_stripe_event_id: string | null;
    version: number;
  }>(
    `
      SELECT id, plan, subscription_status, stripe_subscription_id, stripe_price_id,
             current_period_end, watermark, last_stripe_event_id, version
      FROM profiles
      WHERE id = $1
      FOR UPDATE
    `,
    [profileId],
  );

  const profile = row.rows[0];
  return {
    profileId: profile.id,
    plan: profile.plan,
    subscriptionStatus: profile.subscription_status,
    stripeSubscriptionId: profile.stripe_subscription_id,
    stripePriceId: profile.stripe_price_id,
    currentPeriodEnd: profile.current_period_end,
    watermark: profile.watermark,
    lastStripeEventId: profile.last_stripe_event_id,
    version: profile.version,
  };
}

async function persistProfile(client: PoolClient, profile: SubscriptionState): Promise<void> {
  await client.query(
    `
      UPDATE profiles
      SET
        plan = $2,
        subscription_status = $3,
        stripe_subscription_id = $4,
        stripe_price_id = $5,
        current_period_end = $6,
        watermark = $7,
        last_stripe_event_id = $8,
        version = $9,
        updated_at = NOW()
      WHERE id = $1
    `,
    [
      profile.profileId,
      profile.plan,
      profile.subscriptionStatus,
      profile.stripeSubscriptionId,
      profile.stripePriceId,
      profile.currentPeriodEnd,
      profile.watermark,
      profile.lastStripeEventId,
      profile.version,
    ],
  );
}
