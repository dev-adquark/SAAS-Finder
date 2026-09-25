import type { Product } from "@/lib/content/types";
import { isHttpUrl } from "@/lib/validation";

export type OutboundTarget = { url: string; kind: "affiliate" | "official" };

/**
 * Resolves where `/go/{slug}` may send a visitor. Only URLs stored on the product record are ever
 * used (never request input), so the endpoint cannot be abused as an open redirect.
 * Affiliate links must be verified, active and HTTPS; otherwise the official vendor URL is used.
 */
export function resolveOutbound(product: Pick<Product, "affiliate" | "officialUrl">): OutboundTarget | null {
  const affiliate = product.affiliate?.url;
  if (affiliate && isHttpUrl(affiliate) && new URL(affiliate).protocol === "https:") return { url: affiliate, kind: "affiliate" };
  if (!isHttpUrl(product.officialUrl)) return null;
  const url = new URL(product.officialUrl);
  // UTM tags are only added to non-affiliate links so partner tracking parameters are never altered.
  url.searchParams.set("utm_source", "saasfinder");
  url.searchParams.set("utm_medium", "referral");
  return { url: url.toString(), kind: "official" };
}
