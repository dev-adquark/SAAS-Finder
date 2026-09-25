import Link from "next/link";
import type { Product } from "@/lib/content/types";
import { campaignQuery, type CtaType } from "@/lib/analytics";
import { routes, type PageType } from "@/lib/seo/routes";
import { TrackedLink } from "@/components/tracked-link";

type CtaProps = {
  product: Pick<Product, "slug" | "name" | "affiliate">;
  ctaType: CtaType;
  placement: string;
  pageType: PageType;
  pageSlug: string;
  label?: string;
};

// The one outbound CTA used across the site. Every CTA routes through `/go/{slug}` with campaign
// metadata, and is labelled truthfully as an affiliate or an official vendor link.
export function AffiliateCta({ product, ctaType, placement, pageType, pageSlug, label }: CtaProps) {
  const isAffiliate = Boolean(product.affiliate);
  const href = routes.go(product.slug) + campaignQuery({ pageType, pageSlug, ctaType, placement });
  const text = label ?? (isAffiliate ? `Visit ${product.name}` : `Visit ${product.name} official site`);
  const rel = isAffiliate ? "sponsored nofollow noopener" : "nofollow noopener";
  const campaign = { product: product.slug, pageType, pageSlug, ctaType, placement };
  const className = ctaType === "inline" ? "cta-inline" : `btn ${ctaType === "hero" || ctaType === "button" ? "primary" : "secondary"}`;
  return (
    <span className={`cta cta-${ctaType}`} data-cta-type={ctaType} data-cta-kind={isAffiliate ? "affiliate" : "official"}>
      <TrackedLink href={href} rel={rel} className={className} campaign={campaign}>
        {text} <span aria-hidden="true">↗</span>
      </TrackedLink>
      <span className="cta-note">{isAffiliate ? <Link href={routes.disclosure()}>Affiliate link</Link> : "Official vendor site"}</span>
    </span>
  );
}
