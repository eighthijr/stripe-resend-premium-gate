import Link from "next/link";
import { getProfileSubscriptionState } from "@/lib/subscription/service";

export const dynamic = "force-dynamic";

function tierFeatures(plan: string): string[] {
  if (plan === "fintech") return ["Compliance report API", "Risk analytics API", "Priority queue"];
  if (plan === "pro") return ["Pro analytics API", "Team dashboard"];
  return ["Basic dashboard"];
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { profileId?: string };
}) {
  const profileId = searchParams?.profileId ?? "00000000-0000-0000-0000-000000000000";

  let profile = null;
  try {
    profile = await getProfileSubscriptionState(profileId);
  } catch {
    profile = null;
  }

  return (
    <main>
      <h1>Dashboard</h1>
      <p>Profile: {profileId}</p>
      <p>Current tier: {profile?.plan ?? "free (default)"}</p>
      <h2>Features enabled</h2>
      <ul>
        {tierFeatures(profile?.plan ?? "free").map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>

      <h2>Protected endpoints</h2>
      <ul>
        <li>
          <Link href="/api/dashboard/pro/analytics">/api/dashboard/pro/analytics</Link>
        </li>
        <li>
          <Link href="/api/dashboard/fintech/report">/api/dashboard/fintech/report</Link>
        </li>
      </ul>
    </main>
  );
}
