// Visual availability indicators derived *conservatively* from stored editorial text.
// They never replace the text (always shown next to it) and never produce numeric scores.

export type Indicator = "included" | "varies" | "none" | "verify";

export const INDICATOR_LABEL: Record<Indicator, string> = { included: "Included", varies: "Varies", none: "Not available", verify: "Verify" };

export function indicatorFor(value: string | undefined): Indicator | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (/^(no|none|not available|not included|unavailable)\b/.test(v)) return "none";
  if (/(varies|depending|depends|plan-dependent|by plan|edition-based|check vendor|trial|limited|paid tiers?|add-on|higher tiers?)/.test(v)) return "varies";
  if (/^(yes|included|built-in|built in|native)\b/.test(v) || /\bincluded\b/.test(v)) return "included";
  return null;
}
