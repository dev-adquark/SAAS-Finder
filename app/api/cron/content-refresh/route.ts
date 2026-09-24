import { NextResponse } from "next/server";
import { ensureRefreshTasks, getDueRefreshes } from "@/lib/freshness";
import { requireCronSecret } from "@/lib/cron-auth";

export async function GET(req: Request) {
  if (!requireCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Database is not configured" },
      { status: 503 },
    );
  }

  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") ?? "25");
    const refreshAfterDays = Number(url.searchParams.get("refreshAfterDays") ?? "90");
    const created = await ensureRefreshTasks(
      new Date(),
      Number.isFinite(refreshAfterDays) ? refreshAfterDays : 90,
      Number.isFinite(limit) ? limit : 25,
    );
    const due = await getDueRefreshes(new Date(), Number.isFinite(limit) ? limit : 25);

    return NextResponse.json({
      ok: true,
      mode: "queue-only",
      createdCount: created.length,
      dueCount: due.length,
      due: due.map((item) => ({
        id: item.id,
        productId: item.productId,
        productSlug: item.productSlug,
        productName: item.productName,
        dueAt: item.dueAt,
        reason: item.reason,
      })),
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
