import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { alternativesFor, findCategory, findProduct, loadCatalog, pairFor } from "@/lib/catalog";
import { alternativesLinks } from "@/lib/linking";
import { buildMetadata } from "@/lib/seo/metadata";
import { itemListJsonLd } from "@/lib/seo/jsonld";
import { routes } from "@/lib/seo/routes";
import { AffiliateCta } from "@/components/cta";
import { AffiliateDisclosure } from "@/components/disclosure";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { LinkGroups } from "@/components/link-groups";
import { lastCheckedText, pricingSummary } from "@/components/pricing-snapshot";
import { ScoreBadge } from "@/components/score";
import { SponsorSlot } from "@/components/sponsor-slot";

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
    <>
      <JsonLd data={itemListJsonLd(`Alternatives to ${p.name}`, path, alts.map((a) => ({ name: a.product.name, path: routes.product(a.product.slug) })))} />
      <section className="section">
        <div className="container">
          <Breadcrumbs items={[{ name: "Alternatives", path: routes.alternativesIndex() }, { name: `${p.name} alternatives`, path }]} />
          <span className="eyebrow">{category?.name} alternatives</span>
          <h1>Best {p.name} alternatives</h1>
          <p className="section-intro">{alts.length} curated alternative{alts.length === 1 ? "" : "s"} to {p.name}, each chosen for a specific reason — with the trade-offs spelled out.</p>

          <div className="detail-layout">
            <div>
              <section className="panel" id="reviewed-product">
                <h2>About {p.name}</h2>
                <p>{p.review.editorialSummary}</p>
                <p className="muted small"><ScoreBadge product={p} /> · <Link href={routes.product(p.slug)}>Read the full {p.name} review</Link></p>
              </section>

              <section className="panel section-gap" id="why-switch">
                <h2>Why people look for {p.name} alternatives</h2>
                <p>{p.alternativesIntro}</p>
                {p.review.limitations.length > 0 && (
                  <>
                    <h3>Common sticking points with {p.name}</h3>
                    <ul className="list">{p.review.limitations.map((x) => <li key={x}>{x}</li>)}</ul>
                  </>
                )}
              </section>

              {alts.map(({ product: a, ref }, i) => {
                const pair = pairFor(c, p.slug, a.slug);
                return (
                  <article className="panel section-gap alt-item" key={a.slug} id={`alt-${a.slug}`}>
                    <span className="tag">#{i + 1} · {a.subcategory}</span>
                    <h2><Link href={routes.product(a.slug)}>{a.name}</Link></h2>
                    <p className="muted">{a.tagline}</p>
                    <h3>Why it&apos;s on this list</h3>
                    <p>{ref.rationale}</p>
                    {ref.keyDifference && (<><h3>Key difference from {p.name}</h3><p>{ref.keyDifference}</p></>)}
                    <dl className="meta-list">
                      <div><dt>Best for</dt><dd>{a.review.bestFor.join(", ")}</dd></div>
                      <div><dt>Watch out for</dt><dd>{a.review.limitations[0] ?? "—"}</dd></div>
                      <div><dt>Pricing</dt><dd>{pricingSummary(a)} <span className="muted small">({lastCheckedText(a)})</span></dd></div>
                      <div><dt>Editorial score</dt><dd><ScoreBadge product={a} /></dd></div>
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
              <SponsorSlot pageType="alternatives" pageSlug={p.slug} />
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
