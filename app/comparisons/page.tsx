import type { Metadata } from "next";
import Link from "next/link";
import { getProducts } from "@/lib/catalog";
import { absolute } from "@/lib/site";

export const metadata: Metadata = {
  title: "SaaS comparisons",
  description: "Compare SaaS products side by side using structured feature, use-case and pricing criteria.",
  alternates: { canonical: absolute("/comparisons") },
  openGraph: {
    title: "SaaS comparisons",
    description: "Compare SaaS products side by side using structured criteria.",
    url: absolute("/comparisons"),
    type: "website",
  },
};

export default async function Comparisons() {
  const products = await getProducts();
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const pairs = products
    .flatMap((a) => a.alternatives.map((s) => ({ a, b: bySlug.get(s) })))
    .filter((x): x is { a: (typeof products)[number]; b: (typeof products)[number] } => Boolean(x.b))
    .filter(({ a, b }) => a.slug < b.slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "SaaS comparisons",
    url: absolute("/comparisons"),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: pairs.length,
      itemListElement: pairs.map(({ a, b }, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: `${a.name} vs ${b.name}`,
        url: absolute(`/compare/${a.slug}-vs-${b.slug}`),
      })),
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="section">
        <div className="container">
          <span className="eyebrow">Comparison library</span>
          <h1>SaaS vs SaaS comparisons</h1>
          <p className="section-intro">
            Side-by-side pages using category-specific comparison fields, use cases and vendor links.
          </p>
          {pairs.length ? (
            <div className="grid">
              {pairs.map(({ a, b }) => (
                <Link className="card" key={`${a.slug}-vs-${b.slug}`} href={`/compare/${a.slug}-vs-${b.slug}`}>
                  <span className="tag">{a.category}</span>
                  <h2>{a.name} vs {b.name}</h2>
                  <p className="muted">Features, use cases, trade-offs and vendor links.</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="notice">No published comparison pairs are available yet.</div>
          )}
        </div>
      </section>
    </>
  );
}
