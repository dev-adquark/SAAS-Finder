import Link from "next/link";
import type { Product } from "@/lib/content/types";
import { routes, type PageType } from "@/lib/seo/routes";
import { ScoreBadge } from "@/components/score";
import { Monogram, catStyle } from "@/components/identity";
import { AffiliateCta } from "@/components/cta";
import { pricingState } from "@/lib/pricing";

type Props = {
  product: Product;
  categoryName?: string;
  /** When set, the card shows a tracked vendor CTA for this page context. */
  cta?: { pageType: PageType; pageSlug: string; placement: string };
};

export function ProductCard({ product, categoryName, cta }: Props) {
  const ps = pricingState(product);
  return (
    <article className="card hoverable pcard accent-top" style={catStyle(product.categorySlug)}>
      <div className="pcard-head">
        <Monogram name={product.name} slug={product.slug} categorySlug={product.categorySlug} />
        <div>
          <h3><Link className="stretch" href={routes.product(product.slug)}>{product.name}</Link></h3>
          <div className="sub">{categoryName ?? product.subcategory}</div>
        </div>
      </div>
      <p>{product.tagline}</p>
      <div className="chip-row"><span className={`status ${ps.tone}`}>{ps.label}</span></div>
      <div className="pcard-foot">
        <ScoreBadge product={product} />
        {cta ? (
          <AffiliateCta product={product} ctaType="button" variant="card" placement={cta.placement} pageType={cta.pageType} pageSlug={cta.pageSlug} label="Visit site" hideNote />
        ) : (
          <span className="tiny muted">Read review →</span>
        )}
      </div>
    </article>
  );
}
