// Hard, explicit single-call guard for scheduled triggers. Within one invocation of a scheduled
// trigger (one external hit on the cron route, one webhook delivery, or one self-continuation "hop"
// — see advanceInBackground in lib/sync/schedule.ts), each distinct outbound call to a paid/billable
// API may be claimed at most once: the first claim for a given key succeeds, every later one for the
// SAME key — a genuine second attempt in the same invocation, or a retry after that call failed — is
// refused outright and never reaches the network.
//
// This is deliberately independent of, and in addition to, the per-run-attempt budget cap in
// lib/sync/preflight.ts: the budget bounds the total spend across every hop of a run's full
// background continuation (persisted in the database, so it survives across separate requests); this
// guard bounds a single invocation in memory, catching a future bug that calls out twice within one
// request before any database write could have recorded the first call.
//
// Scoped to scheduled triggers only — a manual, admin-initiated sync is never wrapped in a trigger
// context, so claimOutboundCall is a permissive no-op there and manual-sync behavior is unchanged.
import { AsyncLocalStorage } from "node:async_hooks";

type TriggerContext = { label: string; claimed: Set<string> };
const als = new AsyncLocalStorage<TriggerContext>();

/** Establishes a fresh single-call-budget context for one trigger invocation. */
export function runAsTrigger<T>(label: string, fn: () => Promise<T>): Promise<T> {
  return als.run({ label, claimed: new Set() }, fn);
}

export type Claim = { ok: true } | { ok: false; reason: string };

/**
 * Claims the right to make one outbound call identified by `key` within the current trigger
 * invocation. Outside a trigger context (a manual/admin sync, a script, a test calling the sync
 * pipeline directly) this always succeeds, so nothing about manual syncs changes.
 */
export function claimOutboundCall(key: string): Claim {
  const ctx = als.getStore();
  if (!ctx) return { ok: true };
  if (ctx.claimed.has(key)) return { ok: false, reason: `This trigger (${ctx.label}) already made this exact call; a second attempt is refused, never retried` };
  ctx.claimed.add(key);
  return { ok: true };
}
