import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { alternativesFor, findCategory, findProduct, findUseCase, loadCatalog } from "@/lib/catalog";
import type { Product } from "@/lib/content/types";
import { bestForLinks } from "@/lib/linking";
import { buildMetadata } from "@/lib/seo/metadata";
import { itemListJsonLd } from "@/lib/seo/jsonld";
import { routes } from "@/lib/seo/routes";
import { formatDate } from "@/lib/freshness-rules";
import { AffiliateCta } from "@/components/cta";
import { AffiliateDisclosure } from "@/components/disclosure";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { FaqSection } from "@/components/faq-section";
import { JsonLd } from "@/components/json-ld";
import { LinkGroups } from "@/components/link-groups";
import { lastCheckedText, pricingSummary } from "@/components/pricing-snapshot";
import { ScoreBadge } from "@/components/score";
import { SponsorSlot } from "@/components/sponsor-slot";

export const revalidate = 3600;

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await loadCatalog()).useCases.map((u) => ({ slug: u.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const u = findUseCase(await loadCatalog(), (await params).slug);
  if (!u) return {};
  return buildMetadata({
    title: u.seoTitle ?? u.title,
    description: u.seoDescription ?? `${u.title}: curated picks for ${u.audience}, selection criteria, limitations and pricing notes.`,
    path: routes.best(u.slug),
    type: "article",
    modifiedTime: u.contentUpdatedAt,
  });
}

export default async function BestForPage({ params }: Params) {
  const c = await loadCatalog();
  const u = findUseCase(c, (await params).slug);
  if (!u) notFound();
  const category = findCategory(c, u.categorySlug);
  const picks = u.products.map((ref) => ({ ref, product: findProduct(c, ref.slug) })).filter((x): x is { ref: (typeof u.products)[number]; product: Product } => Boolean(x.product));
  const path = routes.best(u.slug);
  const cta = { pageType: "best" as const, pageSlug: u.slug };

  return (
    <>
      <JsonLd data={itemListJsonLd(u.title, path, picks.map(({ product }) => ({ name: product.name, path: routes.product(product.slug) })))} />
      <section className="section">
        <div className="container">
          <Breadcrumbs items={[{ name: "Best-for guides", path: routes.bestIndex() }, { name: u.title, path }]} />
          <span className="eyebrow">{category?.name} · for {u.audience}</span>
          <h1>{u.title}</h1>
          <p className="small muted">Updated {formatDate(u.contentUpdatedAt)} · {picks.length} picks</p>
          {u.intro.split(/\n\n+/).map((para) => <p className="section-intro" key={para.slice(0, 40)}>{para}</p>)}

          <div className="detail-layout">
            <div>
              <section className="panel" id="criteria">
                <h2>How we chose</h2>
                <ul className="list">{u.criteria.map((cr) => <li key={cr.name}><strong>{cr.name}:</strong> {cr.description}</li>)}</ul>
                <p className="muted small">Selections are editorial. Affiliate relationships and sponsorships do not influence which products appear or their order. <Link href={routes.methodology()}>Methodology</Link>.</p>
              </section>

              <section className="panel section-gap" id="shortlist">
                <h2>The shortlist</h2>
                <ol className="list">{picks.map(({ product }) => <li key={product.slug}><a href={`#pick-${product.slug}`}>{product.name}</a> — {product.tagline}</li>)}</ol>
              </section>

              {picks.map(({ product: p, ref }, i) => (
                <article className="panel section-gap" key={p.slug} id={`pick-${p.slug}`}>
                  <span className="tag">#{i + 1} for {u.audience}</span>
                  <h2><Link href={routes.product(p.slug)}>{p.name}</Link></h2>
                  <p className="muted">{p.tagline}</p>
                  <h3>Why it fits</h3>
                  <p>{ref.rationale}</p>
                  {ref.caveat && (<><h3>Limitations to weigh</h3><p>{ref.caveat}</p></>)}
                  <dl className="meta-list">
                    <div><dt>Pricing</dt><dd>{pricingSummary(p)} <span className="muted small">({lastCheckedText(p)})</span></dd></div>
                    <div><dt>Editorial score</dt><dd><ScoreBadge product={p} /></dd></div>
                  </dl>
                  <div className="actions">
                    <AffiliateCta product={p} ctaType="plan" placement={`pick-${i + 1}`} {...cta} />
                    <Link className="btn secondary" href={routes.product(p.slug)}>{p.name} review</Link>
                    {alternativesFor(c, p).length > 0 && <Link className="btn secondary" href={routes.alternatives(p.slug)}>{p.name} alternatives</Link>}
                  </div>
                </article>
              ))}

              <FaqSection faqs={u.faqs} />
              <AffiliateDisclosure />
              <LinkGroups groups={bestForLinks(c, u)} />
            </div>
            <aside className="sidebar">
              {category && (
                <div className="panel">
                  <h2>{category.name}</h2>
                  <p className="muted small">{category.description}</p>
                  <Link className="btn secondary" href={routes.category(category.slug)}>Explore {category.name} →</Link>
                </div>
              )}
              <SponsorSlot pageType="best" pageSlug={u.slug} />
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
