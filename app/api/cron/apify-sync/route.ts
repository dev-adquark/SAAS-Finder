import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron-auth";
import { boundedInt } from "@/lib/validation";
import { apifyConfigured } from "@/lib/sync/apify";
import { startSync, SyncError } from "@/lib/sync/run";
import { advanceInBackground } from "@/lib/sync/schedule";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Daily tick (vercel.json). Starts the current ISO week's sync once, retries a failed week up to 3
// times, and advances any run in progress. mode=advance only continues processing.
export async function GET(req: Request) {
  if (!requireCronSecret(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  if (!apifyConfigured()) return NextResponse.json({ ok: false, configured: false, note: "APIFY_API_TOKEN is not set; automated research is disabled." }, { status: 200 });
  const url = new URL(req.url);
  const hop = boundedInt(url.searchParams.get("hop"), 0, 0, 1000);
  if (url.searchParams.get("mode") === "advance") {
    advanceInBackground(hop);
    return NextResponse.json({ ok: true, mode: "advance" }, { status: 202 });
  }
  try {
    const r = await startSync({ trigger: "SCHEDULED" });
    advanceInBackground();
    return NextResponse.json({ ok: true, started: r.started, runId: r.run?.id ?? null, status: r.run?.status ?? null, reason: r.reason ?? null });
  } catch (e) {
    if (e instanceof SyncError) return NextResponse.json({ ok: false, error: e.message }, { status: 409 });
    console.error("[cron/apify-sync]", e instanceof Error ? e.name : "error");
    return NextResponse.json({ error: "Sync could not start" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
