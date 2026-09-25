import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { findCategory, loadCatalog, productsInCategory, guidesInCategory } from "@/lib/catalog";
import { categoryLinks } from "@/lib/linking";
import { buildMetadata } from "@/lib/seo/metadata";
import { itemListJsonLd } from "@/lib/seo/jsonld";
import { routes, slugify } from "@/lib/seo/routes";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { FaqSection } from "@/components/faq-section";
import { JsonLd } from "@/components/json-ld";
import { LinkGroups } from "@/components/link-groups";
import { ProductCard } from "@/components/product-card";
import { SponsorSlot } from "@/components/sponsor-slot";

export const revalidate = 3600;

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await loadCatalog()).categories.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const cat = findCategory(await loadCatalog(), (await params).slug);
  if (!cat) return {};
  return buildMetadata({
    title: cat.seoTitle ?? `${cat.name} software: reviews, comparisons and alternatives`,
    description: cat.seoDescription ?? `Compare ${cat.name.toLowerCase()} software with structured reviews, best-for guides, alternatives and side-by-side comparisons.`,
    path: routes.category(cat.slug),
  });
}

export default async function CategoryHub({ params }: Params) {
  const c = await loadCatalog();
  const { slug } = await params;
  const cat = findCategory(c, slug);
  if (!cat) {
    // Legacy hubs used URL-encoded lowercase names (e.g. "website%20builders").
    let legacy = "";
    try { legacy = slugify(decodeURIComponent(slug)); } catch {}
    if (legacy && legacy !== slug && findCategory(c, legacy)) permanentRedirect(routes.category(legacy));
    notFound();
  }
  const products = productsInCategory(c, cat.slug);
  // Featured = editorially scored products first (highest score), then alphabetical. Never sponsor-driven.
  const featured = [...products].sort((a, b) => (b.review.rating ?? -1) - (a.review.rating ?? -1) || a.name.localeCompare(b.name)).slice(0, 3);
  const useCases = guidesInCategory(c, cat.slug);
  const path = routes.category(cat.slug);

  return (
    <>
      <JsonLd data={itemListJsonLd(`${cat.name} software reviews`, path, products.map((p) => ({ name: p.name, path: routes.product(p.slug) })))} />
      <section className="section">
        <div className="container">
          <Breadcrumbs items={[{ name: "Categories", path: routes.categories() }, { name: cat.name, path }]} />
          <span className="eyebrow">Category hub</span>
          <h1>{cat.name} software</h1>
          {cat.intro.split(/\n\n+/).filter(Boolean).map((para) => <p className="section-intro" key={para.slice(0, 40)}>{para}</p>)}

          <h2 className="section-gap">Featured {cat.name.toLowerCase()} reviews</h2>
          <div className="grid">{featured.map((p) => <ProductCard key={p.slug} product={p} categoryName={p.subcategory ?? cat.name} />)}</div>

          {useCases.length > 0 && (
            <section className="section-gap" id="best-for">
              <h2>Best {cat.name.toLowerCase()} by use case</h2>
              <div className="grid">
                {useCases.map((u) => (
                  <Link className="card" key={u.slug} href={routes.best(u.slug)}>
                    <span className="tag">{u.products.length} picks</span>
                    <h3 className="product-title">{u.title}</h3>
                    <p className="muted">For {u.audience}.</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="panel section-gap" id="all-reviews">
            <h2>All {cat.name.toLowerCase()} reviews</h2>
            <ul className="list">{products.map((p) => <li key={p.slug}><Link href={routes.product(p.slug)}><strong>{p.name}</strong></Link> — {p.tagline}</li>)}</ul>
          </section>

          <LinkGroups groups={categoryLinks(c, cat.slug).filter((g) => g.title !== "Best-for guides")} title={`${cat.name} alternatives and comparisons`} />

          <SponsorSlot pageType="category" pageSlug={cat.slug} placement="inline" />
          <FaqSection faqs={cat.faqs} title={`${cat.name} FAQs`} />
        </div>
      </section>
    </>
  );
}
