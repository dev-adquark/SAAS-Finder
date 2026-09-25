import { adminRoute } from "@/lib/admin/api";
import { analyticsReport, analyticsWindow } from "@/lib/admin/services";

// GET /api/admin/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD (legacy ?days=N also supported)
export const GET = adminRoute(async (req) => {
  const url = new URL(req.url);
  const days = Number(url.searchParams.get("days"));
  const from = Number.isFinite(days) && days >= 1 ? new Date(Date.now() - Math.min(Math.floor(days), 366) * 86_400_000).toISOString() : url.searchParams.get("from");
  const w = analyticsWindow(from, url.searchParams.get("to"));
  return { ok: true, ...(await analyticsReport(w.from, w.to)) };
});
