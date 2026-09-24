import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategories, getCategoryProducts } from "@/lib/catalog";
import { ProductCard } from "@/components/product-card";
import { absolute } from "@/lib/site";

export async function generateStaticParams() {
  return (await getCategories()).map((category) => ({ slug: category.toLowerCase() }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const category = (await getCategories()).find((x) => x.toLowerCase() === slug);
  return category ? { title: `${category} software reviews and comparisons`, description: `Compare ${category} software, features, pricing and alternatives.`, alternates: { canonical: absolute(`/categories/${slug}`) } } : {};
}

export default async function Category({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const categories = await getCategories();
  const category = categories.find((x) => x.toLowerCase() === slug);
  if (!category) notFound();
  const products = await getCategoryProducts(category);
  return <section className="section"><div className="container"><span className="eyebrow">Category hub</span><h1>{category} software</h1><p className="section-intro">Consistent comparison criteria, product reviews and alternatives for this category.</p><div className="grid">{products.map((product) => <ProductCard key={product.slug} product={product} />)}</div></div></section>;
}
