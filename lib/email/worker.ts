import { PoolClient } from "pg";
import { withSerializableTransaction } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/email/resend";

interface EmailJobRow {
  id: string;
  profile_id: string;
  payload: { to: string; subject: string; html: string };
  retry_count: number;
}

export async function processEmailOutboxBatch(limit = 25): Promise<number> {
  return withSerializableTransaction(async (client) => {
    const jobs = await lockPendingJobs(client, limit);
    for (const job of jobs.rows) {
      await processOne(client, job);
    }
    return jobs.rowCount;
  });
}

async function lockPendingJobs(client: PoolClient, limit: number) {
  return client.query<EmailJobRow>(
    `
      SELECT id, profile_id, payload, retry_count
      FROM email_jobs
      WHERE status = 'pending'
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT $1
    `,
    [limit],
  );
}

async function processOne(client: PoolClient, job: EmailJobRow): Promise<void> {
  try {
    await sendTransactionalEmail(job.payload);
    await client.query(`UPDATE email_jobs SET status = 'sent', sent_at = NOW() WHERE id = $1`, [job.id]);
  } catch (error) {
    const retries = job.retry_count + 1;
    if (retries >= 3) {
      await client.query(
        `UPDATE email_jobs SET status = 'dead_letter', retry_count = $2, last_error = $3 WHERE id = $1`,
        [job.id, retries, error instanceof Error ? error.message : 'unknown_error'],
      );
      return;
    }

    await client.query(
      `UPDATE email_jobs SET retry_count = $2, last_error = $3 WHERE id = $1`,
      [job.id, retries, error instanceof Error ? error.message : 'unknown_error'],
    );
  }
}
