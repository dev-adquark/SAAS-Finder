// Read models for the admin Data Sync / Data Quality screens. Every figure comes from the database.
import { db } from "@/lib/db";
import { apifyConfigured } from "@/lib/sync/apify";
import { isoWeekKey, nextScheduledRun } from "@/lib/sync/run";

export type ProductSyncState = "verified" | "partial" | "review" | "failed" | "never";
export const SYNC_STATE_LABEL: Record<ProductSyncState, string> = { verified: "✓ Fully verified", partial: "◐ Partially verified", review: "! Needs review", failed: "× Sync failed", never: "Not synced yet" };

type RunStats = Partial<Record<"productsChecked" | "sourcesChecked" | "factsChecked" | "pricesChecked" | "claimsReverified" | "changesDetected" | "sourcesUnavailable" | "validationFailures" | "linksDiscovered", number>>;

export async function productSyncStates(): Promise<Map<string, { state: ProductSyncState; pending: number; lastSyncedAt: Date | null; ok: number; pages: number }>> {
  const [products, pending, pages] = await Promise.all([
    db.product.findMany({ select: { id: true } }),
    db.dataChange.groupBy({ by: ["productId"], where: { status: "PENDING" }, _count: { _all: true } }),
    // Latest processed phase-1 page per (product, url) tells us the current state of each source.
    db.syncPage.findMany({ where: { phase: 1, processedAt: { not: null } }, orderBy: { processedAt: "desc" }, select: { productId: true, url: true, status: true, runId: true, processedAt: true, outcome: true }, take: 5000 }),
  ]);
  const pend = new Map(pending.map((p) => [p.productId, p._count._all]));
  const out = new Map<string, { state: ProductSyncState; pending: number; lastSyncedAt: Date | null; ok: number; pages: number }>();
  for (const { id } of products) {
    const mine = pages.filter((p) => p.productId === id);
    if (!mine.length) {
      out.set(id, { state: pend.get(id) ? "review" : "never", pending: pend.get(id) ?? 0, lastSyncedAt: null, ok: 0, pages: 0 });
      continue;
    }
    const latestRun = mine[0].runId;
    const latest = mine.filter((p) => p.runId === latestRun);
    const ok = latest.filter((p) => p.status === "OK").length;
    const unconfirmed = latest.some((p) => {
      const o = (p.outcome ?? {}) as { checked?: { sources: number; facts: number; plans: number }; reverified?: { sources: string[]; facts: string[]; plans: string[] } };
      if (!o.checked || !o.reverified) return false;
      return o.checked.sources + o.checked.facts + o.checked.plans > o.reverified.sources.length + o.reverified.facts.length + o.reverified.plans.length;
    });
    const n = pend.get(id) ?? 0;
    const state: ProductSyncState = n ? "review" : ok === 0 ? "failed" : ok < latest.length || unconfirmed ? "partial" : "verified";
    out.set(id, { state, pending: n, lastSyncedAt: mine[0].processedAt, ok, pages: latest.length });
  }
  return out;
}

export async function syncDashboard(now = new Date()) {
  const [runs, pendingChanges, history] = await Promise.all([
    db.syncRun.findMany({ orderBy: { startedAt: "desc" }, take: 12 }),
    db.dataChange.findMany({ where: { status: "PENDING" }, include: { product: { select: { id: true, name: true } } }, orderBy: [{ detectedAt: "desc" }], take: 200 }),
    db.dataChange.findMany({ where: { status: { not: "PENDING" } }, include: { product: { select: { id: true, name: true } } }, orderBy: [{ reviewedAt: "desc" }], take: 60 }),
  ]);
  const last = runs[0] ?? null;
  const lastFinished = runs.find((r) => r.finishedAt) ?? null;
  const decided = last ? await db.dataChange.groupBy({ by: ["status"], where: { runId: last.id }, _count: { _all: true } }) : [];
  const byStatus = Object.fromEntries(decided.map((d) => [d.status, d._count._all])) as Record<string, number>;
  const failures = last
    ? await db.syncPage.findMany({ where: { runId: last.id, status: { not: "OK" }, processedAt: { not: null } }, include: { product: { select: { id: true, name: true } } }, orderBy: [{ productId: "asc" }], take: 200 })
    : [];
  const stats = ((last?.stats ?? {}) as RunStats);
  const thisWeek = await db.syncRun.findUnique({ where: { weekKey: isoWeekKey(now) }, select: { status: true, attempts: true } });
  const doneThisWeek = !!thisWeek && (thisWeek.status === "COMPLETED" || thisWeek.status === "PARTIAL" || thisWeek.attempts >= 3);
  return {
    configured: apifyConfigured(),
    nextRun: nextScheduledRun(now, doneThisWeek),
    last,
    lastFinished,
    runs,
    summary: {
      productsChecked: stats.productsChecked ?? 0,
      sourcesChecked: stats.sourcesChecked ?? 0,
      factsChecked: stats.factsChecked ?? 0,
      pricesChecked: stats.pricesChecked ?? 0,
      claimsReverified: stats.claimsReverified ?? 0,
      changesDetected: stats.changesDetected ?? 0,
      changesAccepted: byStatus.ACCEPTED ?? 0,
      changesRejected: (byStatus.REJECTED ?? 0) + (byStatus.KEPT ?? 0),
      sourcesUnavailable: stats.sourcesUnavailable ?? 0,
      validationFailures: stats.validationFailures ?? 0,
      linksDiscovered: stats.linksDiscovered ?? 0,
      durationMs: last?.durationMs ?? null,
    },
    pendingChanges,
    history,
    failures,
  };
}
