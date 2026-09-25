// Pure freshness calculations (no database access) shared by the cron job, admin UI and pages.

export const DEFAULT_REFRESH_AFTER_DAYS = 90;
export const DUE_SOON_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export type FreshnessState = "never-checked" | "fresh" | "due-soon" | "overdue";

export function refreshTargetDays(override: number | null | undefined): number {
  if (typeof override === "number" && Number.isInteger(override) && override >= 1 && override <= 3650) return override;
  return DEFAULT_REFRESH_AFTER_DAYS;
}

/** Latest of the explicit "pricing checked" timestamp and the newest verified snapshot capture. */
export function lastCheckedAt(pricingCheckedAt: Date | null | undefined, latestVerifiedCapture: Date | null | undefined): Date | null {
  const candidates = [pricingCheckedAt, latestVerifiedCapture].filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()));
  if (!candidates.length) return null;
  return new Date(Math.max(...candidates.map((d) => d.getTime())));
}

export function freshness(lastChecked: Date | null, targetDays: number, now = new Date()) {
  if (!lastChecked) return { state: "never-checked" as FreshnessState, dueAt: null, daysUntilDue: null };
  const dueAt = new Date(lastChecked.getTime() + targetDays * DAY_MS);
  const daysUntilDue = Math.floor((dueAt.getTime() - now.getTime()) / DAY_MS);
  const state: FreshnessState = daysUntilDue < 0 ? "overdue" : daysUntilDue <= DUE_SOON_DAYS ? "due-soon" : "fresh";
  return { state, dueAt, daysUntilDue };
}

export function needsRefresh(lastChecked: Date | null, targetDays: number, now = new Date()): boolean {
  const { state } = freshness(lastChecked, targetDays, now);
  return state === "never-checked" || state === "overdue";
}

/** Formats a date for "Last checked" copy; stable across server locales. */
export function formatDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}
