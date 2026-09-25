import type { Product } from "@/lib/content/types";
import { PRICING_FALLBACK, lastCheckedText, pricingState } from "@/lib/pricing";
import { AffiliateCta } from "@/components/cta";
import { PlanTable } from "@/components/verification";
import type { PageType } from "@/lib/seo/routes";

export { PRICING_FALLBACK, formatPrice, lastCheckedText, pricingSummary } from "@/lib/pricing";

/** Pricing panel: verified plans or the honest fallback, the verification pipeline state and CTAs. */
export function PricingSnapshot({ product, cta }: { product: Product; cta?: { pageType: PageType; pageSlug: string } }) {
  const state = pricingState(product);
  const verified = product.pricing.length > 0;
  return (
    <section className="panel section-gap pricing-panel reveal" id="pricing" data-pricing={verified ? "verified" : "fallback"} aria-labelledby="pricing-title">
      <div className="section-head" style={{ marginBottom: 6 }}>
        <h2 id="pricing-title" style={{ margin: 0 }}>{product.name} pricing</h2>
        <span className={`status ${state.tone}`} title={state.detail}>{state.label}</span>
      </div>
      {verified ? (
        <>
          {state.kind === "region" && <p className="small" style={{ marginTop: 8 }}><strong>Pricing varies by region.</strong> {product.pricingRegionNote ?? ""} Prices below are as shown on the official page at our check location.</p>}
          {state.kind === "custom" && <p className="price">Custom pricing — contact vendor.</p>}
          <PlanTable product={product} />
          {product.pricing.some((p) => p.promotional) && <p className="tiny muted">Promotional prices are marked and may not reflect the regular price.</p>}
        </>
      ) : (
        <p className="price">{PRICING_FALLBACK}</p>
      )}
      <div className="pricing-steps" aria-label="Pricing verification workflow">
        <span className="on">Captured</span>
        <span className={verified ? "on" : "cur"}>Evidence-matched</span>
        <span className={verified ? "on" : ""}>Verified snapshot</span>
        <span className={verified ? "on" : ""}>Published</span>
      </div>
      <p className="muted small" data-last-checked>
        {lastCheckedText(product)}. Vendor prices, taxes, limits and promotions change — confirm on the vendor&apos;s site before buying.
      </p>
      <div className="actions">
        {cta && <AffiliateCta product={product} ctaType="plan" placement="pricing" pageType={cta.pageType} pageSlug={cta.pageSlug} label={`See ${product.name} plans`} />}
        {product.pricingUrl && <a className="btn ghost" href={product.pricingUrl} target="_blank" rel="nofollow noopener">Official pricing page ↗</a>}
      </div>
    </section>
  );
}
