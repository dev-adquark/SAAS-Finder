import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { alternativesFor, findCategory, findProduct, loadCatalog, pairFor } from "@/lib/catalog";
import type { Product } from "@/lib/content/types";
import { alternativesLinks } from "@/lib/linking";
import { buildMetadata } from "@/lib/seo/metadata";
import { itemListJsonLd } from "@/lib/seo/jsonld";
import { routes } from "@/lib/seo/routes";
import { pricingState, pricingSummary } from "@/lib/pricing";
import { AffiliateCta } from "@/components/cta";
import { AffiliateDisclosure } from "@/components/disclosure";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { LinkGroups } from "@/components/link-groups";
import { ScoreBadge } from "@/components/score";
import { SponsorSlot } from "@/components/sponsor-slot";
import { Monogram, catStyle } from "@/components/identity";
import { IconAlert, IconCheck, IconScale } from "@/components/icons";

export const revalidate = 3600;

type Params = { params: Promise<{ productSlug: string }> };

export async function generateStaticParams() {
  const c = await loadCatalog();
  return c.products.filter((p) => alternativesFor(c, p).length > 0).map((p) => ({ productSlug: p.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { productSlug } = await params;
  const c = await loadCatalog();
  const p = findProduct(c, productSlug);
  if (!p || !alternativesFor(c, p).length) return {};
  const names = alternativesFor(c, p).map((a) => a.product.name).join(", ");
  return buildMetadata({
    title: `Best ${p.name} alternatives: ${names}`,
    description: `Considering a switch from ${p.name}? Compare curated ${p.name} alternatives (${names}) by fit, key differences, limitations and pricing notes.`,
    path: routes.alternatives(p.slug),
    type: "article",
    modifiedTime: p.contentUpdatedAt,
  });
}

/** Editorial closeness from stored taxonomy only — no invented similarity scores. */
function closeness(source: Product, alt: Product): 0 | 1 | 2 {
  if (alt.categorySlug !== source.categorySlug) return 2;
  return alt.subcategory && alt.subcategory === source.subcategory ? 0 : 1;
}
const ZONES = ["Same subcategory", "Same category, different approach", "Different category"] as const;

export default async function AlternativesPage({ params }: Params) {
  const { productSlug } = await params;
  const c = await loadCatalog();
  const p = findProduct(c, productSlug);
  if (!p) notFound();
  const alts = alternativesFor(c, p);
  if (!alts.length) notFound();
  const category = findCategory(c, p.categorySlug);
  const path = routes.alternatives(p.slug);
  const cta = { pageType: "alternatives" as const, pageSlug: p.slug };

  return (
    <div style={catStyle(p.categorySlug)}>
      <JsonLd data={itemListJsonLd(`Alternatives to ${p.name}`, path, alts.map((a) => ({ name: a.product.name, path: routes.product(a.product.slug) })))} />
      <section className="detail-hero">
        <div className="container">
          <Breadcrumbs items={[{ name: "Alternatives", path: routes.alternativesIndex() }, { name: `${p.name} alternatives`, path }]} />
          <div className="id-hero" style={{ marginTop: 18 }}>
            <div className="enter">
              <span className="eyebrow">{category?.name} alternatives</span>
              <h1 style={{ marginTop: 14 }}>Looking for alternatives to <span className="grad-text">{p.name}</span>?</h1>
              <p className="lead">{alts.length} curated alternative{alts.length === 1 ? "" : "s"} to {p.name}, each chosen for a specific reason — with the trade-offs spelled out.</p>
              <div className="chip-row" style={{ marginTop: 16 }}>
                {alts.map(({ product: a }) => <a key={a.slug} className="chip" href={`#alt-${a.slug}`} style={catStyle(a.categorySlug)}>{a.name}</a>)}
              </div>
            </div>
            <aside className="hero-card glass enter-2" aria-labelledby="reviewed-title">
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <Monogram name={p.name} categorySlug={p.categorySlug} />
                <div><strong id="reviewed-title">{p.name}</strong><div className="tiny muted">{p.subcategory}</div></div>
              </div>
              <p className="small" style={{ margin: 0 }}>{p.review.editorialSummary}</p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><ScoreBadge product={p} /><Link className="text-link small" href={routes.product(p.slug)}>Full {p.name} review</Link></div>
            </aside>
          </div>
        </div>
      </section>

      <div className="container detail-layout">
        <div>
          <section className="panel" id="why-switch">
            <h2>Why people look for {p.name} alternatives</h2>
            <p>{p.alternativesIntro}</p>
            <div className="grid two-col section-gap reveal-stagger">
              {[...p.review.limitations, ...p.review.cons].slice(0, 4).map((x) => (
                <div className="feature" key={x}><span className="fi" style={{ color: "var(--warning)" }}><IconAlert size={16} /></span><span>{x}</span></div>
              ))}
            </div>
          </section>

          <section className="panel section-gap reveal" id="similarity">
            <h2><IconScale /> How close is each alternative?</h2>
            <p className="muted small">Placed by our editorial taxonomy (subcategory and category), not by a computed similarity score.</p>
            <div className="spectrum">
              <div className="spectrum-track" aria-hidden="true" />
              <div className="spectrum-labels"><span>← More similar</span><span>More different →</span></div>
              <div className="spectrum-zones">
                {ZONES.map((label, z) => {
                  const inZone = alts.filter(({ product: a }) => closeness(p, a) === z);
                  return (
                    <div className="spectrum-zone" key={label}>
                      <h3>{label}</h3>
                      {inZone.length ? (
                        <div className="chip-row">{inZone.map(({ product: a }) => <a key={a.slug} href={`#alt-${a.slug}`} style={catStyle(a.categorySlug)}><Monogram name={a.name} categorySlug={a.categorySlug} size="sm" />{a.name}</a>)}</div>
                      ) : <p className="tiny muted">None in this set</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <h2 className="section-gap" style={{ marginTop: 32 }}>Alternative explorer</h2>
          {alts.map(({ product: a, ref }, i) => {
            const pair = pairFor(c, p.slug, a.slug);
            const ps = pricingState(a);
            return (
              <article className="panel section-gap alt-item hoverable card reveal" key={a.slug} id={`alt-${a.slug}`} style={catStyle(a.categorySlug)}>
                <div className="pcard-head" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                    <Monogram name={a.name} categorySlug={a.categorySlug} size="lg" />
                    <div>
                      <span className="tag">#{i + 1} · {a.subcategory}</span>
                      <h2 style={{ margin: "6px 0 0" }}><Link href={routes.product(a.slug)}>{a.name}</Link></h2>
                    </div>
                  </div>
                  <ScoreBadge product={a} />
                </div>
                <p className="muted" style={{ marginTop: 12 }}>{a.tagline}</p>
                <div className="two">
                  <div>
                    <h3>Why it&apos;s on this list</h3>
                    <p>{ref.rationale}</p>
                    {ref.keyDifference && (<><h3>Key difference from {p.name}</h3><p>{ref.keyDifference}</p></>)}
                  </div>
                  <div>
                    <h3>Strengths</h3>
                    <ul className="limit-list">{a.review.pros.slice(0, 2).map((x) => <li key={x} style={{ background: "rgba(52,211,153,0.06)", borderColor: "rgba(52,211,153,0.22)" }}><IconCheck size={16} style={{ color: "var(--success)" }} />{x}</li>)}</ul>
                    <h3 className="section-gap">Watch out for</h3>
                    <ul className="limit-list">{a.review.limitations.slice(0, 1).map((x) => <li key={x}><IconAlert size={16} />{x}</li>)}</ul>
                  </div>
                </div>
                <dl className="meta-list">
                  <div><dt>Best for</dt><dd>{a.review.bestFor.join(", ")}</dd></div>
                  <div><dt>Pricing</dt><dd><span className={`status ${ps.tone}`}>{ps.label}</span><br /><span className="tiny muted">{pricingSummary(a)}</span></dd></div>
                </dl>
                <div className="actions">
                  <AffiliateCta product={a} ctaType="button" placement={`alternative-${i + 1}`} {...cta} />
                  <Link className="btn secondary" href={routes.product(a.slug)}>{a.name} review</Link>
                  {pair && <Link className="btn secondary" href={routes.compare(pair.productA, pair.productB)}>{p.name} vs {a.name}</Link>}
                </div>
              </article>
            );
          })}

          <AffiliateDisclosure />
          <LinkGroups groups={alternativesLinks(c, p)} />
        </div>
        <aside className="sidebar">
          <div className="panel">
            <strong>Still considering {p.name}?</strong>
            <p className="muted small" style={{ margin: "8px 0 12px" }}>Check its current plans before you switch.</p>
            <AffiliateCta product={p} ctaType="button" placement="sidebar-original" {...cta} />
          </div>
          <SponsorSlot pageType="alternatives" pageSlug={p.slug} />
        </aside>
      </div>
    </div>
  );
}
