// Automatic data sync, every 25 days: start → official-site crawl (phases 1–2) → G2 listings
// (phases 3–4) → resumable processing → auto-apply → finalize → revalidate.
//
// Source rules: the official crawl is authoritative for published pricing and facts. Every detected
// official change is recorded as a DataChange and applied automatically through the same validated
// path as an editor's accept (see AUTO_APPLY); removals ("no longer found") apply only after a second
// successful run confirms them, so one bad scrape can never blank data. G2 is an additional source:
// its data is stored as G2Listing source data, fills configured empty fields only, and never touches
// editorial content, scores or published prices. A failed, blocked or partial source changes nothing.
import { createHmac } from "node:crypto";
import type { Prisma, SyncPageStatus, SyncRun, SyncTrigger } from "@prisma/client";
import { db } from "@/lib/db";
import { siteUrl } from "@/lib/site";
import { revalidateSite } from "@/lib/admin/services";
import { isOfficialUrl, officialDomains } from "@/lib/research/evidence";
import { abortRun, apifyActor, apifyConfigured, datasetItems, getRun, scrub, startActorRun, TERMINAL } from "@/lib/sync/apify";
import { crawlInput } from "@/lib/sync/crawl-input";
import { acceptChange } from "@/lib/sync/review";
import { productSlugProblem } from "@/lib/seo/routes";
import {
  autoFill, changedFields, G2, g2Actor, g2Input, g2PageUrl, listingHash, matchListing, mergeField, parseG2Item,
  LISTING_FIELDS, type CatalogEntry, type G2Listing as G2ListingRecord, type G2Target, type ListingFields,
} from "@/lib/sync/g2";
import { dedupeKey, evaluateDiscovered, evaluatePage, type Claims, type Outcome, type Proposal } from "@/lib/sync/diff";
import { normalizeUrl, validateItem } from "@/lib/sync/extract";

export const SYNC = {
  maxAttempts: 3,
  actorTimeoutSecs: 1800,
  actorMemoryMb: 2048,
  batchSize: 8,
  lockMs: 4 * 60_000,
  budgetMs: 45_000,
  manualProductCooldownMs: 30 * 60_000,
  manualFullCooldownMs: 6 * 3_600_000,
  maxDiscoveriesPerRun: 40,
  maxDiscoveriesPerProduct: 6,
  /** Apify crawl considered stuck after this long; its partial results are processed. */
  stuckAfterMs: 45 * 60_000,
  cycleDays: 25,
  g2TimeoutSecs: 3600,
  g2MemoryMb: 1024,
  g2StuckAfterMs: 70 * 60_000,
};

/** G2 runs as part of every sync unless explicitly switched off (APIFY_G2_ENABLED=false). */
export const g2Enabled = () => process.env.APIFY_G2_ENABLED?.trim().toLowerCase() !== "false";
const isG2Phase = (phase: number) => phase >= 3;

export class SyncError extends Error {}

const ACTIVE = ["RUNNING", "PROCESSING"] as const;
const DAY = 86_400_000;

/** Elapsed milliseconds clamped to a valid INT4 (clock skew or a very old run must not break writes). */
export const elapsed = (from: Date, to = Date.now()) => Math.max(0, Math.min(to - from.getTime(), 2_147_483_647));

/** Scheduled syncs run in fixed 25-day cycles counted from this anchor (UTC). */
const CYCLE_ANCHOR = Date.UTC(2026, 0, 1);

export function cycleStart(d: Date): Date {
  const n = Math.floor((d.getTime() - CYCLE_ANCHOR) / (SYNC.cycleDays * DAY));
  return new Date(CYCLE_ANCHOR + n * SYNC.cycleDays * DAY);
}

/** Idempotency key of the 25-day cycle containing `d`, e.g. "cycle-2026-09-08". */
export const cycleKey = (d: Date) => `cycle-${cycleStart(d).toISOString().slice(0, 10)}`;

/**
 * Next automatic sync attempt. The cron ticks daily at 04:00 UTC (vercel.json) and starts one sync per
 * 25-day cycle: while the current cycle has not synced successfully the next tick tries (up to 3
 * attempts), otherwise the first tick of the next cycle.
 */
export function nextScheduledRun(now = new Date(), doneThisCycle = true): Date {
  const tick = (d: Date) => {
    const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 4, 0, 0));
    if (t <= d) t.setUTCDate(t.getUTCDate() + 1);
    return t;
  };
  if (!doneThisCycle) return tick(now);
  const next = new Date(cycleStart(now).getTime() + SYNC.cycleDays * DAY);
  return new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate(), 4, 0, 0));
}

/** Signature Apify sends back on its completion webhook; derived so CRON_SECRET itself is never shared. */
export function webhookSignature(): string | null {
  const s = process.env.CRON_SECRET;
  return s ? createHmac("sha256", s).update("apify-webhook-v1").digest("hex") : null;
}

function webhook() {
  const secret = webhookSignature();
  if (!secret) return undefined;
  try {
    const u = new URL("/api/apify/webhook", siteUrl);
    if (u.protocol !== "https:" || /^(localhost|127\.|0\.0\.0\.0)/.test(u.hostname)) return undefined;
    return { requestUrl: u.toString(), secret };
  } catch {
    return undefined;
  }
}

// ---------------- Claims ----------------

type ProductClaims = Claims & { slug: string; name: string };

async function loadClaims(where: Prisma.ProductWhereInput): Promise<Map<string, ProductClaims>> {
  const rows = await db.product.findMany({
    where,
    select: {
      id: true, slug: true, name: true, officialUrl: true, pricingUrl: true,
      sources: { select: { id: true, url: true, kind: true, name: true, status: true } },
      facts: { select: { id: true, key: true, value: true, evidence: true, status: true, source: { select: { url: true } } } },
      snapshots: { where: { status: "VERIFIED" }, select: { id: true, plan: true, price: true, currency: true, billingPeriod: true, unit: true, perSeat: true, evidence: true, sourceUrl: true } },
    },
    orderBy: { slug: "asc" },
  });
  const out = new Map<string, ProductClaims>();
  for (const p of rows) {
    const known = new Set([p.officialUrl, p.pricingUrl, ...p.sources.map((s) => s.url), ...p.snapshots.map((s) => s.sourceUrl)].filter((u): u is string => !!u).map(normalizeUrl));
    out.set(p.id, {
      productId: p.id, slug: p.slug, name: p.name, officialUrl: p.officialUrl, pricingUrl: p.pricingUrl, domains: officialDomains(p.slug, p.officialUrl), known,
      sources: p.sources,
      facts: p.facts.map((f) => ({ id: f.id, key: f.key, value: f.value, evidence: f.evidence, status: f.status, sourceUrl: f.source?.url ?? null })),
      plans: p.snapshots.map((s) => ({ ...s, price: s.price === null ? null : Number(s.price) })),
    });
  }
  return out;
}

/** Official URLs worth fetching for a product: pages that existing claims cite, plus home and pricing. */
export function targetUrls(c: Claims): string[] {
  const urls = [
    c.officialUrl,
    c.pricingUrl,
    ...c.sources.filter((s) => s.status === "VERIFIED").map((s) => s.url),
    ...c.plans.map((p) => p.sourceUrl),
  ].filter((u): u is string => !!u && isOfficialUrl(u, c.domains));
  return [...new Set(urls.map(normalizeUrl))];
}

// ---------------- Start ----------------

export type StartResult = { run: SyncRun | null; started: boolean; reason?: string };

type RunStats = Record<string, unknown> & { errors?: { source: string; message: string; at: string }[]; actorRuns?: { phase: number; actor: string; runId: string; status: string }[] };
const statsOf = (r: Pick<SyncRun, "stats">) => (r.stats ?? {}) as RunStats;
const sourceOf = (phase: number) => (isG2Phase(phase) ? "G2" : "Official websites");

export async function startSync(opts: { trigger: SyncTrigger; productId?: string; now?: Date }): Promise<StartResult> {
  const now = opts.now ?? new Date();
  if (!apifyConfigured()) throw new SyncError("APIFY_API_TOKEN is not configured. Add it to the server environment to enable the automatic sync.");
  await db.syncRun.updateMany({
    where: { status: "RUNNING", apifyRunId: null, lockedUntil: null, startedAt: { lt: new Date(Date.now() - 10 * 60_000) } },
    data: { status: "FAILED", error: "The Apify crawl was never recorded as started", finishedAt: new Date() },
  });
  const active = await db.syncRun.findFirst({ where: { status: { in: [...ACTIVE] } }, orderBy: { startedAt: "desc" } });
  if (active) {
    if (opts.trigger === "SCHEDULED") return { run: active, started: false, reason: "A sync is already in progress" };
    throw new SyncError("A sync is already in progress. Wait for it to finish.");
  }
  let reuse: SyncRun | null = null;
  const key = opts.trigger === "SCHEDULED" ? cycleKey(now) : null;
  if (key) {
    const existing = await db.syncRun.findUnique({ where: { cycleKey: key } });
    if (existing && existing.status !== "FAILED") return { run: existing, started: false, reason: `Already synced for ${key}` };
    if (existing && existing.attempts >= SYNC.maxAttempts) return { run: existing, started: false, reason: `Gave up after ${existing.attempts} attempts for ${key}` };
    reuse = existing;
  } else if (opts.trigger === "MANUAL_PRODUCT") {
    if (!opts.productId) throw new SyncError("Product is required");
    const recent = await db.syncRun.findFirst({ where: { productId: opts.productId, startedAt: { gt: new Date(now.getTime() - SYNC.manualProductCooldownMs) } } });
    if (recent) throw new SyncError("This product was synced less than 30 minutes ago.");
  } else {
    const recent = await db.syncRun.findFirst({ where: { productId: null, startedAt: { gt: new Date(now.getTime() - SYNC.manualFullCooldownMs) }, status: { not: "FAILED" } } });
    if (recent) throw new SyncError("A full sync ran less than 6 hours ago.");
  }

  const claims = await loadClaims(opts.productId ? { id: opts.productId } : { status: "PUBLISHED" });
  if (!claims.size) throw new SyncError("No products to sync");
  const pages = [...claims.values()].flatMap((c) => targetUrls(c).map((url) => ({ productId: c.productId, url, phase: 1 })));

  const created = await db.$transaction(async (tx) => {
    // Distributed start lock: concurrent starts (duplicate cron ticks, overlapping deployments, double
    // clicks) serialize here, and the loser sees the winner's run. Transaction-scoped, so it also works
    // behind a transaction-mode connection pooler.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(727100251)`;
    const raced = await tx.syncRun.findFirst({ where: { status: { in: [...ACTIVE] } } });
    if (raced) return { raced };
    if (key && !reuse && (await tx.syncRun.findUnique({ where: { cycleKey: key } }))) return { raced: await tx.syncRun.findUniqueOrThrow({ where: { cycleKey: key } }) };
    const data = { trigger: opts.trigger, status: "RUNNING" as const, productId: opts.productId ?? null, phase: 1, cursor: 0, apifyRunId: null, apifyDatasetId: null, error: null, finishedAt: null, durationMs: null, lockedUntil: null, startedAt: now, stats: {} };
    const r = reuse
      ? await tx.syncRun.update({ where: { id: reuse.id }, data: { ...data, attempts: { increment: 1 } } })
      : await tx.syncRun.create({ data: { ...data, cycleKey: key } });
    if (reuse) await tx.syncPage.deleteMany({ where: { runId: r.id } });
    await tx.syncPage.createMany({ data: pages.map((p) => ({ ...p, runId: r.id })), skipDuplicates: true });
    return { run: r };
  });
  if ("raced" in created && created.raced) {
    const raced = created.raced;
    if (opts.trigger === "SCHEDULED") return { run: raced, started: false, reason: raced.status === "RUNNING" || raced.status === "PROCESSING" ? "A sync is already in progress" : `Already synced for ${key}` };
    throw new SyncError("A sync is already in progress. Wait for it to finish.");
  }
  const run = (created as { run: SyncRun }).run;
  if (!pages.length) return { run: await startG2(run), started: true };
  const launched = await launch(run, crawlInput([...new Set(pages.map((p) => p.url))]));
  // The official crawl could not start: G2 still runs (one source failing never blocks the other).
  if (!launched) return { run: await afterOfficial(await db.syncRun.findUniqueOrThrow({ where: { id: run.id } })), started: true };
  return { run: launched, started: true };
}

async function recordError(runId: string, phase: number, message: string) {
  const r = await db.syncRun.findUniqueOrThrow({ where: { id: runId }, select: { stats: true } });
  const st = statsOf(r);
  const errors = [...(st.errors ?? []), { source: sourceOf(phase), message: scrub(message), at: new Date().toISOString() }].slice(-30);
  await db.syncRun.update({ where: { id: runId }, data: { stats: { ...st, errors } as Prisma.InputJsonValue } });
  console.error("[sync] SOURCE_FAILED", sourceOf(phase), scrub(message));
}

/** Starts the Apify run for the run's current phase. Returns null (and records why) when it cannot start. */
async function launch(run: SyncRun, input: unknown): Promise<SyncRun | null> {
  const g2 = isG2Phase(run.phase);
  const actor = g2 ? g2Actor() : apifyActor();
  try {
    const a = await startActorRun(input, g2
      ? { timeoutSecs: SYNC.g2TimeoutSecs, memoryMbytes: SYNC.g2MemoryMb, webhook: webhook(), actor }
      : { timeoutSecs: SYNC.actorTimeoutSecs, memoryMbytes: SYNC.actorMemoryMb, webhook: webhook(), actor });
    const st = statsOf(run);
    const actorRuns = [...(st.actorRuns ?? []), { phase: run.phase, actor, runId: a.id, status: a.status }];
    console.info("[sync] APIFY_RUN_CREATED", actor, `phase ${run.phase}`, a.id);
    return db.syncRun.update({ where: { id: run.id }, data: { apifyRunId: a.id, apifyDatasetId: a.defaultDatasetId, status: "RUNNING", cursor: 0, stats: { ...st, actorRuns } as Prisma.InputJsonValue } });
  } catch (e) {
    const msg = `Could not start the Apify ${g2 ? "G2 run" : "crawl"}: ${e instanceof Error ? e.message : "unknown error"}`;
    await recordError(run.id, run.phase, msg);
    await db.syncPage.updateMany({ where: { runId: run.id, phase: run.phase, processedAt: null }, data: { status: "UNAVAILABLE", reason: scrub(msg).slice(0, 300), processedAt: new Date() } });
    const cur = await db.syncRun.findUniqueOrThrow({ where: { id: run.id } });
    await db.syncRun.update({ where: { id: run.id }, data: { error: scrub([cur.error, msg].filter(Boolean).join(" · ")), apifyRunId: null, apifyDatasetId: null } });
    return null;
  }
}

/** Official phases are done (or could not run): continue with G2. */
async function afterOfficial(run: SyncRun): Promise<SyncRun> {
  return startG2(run);
}

async function g2Targets(run: SyncRun): Promise<G2Target[]> {
  const products = await db.product.findMany({
    where: run.productId ? { id: run.productId } : { status: "PUBLISHED" },
    select: { id: true, name: true, g2: { select: { g2Slug: true, status: true } } },
    orderBy: { slug: "asc" },
  });
  return products.map((p) => ({ productId: p.id, name: p.name, g2Slug: p.g2?.g2Slug ?? null }));
}

async function startG2(run: SyncRun, phase = 3, only?: string[]): Promise<SyncRun> {
  if (!g2Enabled()) return finalize(run);
  const targets = (await g2Targets(run)).filter((t) => !only || only.includes(t.productId));
  if (!targets.length) return finalize(run);
  const next = await db.syncRun.update({ where: { id: run.id }, data: { phase, cursor: 0, status: "RUNNING", apifyRunId: null, apifyDatasetId: null } });
  await db.syncPage.createMany({ data: targets.map((t) => ({ runId: run.id, productId: t.productId, phase, url: g2PageUrl(t) })), skipDuplicates: true });
  const launched = await launch(next, g2Input(targets));
  return launched ?? finalize(await db.syncRun.findUniqueOrThrow({ where: { id: run.id } }));
}

// ---------------- Advance / process ----------------

export type AdvanceResult = { runId: string; state: "locked" | "waiting" | "processing" | "finished" | "failed"; processed: number };

/** Advances every active run (or one run) within a time budget. Safe to call repeatedly and concurrently. */
export async function advanceSyncs(opts: { runId?: string; budgetMs?: number; now?: () => number } = {}): Promise<{ results: AdvanceResult[]; more: boolean }> {
  const clock = opts.now ?? Date.now;
  const deadline = clock() + (opts.budgetMs ?? SYNC.budgetMs);
  const runs = await db.syncRun.findMany({ where: { status: { in: [...ACTIVE] }, ...(opts.runId ? { id: opts.runId } : {}) }, orderBy: { startedAt: "asc" } });
  const results: AdvanceResult[] = [];
  for (const r of runs) results.push(await advanceRun(r.id, deadline, clock));
  return { results, more: results.some((r) => r.state === "processing") };
}

/** Records the actor's final status on the run's actorRuns list (shown in Admin). */
async function noteActorStatus(run: SyncRun, status: string): Promise<SyncRun> {
  const st = statsOf(run);
  const actorRuns = (st.actorRuns ?? []).map((a) => (a.runId === run.apifyRunId ? { ...a, status } : a));
  console.info("[sync] APIFY_RUN_COMPLETED", sourceOf(run.phase), run.apifyRunId, status);
  return db.syncRun.update({ where: { id: run.id }, data: { status: "PROCESSING", stats: { ...st, actorRuns, [`apifyPhase${run.phase}`]: status } as Prisma.InputJsonValue } });
}

async function advanceRun(runId: string, deadline: number, clock: () => number): Promise<AdvanceResult> {
  const now = new Date(clock());
  const claimed = await db.syncRun.updateMany({
    where: { id: runId, status: { in: [...ACTIVE] }, OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] },
    data: { lockedUntil: new Date(now.getTime() + SYNC.lockMs) },
  });
  if (!claimed.count) return { runId, state: "locked", processed: 0 };
  let processed = 0;
  try {
    let run = await db.syncRun.findUniqueOrThrow({ where: { id: runId } });
    if (run.status === "RUNNING") {
      if (!run.apifyRunId) {
        await fail(run, "The Apify crawl was never started");
        return { runId, state: "failed", processed };
      }
      const a = await getRun(run.apifyRunId);
      if (!TERMINAL.has(a.status)) {
        if (clock() - run.startedAt.getTime() < (isG2Phase(run.phase) ? SYNC.g2StuckAfterMs : SYNC.stuckAfterMs)) return { runId, state: "waiting", processed };
        await abortRun(run.apifyRunId).catch(() => {});
      }
      if (a.status !== "SUCCEEDED") await recordError(run.id, run.phase, `Apify ${isG2Phase(run.phase) ? "G2 run" : "crawl"} ${run.apifyRunId} ended ${TERMINAL.has(a.status) ? a.status : "STUCK (aborted)"}; its partial results are used`);
      run = await noteActorStatus({ ...run, stats: (await db.syncRun.findUniqueOrThrow({ where: { id: run.id }, select: { stats: true } })).stats }, TERMINAL.has(a.status) ? a.status : "ABORTED");
      if (a.defaultDatasetId && a.defaultDatasetId !== run.apifyDatasetId) run = await db.syncRun.update({ where: { id: run.id }, data: { apifyDatasetId: a.defaultDatasetId } });
    }
    const claims = new Map<string, ProductClaims>();
    const g2ctx = isG2Phase(run.phase) ? await loadG2Context(run) : null;
    while (clock() < deadline) {
      const items = run.apifyDatasetId ? await datasetItems(run.apifyDatasetId, run.cursor, SYNC.batchSize) : [];
      if (!items.length) {
        const done = await finishPhase(run);
        return { runId, state: done.status === "FAILED" ? "failed" : done.status === "RUNNING" ? "waiting" : "finished", processed };
      }
      const apply: string[] = [];
      for (const item of items) {
        if (g2ctx) await processG2Item(run, item, g2ctx);
        else apply.push(...(await processItem(run, item, claims)));
        run = { ...run, cursor: run.cursor + 1 };
        processed++;
      }
      if (apply.length) await autoApplyChanges(run.id, apply);
      if (processed) revalidateSite();
    }
    return { runId, state: "processing", processed };
  } catch (e) {
    // Transient errors leave the run resumable; the next trigger retries from the saved cursor. An item
    // that fails three times at the same cursor is skipped (counted as a validation failure) so one bad
    // result can never stall the run; skipping writes nothing for that item.
    const msg = scrub(e instanceof Error ? e.message : "Processing error");
    await db.$transaction(async (tx) => {
      const r = await tx.syncRun.findUniqueOrThrow({ where: { id: runId } });
      const s = (r.stats ?? {}) as Record<string, number>;
      const count = s.errorCursor === r.cursor ? (s.errorCount ?? 0) + 1 : 1;
      const skip = r.status === "PROCESSING" && count >= 3;
      await tx.syncRun.update({
        where: { id: runId },
        data: { error: msg, ...(skip ? { cursor: { increment: 1 } } : {}), stats: { ...s, errorCursor: skip ? -1 : r.cursor, errorCount: skip ? 0 : count, itemRetries: (s.itemRetries ?? 0) + 1, ...(skip ? { unmatched: (s.unmatched ?? 0) + 1 } : {}) } },
      });
    }).catch(() => {});
    return { runId, state: "processing", processed };
  } finally {
    await db.syncRun.updateMany({ where: { id: runId }, data: { lockedUntil: null } }).catch(() => {});
  }
}

async function claimsFor(productId: string, cache: Map<string, ProductClaims>) {
  if (!cache.has(productId)) {
    const m = await loadClaims({ id: productId });
    for (const [k, v] of m) cache.set(k, v);
  }
  return cache.get(productId);
}

const FIXABLE = ["FACT_NOT_FOUND", "PLAN_NOT_FOUND", "PRICE_CHANGED", "SOURCE_NOT_FOUND", "FACT_CHANGED"] as const;
const PERIODS = new Set(["FREE", "MONTHLY", "ANNUAL", "ONE_TIME", "USAGE", "CUSTOM"]);

/**
 * Which official-source detections apply automatically. Updates with complete evidence apply at once;
 * removals ("no longer found") only when a second, separate successful run confirms them. A new plan
 * whose billing period the page does not state cannot be published honestly and stays recorded (and
 * is reported in Admin) until a later crawl or an editor supplies it.
 */
export function autoApplicable(kind: string, payload: unknown, confirmedAgain: boolean): boolean {
  const period = (payload as { billingPeriod?: unknown } | null)?.billingPeriod;
  switch (kind) {
    case "PRICE_CHANGED":
    case "NEW_PLAN":
      return typeof period === "string" && PERIODS.has(period);
    case "FACT_CHANGED":
    case "NEW_SOURCE":
    case "SOURCE_UPDATED":
      return true;
    case "FACT_NOT_FOUND":
    case "PLAN_NOT_FOUND":
    case "SOURCE_NOT_FOUND":
      return confirmedAgain;
    default:
      return false;
  }
}

/** Applies detections through the editor's accept path (same validation, audit trail and revert). */
async function autoApplyChanges(runId: string, ids: string[]) {
  let applied = 0, failed = 0;
  for (const id of [...new Set(ids)]) {
    try {
      await acceptChange(id, { by: "auto-sync", note: "Applied automatically by the scheduled data sync." });
      applied++;
    } catch (e) {
      failed++;
      const msg = scrub(e instanceof Error ? e.message : "could not apply");
      await db.dataChange.updateMany({ where: { id, status: "PENDING" }, data: { note: `Not applied automatically: ${msg}`.slice(0, 1000) } });
    }
  }
  const r = await db.syncRun.findUniqueOrThrow({ where: { id: runId }, select: { stats: true } });
  const st = (r.stats ?? {}) as Record<string, number>;
  await db.syncRun.update({ where: { id: runId }, data: { stats: { ...st, changesApplied: (st.changesApplied ?? 0) + applied, autoApplyFailed: (st.autoApplyFailed ?? 0) + failed } } });
  if (applied) console.info("[sync] PRODUCTS_UPDATED", `${applied} official change(s) applied`);
}

async function processItem(run: SyncRun, raw: unknown, cache: Map<string, ProductClaims>): Promise<string[]> {
  const apply: string[] = [];
  const requestUrl = raw && typeof raw === "object" ? ((raw as Record<string, unknown>).requestUrl ?? (raw as Record<string, unknown>).url) : null;
  const key = typeof requestUrl === "string" ? normalizeUrl(requestUrl) : null;
  const pages = key ? await db.syncPage.findMany({ where: { runId: run.id, phase: run.phase, url: key, processedAt: null } }) : [];
  const evaluated: { page: (typeof pages)[number]; status: string; reason: string | null; httpStatus: number | null; hash: string | null; title: string | null; fetchedAt: Date | null; outcome: Outcome | null; proposals: Proposal[]; claims: ProductClaims }[] = [];
  for (const page of pages) {
    const claims = await claimsFor(page.productId, cache);
    if (!claims) continue;
    const result = validateItem(raw, claims.domains);
    let outcome: Outcome | null = null;
    let proposals: Proposal[] = [];
    if (run.phase === 1) {
      const prev = await db.syncPage.findFirst({ where: { productId: page.productId, url: key!, status: "OK", runId: { not: run.id } }, orderBy: { fetchedAt: "desc" }, select: { contentHash: true } });
      outcome = evaluatePage(claims, key!, result, prev?.contentHash ?? null);
      proposals = outcome.proposals;
    } else if (page.kind) {
      const p = evaluateDiscovered(claims, page.kind, result);
      if (p) proposals = [p];
    }
    evaluated.push({ page, status: result.status, reason: result.reason, httpStatus: result.httpStatus, hash: result.page?.contentHash ?? null, title: result.page?.title ?? null, fetchedAt: result.page?.fetchedAt ?? null, outcome, proposals, claims });
  }

  await db.$transaction(async (tx) => {
    const unmatched = !evaluated.length;
    for (const e of evaluated) {
      const at = e.fetchedAt ?? new Date();
      const o = e.outcome;
      await tx.syncPage.update({
        where: { id: e.page.id },
        data: {
          status: e.status as SyncPageStatus, reason: e.reason, httpStatus: e.httpStatus, contentHash: e.hash, title: e.title?.slice(0, 300) ?? null, fetchedAt: e.fetchedAt, processedAt: new Date(),
          outcome: o ? { checked: o.checked, reverified: o.reverified, proposals: e.proposals.length } : { proposals: e.proposals.length },
        },
      });
      if (o) {
        const { sources, facts } = o.reverified;
        if (sources.length) {
          await tx.productSource.updateMany({ where: { id: { in: sources }, status: "VERIFIED" }, data: { checkedAt: at } });
          await tx.product.updateMany({ where: { id: e.page.productId, OR: [{ sourceCheckedAt: null }, { sourceCheckedAt: { lt: at } }] }, data: { sourceCheckedAt: at } });
        }
        if (facts.length) await tx.productFact.updateMany({ where: { id: { in: facts }, status: "VERIFIED" }, data: { checkedAt: at } });
        const confirmed = [...sources, ...facts, ...o.reverified.plans];
        if (confirmed.length) {
          // A claim seen again with its evidence resolves an open "not found" proposal about it.
          await tx.dataChange.updateMany({
            where: { productId: e.page.productId, status: "PENDING", targetId: { in: confirmed }, kind: { in: [...FIXABLE] } },
            data: { status: "KEPT", reviewedAt: new Date(), reviewedBy: "sync", note: `Resolved automatically: the official evidence was found again on ${at.toISOString().slice(0, 10)}.` },
          });
        }
        if (o.discovered.length) {
          const inRun = await tx.syncPage.count({ where: { runId: run.id, phase: 2 } });
          const inProduct = await tx.syncPage.count({ where: { runId: run.id, phase: 2, productId: e.page.productId } });
          const room = Math.max(0, Math.min(SYNC.maxDiscoveriesPerRun - inRun, SYNC.maxDiscoveriesPerProduct - inProduct));
          const fresh = o.discovered.filter((d) => !e.claims.known.has(d.url)).slice(0, room);
          if (fresh.length) await tx.syncPage.createMany({ data: fresh.map((d) => ({ runId: run.id, productId: e.page.productId, phase: 2, url: d.url, kind: d.kind })), skipDuplicates: true });
        }
      }
      for (const p of e.proposals) {
        const dk = dedupeKey(p);
        const existing = await tx.dataChange.findFirst({ where: { productId: e.page.productId, dedupeKey: dk } });
        if (existing && existing.status === "KEPT" && existing.reviewedBy === "sync") {
          // Resolved automatically earlier (the evidence came back), now missing again: a fresh first
          // sighting. Editor decisions stay decided; only the sync's own resolution is reopened.
          await tx.dataChange.update({ where: { id: existing.id }, data: { status: "PENDING", reviewedAt: null, reviewedBy: null, note: null, detectedAt: new Date(), lastSeenAt: new Date(), runId: run.id } });
          continue;
        }
        if (existing) {
          // Decided proposals stay decided; an open one is just seen again — which, from a different
          // successful run, is the second confirmation removals need before they apply automatically.
          if (existing.status === "PENDING") {
            const confirmedAgain = existing.runId !== run.id;
            await tx.dataChange.update({ where: { id: existing.id }, data: { lastSeenAt: new Date(), runId: run.id } });
            if (autoApplicable(existing.kind, existing.payload, confirmedAgain)) apply.push(existing.id);
          }
          continue;
        }
        const created = await tx.dataChange.create({
          data: {
            runId: run.id, productId: e.page.productId, kind: p.kind, field: p.field.slice(0, 300), targetId: p.targetId, previousValue: p.previousValue?.slice(0, 2000) ?? null,
            newValue: p.newValue?.slice(0, 2000) ?? null, sourceUrl: p.sourceUrl.slice(0, 2000), evidence: p.evidence?.slice(0, 2000) ?? null, payload: (p.payload ?? undefined) as Prisma.InputJsonValue | undefined, dedupeKey: dk,
          },
        });
        if (autoApplicable(p.kind, p.payload, false)) apply.push(created.id);
      }
    }
    const stats = (await tx.syncRun.findUniqueOrThrow({ where: { id: run.id }, select: { stats: true } })).stats as Record<string, number>;
    await tx.syncRun.update({ where: { id: run.id }, data: { cursor: { increment: 1 }, ...(unmatched ? { stats: { ...stats, unmatched: (stats.unmatched ?? 0) + 1 } } : {}) } });
  }, { timeout: 20_000 });
  return apply;
}

// ---------------- G2 processing ----------------

type G2Context = {
  catalog: (CatalogEntry & { categoryId: string; vendor: string | null })[];
  /** Products targeted in this phase → their SyncPage id. */
  targets: Map<string, string>;
};

async function loadG2Context(run: SyncRun): Promise<G2Context> {
  const [products, pages] = await Promise.all([
    // All products (drafts too), so a detected G2 product can never duplicate an existing draft.
    db.product.findMany({ select: { id: true, slug: true, name: true, vendor: true, officialUrl: true, categoryId: true, g2: { select: { g2Slug: true } } } }),
    db.syncPage.findMany({ where: { runId: run.id, phase: run.phase }, select: { id: true, productId: true } }),
  ]);
  return {
    catalog: products.map((p) => ({ id: p.id, slug: p.slug, name: p.name, vendor: p.vendor, categoryId: p.categoryId, domains: officialDomains(p.slug, p.officialUrl), g2Slug: p.g2?.g2Slug ?? null })),
    targets: new Map(pages.map((p) => [p.productId, p.id])),
  };
}

const bump = async (runId: string, delta: Record<string, number>) => {
  const r = await db.syncRun.findUniqueOrThrow({ where: { id: runId }, select: { stats: true } });
  const st = (r.stats ?? {}) as Record<string, number>;
  const next = { ...st };
  for (const [k, v] of Object.entries(delta)) next[k] = (Number(st[k]) || 0) + v;
  await db.syncRun.update({ where: { id: runId }, data: { stats: next } });
};

type ListingRow = NonNullable<Awaited<ReturnType<typeof db.g2Listing.findUnique>>>;
const listFields = (l: ListingRow): ListingFields => ({
  name: l.name, vendorName: l.vendorName, g2Url: l.g2Url, companyDomain: l.companyDomain, companyWebsite: l.companyWebsite, description: l.description, imageUrl: l.imageUrl,
  rating: l.rating, reviewCount: l.reviewCount, pricingType: l.pricingType, categories: l.categories, pricing: l.pricing, competitors: l.competitors, reviewSummary: l.reviewSummary, recentReviews: l.recentReviews,
});

/** Per-run accumulated list (competitors, reviews): replaced on the first item of a new run, then appended. */
function accumulate<T extends Record<string, unknown>>(prev: unknown, runId: string, item: T, key: keyof T, max: number): { runId: string; items: T[] } {
  const p = prev && typeof prev === "object" ? (prev as { runId?: string; items?: T[] }) : null;
  const items = p?.runId === runId && Array.isArray(p.items) ? p.items.filter((x) => x[key] !== item[key]) : [];
  return { runId, items: [...items, item].slice(-max) };
}

/**
 * Writes one listing's merged fields in a transaction, recording exactly which fields changed on the
 * product's SyncPage outcome, and fills configured empty product fields (G2_AUTO_FIELDS).
 */
async function writeListing(run: SyncRun, ctx: G2Context, productId: string | null, g2Slug: string, patch: ListingFields & { dataAsOf?: Date | null; status?: "ACTIVE" | "NOT_FOUND"; domainConflict?: boolean; mentions?: number; candidateCategoryId?: string | null }) {
  await db.$transaction(async (tx) => {
    const existing = await tx.g2Listing.findUnique({ where: { g2Slug } });
    if (existing && productId && existing.productId && existing.productId !== productId) return; // slug owned by another product: never reassigned
    const prev = existing ? listFields(existing) : null;
    // Only listing fields present in this record are merged; missing data keeps the stored value.
    const merged: ListingFields = {};
    for (const k of LISTING_FIELDS) if (k in patch) merged[k] = mergeField(prev?.[k] as never, patch[k] as never);
    const fields = changedFields(prev, merged);
    const data = {
      ...(merged as Record<string, unknown>),
      ...(patch.dataAsOf ? { dataAsOf: patch.dataAsOf } : {}),
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.domainConflict !== undefined ? { domainConflict: patch.domainConflict } : {}),
      ...(patch.candidateCategoryId !== undefined ? { candidateCategoryId: patch.candidateCategoryId } : {}),
      lastSyncedAt: new Date(), lastRunId: run.id,
    } as Prisma.G2ListingUncheckedUpdateInput;
    const full = { ...(prev ?? {}), ...merged };
    const hash = listingHash(full);
    if (existing) {
      await tx.g2Listing.update({ where: { id: existing.id }, data: { ...data, contentHash: hash, ...(productId && !existing.productId ? { productId, mentions: 0, candidateCategoryId: null } : {}) } });
    } else {
      await tx.g2Listing.create({ data: { ...(data as Prisma.G2ListingUncheckedCreateInput), g2Slug, productId, name: String(full.name ?? g2Slug), g2Url: String(full.g2Url ?? `https://www.g2.com/products/${g2Slug}/reviews`), contentHash: hash } });
    }
    if (!productId) return;
    const product = await tx.product.findUniqueOrThrow({ where: { id: productId }, select: { vendor: true } });
    const fill = autoFill(product, { vendorName: (full.vendorName as string | null) ?? null });
    if (Object.keys(fill).length) {
      await tx.product.update({ where: { id: productId }, data: fill });
      fields.push(...Object.keys(fill).map((k) => `product.${k}`));
    }
    const pageId = ctx.targets.get(productId);
    if (pageId) {
      const page = await tx.syncPage.findUniqueOrThrow({ where: { id: pageId }, select: { outcome: true } });
      const o = (page.outcome ?? {}) as { changed?: string[]; created?: boolean; records?: number };
      await tx.syncPage.update({
        where: { id: pageId },
        data: { status: "OK", reason: null, processedAt: new Date(), fetchedAt: new Date(), title: String(full.name ?? "").slice(0, 300), contentHash: hash, outcome: { ...o, changed: [...new Set([...(o.changed ?? []), ...fields])], created: o.created || !existing, records: (o.records ?? 0) + 1 } },
      });
    }
  }, { timeout: 20_000 });
}

async function processG2Item(run: SyncRun, raw: unknown, ctx: G2Context) {
  const v = parseG2Item(raw);
  if (!v.ok) return bump(run.id, { g2Invalid: 1, g2Scanned: 1 });
  const rec = v.record;
  const bySlug = (slug: string) => ctx.catalog.find((c) => c.g2Slug === slug) ?? null;
  const attach = (entry: CatalogEntry, slug: string) => { entry.g2Slug = slug; };

  if (rec.kind === "listing") {
    const m = matchListing(rec, ctx.catalog);
    const entry = m ? ctx.catalog.find((c) => c.id === m.productId)! : null;
    if (!entry || !ctx.targets.has(entry.id) || rec.sponsored) return bump(run.id, { g2Scanned: 1, g2Unmatched: 1 });
    if (entry.g2Slug && entry.g2Slug !== rec.g2Slug) return bump(run.id, { g2Scanned: 1, g2Unmatched: 1 });
    const fresh = !entry.g2Slug;
    attach(entry, rec.g2Slug);
    await writeListing(run, ctx, entry.id, rec.g2Slug, listingPatch(rec, entry));
    if (rec.rating !== null) await addToRunList(run.id, "g2ExplicitRating", rec.g2Slug);
    if (fresh) await markNewlyMatched(run, entry.id);
    return bump(run.id, { g2Scanned: 1, g2Matched: 1 });
  }
  if (rec.kind === "competitor") {
    const source = bySlug(rec.sourceSlug);
    if (!source || !ctx.targets.has(source.id)) return bump(run.id, { g2Scanned: 1, g2Unmatched: 1 });
    const l = rec.listing;
    const cur = await db.g2Listing.findUnique({ where: { g2Slug: rec.sourceSlug }, select: { competitors: true } });
    const competitors = accumulate(cur?.competitors, run.id, { slug: l.g2Slug, name: l.name, domain: l.companyDomain, rank: rec.rank, rating: l.rating, reviewCount: l.reviewCount }, "slug", G2.maxCompetitorsKept);
    await writeListing(run, ctx, source.id, rec.sourceSlug, { competitors });
    // The competitor itself: an existing product gains its G2 link; an unknown one is a candidate.
    const m = matchListing(l, ctx.catalog);
    if (m) {
      const other = ctx.catalog.find((c) => c.id === m.productId)!;
      if (!other.g2Slug && m.by === "domain") {
        attach(other, l.g2Slug);
        await writeListing(run, { ...ctx, targets: new Map() }, other.id, l.g2Slug, listingPatch(l, other));
      }
    } else if (l.companyDomain && l.companyWebsite) {
      await writeListing(run, { ...ctx, targets: new Map() }, null, l.g2Slug, { ...listingPatch(l, null), status: "ACTIVE" });
    }
    return bump(run.id, { g2Scanned: 1, g2Competitors: 1 });
  }
  const entry = bySlug(rec.g2Slug);
  if (!entry || !ctx.targets.has(entry.id)) return bump(run.id, { g2Scanned: 1, g2Unmatched: 1 });
  if (rec.kind === "pricing") {
    // G2's copy of pricing is stored as source data only; published prices come from the official crawl.
    await writeListing(run, ctx, entry.id, rec.g2Slug, { pricing: { ...rec.data, dataAsOf: rec.dataAsOf?.toISOString() ?? null }, ...(rec.companyDomain ? { companyDomain: rec.companyDomain, domainConflict: !entry.domains.has(rec.companyDomain) } : {}) });
  } else if (rec.kind === "review_summary") {
    // The summary's rating scale is inferred; a listing row's explicit-scale rating from this run wins.
    const explicit = ((statsOf(await db.syncRun.findUniqueOrThrow({ where: { id: run.id }, select: { stats: true } })).g2ExplicitRating as string[] | undefined) ?? []).includes(rec.g2Slug);
    await writeListing(run, ctx, entry.id, rec.g2Slug, { reviewSummary: rec.data, ...(explicit ? {} : { rating: rec.data.rating }), reviewCount: rec.data.totalReviews, dataAsOf: rec.dataAsOf });
  } else if (rec.kind === "review") {
    const cur = await db.g2Listing.findUnique({ where: { g2Slug: rec.g2Slug }, select: { recentReviews: true } });
    await writeListing(run, ctx, entry.id, rec.g2Slug, { recentReviews: accumulate(cur?.recentReviews, run.id, rec.data, "id", G2.maxReviewsPerProduct) });
  }
  return bump(run.id, { g2Scanned: 1, g2Matched: 1 });
}

function listingPatch(l: G2ListingRecord, entry: CatalogEntry | null): ListingFields & { dataAsOf: Date | null; domainConflict?: boolean } {
  return {
    name: l.name, vendorName: l.vendorName, g2Url: l.g2Url, companyDomain: l.companyDomain, companyWebsite: l.companyWebsite, description: l.description, imageUrl: l.imageUrl,
    rating: l.rating, reviewCount: l.reviewCount, pricingType: l.pricingType, categories: l.categories, dataAsOf: l.dataAsOf,
    ...(entry && l.companyDomain ? { domainConflict: !entry.domains.has(l.companyDomain) } : {}),
  };
}

async function addToRunList(runId: string, key: string, value: string) {
  const r = await db.syncRun.findUniqueOrThrow({ where: { id: runId }, select: { stats: true } });
  const st = statsOf(r);
  const list = new Set([...((st[key] as string[] | undefined) ?? []), value]);
  await db.syncRun.update({ where: { id: runId }, data: { stats: { ...st, [key]: [...list] } as Prisma.InputJsonValue } });
}

const markNewlyMatched = (run: SyncRun, productId: string) => addToRunList(run.id, "g2NewlyMatched", productId);

/**
 * G2 products that at least two catalog products list as competitors in one category become draft
 * products (official URL from G2's company website, never an existing domain or slug). They publish
 * only when an editor completes the content the publish gate requires — nothing is invented for them.
 */
async function createCandidates(run: SyncRun): Promise<number> {
  const listings = await db.g2Listing.findMany({ where: { productId: { not: null } }, select: { competitors: true, product: { select: { categoryId: true } } } });
  const counts = new Map<string, Map<string, number>>();
  for (const l of listings) {
    const items = ((l.competitors as { items?: { slug: string }[] } | null)?.items ?? []).map((i) => i.slug);
    for (const slug of new Set(items)) {
      const byCat = counts.get(slug) ?? new Map<string, number>();
      byCat.set(l.product!.categoryId, (byCat.get(l.product!.categoryId) ?? 0) + 1);
      counts.set(slug, byCat);
    }
  }
  const candidates = await db.g2Listing.findMany({ where: { productId: null, status: "ACTIVE" } });
  const products = await db.product.findMany({ select: { slug: true, officialUrl: true } });
  const takenSlugs = new Set(products.map((p) => p.slug));
  const takenDomains = new Set(products.flatMap((p) => [...officialDomains(p.slug, p.officialUrl)]));
  let created = 0;
  for (const c of candidates) {
    const byCat = counts.get(c.g2Slug);
    const best = byCat ? [...byCat.entries()].sort((a, b) => b[1] - a[1])[0] : null;
    await db.g2Listing.update({ where: { id: c.id }, data: { mentions: best?.[1] ?? 0, candidateCategoryId: best?.[0] ?? null } });
    if (!best || best[1] < G2.candidateMinMentions || created >= G2.maxCandidatesCreatedPerRun) continue;
    if (!c.companyWebsite || !c.companyDomain || takenDomains.has(c.companyDomain)) continue;
    const slug = c.g2Slug;
    if (takenSlugs.has(slug) || productSlugProblem(slug)) continue;
    let officialUrl: string;
    try {
      const u = new URL(c.companyWebsite);
      if (u.protocol !== "https:" && u.protocol !== "http:") continue;
      officialUrl = `https://${u.host}/`;
    } catch {
      continue;
    }
    await db.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: { slug, name: c.name.slice(0, 120), vendor: c.vendorName?.slice(0, 120) ?? null, tagline: "", description: "", status: "DRAFT", categoryId: best[0], officialUrl, features: [], comparison: {}, autoCreatedAt: new Date() },
      });
      await tx.g2Listing.update({ where: { id: c.id }, data: { productId: p.id } });
      await tx.changeLog.create({ data: { productId: p.id, version: `sync-${new Date().toISOString().slice(0, 10)}`, summary: `Detected on G2 as a competitor of ${best[1]} catalog products; created as a draft by the automatic sync.` } });
    });
    takenSlugs.add(slug);
    takenDomains.add(c.companyDomain);
    created++;
  }
  if (created) console.info("[sync] PRODUCTS_CREATED", created, "draft(s) from G2");
  return created;
}

// ---------------- Phases / finalize ----------------

async function finishPhase(run: SyncRun): Promise<SyncRun> {
  const g2 = isG2Phase(run.phase);
  const succeeded = statsOf(run)[`apifyPhase${run.phase}`] === "SUCCEEDED";
  if (g2) {
    // A search that returned results but none on the product's official domain means "not on G2";
    // a known listing that returned nothing (or a failed run) is unavailable, and the listing is kept.
    await db.syncPage.updateMany({
      where: { runId: run.id, phase: run.phase, processedAt: null, url: { startsWith: "https://www.g2.com/search" } },
      data: succeeded ? { status: "NOT_FOUND", reason: "No G2 listing on the product's official domain", processedAt: new Date() } : { status: "UNAVAILABLE", reason: "No result returned: the G2 run failed, timed out or was blocked", processedAt: new Date() },
    });
  }
  // Anything the crawl did not return is recorded as unavailable (blocked, timed out or failed after retries).
  await db.syncPage.updateMany({
    where: { runId: run.id, phase: run.phase, processedAt: null },
    data: { status: "UNAVAILABLE", reason: g2 ? "No result returned for this G2 listing: blocked, timed out or failed" : "No result returned: blocked, timed out or failed after Apify retries", processedAt: new Date() },
  });
  if (run.phase === 1) {
    const discovered = await db.syncPage.findMany({ where: { runId: run.id, phase: 2 }, select: { url: true } });
    if (discovered.length) {
      const next = await db.syncRun.update({ where: { id: run.id }, data: { phase: 2, cursor: 0, status: "RUNNING", apifyRunId: null, apifyDatasetId: null } });
      const launched = await launch(next, crawlInput([...new Set(discovered.map((d) => d.url))]));
      if (launched) return launched;
      // Discovery is optional: a failed phase 2 must not fail the verified phase-1 work.
    }
    return afterOfficial(await db.syncRun.findUniqueOrThrow({ where: { id: run.id } }));
  }
  if (run.phase === 2) return afterOfficial(run);
  if (run.phase === 3) {
    const fresh = ((statsOf(await db.syncRun.findUniqueOrThrow({ where: { id: run.id } })).g2NewlyMatched as string[] | undefined) ?? []);
    if (fresh.length) return startG2(await db.syncRun.findUniqueOrThrow({ where: { id: run.id } }), 4, fresh);
  }
  return finalize(await db.syncRun.findUniqueOrThrow({ where: { id: run.id } }));
}

async function fail(run: SyncRun, error: string) {
  await db.syncRun.update({ where: { id: run.id }, data: { status: "FAILED", error: scrub(error), finishedAt: new Date(), durationMs: elapsed(run.startedAt) } });
  console.error("[sync] SYNC_FAILED", scrub(error));
}

type PageOutcome = { checked?: { sources: number; facts: number; plans: number }; reverified?: { sources: string[]; facts: string[]; plans: string[] }; proposals?: number; changed?: string[]; created?: boolean };

async function finalize(run: SyncRun): Promise<SyncRun> {
  if (run.status === "COMPLETED" || run.status === "PARTIAL" || run.status === "FAILED") return run;
  const pages = await db.syncPage.findMany({ where: { runId: run.id } });
  const phase1 = pages.filter((p) => p.phase === 1);
  const g2Pages = pages.filter((p) => p.phase === 3);
  const productIds = [...new Set(phase1.map((p) => p.productId))];
  const products: Record<string, { pages: number; ok: number; claims: number; reverified: number }> = {};
  let facts = 0, plans = 0, reverified = 0;
  const now = new Date();
  for (const pid of productIds) {
    const mine = phase1.filter((p) => p.productId === pid);
    const outs = mine.map((p) => (p.outcome ?? {}) as PageOutcome);
    const reverifiedPlans = new Set(outs.flatMap((o) => o.reverified?.plans ?? []));
    const claims = outs.reduce((n, o) => n + (o.checked ? o.checked.sources + o.checked.facts + o.checked.plans : 0), 0);
    const rev = outs.reduce((n, o) => n + (o.reverified ? o.reverified.sources.length + o.reverified.facts.length + o.reverified.plans.length : 0), 0);
    facts += outs.reduce((n, o) => n + (o.checked?.facts ?? 0), 0);
    plans += outs.reduce((n, o) => n + (o.checked?.plans ?? 0), 0);
    reverified += rev;
    products[pid] = { pages: mine.length, ok: mine.filter((p) => p.status === "OK").length, claims, reverified: rev };
    // "Last checked" for pricing moves only when every verified price was re-confirmed verbatim.
    const verified = await db.pricingSnapshot.findMany({ where: { productId: pid, status: "VERIFIED", plan: { not: null } }, select: { id: true } });
    if (verified.length && verified.every((v) => reverifiedPlans.has(v.id))) {
      const when = mine.filter((p) => p.status === "OK" && p.fetchedAt).map((p) => p.fetchedAt!.getTime());
      const at = new Date(when.length ? Math.max(...when) : now.getTime());
      await db.$transaction([
        db.product.updateMany({ where: { id: pid, OR: [{ pricingCheckedAt: null }, { pricingCheckedAt: { lt: at } }] }, data: { pricingCheckedAt: at } }),
        db.contentRefresh.updateMany({ where: { productId: pid, completedAt: null }, data: { completedAt: at, resolution: "Automated check: every verified price's official quote was still present on the pricing page." } }),
      ]);
    }
  }
  const productsAdded = g2Enabled() && !run.productId && g2Pages.some((p) => p.status === "OK") ? await createCandidates(run) : 0;

  const changes = await db.dataChange.findMany({ where: { runId: run.id }, select: { productId: true, status: true, reviewedBy: true } });
  const autoApplied = changes.filter((c) => c.status === "ACCEPTED" && c.reviewedBy === "auto-sync");
  const g2Changed = new Set(pages.filter((p) => p.phase >= 3 && ((p.outcome ?? {}) as PageOutcome).changed?.length).map((p) => p.productId));
  const updated = new Set([...autoApplied.map((c) => c.productId), ...g2Changed]);
  const scope = new Set(pages.map((p) => p.productId));
  const officialFailed = pages.filter((p) => p.phase <= 2 && p.status && p.status !== "OK").length;
  const g2Failed = g2Pages.filter((p) => p.status && p.status !== "OK" && p.status !== "NOT_FOUND").length;
  // A product's official home page returning 404/410 is flagged (never removed automatically).
  const gone = [...new Set(phase1.filter((p) => p.status === "NOT_FOUND").map((p) => p.productId))];
  const retiredFlagged = (await db.product.findMany({ where: { id: { in: gone } }, select: { id: true, officialUrl: true } }))
    .filter((p) => phase1.some((x) => x.productId === p.id && x.status === "NOT_FOUND" && x.url === normalizeUrl(p.officialUrl)))
    .map((p) => p.id);
  const g2NotFound = g2Pages.filter((p) => p.status === "NOT_FOUND").length;

  const prev = statsOf(run) as Record<string, unknown>;
  const stats = {
    ...prev,
    productsChecked: productIds.length,
    sourcesChecked: phase1.length,
    factsChecked: facts,
    pricesChecked: plans,
    claimsReverified: reverified,
    changesDetected: changes.length,
    sourcesUnavailable: officialFailed + g2Failed,
    validationFailures: pages.filter((p) => p.status === "MALFORMED").length + Number(prev.unmatched ?? 0) + Number(prev.g2Invalid ?? 0),
    linksDiscovered: pages.filter((p) => p.phase === 2).length,
    productsInScope: scope.size,
    productsAdded,
    productsUpdated: updated.size,
    productsUnchanged: [...scope].filter((id) => !updated.has(id)).length,
    productsRetiredFlagged: retiredFlagged.length,
    retiredFlagged,
    officialPagesOk: pages.filter((p) => p.phase <= 2 && p.status === "OK").length,
    g2ListingsOk: g2Pages.filter((p) => p.status === "OK").length,
    g2NotListed: g2NotFound,
    g2Unavailable: g2Failed,
    changesPending: changes.filter((c) => c.status === "PENDING").length,
    products,
  };
  const officialOk = !phase1.length || phase1.some((p) => p.status === "OK");
  const g2Ok = !g2Pages.length || g2Pages.some((p) => p.status === "OK" || p.status === "NOT_FOUND");
  const anySource = phase1.length || g2Pages.length;
  const status = !anySource || (!officialOk && !g2Ok) ? "FAILED" : !officialOk || !g2Ok || officialFailed || g2Failed ? "PARTIAL" : "COMPLETED";
  const done = await db.syncRun.update({
    where: { id: run.id },
    data: { status, stats: stats as Prisma.InputJsonValue, finishedAt: now, durationMs: elapsed(run.startedAt, now.getTime()), lockedUntil: null, error: status === "FAILED" ? (run.error ?? "No source could be fetched") : status === "COMPLETED" ? null : run.error },
  });
  console.info(status === "FAILED" ? "[sync] SYNC_FAILED" : "[sync] SYNC_COMPLETED", status, `updated ${updated.size}, added ${productsAdded}`);
  revalidateSite();
  return done;
}
