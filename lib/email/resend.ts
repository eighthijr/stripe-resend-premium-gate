import { Resend } from "resend";
import { env } from "@/lib/env";

const client = new Resend(env.RESEND_API_KEY);

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export async function sendTransactionalEmail(input: SendEmailInput): Promise<void> {
  await client.emails.send({
    from: "billing@updates.example.com",
    to: input.to,
    subject: input.subject,
    html: input.html,
  });
}
