import { db } from "@/lib/db";
import type { AnalyticsRecord } from "@/lib/analytics";

/** Persists an analytics event. Never throws: analytics must not break page or redirect flows. */
export async function recordEvent(record: AnalyticsRecord): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  try {
    await db.analyticsEvent.create({ data: { ...record, metadata: record.metadata ?? undefined } });
    return true;
  } catch (error) {
    console.error("[analytics] write failed", error instanceof Error ? error.name : "unknown");
    return false;
  }
}
