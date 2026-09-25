import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { alternativesFor, findCategory, findProduct, findUseCase, loadCatalog } from "@/lib/catalog";
import type { Product } from "@/lib/content/types";
import { comparisonSchemaFor } from "@/lib/content/comparison-schema";
import { bestForLinks } from "@/lib/linking";
import { buildMetadata } from "@/lib/seo/metadata";
import { itemListJsonLd } from "@/lib/seo/jsonld";
import { routes } from "@/lib/seo/routes";
import { formatDate } from "@/lib/freshness-rules";
import { lastCheckedText, pricingState, pricingSummary } from "@/lib/pricing";
import { INDICATOR_LABEL, indicatorFor } from "@/lib/indicators";
import { AffiliateCta } from "@/components/cta";
import { AffiliateDisclosure } from "@/components/disclosure";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { FaqSection } from "@/components/faq-section";
import { JsonLd } from "@/components/json-ld";
import { LinkGroups } from "@/components/link-groups";
import { ScoreBadge } from "@/components/score";
import { SponsorSlot } from "@/components/sponsor-slot";
import { Monogram, catStyle } from "@/components/identity";
import { CategoryIcon, IconAlert, IconCheck, IconStar } from "@/components/icons";

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
  const schema = comparisonSchemaFor(u.categorySlug).filter((f) => !f.computed).slice(0, 5);
  const [top] = picks;
  const paras = u.intro.split(/\n\n+/);

  return (
    <div style={catStyle(u.categorySlug)}>
      <JsonLd data={itemListJsonLd(u.title, path, picks.map(({ product }) => ({ name: product.name, path: routes.product(product.slug) })))} />
      <section className="detail-hero">
        <div className="container">
          <Breadcrumbs items={[{ name: "Best-for guides", path: routes.bestIndex() }, { name: u.title, path }]} />
          <div className="id-hero" style={{ marginTop: 18 }}>
            <div className="enter">
              <span className="eyebrow"><CategoryIcon slug={u.categorySlug} size={14} /> {category?.name} · for {u.audience}</span>
              <h1 style={{ marginTop: 14 }}>{u.title}</h1>
              <p className="lead">{paras[0]}</p>
              <p className="small muted">Updated {formatDate(u.contentUpdatedAt)} · {picks.length} picks · selections are editorial and never sponsored</p>
            </div>
            {top && (
              <aside className="hero-card glass glow-border enter-2" aria-label="Top pick">
                <span className="status info" style={{ alignSelf: "flex-start" }}><IconStar size={12} /> Top pick for {u.audience}</span>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <Monogram name={top.product.name} categorySlug={top.product.categorySlug} size="lg" />
                  <div><strong style={{ fontSize: "1.3rem" }}>{top.product.name}</strong><div className="tiny muted">{top.product.subcategory}</div></div>
                </div>
                <p className="small" style={{ margin: 0 }}>{top.ref.rationale}</p>
                <AffiliateCta product={top.product} ctaType="hero" placement="top-pick" {...cta} />
              </aside>
            )}
          </div>
        </div>
      </section>

      <div className="container detail-layout">
        <div>
          {paras.slice(1).map((para) => <p className="lead" key={para.slice(0, 40)}>{para}</p>)}

          <section className="section-gap reveal" id="criteria">
            <h2>How we chose</h2>
            <div className="criteria reveal-stagger">
              {u.criteria.map((cr, i) => <div className="criterion" key={cr.name}><h3><span className="ind verify">{i + 1}</span> {cr.name}</h3><p>{cr.description}</p></div>)}
            </div>
          </section>

          <section className="section-gap reveal" id="matrix">
            <h2>Picks at a glance</h2>
            <div className="table-wrap">
              <table className="compare">
                <thead>
                  <tr><th scope="col">Criterion</th>{picks.map(({ product: p }) => <th scope="col" key={p.slug}><a href={`#pick-${p.slug}`} style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><Monogram name={p.name} categorySlug={p.categorySlug} size="sm" />{p.name}</a></th>)}</tr>
                </thead>
                <tbody>
                  {schema.map((f) => (
                    <tr key={f.key}>
                      <th scope="row">{f.label}</th>
                      {picks.map(({ product: p }) => { const v = p.comparison[f.key] ?? "—"; const ind = indicatorFor(v); return <td key={p.slug}><span className="cell">{ind && <span className={`ind ${ind}`}>{INDICATOR_LABEL[ind]}</span>}{v}</span></td>; })}
                    </tr>
                  ))}
                  <tr><th scope="row">Pricing</th>{picks.map(({ product: p }) => <td key={p.slug}><span className={`status ${pricingState(p).tone}`}>{p.pricing.length ? pricingSummary(p) : "Verify"}</span></td>)}</tr>
                  <tr><th scope="row">Editorial score</th>{picks.map(({ product: p }) => <td key={p.slug}><ScoreBadge product={p} /></td>)}</tr>
                </tbody>
              </table>
            </div>
          </section>

          <h2 className="section-gap" style={{ marginTop: 32 }}>The picks</h2>
          {picks.map(({ product: p, ref }, i) => (
            <article className={`panel section-gap pick reveal${i === 0 ? " top" : ""}`} key={p.slug} id={`pick-${p.slug}`} style={catStyle(p.categorySlug)}>
              <span className="pick-rank" aria-label={`Pick ${i + 1}`}>{i + 1}</span>
              <div>
                <div className="pcard-head" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <Monogram name={p.name} categorySlug={p.categorySlug} />
                    <div><h2 style={{ margin: 0 }}><Link href={routes.product(p.slug)}>{p.name}</Link></h2><span className="tiny muted">{p.tagline}</span></div>
                  </div>
                  <ScoreBadge product={p} />
                </div>
                <div className="two section-gap">
                  <div><h3><IconCheck size={16} style={{ color: "var(--success)" }} /> Why it fits {u.audience.toLowerCase()}</h3><p>{ref.rationale}</p></div>
                  {ref.caveat && <div><h3><IconAlert size={16} style={{ color: "var(--warning)" }} /> Limitations to weigh</h3><p>{ref.caveat}</p></div>}
                </div>
                <dl className="meta-list">
                  <div><dt>Pricing</dt><dd><span className={`status ${pricingState(p).tone}`}>{pricingState(p).label}</span></dd></div>
                  <div><dt>Last checked</dt><dd>{lastCheckedText(p).replace("Last checked: ", "")}</dd></div>
                  <div><dt>Also good for</dt><dd>{p.review.bestFor.join(", ")}</dd></div>
                </dl>
                <div className="actions">
                  <AffiliateCta product={p} ctaType="plan" placement={`pick-${i + 1}`} {...cta} />
                  <Link className="btn secondary" href={routes.product(p.slug)}>{p.name} review</Link>
                  {alternativesFor(c, p).length > 0 && <Link className="btn ghost" href={routes.alternatives(p.slug)}>{p.name} alternatives</Link>}
                </div>
              </div>
            </article>
          ))}

          <FaqSection faqs={u.faqs} />
          <AffiliateDisclosure />
          <LinkGroups groups={bestForLinks(c, u)} />
        </div>
        <aside className="sidebar">
          <nav className="panel" aria-label="Picks">
            <strong className="small">Jump to a pick</strong>
            <ol className="list" style={{ marginTop: 8 }}>{picks.map(({ product: p }) => <li key={p.slug}><a href={`#pick-${p.slug}`}>{p.name}</a></li>)}</ol>
          </nav>
          {category && (
            <div className="panel">
              <strong>{category.name}</strong>
              <p className="muted small" style={{ margin: "8px 0 12px" }}>{category.description}</p>
              <Link className="btn secondary" href={routes.category(category.slug)}>Explore {category.name} →</Link>
            </div>
          )}
          <SponsorSlot pageType="best" pageSlug={u.slug} />
        </aside>
      </div>
    </div>
  );
}
