import type { Product } from "@/lib/content/types";

/** Editorial score, or an explicit "not yet scored" state — scores are never invented. */
export function ScoreBadge({ product }: { product: Pick<Product, "review"> }) {
  const r = product.review.rating;
  if (typeof r !== "number") return <span className="rating muted">Not yet scored</span>;
  return (
    <span className="rating" title="SaaSFinder editorial score — see methodology">
      ★ {r.toFixed(1)} <span className="muted">/5 editorial</span>
    </span>
  );
}
