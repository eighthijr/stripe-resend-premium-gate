import { NextRequest, NextResponse } from "next/server";
import { requireTier, TierAccessError } from "@/lib/subscription/gate";
import { getProfileSubscriptionState } from "@/lib/subscription/service";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const profileId = req.headers.get("x-profile-id");
    if (!profileId) return NextResponse.json({ error: "Missing x-profile-id header" }, { status: 400 });

    const profile = await getProfileSubscriptionState(profileId);
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    requireTier(profile, "pro");
    return NextResponse.json({ ok: true, analytics: { mrr: 12450, churnRate: 0.02 } });
  } catch (error) {
    if (error instanceof TierAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
