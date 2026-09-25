import type { PricePoint, Product } from "@/lib/content/types";
import { formatDate } from "@/lib/freshness-rules";

export const PRICING_FALLBACK = "Pricing varies — check the official pricing page.";

const PERIOD: Record<string, string> = { FREE: "Free", MONTHLY: "per month", ANNUAL: "per year", ONE_TIME: "one-time", USAGE: "usage-based", CUSTOM: "custom quote" };

/**
 * Formats a verified price. When the vendor's own unit wording was captured (e.g. "per user per
 * month, billed annually"), only the amount is returned and the unit is shown alongside it —
 * annual rows can be per-month equivalents or yearly totals, so we never infer the period.
 */
export function formatPrice(pt: Pick<PricePoint, "price" | "currency" | "billingPeriod"> & { unit?: string | null }): string {
  if (pt.billingPeriod === "FREE") return "Free";
  if (pt.price === null || !pt.currency) return pt.billingPeriod === "CUSTOM" ? "Custom — contact vendor" : "See vendor";
  const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: pt.currency, maximumFractionDigits: pt.price % 1 === 0 ? 0 : 2 }).format(pt.price);
  if (pt.unit) return amount;
  return pt.billingPeriod ? `${amount} ${PERIOD[pt.billingPeriod]}` : amount;
}

/** Amount plus the vendor's unit wording, for compact summaries. */
export function priceWithUnit(pt: Pick<PricePoint, "price" | "currency" | "billingPeriod" | "unit">): string {
  const amount = formatPrice(pt);
  return pt.unit && pt.price !== null ? `${amount} ${pt.unit}` : amount;
}

export function lastCheckedText(product: Pick<Product, "pricingLastChecked">): string {
  const date = formatDate(product.pricingLastChecked);
  return date ? `Last checked: ${date}` : "Last checked: not yet verified by our editors";
}

/** Short value for comparison tables; never shows an unverified price. */
export function pricingSummary(product: Pick<Product, "pricing">): string {
  if (!product.pricing.length) return "Varies — see official pricing";
  const plans = product.pricing.filter((p) => p.plan && p.price !== null && p.price > 0).slice(0, 1).map((p) => `From ${formatPrice(p)}${p.unit ? ` (${p.unit})` : ""}`);
  return plans.length ? plans.join("; ") : formatPrice(product.pricing[0]);
}

export type PricingStatusKind = "verified" | "region" | "custom" | "unverified";
export type PricingState = { kind: PricingStatusKind; tone: "ok" | "pending" | "info"; label: string; detail: string };

/**
 * Pricing status for badges, derived only from editor/evidence-verified snapshots:
 * verified, verified but region-dependent, custom (contact sales), or not yet verified.
 */
export function pricingState(product: Pick<Product, "pricing" | "pricingLastChecked" | "pricingRegionNote">): PricingState {
  const date = formatDate(product.pricingLastChecked);
  if (!product.pricing.length) return { kind: "unverified", tone: "pending", label: "Pricing not yet verified", detail: "Verify on the official pricing page" };
  if (product.pricing.every((p) => p.billingPeriod === "CUSTOM")) return { kind: "custom", tone: "info", label: "Custom pricing", detail: "Contact vendor" };
  if (product.pricingRegionNote || product.pricing.some((p) => p.regionDependent)) return { kind: "region", tone: "ok", label: date ? `Verified ${date.replace(/, \d{4}$/, "")} · region-dependent` : "Region-dependent pricing", detail: product.pricingRegionNote ?? "Pricing varies by region" };
  return { kind: "verified", tone: "ok", label: date ? `✓ Verified ${date}` : "Pricing verified", detail: "Official pricing" };
}
