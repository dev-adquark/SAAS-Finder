import type { Metadata } from "next";
import { getProducts } from "@/lib/catalog";
import { SearchProducts } from "@/components/search-products";
import { absolute } from "@/lib/site";

export const metadata: Metadata = {
  title: "SaaS products",
  description: "Browse structured SaaS reviews, pricing snapshots, features and alternatives.",
  alternates: { canonical: absolute("/products") },
  openGraph: {
    title: "SaaS products",
    description: "Browse structured SaaS reviews, pricing snapshots, features and alternatives.",
    url: absolute("/products"),
  },
};

export default async function Products() {
  const products = await getProducts();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "SaaS products",
    url: absolute("/products"),
    mainEntity: {
      "@type": "ItemList",
      itemListElement: products.map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: product.name,
        url: absolute("/products/" + product.slug),
      })),
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="section">
        <div className="container">
          <span className="eyebrow">Product index</span>
          <h1>Browse SaaS products</h1>
          <p className="section-intro">Search by product, category or use case.</p>
          <SearchProducts products={products} />
        </div>
      </section>
    </>
  );
}