import type { PricePoint, Product } from "@/lib/content/types";
import { formatDate } from "@/lib/freshness-rules";

export const PRICING_FALLBACK = "Pricing varies — check the official pricing page.";

const PERIOD: Record<string, string> = { FREE: "Free", MONTHLY: "per month", ANNUAL: "per year", ONE_TIME: "one-time", USAGE: "usage-based", CUSTOM: "custom quote" };

export function formatPrice(pt: PricePoint): string {
  if (pt.billingPeriod === "FREE") return "Free";
  if (pt.price === null || !pt.currency) return pt.billingPeriod === "CUSTOM" ? "Custom quote" : "See vendor";
  const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: pt.currency }).format(pt.price);
  return pt.billingPeriod ? `${amount} ${PERIOD[pt.billingPeriod]}` : amount;
}

export function lastCheckedText(product: Pick<Product, "pricingLastChecked">): string {
  const date = formatDate(product.pricingLastChecked);
  return date ? `Last checked: ${date}` : "Last checked: not yet verified by our editors";
}

/** Short value for comparison tables; never shows an unverified price. */
export function pricingSummary(product: Pick<Product, "pricing">): string {
  if (!product.pricing.length) return "Varies — see official pricing";
  const plans = product.pricing.filter((p) => p.plan).slice(0, 2).map((p) => `${p.plan}: ${formatPrice(p)}`);
  return plans.length ? plans.join("; ") : formatPrice(product.pricing[0]);
}
