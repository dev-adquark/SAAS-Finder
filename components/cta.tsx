"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { trackEvent } from "@/lib/events";

export function VendorCTA({ product, compact = false }: { product: { slug: string; name: string; officialUrl: string; affiliateUrl?: string; affiliateAvailable: boolean }; compact?: boolean }) {
  const href = `/go/${product.slug}`;
  return (
    <Link
      className="btn primary"
      href={href}
      rel="nofollow sponsored"
      onClick={() => trackEvent(product.affiliateAvailable ? "affiliate_click" : "cta_click", { product: product.slug, placement: compact ? "compact" : "primary" })}
    >
      {compact ? "Visit vendor" : "Check current plans"} <ArrowUpRight size={16} />
    </Link>
  );
}
