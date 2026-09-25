import type { PageType } from "@/lib/seo/routes";
import { isHttpUrl } from "@/lib/validation";

// Sponsor placements are configured data-first and are rendered completely separately from
// editorial selection: no ranking, alternatives or best-for logic reads sponsor data.

export const SPONSOR_PAGE_TYPES = ["product", "alternatives", "compare", "best", "category"] as const satisfies readonly PageType[];
export type SponsorPageType = (typeof SPONSOR_PAGE_TYPES)[number];

export const SPONSOR_PLACEMENTS = ["sidebar", "inline"] as const;
export type SponsorPlacement = (typeof SPONSOR_PLACEMENTS)[number];

/** Minimum priority a slot needs to render per placement (inline placements are more intrusive). */
export const SPONSOR_MIN_PRIORITY: Record<SponsorPlacement, number> = { sidebar: 0, inline: 10 };

export const SPONSOR_LABEL = "Sponsored";

export type SponsorRecord = {
  id: string;
  title: string;
  label: string;
  description: string | null;
  pageType: string;
  placement: string;
  priority: number;
  active: boolean;
  url: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
};

export const isSponsorPageType = (v: unknown): v is SponsorPageType => typeof v === "string" && (SPONSOR_PAGE_TYPES as readonly string[]).includes(v);
export const isSponsorPlacement = (v: unknown): v is SponsorPlacement => typeof v === "string" && (SPONSOR_PLACEMENTS as readonly string[]).includes(v);

/** Every rule a slot must pass before it may render. */
export function isRenderableSponsor(s: SponsorRecord, now = new Date()): boolean {
  if (!s.active) return false;
  if (!s.title?.trim() || !s.label?.trim() || !s.url || !isHttpUrl(s.url)) return false;
  if (!isSponsorPageType(s.pageType) || !isSponsorPlacement(s.placement)) return false;
  if (s.startsAt && s.startsAt > now) return false;
  if (s.endsAt && s.endsAt < now) return false;
  return s.priority >= SPONSOR_MIN_PRIORITY[s.placement];
}

export function pickSponsor(slots: SponsorRecord[], pageType: SponsorPageType, placement: SponsorPlacement, now = new Date()): SponsorRecord | null {
  return (
    slots
      .filter((s) => s.pageType === pageType && s.placement === placement && isRenderableSponsor(s, now))
      .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))[0] ?? null
  );
}

/** Public label always contains the word "Sponsored", whatever the configured label says. */
export function sponsorDisplayLabel(label: string): string {
  const clean = label.trim();
  return /sponsored/i.test(clean) ? clean : clean ? `${SPONSOR_LABEL} · ${clean}` : SPONSOR_LABEL;
}
