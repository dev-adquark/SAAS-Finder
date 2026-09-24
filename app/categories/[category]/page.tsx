import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategories, getCategoryProducts } from "@/lib/catalog";
import { absolute } from "@/lib/site";

export async function generateStaticParams() {
  return (await getCategories()).map((category) => ({ category: category.toLowerCase() }));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params;
  const products = await getCategoryProducts(category);
  if (!products.length) return {};
  const name = products[0].category;
  return {
    title: `${name} SaaS reviews, alternatives and comparisons`,
    description: `Browse ${name} software reviews, pricing snapshots, alternatives and comparisons.`,
    alternates: { canonical: absolute(`/categories/${encodeURIComponent(name.toLowerCase())}`) },
    openGraph: {
      title: `${name} SaaS reviews, alternatives and comparisons`,
      description: `Browse ${name} software reviews, pricing snapshots, alternatives and comparisons.`,
      url: absolute(`/categories/${encodeURIComponent(name.toLowerCase())}`),
    },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const products = await getCategoryProducts(category);
  if (!products.length) notFound();
  const name = products[0].category;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${name} SaaS software`,
    url: absolute(`/categories/${encodeURIComponent(name.toLowerCase())}`),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: products.length,
      itemListElement: products.map((p, index) => ({
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
          <div className="breadcrumbs"><Link href="/categories">Categories</Link> / {name}</div>
          <span className="eyebrow">Category hub</span>
          <h1>{name} SaaS reviews</h1>
          <p className="section-intro">Compare published software reviews, pricing snapshots, alternatives and use cases in {name.toLowerCase()}.</p>
          <div className="grid">
            {products.map((p) => (
              <Link className="card" key={p.slug} href={`/products/${p.slug}`}>
                <span className="tag">{p.subcategory || name}</span>
                <h2>{p.name}</h2>
                <p>{p.tagline}</p>
                <p className="muted">Editorial score {p.rating.toFixed(1)}/5 · Updated {p.pricingUpdated}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
