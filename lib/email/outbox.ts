import { DbExecutor } from "@/lib/db";

export interface QueueEmailJobInput {
  profileId: string;
  stripeEventId: string;
  template: "subscription_activated" | "subscription_canceled" | "subscription_updated";
  payload: Record<string, unknown>;
}

export async function queueEmailJob(executor: DbExecutor, input: QueueEmailJobInput): Promise<void> {
  await executor.query(
    `
      INSERT INTO email_jobs (profile_id, stripe_event_id, template, payload, status)
      VALUES ($1, $2, $3, $4::jsonb, 'pending')
      ON CONFLICT (profile_id, stripe_event_id, template)
      DO NOTHING
    `,
    [input.profileId, input.stripeEventId, input.template, JSON.stringify(input.payload)],
  );
}
