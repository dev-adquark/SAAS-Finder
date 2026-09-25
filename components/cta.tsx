import Link from "next/link";
import type { Product } from "@/lib/content/types";
import { campaignQuery, type CtaType } from "@/lib/analytics";
import { routes, type PageType } from "@/lib/seo/routes";
import { TrackedLink } from "@/components/tracked-link";
import { IconArrow } from "@/components/icons";

/** Visual treatment. Independent of `ctaType`, which is the analytics dimension. */
export type CtaVariant = "hero" | "primary" | "secondary" | "comparison" | "plan" | "inline" | "card" | "sticky";

type CtaProps = {
  product: Pick<Product, "slug" | "name" | "affiliate">;
  ctaType: CtaType;
  placement: string;
  pageType: PageType;
  pageSlug: string;
  label?: string;
  variant?: CtaVariant;
  hideNote?: boolean;
};

const DEFAULT_VARIANT: Record<CtaType, CtaVariant> = { hero: "hero", button: "primary", comparison: "comparison", plan: "plan", inline: "inline" };

// The one outbound CTA used across the site. Every CTA routes through `/go/{slug}` with campaign
// metadata, and is labelled truthfully as an affiliate or an official vendor link.
export function AffiliateCta({ product, ctaType, placement, pageType, pageSlug, label, variant, hideNote }: CtaProps) {
  const v = variant ?? DEFAULT_VARIANT[ctaType];
  const isAffiliate = Boolean(product.affiliate);
  const href = routes.go(product.slug) + campaignQuery({ pageType, pageSlug, ctaType, placement });
  const text = label ?? (isAffiliate ? `Visit ${product.name}` : `Visit ${product.name}`);
  const rel = isAffiliate ? "sponsored nofollow noopener" : "nofollow noopener";
  const campaign = { product: product.slug, pageType, pageSlug, ctaType, placement };
  const className =
    v === "inline" ? "cta-inline" : `btn ${v === "hero" || v === "primary" || v === "comparison" || v === "sticky" ? "primary" : "secondary"}`;
  return (
    <span className={`cta cta-${v}`} data-cta-type={ctaType} data-cta-kind={isAffiliate ? "affiliate" : "official"}>
      <TrackedLink href={href} rel={rel} className={className} campaign={campaign}>
        {text} <IconArrow className="arrow" size={16} />
      </TrackedLink>
      {!hideNote && (
        <span className="cta-note">
          <span className="dot" aria-hidden="true" />
          {isAffiliate ? <Link href={routes.disclosure()}>Affiliate link</Link> : "Official vendor site"}
        </span>
      )}
    </span>
  );
}
