import { processEmailOutboxBatch } from "@/lib/email/worker";

async function main(): Promise<void> {
  const processed = await processEmailOutboxBatch(50);
  console.info(`Processed ${processed} email jobs.`);
}

main().catch((error: unknown) => {
  console.error("Email worker failed", error);
  process.exitCode = 1;
});
