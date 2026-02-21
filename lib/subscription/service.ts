import { query } from "@/lib/db";
import { SubscriptionState } from "@/types/subscription";

export async function getProfileSubscriptionState(profileId: string): Promise<SubscriptionState | null> {
  const result = await query<{
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
    `,
    [profileId],
  );

  if (result.rowCount !== 1) return null;
  const row = result.rows[0];

  return {
    profileId: row.id,
    plan: row.plan,
    subscriptionStatus: row.subscription_status,
    stripeSubscriptionId: row.stripe_subscription_id,
    stripePriceId: row.stripe_price_id,
    currentPeriodEnd: row.current_period_end,
    watermark: row.watermark,
    lastStripeEventId: row.last_stripe_event_id,
    version: row.version,
  };
}
