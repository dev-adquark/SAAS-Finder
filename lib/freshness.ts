import { db } from "@/lib/db";
import { DEFAULT_REFRESH_AFTER_DAYS, lastCheckedAt, needsRefresh, refreshTargetDays } from "@/lib/freshness-rules";

export { DEFAULT_REFRESH_AFTER_DAYS };
export const DEFAULT_REFRESH_BATCH_SIZE = 25;

export type RefreshQueueItem = {
  id: string;
  productId: string;
  productSlug: string;
  productName: string;
  dueAt: Date;
  reason: string;
};

function safeLimit(value: number) {
  return Math.min(Math.max(Math.floor(Number.isFinite(value) ? value : DEFAULT_REFRESH_BATCH_SIZE), 1), 100);
}

export async function getDueRefreshes(now = new Date(), limit = DEFAULT_REFRESH_BATCH_SIZE): Promise<RefreshQueueItem[]> {
  const rows = await db.contentRefresh.findMany({
    where: { dueAt: { lte: now }, completedAt: null, product: { status: "PUBLISHED" } },
    include: { product: { select: { slug: true, name: true } } },
    orderBy: [{ dueAt: "asc" }, { id: "asc" }],
    take: safeLimit(limit),
  });
  return rows.map((row) => ({ id: row.id, productId: row.productId, productSlug: row.product.slug, productName: row.product.name, dueAt: row.dueAt, reason: row.reason }));
}

/**
 * Queues a refresh task for every published product whose pricing has never been verified or whose
 * last check is older than its target (per-product override, default 90 days). Queue-only: it never
 * scrapes vendors or changes editorial pricing.
 * `refreshAfterDays` overrides the default target for products without a manual override.
 */
export async function ensureRefreshTasks(now = new Date(), refreshAfterDays = DEFAULT_REFRESH_AFTER_DAYS, limit = DEFAULT_REFRESH_BATCH_SIZE) {
  const defaultDays = refreshTargetDays(Math.floor(Number.isFinite(refreshAfterDays) ? refreshAfterDays : DEFAULT_REFRESH_AFTER_DAYS));
  const batchSize = safeLimit(limit);
  const products = await db.product.findMany({
    where: { status: "PUBLISHED", refreshes: { none: { completedAt: null } } },
    select: {
      id: true,
      pricingCheckedAt: true,
      refreshIntervalDays: true,
      snapshots: { where: { status: "VERIFIED" }, orderBy: { capturedAt: "desc" }, take: 1, select: { capturedAt: true } },
    },
    orderBy: { updatedAt: "asc" },
    take: 500,
  });
  const stale = products
    .map((p) => ({ p, checked: lastCheckedAt(p.pricingCheckedAt, p.snapshots[0]?.capturedAt), days: p.refreshIntervalDays ? refreshTargetDays(p.refreshIntervalDays) : defaultDays }))
    .filter(({ checked, days }) => needsRefresh(checked, days, now))
    .slice(0, batchSize);
  const created: Array<{ id: string; productId: string; dueAt: Date }> = [];
  for (const { p, checked, days } of stale) {
    const dueAt = checked ? new Date(checked.getTime() + days * 24 * 60 * 60 * 1000) : now;
    const refresh = await db.contentRefresh.create({
      data: { productId: p.id, dueAt, reason: checked ? `Pricing was last checked more than ${days} days ago.` : "Published product has no verified pricing check." },
      select: { id: true, productId: true, dueAt: true },
    });
    created.push(refresh);
  }
  return created;
}
