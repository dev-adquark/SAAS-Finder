import type { Product } from "@/lib/content/types";
import { PRICING_FALLBACK, formatPrice, lastCheckedText, pricingState } from "@/lib/pricing";
import { AffiliateCta } from "@/components/cta";
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
        <span className={`status ${state.tone}`}>{state.label}</span>
      </div>
      {verified ? (
        <div className="table-wrap section-gap">
          <table className="compare slim">
            <thead><tr><th scope="col">Plan</th><th scope="col">Price</th><th scope="col">Notes</th></tr></thead>
            <tbody>
              {product.pricing.map((pt, i) => (
                <tr key={`${pt.plan ?? "plan"}-${i}`}><td>{pt.plan ?? "—"}</td><td><strong>{formatPrice(pt)}</strong></td><td className="muted">{pt.note}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="price">{PRICING_FALLBACK}</p>
      )}
      <div className="pricing-steps" aria-label="Pricing verification workflow">
        <span className="on">Queued</span>
        <span className={verified ? "on" : "cur"}>Editor verification</span>
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
