import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findCategory, loadCatalog, productsInCategory } from "@/lib/catalog";
import { buildMetadata } from "@/lib/seo/metadata";
import { routes } from "@/lib/seo/routes";
import { MIN_CATEGORY_FAQS } from "@/lib/seo/sitemap";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { FaqSection } from "@/components/faq-section";
import { Monogram, catStyle } from "@/components/identity";
import { CategoryIcon } from "@/components/icons";

export const revalidate = 3600;

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await loadCatalog()).categories.filter((c) => c.faqs.length >= MIN_CATEGORY_FAQS).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const cat = findCategory(await loadCatalog(), (await params).slug);
  if (!cat || cat.faqs.length < MIN_CATEGORY_FAQS) return {};
  return buildMetadata({
    title: `${cat.name} FAQ: common questions answered`,
    description: `Answers to common questions about choosing ${cat.name.toLowerCase()} software — plus links to product-specific FAQs for every ${cat.name.toLowerCase()} tool we review.`,
    path: routes.categoryFaq(cat.slug),
  });
}

export default async function CategoryFaqPage({ params }: Params) {
  const c = await loadCatalog();
  const cat = findCategory(c, (await params).slug);
  if (!cat || cat.faqs.length < MIN_CATEGORY_FAQS) notFound();
  const products = productsInCategory(c, cat.slug).filter((p) => p.faqs.length > 0);
  return (
    <div style={catStyle(cat.slug)}>
      <section className="detail-hero">
        <div className="container">
          <Breadcrumbs items={[{ name: "Categories", path: routes.categories() }, { name: cat.name, path: routes.category(cat.slug) }, { name: "FAQ", path: routes.categoryFaq(cat.slug) }]} />
          <span className="eyebrow" style={{ marginTop: 18 }}><CategoryIcon slug={cat.slug} size={14} /> {cat.name}</span>
          <h1 style={{ marginTop: 12 }}>{cat.name} FAQ</h1>
          <p className="lead">{cat.description}</p>
        </div>
      </section>
      <div className="container detail-layout">
        <div>
          <FaqSection faqs={cat.faqs} title={`Choosing ${cat.name.toLowerCase()} software`} openFirst />
          <section className="section-gap reveal">
            <h2>Product-specific FAQs</h2>
            <div className="grid two-col">
              {products.map((p) => (
                <Link key={p.slug} className="card pcard" href={`${routes.product(p.slug)}#faq`} style={catStyle(p.categorySlug)}>
                  <div className="pcard-head"><Monogram name={p.name} slug={p.slug} categorySlug={p.categorySlug} /><div><h3>{p.name} FAQs</h3><div className="sub">{p.faqs.length} questions</div></div></div>
                  <ul className="list small" style={{ margin: 0 }}>{p.faqs.slice(0, 2).map((f) => <li key={f.question}>{f.question}</li>)}</ul>
                </Link>
              ))}
            </div>
          </section>
        </div>
        <aside className="sidebar">
          <div className="panel">
            <strong>{cat.name} hub</strong>
            <p className="muted small" style={{ margin: "8px 0 12px" }}>Reviews, comparisons, alternatives and buying guides.</p>
            <Link className="btn secondary" href={routes.category(cat.slug)}>Back to {cat.name} →</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
