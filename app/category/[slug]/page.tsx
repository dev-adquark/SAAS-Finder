import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { findCategory, findProduct, guidesInCategory, loadCatalog, pairsInCategory, productsInCategory } from "@/lib/catalog";
import { categoryLinks } from "@/lib/linking";
import { buildMetadata } from "@/lib/seo/metadata";
import { itemListJsonLd } from "@/lib/seo/jsonld";
import { routes, slugify } from "@/lib/seo/routes";
import { formatDate } from "@/lib/freshness-rules";
import { pricingState } from "@/lib/pricing";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { FaqSection } from "@/components/faq-section";
import { JsonLd } from "@/components/json-ld";
import { LinkGroups } from "@/components/link-groups";
import { ProductCard } from "@/components/product-card";
import { SponsorSlot } from "@/components/sponsor-slot";
import { FilterBar } from "@/components/filter-bar";
import { Monogram, catStyle } from "@/components/identity";
import { CategoryIcon } from "@/components/icons";
import { AffiliateDisclosure } from "@/components/disclosure";
import type { CSSProperties } from "react";

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
  const guides = guidesInCategory(c, cat.slug);
  const pairs = pairsInCategory(c, cat.slug);
  const subs = [...new Set(products.map((p) => p.subcategory ?? "Other"))].sort();
  const subCount = subs.map((s) => ({ s, n: products.filter((p) => (p.subcategory ?? "Other") === s).length }));
  const recent = [...products].sort((a, b) => +new Date(b.contentUpdatedAt) - +new Date(a.contentUpdatedAt)).slice(0, 4);
  const path = routes.category(cat.slug);
  const paras = cat.intro.split(/\n\n+/).filter(Boolean);

  return (
    <div style={catStyle(cat.slug)}>
      <JsonLd data={itemListJsonLd(`${cat.name} software reviews`, path, products.map((p) => ({ name: p.name, path: routes.product(p.slug) })))} />
      <section className="detail-hero">
        <div className="container">
          <Breadcrumbs items={[{ name: "Categories", path: routes.categories() }, { name: cat.name, path }]} />
          <div className="id-hero" style={{ marginTop: 18, alignItems: "center" }}>
            <div className="enter">
              <span className="eyebrow">Category hub</span>
              <h1 style={{ marginTop: 14 }}>{cat.name} <span className="grad-text">software</span></h1>
              {paras[0] && <p className="lead">{paras[0]}</p>}
              <div className="hero-stats">
                <div><strong>{products.length}</strong><span>reviews</span></div>
                <div><strong>{guides.length}</strong><span>best-for guides</span></div>
                <div><strong>{pairs.length}</strong><span>comparisons</span></div>
              </div>
            </div>
            <div className="cat-hero-graphic enter-2" aria-hidden="true">
              <div className="ring">
                {products.map((p, i) => (
                  <span className="orb" key={p.slug} style={{ ["--a" as string]: `${(360 / products.length) * i}deg` } as CSSProperties}>
                    <Monogram name={p.name} categorySlug={p.categorySlug} />
                  </span>
                ))}
              </div>
              <div className="center"><CategoryIcon slug={cat.slug} size={48} /></div>
            </div>
          </div>
        </div>
      </section>

      <div className="container">
        {paras.slice(1).map((para) => <p className="lead" key={para.slice(0, 40)}>{para}</p>)}

        <section className="section-gap reveal">
          <div className="section-head"><div><span className="eyebrow">Featured</span><h2>Top {cat.name.toLowerCase()} reviews</h2></div></div>
          <div className="grid three reveal-stagger">{featured.map((p) => <ProductCard key={p.slug} product={p} categoryName={p.subcategory ?? cat.name} cta={{ pageType: "category", pageSlug: cat.slug, placement: `featured-${p.slug}` }} />)}</div>
        </section>

        {guides.length > 0 && (
          <section className="section-gap reveal" id="best-for">
            <div className="section-head"><div><span className="eyebrow">Best for</span><h2>Best {cat.name.toLowerCase()} by use case</h2></div></div>
            <div className="grid two-col reveal-stagger">
              {guides.map((u) => (
                <Link className="card ucard accent-top" key={u.slug} href={routes.best(u.slug)}>
                  <span className="tag">For {u.audience}</span>
                  <h3>{u.title}</h3>
                  <span className="picks">
                    {u.products.slice(0, 4).map((x) => { const p = findProduct(c, x.slug); return p ? <Monogram key={x.slug} name={p.name} categorySlug={p.categorySlug} size="sm" /> : null; })}
                    <span className="tiny muted" style={{ marginLeft: 10 }}>{u.products.length} picks</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="section-gap reveal" id="all-reviews">
          <div className="section-head"><div><span className="eyebrow">Explore</span><h2>All {cat.name.toLowerCase()} reviews</h2></div></div>
          <div className="split-2-1">
            <div>
              <FilterBar targetId="cat-products" options={subs} label="Filter by subcategory" />
              <div id="cat-products" className="grid two-col">
                {products.map((p) => <div key={p.slug} data-filter={p.subcategory ?? "Other"}><ProductCard product={p} categoryName={p.subcategory ?? cat.name} /></div>)}
              </div>
            </div>
            <div className="panel">
              <h3>By subcategory</h3>
              <div className="bars">
                {subCount.map(({ s, n }) => (
                  <div className="bar-row" key={s} style={{ gridTemplateColumns: "1fr 80px 20px" }}>
                    <span className="small">{s}</span>
                    <div className="bar-track"><div className="bar-fill" style={{ width: `${(n / Math.max(...subCount.map((x) => x.n))) * 100}%` }} /></div>
                    <strong className="small">{n}</strong>
                  </div>
                ))}
              </div>
              <h3 className="section-gap">Recently updated</h3>
              <ul className="list" style={{ listStyle: "none", padding: 0 }}>
                {recent.map((p) => <li key={p.slug} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><Link href={routes.product(p.slug)}>{p.name}</Link><span className="tiny muted">{formatDate(p.contentUpdatedAt)} · <span style={{ color: pricingState(p).tone === "ok" ? "var(--success)" : "var(--warning)" }}>{pricingState(p).tone === "ok" ? "verified" : "pricing pending"}</span></span></li>)}
              </ul>
            </div>
          </div>
        </section>

        {pairs.length > 0 && (
          <section className="section-gap reveal" id="comparisons">
            <div className="section-head"><div><span className="eyebrow">Compare</span><h2>{cat.name} head-to-heads</h2></div></div>
            <div className="grid three reveal-stagger">
              {pairs.map((pair) => {
                const a = findProduct(c, pair.productA)!;
                const b = findProduct(c, pair.productB)!;
                return (
                  <Link key={pair.slug} href={routes.compare(a.slug, b.slug)} className="card vscard">
                    <span className="side"><Monogram name={a.name} categorySlug={a.categorySlug} size="sm" />{a.name}</span>
                    <span className="vs" aria-hidden="true">VS</span>
                    <span className="side"><Monogram name={b.name} categorySlug={b.categorySlug} size="sm" />{b.name}</span>
                    <span className="sr-only"> versus </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <LinkGroups groups={categoryLinks(c, cat.slug).filter((g) => g.title === "Alternatives")} title={`${cat.name} alternatives`} />
        <SponsorSlot pageType="category" pageSlug={cat.slug} placement="inline" />
        <FaqSection faqs={cat.faqs} title={`${cat.name} FAQs`} />
        <AffiliateDisclosure />
      </div>
    </div>
  );
}
