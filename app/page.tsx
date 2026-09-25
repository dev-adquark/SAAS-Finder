import Link from "next/link";
import { loadCatalog, productsInCategory } from "@/lib/catalog";
import { ProductCard } from "@/components/product-card";
import { JsonLd } from "@/components/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { absolute, SITE_NAME } from "@/lib/site";
import { routes } from "@/lib/seo/routes";

export const revalidate = 3600;

export const metadata = buildMetadata({
  title: "SaaS reviews, alternatives and comparisons",
  description: "Structured SaaS reviews, verified pricing snapshots, curated alternatives, side-by-side comparisons and best-for guides for software buyers.",
  path: routes.home(),
});

export default async function Home() {
  const catalog = await loadCatalog();
  const categoryName = new Map(catalog.categories.map((c) => [c.slug, c.name]));
  const featured = catalog.products.slice(0, 6);
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: absolute("/"), description: "Structured SaaS reviews, alternatives and comparisons." }} />
      <section className="hero">
        <div className="container">
          <span className="eyebrow">Independent SaaS research</span>
          <h1>Compare software without digging through ten vendor tabs.</h1>
          <p>Structured reviews, dated pricing checks, pros, cons and limitations, curated alternatives, side-by-side comparisons and best-for guides. Commercial links are labelled and never decide what we recommend.</p>
          <div className="actions">
            <Link className="btn primary" href={routes.products()}>Browse all reviews →</Link>
            <Link className="btn secondary" href={routes.bestIndex()}>Best-for guides</Link>
          </div>
          <div className="kpi">
            <div className="card"><strong>{catalog.products.length}</strong><span className="muted">published reviews</span></div>
            <div className="card"><strong>{catalog.categories.length}</strong><span className="muted">categories</span></div>
            <div className="card"><strong>{catalog.pairs.length}</strong><span className="muted">comparisons</span></div>
            <div className="card"><strong>{catalog.useCases.length}</strong><span className="muted">best-for guides</span></div>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <h2>Browse by category</h2>
          <div className="grid">
            {catalog.categories.map((c) => (
              <Link className="card" key={c.slug} href={routes.category(c.slug)}>
                <span className="tag">{productsInCategory(catalog, c.slug).length} reviews</span>
                <h3 className="product-title">{c.name}</h3>
                <p className="muted">{c.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
      {catalog.useCases.length > 0 && (
        <section className="section">
          <div className="container">
            <h2>Best-for guides</h2>
            <div className="grid">
              {catalog.useCases.map((u) => (
                <Link className="card" key={u.slug} href={routes.best(u.slug)}>
                  <span className="tag">{categoryName.get(u.categorySlug)}</span>
                  <h3 className="product-title">{u.title}</h3>
                  <p className="muted">For {u.audience}.</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
      <section className="section">
        <div className="container">
          <h2>Featured reviews</h2>
          <div className="grid">{featured.map((p) => <ProductCard key={p.slug} product={p} categoryName={categoryName.get(p.categorySlug)} />)}</div>
        </div>
      </section>
    </>
  );
}
