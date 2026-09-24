import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

const allowedEvents = new Set([
  "affiliate_click",
  "cta_click",
  "sponsor_click",
  "cpl_submit",
]);

export async function GET(req: Request) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  try {
    const url = new URL(req.url);
    const days = Math.min(Math.max(Number(url.searchParams.get("days") ?? "30"), 1), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [events, byEvent, byProduct] = await Promise.all([
      db.analyticsEvent.findMany({
        where: { createdAt: { gte: since } },
        select: { event: true, productSlug: true, placement: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 10_000,
      }),
      db.analyticsEvent.groupBy({
        by: ["event"],
        where: { createdAt: { gte: since }, event: { in: [...allowedEvents] } },
        _count: { _all: true },
        orderBy: { _count: { event: "desc" } },
      }),
      db.analyticsEvent.groupBy({
        by: ["productSlug"],
        where: { createdAt: { gte: since }, productSlug: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { productSlug: "desc" } },
        take: 50,
      }),
    ]);

    return NextResponse.json({
      ok: true,
      windowDays: days,
      totalEvents: events.length,
      byEvent: byEvent.map((row) => ({ event: row.event, count: row._count._all })),
      byProduct: byProduct.map((row) => ({ productSlug: row.productSlug, count: row._count._all })),
      recent: events,
    });
  } catch (error) {
    console.error("[admin/analytics]", error);
    return NextResponse.json({ error: "Analytics query failed" }, { status: 500 });
  }
}
