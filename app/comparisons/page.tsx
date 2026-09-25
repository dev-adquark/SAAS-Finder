import Link from "next/link";
import { findProduct, loadCatalog } from "@/lib/catalog";
import { JsonLd } from "@/components/json-ld";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { buildMetadata } from "@/lib/seo/metadata";
import { itemListJsonLd } from "@/lib/seo/jsonld";
import { routes } from "@/lib/seo/routes";

export const revalidate = 3600;

export const metadata = buildMetadata({
  title: "SaaS comparisons",
  description: "Side-by-side SaaS comparisons with category-specific criteria, key differences and guidance on which tool fits which team.",
  path: routes.comparisons(),
});

export default async function Comparisons() {
  const c = await loadCatalog();
  const names = new Map(c.categories.map((x) => [x.slug, x.name]));
  const title = (a: string, b: string) => `${findProduct(c, a)?.name} vs ${findProduct(c, b)?.name}`;
  return (
    <section className="section">
      <JsonLd data={itemListJsonLd("SaaS comparisons", routes.comparisons(), c.pairs.map((p) => ({ name: title(p.productA, p.productB), path: routes.compare(p.productA, p.productB) })))} />
      <div className="container">
        <Breadcrumbs items={[{ name: "Comparisons", path: routes.comparisons() }]} />
        <span className="eyebrow">Comparison library</span>
        <h1>SaaS vs SaaS comparisons</h1>
        {c.pairs.length ? (
          <div className="grid">
            {c.pairs.map((p) => (
              <Link className="card" key={p.slug} href={routes.compare(p.productA, p.productB)}>
                <span className="tag">{names.get(p.categorySlug)}</span>
                <h2 className="product-title">{title(p.productA, p.productB)}</h2>
                <p className="muted">{p.summary}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="notice">No published comparisons yet.</div>
        )}
      </div>
    </section>
  );
}
