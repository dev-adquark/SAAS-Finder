import { db } from "@/lib/db";

export const DEFAULT_REFRESH_AFTER_DAYS = 90;
export const DEFAULT_REFRESH_BATCH_SIZE = 25;

export type RefreshQueueItem = {
  id: string;
  productId: string;
  productSlug: string;
  productName: string;
  dueAt: Date;
  reason: string;
};

export async function getDueRefreshes(
  now = new Date(),
  limit = DEFAULT_REFRESH_BATCH_SIZE,
): Promise<RefreshQueueItem[]> {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 100);

  const rows = await db.contentRefresh.findMany({
    where: {
      dueAt: { lte: now },
      completedAt: null,
      product: { status: "PUBLISHED" },
    },
    include: {
      product: { select: { slug: true, name: true } },
    },
    orderBy: [{ dueAt: "asc" }, { id: "asc" }],
    take: safeLimit,
  });

  return rows.map((row) => ({
    id: row.id,
    productId: row.productId,
    productSlug: row.product.slug,
    productName: row.product.name,
    dueAt: row.dueAt,
    reason: row.reason,
  }));
}

export async function ensureRefreshTasks(
  now = new Date(),
  refreshAfterDays = DEFAULT_REFRESH_AFTER_DAYS,
  limit = DEFAULT_REFRESH_BATCH_SIZE,
) {
  const safeDays = Math.max(Math.floor(refreshAfterDays), 1);
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 100);
  const cutoff = new Date(now.getTime() - safeDays * 24 * 60 * 60 * 1000);

  const products = await db.product.findMany({
    where: { status: "PUBLISHED" },
    select: {
      id: true,
      slug: true,
      name: true,
      snapshots: {
        orderBy: { capturedAt: "desc" },
        take: 1,
        select: { capturedAt: true },
      },
      refreshes: {
        where: { completedAt: null },
        orderBy: { dueAt: "asc" },
        take: 1,
        select: { id: true },
      },
    },
    orderBy: { updatedAt: "asc" },
  });

  const staleProducts = products
    .filter((product) => {
      if (product.refreshes.length > 0) return false;
      const latestSnapshot = product.snapshots[0]?.capturedAt;
      return !latestSnapshot || latestSnapshot <= cutoff;
    })
    .slice(0, safeLimit);

  const created: Array<{ id: string; productId: string; dueAt: Date }> = [];

  for (const product of staleProducts) {
    const latestSnapshot = product.snapshots[0]?.capturedAt;
    const dueAt = latestSnapshot ?? cutoff;
    const refresh = await db.contentRefresh.create({
      data: {
        productId: product.id,
        dueAt,
        reason: latestSnapshot
          ? "Pricing/content snapshot is older than the freshness threshold."
          : "Published product has no pricing/content snapshot.",
      },
      select: { id: true, productId: true, dueAt: true },
    });
    created.push(refresh);
  }

  return created;
}
