import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

const allowedEvents = new Set(["affiliate_click", "cta_click", "sponsor_click", "cpl_submit"]);

export async function GET(req: Request) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  try {
    const url = new URL(req.url);
    const rawDays = Number(url.searchParams.get("days") ?? "30");
    const days = Math.min(Math.max(Number.isFinite(rawDays) ? Math.floor(rawDays) : 30, 1), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const where = { createdAt: { gte: since } };
    const [totalEvents, byEvent, byProduct, recent] = await Promise.all([
      db.analyticsEvent.count({ where }),
      db.analyticsEvent.groupBy({ by: ["event"], where: { ...where, event: { in: [...allowedEvents] } }, _count: { _all: true }, orderBy: { _count: { event: "desc" } } }),
      db.analyticsEvent.groupBy({ by: ["productSlug"], where: { ...where, productSlug: { not: null } }, _count: { _all: true }, orderBy: { _count: { productSlug: "desc" } }, take: 50 }),
      db.analyticsEvent.findMany({ where, select: { event: true, productSlug: true, placement: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    ]);
    return NextResponse.json({ ok: true, windowDays: days, totalEvents, byEvent: byEvent.map((row) => ({ event: row.event, count: row._count._all })), byProduct: byProduct.map((row) => ({ productSlug: row.productSlug, count: row._count._all })), recent });
  } catch {
    return NextResponse.json({ error: "Analytics query failed" }, { status: 500 });
  }
}
