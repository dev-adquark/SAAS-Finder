export const CONTENT_STATUSES = ["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"] as const;
export type ContentStatusValue = (typeof CONTENT_STATUSES)[number];

export const SNAPSHOT_TYPES = ["PRICING", "FEATURE", "GENERAL"] as const;
export type SnapshotTypeValue = (typeof SNAPSHOT_TYPES)[number];

export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value);
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
