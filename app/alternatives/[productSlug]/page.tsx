import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAlternatives, getProduct, getProducts } from "@/lib/catalog";
import { absolute } from "@/lib/site";

export async function generateStaticParams() {
  return (await getProducts()).filter((p) => p.alternatives.length > 0).map((p) => ({ productSlug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ productSlug: string }> }): Promise<Metadata> {
  const { productSlug } = await params;
  const product = await getProduct(productSlug);
  if (!product) return {};
  return {
    title: `Alternatives to ${product.name}: reviews and comparisons`,
    description: `Compare ${product.name} alternatives, use cases, pricing snapshots and product differences.`,
    alternates: { canonical: absolute(`/alternatives/${product.slug}`) },
    openGraph: {
      title: `Alternatives to ${product.name}`,
      description: `Compare ${product.name} alternatives, use cases, pricing snapshots and product differences.`,
      url: absolute(`/alternatives/${product.slug}`),
    },
  };
}

export default async function AlternativesPage({ params }: { params: Promise<{ productSlug: string }> }) {
  const { productSlug } = await params;
  const product = await getProduct(productSlug);
  if (!product) notFound();
  const alternatives = await getAlternatives(product);
  if (!alternatives.length) notFound();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Alternatives to ${product.name}`,
    url: absolute(`/alternatives/${product.slug}`),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: alternatives.length,
      itemListElement: alternatives.map((p, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absolute(`/products/${p.slug}`),
        name: p.name,
      })),
    },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="section">
        <div className="container">
          <div className="breadcrumbs"><Link href="/alternatives">Alternatives</Link> / {product.name}</div>
          <span className="eyebrow">Alternatives engine</span>
          <h1>Alternatives to {product.name}</h1>
          <p className="section-intro">Compare curated alternatives using structured product data, pricing snapshots and use-case information.</p>
          <div className="grid">
            {alternatives.map((p) => (
              <article className="card" key={p.slug}>
                <span className="tag">{p.category}</span>
                <h2><Link href={`/products/${p.slug}`}>{p.name}</Link></h2>
                <p>{p.tagline}</p>
                <p className="muted">Editorial score {p.rating.toFixed(1)}/5 · Updated {p.pricingUpdated}</p>
                <Link className="btn secondary" href={product.slug < p.slug ? `/compare/${product.slug}-vs-${p.slug}` : `/compare/${p.slug}-vs-${product.slug}`}>Compare →</Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
