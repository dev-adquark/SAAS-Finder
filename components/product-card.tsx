import Link from "next/link";
import type { Product } from "@/lib/content/types";
import { routes } from "@/lib/seo/routes";
import { ScoreBadge } from "@/components/score";

export function ProductCard({ product, categoryName }: { product: Product; categoryName?: string }) {
  return (
    <article className="card">
      <span className="tag">{categoryName ?? product.subcategory}</span>
      <h3 className="product-title"><Link href={routes.product(product.slug)}>{product.name}</Link></h3>
      <p className="product-desc">{product.tagline}</p>
      <div className="card-row">
        <ScoreBadge product={product} />
        <Link className="btn secondary" href={routes.product(product.slug)}>Read review →</Link>
      </div>
    </article>
  );
}
