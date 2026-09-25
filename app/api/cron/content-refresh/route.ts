import { NextResponse } from "next/server";
import { ensureRefreshTasks, getDueRefreshes } from "@/lib/freshness";
import { requireCronSecret } from "@/lib/cron-auth";

function boundedNumber(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), min), max);
}

export async function GET(req: Request) {
  if (!requireCronSecret(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  try {
    const url = new URL(req.url);
    const limit = boundedNumber(url.searchParams.get("limit"), 25, 1, 100);
    const refreshAfterDays = boundedNumber(url.searchParams.get("refreshAfterDays"), 90, 1, 3650);
    const created = await ensureRefreshTasks(new Date(), refreshAfterDays, limit);
    const due = await getDueRefreshes(new Date(), limit);
    return NextResponse.json({
      ok: true,
      mode: "queue-only",
      createdCount: created.length,
      dueCount: due.length,
      due: due.map((item) => ({ id: item.id, productId: item.productId, productSlug: item.productSlug, productName: item.productName, dueAt: item.dueAt, reason: item.reason })),
      note: "This endpoint queues refresh work only; it does not scrape vendors or publish pricing changes.",
    });
  } catch (error) {
    console.error("[cron/content-refresh]", error);
    return NextResponse.json({ error: "Refresh queue failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
