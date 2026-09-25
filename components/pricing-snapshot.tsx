import type { Product } from "@/lib/content/types";
import { PRICING_FALLBACK, formatPrice, lastCheckedText } from "@/lib/pricing";

export { PRICING_FALLBACK, formatPrice, lastCheckedText, pricingSummary } from "@/lib/pricing";

export function PricingSnapshot({ product, headingLevel = 2 }: { product: Product; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <section className="panel section-gap" id="pricing" data-pricing={product.pricing.length ? "verified" : "fallback"}>
      <H>{product.name} pricing snapshot</H>
      {product.pricing.length ? (
        <div className="table-wrap">
          <table className="compare slim">
            <thead>
              <tr><th>Plan</th><th>Price</th><th>Notes</th></tr>
            </thead>
            <tbody>
              {product.pricing.map((pt, i) => (
                <tr key={`${pt.plan ?? "plan"}-${i}`}>
                  <td>{pt.plan ?? "—"}</td>
                  <td>{formatPrice(pt)}</td>
                  <td className="muted">{pt.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="price">{PRICING_FALLBACK}</p>
      )}
      <p className="muted small" data-last-checked>
        {lastCheckedText(product)}. Vendor prices, taxes, limits and promotions change — confirm on the vendor&apos;s site before buying.
      </p>
      {product.pricingUrl && (
        <a className="btn secondary" href={product.pricingUrl} target="_blank" rel="nofollow noopener">
          Official {product.name} pricing page ↗
        </a>
      )}
    </section>
  );
}
