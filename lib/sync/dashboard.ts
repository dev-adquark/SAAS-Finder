// Read models for the admin Data Sync / Data Quality screens. Every figure comes from the database.
import { db } from "@/lib/db";
import { apifyConfigured } from "@/lib/sync/apify";
import { cycleKey, nextScheduledRun } from "@/lib/sync/run";

export type ProductSyncState = "verified" | "partial" | "review" | "failed" | "never";
export const SYNC_STATE_LABEL: Record<ProductSyncState, string> = { verified: "✓ Fully verified", partial: "◐ Partially verified", review: "! Needs review", failed: "× Sync failed", never: "Not synced yet" };

type RunStats = Partial<Record<
  | "productsChecked" | "sourcesChecked" | "factsChecked" | "pricesChecked" | "claimsReverified" | "changesDetected" | "sourcesUnavailable" | "validationFailures" | "linksDiscovered"
  | "productsInScope" | "productsAdded" | "productsUpdated" | "productsUnchanged" | "productsRetiredFlagged" | "officialPagesOk" | "g2ListingsOk" | "g2NotListed" | "g2Unavailable"
  | "changesApplied" | "changesPending" | "autoApplyFailed" | "itemRetries" | "g2Scanned" | "g2Matched" | "g2Invalid",
  number
>> & {
  errors?: { source: string; message: string; at: string }[];
  actorRuns?: { phase: number; actor: string; runId: string; status: string }[];
  retiredFlagged?: string[];
};

export const runStats = (r: { stats: unknown }) => (r.stats ?? {}) as RunStats;

/** Human label for the sync lifecycle state of a run. */
export function runStateLabel(r: { status: string; phase: number; apifyRunId: string | null; cursor: number }): string {
  if (r.status === "RUNNING") return r.phase >= 3 ? `Running · fetching G2 data (phase ${r.phase})` : `Running · crawling official websites (phase ${r.phase})`;
  if (r.status === "PROCESSING") return `Validating, matching and updating (${r.cursor} records processed, phase ${r.phase})`;
  return r.status.toLowerCase();
}

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
  const [runs, pendingChanges, history, g2Listings, candidates, autoCreated] = await Promise.all([
    db.syncRun.findMany({ orderBy: { startedAt: "desc" }, take: 20 }),
    db.dataChange.findMany({ where: { status: "PENDING" }, include: { product: { select: { id: true, name: true } } }, orderBy: [{ detectedAt: "desc" }], take: 200 }),
    db.dataChange.findMany({ where: { status: { not: "PENDING" } }, include: { product: { select: { id: true, name: true } } }, orderBy: [{ reviewedAt: "desc" }], take: 60 }),
    db.g2Listing.findMany({ where: { productId: { not: null } }, include: { product: { select: { id: true, name: true, status: true } } }, orderBy: { lastSyncedAt: "desc" }, take: 300 }),
    db.g2Listing.findMany({ where: { productId: null }, orderBy: [{ mentions: "desc" }, { lastSyncedAt: "desc" }], take: 30 }),
    db.product.findMany({ where: { autoCreatedAt: { not: null } }, select: { id: true, name: true, status: true, autoCreatedAt: true, category: { select: { name: true } } }, orderBy: { autoCreatedAt: "desc" }, take: 50 }),
  ]);
  const last = runs[0] ?? null;
  const lastFinished = runs.find((r) => r.finishedAt) ?? null;
  const lastSuccessful = runs.find((r) => r.status === "COMPLETED" || r.status === "PARTIAL") ?? null;
  const active = runs.find((r) => r.status === "RUNNING" || r.status === "PROCESSING") ?? null;
  // None of these three depends on the others' result (only on `last`, already resolved above), so
  // they run as one round trip instead of three sequential ones - the biggest single latency cost on
  // this page against a database in a different region from the app.
  const [decided, failures, thisCycle] = await Promise.all([
    last ? db.dataChange.groupBy({ by: ["status"], where: { runId: last.id }, _count: { _all: true } }) : Promise.resolve([]),
    last
      ? db.syncPage.findMany({ where: { runId: last.id, status: { not: "OK" }, processedAt: { not: null } }, include: { product: { select: { id: true, name: true } } }, orderBy: [{ productId: "asc" }], take: 200 })
      : Promise.resolve([]),
    db.syncRun.findUnique({ where: { cycleKey: cycleKey(now) }, select: { status: true, attempts: true } }),
  ]);
  const byStatus = Object.fromEntries(decided.map((d) => [d.status, d._count._all])) as Record<string, number>;
  // Figures describe the latest finished run; an active run shows its live state separately.
  const stats = runStats(lastFinished ?? last ?? { stats: {} });
  const doneThisCycle = !!thisCycle && (thisCycle.status === "COMPLETED" || thisCycle.status === "PARTIAL" || thisCycle.attempts >= 3);
  return {
    configured: apifyConfigured(),
    nextRun: nextScheduledRun(now, doneThisCycle),
    last,
    lastFinished,
    lastSuccessful,
    active,
    runs,
    g2Listings,
    candidates,
    autoCreated,
    errors: stats.errors ?? [],
    actorRuns: runStats(active ?? lastFinished ?? last ?? { stats: {} }).actorRuns ?? [],
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
      productsAdded: stats.productsAdded ?? 0,
      productsUpdated: stats.productsUpdated ?? 0,
      productsUnchanged: stats.productsUnchanged ?? 0,
      productsRetiredFlagged: stats.productsRetiredFlagged ?? 0,
      officialPagesOk: stats.officialPagesOk ?? 0,
      g2ListingsOk: stats.g2ListingsOk ?? 0,
      g2NotListed: stats.g2NotListed ?? 0,
      changesApplied: stats.changesApplied ?? 0,
      changesPending: stats.changesPending ?? 0,
      apiErrors: (stats.errors ?? []).length,
      retries: Math.max(0, (lastFinished?.attempts ?? 1) - 1) + (stats.itemRetries ?? 0),
      durationMs: (lastFinished ?? last)?.durationMs ?? null,
    },
    pendingChanges,
    history,
    failures,
  };
}
