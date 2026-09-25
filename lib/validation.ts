export const CONTENT_STATUSES = ["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"] as const;
export type ContentStatusValue = (typeof CONTENT_STATUSES)[number];

export const SNAPSHOT_TYPES = ["PRICING", "FEATURE", "GENERAL"] as const;
export type SnapshotTypeValue = (typeof SNAPSHOT_TYPES)[number];

export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function slugify(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function isRating(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 5;
}

export function isRatingOrNull(value: unknown): boolean {
  return value === null || value === undefined || isRating(value);
}

export function isContentStatus(value: unknown): value is ContentStatusValue {
  return typeof value === "string" && CONTENT_STATUSES.includes(value as ContentStatusValue);
}

export function isSnapshotType(value: unknown): value is SnapshotTypeValue {
  return typeof value === "string" && SNAPSHOT_TYPES.includes(value as SnapshotTypeValue);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown, maxLength = 500): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}

export function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

export function parseOptionalDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}
/** Parses an optional integer query parameter; missing, blank or non-numeric values use the fallback. */
export function boundedInt(value: string | null | undefined, fallback: number, min: number, max: number): number {
  if (value === null || value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), min), max);
}
