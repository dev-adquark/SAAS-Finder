import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/admin/session";
import { webhookSignature } from "@/lib/sync/run";
import { advanceInBackground } from "@/lib/sync/schedule";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Apify calls this when a crawl finishes. The payload is not trusted: it only triggers a status check
// of runs we started, which is idempotent and lock-protected.
export async function POST(req: Request) {
  const expected = webhookSignature();
  const got = req.headers.get("x-sync-signature");
  if (!expected || !got || !safeEqual(got, expected)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  advanceInBackground();
  return NextResponse.json({ ok: true }, { status: 202 });
}
