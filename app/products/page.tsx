import { loadCatalog } from "@/lib/catalog";
import { Suspense } from "react";
import { SearchProducts, SearchProductsFromUrl } from "@/components/search-products";
import { JsonLd } from "@/components/json-ld";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { buildMetadata } from "@/lib/seo/metadata";
import { itemListJsonLd } from "@/lib/seo/jsonld";
import { routes } from "@/lib/seo/routes";
import { monogram } from "@/components/identity";

export const revalidate = 3600;

export const metadata = buildMetadata({
  title: "All SaaS reviews",
  description: "Browse every structured SaaS review: features, pricing checks, pros, cons, limitations and curated alternatives.",
  path: routes.products(),
});

export default async function Products() {
  const c = await loadCatalog();
  const names = new Map(c.categories.map((x) => [x.slug, x.name]));
  const items = c.products.map((p) => ({ slug: p.slug, href: routes.product(p.slug), name: p.name, category: names.get(p.categorySlug) ?? "", categorySlug: p.categorySlug, tagline: p.tagline, keywords: [...p.tags, ...p.review.bestFor].join(" "), mono: monogram(p.name) }));
  const cats = c.categories.map((x) => ({ slug: x.slug, name: x.name }));
  return (
    <section className="section">
      <JsonLd data={itemListJsonLd("All SaaS reviews", routes.products(), c.products.map((p) => ({ name: p.name, path: routes.product(p.slug) })))} />
      <div className="container">
        <Breadcrumbs items={[{ name: "All reviews", path: routes.products() }]} />
        <span className="eyebrow">Product index</span>
        <h1>All SaaS reviews</h1>
        <p className="section-intro">{c.products.length} structured reviews across {c.categories.length} categories. Search by product, category, tag or audience.</p>
        <Suspense fallback={<SearchProducts items={items} categories={cats} />}>
          <SearchProductsFromUrl items={items} categories={cats} />
        </Suspense>
      </div>
    </section>
  );
}
