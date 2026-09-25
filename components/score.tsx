import type { Product } from "@/lib/content/types";
import { IconStar } from "@/components/icons";

/** Editorial score, or an explicit "not yet scored" state — scores are never invented. */
export function ScoreBadge({ product }: { product: Pick<Product, "review"> }) {
  const r = product.review.rating;
  if (typeof r !== "number") return <span className="status neutral">Not yet scored</span>;
  return (
    <span className="rating" title="SaaSFinder editorial score — see methodology">
      <IconStar className="star" size={15} fill="currentColor" /> {r.toFixed(1)} <span className="muted tiny">/5 editorial</span>
    </span>
  );
}
