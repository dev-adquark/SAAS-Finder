// Weekly research sync orchestration: start → (Apify crawl) → resumable processing → finalize.
// Automated writes are limited to re-confirming verified claims whose verbatim evidence is still on
// the official page (check dates). Everything else becomes a DataChange for editorial review, so a
// failed, blocked or partial run can never remove or overwrite good data.
import { createHmac } from "node:crypto";
import type { Prisma, SyncPageStatus, SyncRun, SyncTrigger } from "@prisma/client";
import { db } from "@/lib/db";
import { siteUrl } from "@/lib/site";
import { revalidateSite } from "@/lib/admin/services";
import { isOfficialUrl, officialDomains } from "@/lib/research/evidence";
import { abortRun, apifyConfigured, datasetItems, getRun, scrub, startActorRun, TERMINAL } from "@/lib/sync/apify";
import { crawlInput } from "@/lib/sync/crawl-input";
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
};

export class SyncError extends Error {}

const ACTIVE = ["RUNNING", "PROCESSING"] as const;
const DAY = 86_400_000;

/** Elapsed milliseconds clamped to a valid INT4 (clock skew or a very old run must not break writes). */
export const elapsed = (from: Date, to = Date.now()) => Math.max(0, Math.min(to - from.getTime(), 2_147_483_647));

/** ISO-8601 week key, e.g. "2026-W39". */
export function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const year = t.getUTCFullYear();
  const week = Math.ceil(((t.getTime() - Date.UTC(year, 0, 1)) / DAY + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/**
 * Next automatic sync attempt. The cron ticks daily at 04:00 UTC (vercel.json) and starts a sync once
 * per ISO week: if this week has not synced successfully the next tick will try, otherwise the first
 * tick of next week (Monday).
 */
export function nextScheduledRun(now = new Date(), doneThisWeek = true): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 4, 0, 0));
  if (d <= now) d.setUTCDate(d.getUTCDate() + 1);
  if (!doneThisWeek) return d;
  while (isoWeekKey(d) === isoWeekKey(now)) d.setUTCDate(d.getUTCDate() + 1);
  return d;
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

export async function startSync(opts: { trigger: SyncTrigger; productId?: string; now?: Date }): Promise<StartResult> {
  const now = opts.now ?? new Date();
  if (!apifyConfigured()) throw new SyncError("APIFY_API_TOKEN is not configured. Add it to the server environment to enable automated research.");
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
  const weekKey = opts.trigger === "SCHEDULED" ? isoWeekKey(now) : null;
  if (weekKey) {
    const existing = await db.syncRun.findUnique({ where: { weekKey } });
    if (existing && existing.status !== "FAILED") return { run: existing, started: false, reason: `Already synced for ${weekKey}` };
    if (existing && existing.attempts >= SYNC.maxAttempts) return { run: existing, started: false, reason: `Gave up after ${existing.attempts} attempts for ${weekKey}` };
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

  const run = await db.$transaction(async (tx) => {
    const data = { trigger: opts.trigger, status: "RUNNING" as const, productId: opts.productId ?? null, phase: 1, cursor: 0, apifyRunId: null, apifyDatasetId: null, error: null, finishedAt: null, durationMs: null, lockedUntil: null, startedAt: now, stats: {} };
    const r = reuse
      ? await tx.syncRun.update({ where: { id: reuse.id }, data: { ...data, attempts: { increment: 1 } } })
      : await tx.syncRun.create({ data: { ...data, weekKey } });
    if (reuse) await tx.syncPage.deleteMany({ where: { runId: r.id } });
    await tx.syncPage.createMany({ data: pages.map((p) => ({ ...p, runId: r.id })), skipDuplicates: true });
    return r;
  });
  return { run: await launch(run, [...new Set(pages.map((p) => p.url))]), started: true };
}

async function launch(run: SyncRun, urls: string[]): Promise<SyncRun> {
  try {
    const a = await startActorRun(crawlInput(urls), { timeoutSecs: SYNC.actorTimeoutSecs, memoryMbytes: SYNC.actorMemoryMb, webhook: webhook() });
    return db.syncRun.update({ where: { id: run.id }, data: { apifyRunId: a.id, apifyDatasetId: a.defaultDatasetId, status: "RUNNING", cursor: 0 } });
  } catch (e) {
    return db.syncRun.update({ where: { id: run.id }, data: { status: "FAILED", error: scrub(`Could not start the Apify crawl: ${e instanceof Error ? e.message : "unknown error"}`), finishedAt: new Date(), durationMs: elapsed(run.startedAt) } });
  }
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
        if (clock() - run.startedAt.getTime() < SYNC.stuckAfterMs) return { runId, state: "waiting", processed };
        await abortRun(run.apifyRunId).catch(() => {});
      }
      run = await db.syncRun.update({ where: { id: run.id }, data: { status: "PROCESSING", apifyDatasetId: a.defaultDatasetId || run.apifyDatasetId, stats: { ...(run.stats as object), [`apifyPhase${run.phase}`]: a.status } } });
    }
    const claims = new Map<string, ProductClaims>();
    while (clock() < deadline) {
      const items = run.apifyDatasetId ? await datasetItems(run.apifyDatasetId, run.cursor, SYNC.batchSize) : [];
      if (!items.length) {
        const done = await finishPhase(run);
        return { runId, state: done.status === "FAILED" ? "failed" : done.status === "RUNNING" ? "waiting" : "finished", processed };
      }
      for (const item of items) {
        await processItem(run, item, claims);
        run = { ...run, cursor: run.cursor + 1 };
        processed++;
      }
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
        data: { error: msg, ...(skip ? { cursor: { increment: 1 } } : {}), stats: { ...s, errorCursor: skip ? -1 : r.cursor, errorCount: skip ? 0 : count, ...(skip ? { unmatched: (s.unmatched ?? 0) + 1 } : {}) } },
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

async function processItem(run: SyncRun, raw: unknown, cache: Map<string, ProductClaims>) {
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
        if (existing) {
          // Decided proposals stay decided; an open one is just seen again.
          if (existing.status === "PENDING") await tx.dataChange.update({ where: { id: existing.id }, data: { lastSeenAt: new Date(), runId: run.id } });
          continue;
        }
        await tx.dataChange.create({
          data: {
            runId: run.id, productId: e.page.productId, kind: p.kind, field: p.field.slice(0, 300), targetId: p.targetId, previousValue: p.previousValue?.slice(0, 2000) ?? null,
            newValue: p.newValue?.slice(0, 2000) ?? null, sourceUrl: p.sourceUrl.slice(0, 2000), evidence: p.evidence?.slice(0, 2000) ?? null, payload: (p.payload ?? undefined) as Prisma.InputJsonValue | undefined, dedupeKey: dk,
          },
        });
      }
    }
    const stats = (await tx.syncRun.findUniqueOrThrow({ where: { id: run.id }, select: { stats: true } })).stats as Record<string, number>;
    await tx.syncRun.update({ where: { id: run.id }, data: { cursor: { increment: 1 }, ...(unmatched ? { stats: { ...stats, unmatched: (stats.unmatched ?? 0) + 1 } } : {}) } });
  }, { timeout: 20_000 });
}

async function finishPhase(run: SyncRun): Promise<SyncRun> {
  // Anything the crawl did not return is recorded as unavailable (blocked, timed out or failed after retries).
  await db.syncPage.updateMany({
    where: { runId: run.id, phase: run.phase, processedAt: null },
    data: { status: "UNAVAILABLE", reason: "No result returned: blocked, timed out or failed after Apify retries", processedAt: new Date() },
  });
  if (run.phase === 1) {
    const discovered = await db.syncPage.findMany({ where: { runId: run.id, phase: 2 }, select: { url: true } });
    if (discovered.length) {
      const next = await db.syncRun.update({ where: { id: run.id }, data: { phase: 2, cursor: 0, status: "RUNNING", apifyRunId: null, apifyDatasetId: null } });
      const launched = await launch(next, [...new Set(discovered.map((d) => d.url))]);
      if (launched.status !== "FAILED") return launched;
      // Discovery is optional: a failed phase 2 must not fail the verified phase-1 work.
      await db.syncPage.updateMany({ where: { runId: run.id, phase: 2, processedAt: null }, data: { status: "UNAVAILABLE", reason: "Link validation crawl could not start", processedAt: new Date() } });
      return finalize({ ...launched, error: launched.error });
    }
  }
  return finalize(run);
}

async function fail(run: SyncRun, error: string) {
  await db.syncRun.update({ where: { id: run.id }, data: { status: "FAILED", error: scrub(error), finishedAt: new Date(), durationMs: elapsed(run.startedAt) } });
}

type PageOutcome = { checked?: { sources: number; facts: number; plans: number }; reverified?: { sources: string[]; facts: string[]; plans: string[] }; proposals?: number };

async function finalize(run: SyncRun): Promise<SyncRun> {
  const pages = await db.syncPage.findMany({ where: { runId: run.id } });
  const phase1 = pages.filter((p) => p.phase === 1);
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
        db.contentRefresh.updateMany({ where: { productId: pid, completedAt: null }, data: { completedAt: at, resolution: "Automated weekly check: every verified price's official quote was still present on the pricing page." } }),
      ]);
    }
  }
  const changes = await db.dataChange.count({ where: { runId: run.id } });
  const ok = pages.filter((p) => p.status === "OK").length;
  const unavailable = pages.filter((p) => p.status && p.status !== "OK").length;
  const prev = (run.stats ?? {}) as Record<string, unknown>;
  const stats = {
    ...prev,
    productsChecked: productIds.length,
    sourcesChecked: phase1.length,
    factsChecked: facts,
    pricesChecked: plans,
    claimsReverified: reverified,
    changesDetected: changes,
    sourcesUnavailable: unavailable,
    validationFailures: pages.filter((p) => p.status === "MALFORMED").length + Number(prev.unmatched ?? 0),
    linksDiscovered: pages.filter((p) => p.phase === 2).length,
    products,
  };
  const status = phase1.length && !phase1.some((p) => p.status === "OK") ? "FAILED" : unavailable ? "PARTIAL" : "COMPLETED";
  const done = await db.syncRun.update({
    where: { id: run.id },
    data: { status, stats: stats as Prisma.InputJsonValue, finishedAt: now, durationMs: elapsed(run.startedAt, now.getTime()), error: status === "FAILED" ? (run.error ?? "No official page could be fetched") : ok ? null : run.error },
  });
  revalidateSite();
  return done;
}
