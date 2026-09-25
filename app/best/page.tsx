import Link from "next/link";
import { loadCatalog } from "@/lib/catalog";
import { JsonLd } from "@/components/json-ld";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { buildMetadata } from "@/lib/seo/metadata";
import { itemListJsonLd } from "@/lib/seo/jsonld";
import { routes } from "@/lib/seo/routes";

export const revalidate = 3600;

export const metadata = buildMetadata({
  title: "Best-for software guides",
  description: "Curated best-for guides that match SaaS tools to specific teams and use cases, with selection criteria and honest limitations.",
  path: routes.bestIndex(),
});

export default async function BestIndex() {
  const c = await loadCatalog();
  return (
    <section className="section">
      <JsonLd data={itemListJsonLd("Best-for software guides", routes.bestIndex(), c.useCases.map((u) => ({ name: u.title, path: routes.best(u.slug) })))} />
      <div className="container">
        <Breadcrumbs items={[{ name: "Best-for guides", path: routes.bestIndex() }]} />
        <span className="eyebrow">Use-case guides</span>
        <h1>Best software for your use case</h1>
        {c.categories.map((cat) => {
          const guides = c.useCases.filter((u) => u.categorySlug === cat.slug);
          if (!guides.length) return null;
          return (
            <section className="section-gap" key={cat.slug}>
              <h2><Link href={routes.category(cat.slug)}>{cat.name}</Link></h2>
              <div className="grid">
                {guides.map((u) => (
                  <Link className="card" key={u.slug} href={routes.best(u.slug)}>
                    <span className="tag">{u.products.length} picks</span>
                    <h3 className="product-title">{u.title}</h3>
                    <p className="muted">For {u.audience}.</p>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
