import type { FactRef, PricePoint, SourceRef } from "@/lib/content/types";
import type { ResearchRecord } from "@/lib/content/seed/research-types";

export const RESEARCH_VERIFIER = "SaaSFinder research — official page, evidence-matched";

const iso = (d: string) => new Date(`${d}T00:00:00.000Z`).toISOString();

/** Region note grounded in what we observed: the currency the vendor served to our check location. */
export function regionNoteFor(r: ResearchRecord): string | null {
  const cur = r.pricing.currencySeen;
  if (!r.pricing.plans.length) return null;
  if (cur && cur !== "USD") return `Prices captured in ${cur} as served to our research location; the vendor may show different prices and currencies elsewhere.`;
  return null;
}

export function researchPricing(r: ResearchRecord): PricePoint[] {
  const region = Boolean(regionNoteFor(r));
  return r.pricing.plans.map((p) => ({
    plan: p.plan,
    price: p.price,
    currency: p.currency,
    billingPeriod: (["MONTHLY", "ANNUAL", "FREE", "CUSTOM"].includes(p.billingPeriod) ? p.billingPeriod : "CUSTOM") as PricePoint["billingPeriod"],
    note: p.notes ?? "",
    sourceUrl: r.pricing.sourceUrl,
    sourceType: "OFFICIAL_PRICING_PAGE",
    capturedAt: iso(r.checkedAt),
    unit: p.unit,
    perSeat: p.perSeat,
    promotional: p.promotional,
    regionDependent: region,
  }));
}

export const researchSources = (r: ResearchRecord): SourceRef[] =>
  r.sources.map((s) => ({ kind: s.kind as SourceRef["kind"], url: s.url, name: s.name, section: null, checkedAt: iso(r.checkedAt), status: "VERIFIED" }));

export const researchFacts = (r: ResearchRecord): FactRef[] =>
  r.facts.map((f) => ({ key: f.key, value: f.value, evidence: f.evidence, sourceUrl: f.sourceUrl, checkedAt: iso(r.checkedAt), status: "VERIFIED" }));
