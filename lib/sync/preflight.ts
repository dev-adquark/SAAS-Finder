// Preflight validation gate for every external call the sync system makes (an Apify actor start, or
// the Logo.dev batch of a run's phase 5). Runs entirely inside the lock the caller already holds,
// immediately before the network call — so a failed check guarantees the call is never sent: no
// retry, no duplicate, no spend. Every failure carries the exact reason the call was skipped, logged
// through the run's existing error trail (see recordError in lib/sync/run.ts) so it is visible on the
// admin sync dashboard without any UI change.
//
// Checks, cheapest/local first so a bad call never reaches the database or the network:
//   1. token      — the credential this call needs is present and not a placeholder.
//   2. input      — the request payload has at least one real target and is a sane size.
//   3. budget     — a hard ceiling on actor calls within one run attempt (in-memory, no DB round
//                    trip), so a bug that loops phase transitions can never spend an unbounded number
//                    of calls. One run attempt is the right scope: a SyncRun row is reused (not
//                    duplicated) across retries of the same 31-day cycle (cycleKey is unique), and
//                    each reuse resets stats, so cross-attempt spend is already bounded by
//                    SYNC.maxAttempts in lib/sync/run.ts — the two caps compose (attempts × perRun)
//                    instead of overlapping.
//   4. database   — the schema is reachable and queryable (catches an unapplied migration or an
//                    unreachable database before spending a call whose result could never be saved).
//   5. run state  — the run this call belongs to is still active (guards a race with a concurrent
//                    cleanup/finalize that marked it done between the caller's lock claim and now).
import type { SyncRun } from "@prisma/client";
import { db } from "@/lib/db";

export type Preflight = { ok: true } | { ok: false; reason: string };

const ok: Preflight = { ok: true };
const fail = (reason: string): Preflight => ({ ok: false, reason });

/** A credential is present, trimmed non-empty, contains no whitespace, and is not a placeholder. */
export function checkToken(envName: string, value: string | null | undefined): Preflight {
  const v = value?.trim();
  if (!v) return fail(`${envName} is not configured`);
  if (/\s/.test(v)) return fail(`${envName} contains whitespace and cannot be a valid token`);
  if (/^(changeme|placeholder|x{3,}|your[-_]?token|xxx)$/i.test(v)) return fail(`${envName} is still a placeholder value`);
  return ok;
}

/** The request payload about to be sent has a real target and is within a sane size bound (Apify's
 * own limit is far larger; a payload past this can only be a bug, e.g. an unbounded URL list). */
const MAX_INPUT_BYTES = 256_000;
export function checkRequestInput(input: unknown): Preflight {
  if (!input || typeof input !== "object") return fail("Request input is empty or malformed");
  const o = input as Record<string, unknown>;
  const urlCount = Array.isArray(o.startUrls) ? o.startUrls.length : 0;
  const queryCount = Array.isArray(o.searchQueries) ? o.searchQueries.length : 0;
  if (urlCount + queryCount === 0) return fail("Request input has no URLs or search queries to fetch");
  let size: number;
  try {
    size = Buffer.byteLength(JSON.stringify(input), "utf8");
  } catch {
    return fail("Request input could not be serialized to JSON");
  }
  if (size > MAX_INPUT_BYTES) return fail(`Request input is ${size} bytes, over the ${MAX_INPUT_BYTES}-byte safety cap`);
  return ok;
}

export type BudgetCaps = { perRun: number };
export const DEFAULT_BUDGET: BudgetCaps = { perRun: Number(process.env.SYNC_MAX_ACTOR_CALLS_PER_RUN) || 6 };

const actorCallCount = (stats: unknown): number => {
  const runs = (stats as { actorRuns?: unknown[] } | null)?.actorRuns;
  return Array.isArray(runs) ? runs.length : 0;
};

/** Pure budget arithmetic, unit-testable without a database. */
export function budgetOk(usedInRun: number, caps: BudgetCaps = DEFAULT_BUDGET): Preflight {
  if (usedInRun >= caps.perRun) return fail(`Actor call budget exhausted for this run attempt: ${usedInRun}/${caps.perRun} calls already made`);
  return ok;
}

/** The database schema is reachable and queryable. Classifies Prisma's own error code so an
 * unapplied migration (P2021/P2022) is distinguished from an unreachable database (P1001/P1017). */
export async function checkDatabase(): Promise<Preflight> {
  try {
    await db.syncRun.count();
    return ok;
  } catch (e) {
    const code = (e as { code?: string } | null)?.code;
    if (code === "P2021" || code === "P2022") return fail(`Database schema is out of date (${code}): apply pending migrations before the next sync`);
    if (code === "P1001" || code === "P1017") return fail(`Database is unreachable (${code})`);
    return fail(`Database is not writable: ${e instanceof Error ? e.message : "unknown error"}`);
  }
}

/** The run this call belongs to is still active — guards a race with a concurrent cleanup/finalize
 * that could have marked it done between the caller's lock claim and this check. */
export async function checkRunWritable(runId: string): Promise<Preflight> {
  const r = await db.syncRun.findUnique({ where: { id: runId }, select: { status: true } });
  if (!r) return fail("The sync run no longer exists");
  if (r.status !== "RUNNING" && r.status !== "PROCESSING") return fail(`The sync run is ${r.status}, not active`);
  return ok;
}

/**
 * Full preflight for one Apify actor call (official crawl or G2). Stops at the first failing check —
 * cheap, local checks before any database or network round trip — so a bad call is caught as early
 * and as cheaply as possible, and never reaches `startActorRun`.
 */
export async function preflightActorCall(opts: {
  run: Pick<SyncRun, "id" | "stats">;
  tokenEnv: string;
  token: string | null | undefined;
  input: unknown;
  caps?: BudgetCaps;
}): Promise<Preflight> {
  const token = checkToken(opts.tokenEnv, opts.token);
  if (!token.ok) return token;
  const input = checkRequestInput(opts.input);
  if (!input.ok) return input;
  const budget = budgetOk(actorCallCount(opts.run.stats), opts.caps);
  if (!budget.ok) return budget;
  const database = await checkDatabase();
  if (!database.ok) return database;
  return checkRunWritable(opts.run.id);
}

/** Preflight for starting the Logo.dev batch (phase 5): no per-call input to validate (each domain is
 * checked individually inside the phase), so this gates the phase itself before any page is queued. */
export async function preflightLogoPhase(run: Pick<SyncRun, "id" | "stats">, tokenEnv: string, token: string | null | undefined): Promise<Preflight> {
  const t = checkToken(tokenEnv, token);
  if (!t.ok) return t;
  const database = await checkDatabase();
  if (!database.ok) return database;
  return checkRunWritable(run.id);
}
