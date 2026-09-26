// Background continuation for sync processing. Work runs after the response is sent (next/server
// `after`), and long runs hand off to a fresh invocation so no function exceeds its duration limit.
import { after } from "next/server";
import { siteUrl } from "@/lib/site";
import { advanceSyncs } from "@/lib/sync/run";

export const MAX_HOPS = 40;

/** Runs `fn` after the response when inside a request; runs it immediately otherwise (scripts/tests). */
export function defer(fn: () => Promise<unknown>) {
  try {
    after(fn);
  } catch {
    void fn().catch(() => {});
  }
}

/** Processes active runs for one time budget, then re-invokes itself if work remains. */
export function advanceInBackground(hop = 0) {
  defer(async () => {
    const { more } = await advanceSyncs();
    const secret = process.env.CRON_SECRET;
    if (!more || !secret || hop >= MAX_HOPS) return;
    await fetch(new URL(`/api/cron/apify-sync?mode=advance&hop=${hop + 1}`, siteUrl), { headers: { authorization: `Bearer ${secret}` }, cache: "no-store" }).catch(() => {});
  });
}
