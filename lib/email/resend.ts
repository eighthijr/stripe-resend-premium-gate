import { Resend } from "resend";
import { getEnv } from "@/lib/env";

function getResendClient(): Resend {
  const env = getEnv();
  return new Resend(env.RESEND_API_KEY);
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export async function sendTransactionalEmail(input: SendEmailInput): Promise<void> {
  const client = getResendClient();

  await client.emails.send({
    from: "billing@updates.example.com",
    to: input.to,
    subject: input.subject,
    html: input.html,
  });
}
