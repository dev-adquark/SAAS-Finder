import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { alternativesFor, findCategory, findProduct, loadCatalog, pairsForProduct } from "@/lib/catalog";
import { comparisonSchemaFor } from "@/lib/content/comparison-schema";
import { productLinks } from "@/lib/linking";
import { buildMetadata } from "@/lib/seo/metadata";
import { productJsonLd, hasPublishableRating } from "@/lib/seo/jsonld";
import { routes } from "@/lib/seo/routes";
import { formatDate } from "@/lib/freshness-rules";
import { AffiliateCta } from "@/components/cta";
import { AffiliateDisclosure } from "@/components/disclosure";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { FaqSection } from "@/components/faq-section";
import { JsonLd } from "@/components/json-ld";
import { LinkGroups } from "@/components/link-groups";
import { PricingSnapshot, lastCheckedText, pricingSummary } from "@/components/pricing-snapshot";
import { ScoreBadge } from "@/components/score";
import { SponsorSlot } from "@/components/sponsor-slot";

export const revalidate = 3600;

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await loadCatalog()).products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const p = findProduct(await loadCatalog(), slug);
  if (!p) return {};
  return buildMetadata({
    title: p.seoTitle ?? `${p.name} review: features, pricing, pros & cons`,
    description: p.seoDescription ?? `${p.name} review: ${p.tagline} See who it's best for, limitations, pricing notes and alternatives.`,
    path: routes.product(p.slug),
    type: "article",
    modifiedTime: p.contentUpdatedAt,
  });
}

const REVIEW_STATUS: Record<string, string> = {
  REVIEWED: "Editor reviewed",
  IN_PROGRESS: "Review in progress",
  NEEDS_UPDATE: "Update pending",
  NOT_STARTED: "Structured editorial profile; hands-on review pending",
};

export default async function ProductReview({ params }: Params) {
  const { slug } = await params;
  const catalog = await loadCatalog();
  const p = findProduct(catalog, slug);
  if (!p) notFound();
  const category = findCategory(catalog, p.categorySlug);
  const alts = alternativesFor(catalog, p);
  const pairs = pairsForProduct(catalog, p.slug);
  const schema = comparisonSchemaFor(p.categorySlug);
  const cta = { pageType: "product" as const, pageSlug: p.slug };
  const nameOf = (s: string) => catalog.products.find((x) => x.slug === s)?.name ?? s;

  return (
    <>
      <JsonLd data={productJsonLd(p, category?.name ?? "")} />
      <div className="container">
        <Breadcrumbs items={[...(category ? [{ name: category.name, path: routes.category(category.slug) }] : []), { name: `${p.name} review`, path: routes.product(p.slug) }]} />
      </div>

      {/* 1. Hero */}
      <section className="detail-hero">
        <div className="container">
          <span className="tag">{category?.name}{p.subcategory ? ` · ${p.subcategory}` : ""}</span>
          <h1>{p.name} review</h1>
          <p className="section-intro">{p.tagline}</p>
          <div className="actions">
            <AffiliateCta product={p} ctaType="hero" placement="hero" {...cta} />
            {alts.length > 0 && <Link className="btn secondary" href={routes.alternatives(p.slug)}>{p.name} alternatives</Link>}
          </div>
          <p className="small muted">{lastCheckedText(p)} · Content updated {formatDate(p.contentUpdatedAt)}{p.vendor ? ` · Vendor: ${p.vendor}` : ""}</p>
        </div>
      </section>

      <div className="container detail-layout">
        <div>
          {/* 2. Editorial summary */}
          <section className="panel" id="summary">
            <h2>Editorial summary</h2>
            <p>{p.review.editorialSummary}</p>
            <p className="muted">{p.description}</p>
            {p.review.verdict && <p className="notice"><strong>Verdict:</strong> {p.review.verdict}</p>}
          </section>

          {/* 3. Rating / review metadata */}
          <section className="panel section-gap" id="review-meta">
            <h2>Review details</h2>
            <dl className="meta-list">
              <div><dt>Editorial score</dt><dd><ScoreBadge product={p} /></dd></div>
              <div><dt>Review status</dt><dd>{REVIEW_STATUS[p.review.reviewStatus]}</dd></div>
              <div><dt>Last editorial review</dt><dd>{formatDate(p.review.lastReviewedAt) ?? "Not yet completed"}</dd></div>
              <div><dt>Category</dt><dd>{category ? <Link href={routes.category(category.slug)}>{category.name}</Link> : "—"}</dd></div>
            </dl>
            {!hasPublishableRating(p) && p.review.rating !== null && (
              <p className="muted small">This score is a provisional editorial signal based on positioning and documented features, not a completed hands-on review. See our <Link href={routes.methodology()}>methodology</Link>.</p>
            )}
          </section>

          {/* 4. Key features */}
          <section className="panel section-gap" id="features">
            <h2>Key features</h2>
            <ul className="list">{p.features.map((x) => <li key={x}>{x}</li>)}</ul>
          </section>

          {/* 5 + 6. Pricing snapshot and last checked */}
          <PricingSnapshot product={p} />

          {/* 7. Best for */}
          <section className="panel section-gap" id="best-for">
            <h2>Best for</h2>
            <ul className="list">{p.review.bestFor.map((x) => <li key={x}>{x}</li>)}</ul>
          </section>

          {/* 8. Limitations */}
          <section className="panel section-gap" id="limitations">
            <h2>Limitations</h2>
            <ul className="list">{p.review.limitations.map((x) => <li key={x}>{x}</li>)}</ul>
          </section>

          {/* 9 + 10. Pros and cons */}
          <section className="panel section-gap two" id="pros-cons">
            <div><h2>Pros</h2><ul className="list">{p.review.pros.map((x) => <li key={x}>✓ {x}</li>)}</ul></div>
            <div><h2>Cons</h2><ul className="list">{p.review.cons.map((x) => <li key={x}>— {x}</li>)}</ul></div>
          </section>

          {/* 11. Comparison highlights */}
          <section className="panel section-gap" id="comparison">
            <h2>Comparison highlights</h2>
            <div className="table-wrap">
              <table className="compare slim">
                <tbody>
                  {schema.map((f) => (
                    <tr key={f.key}><th scope="row">{f.label}</th><td>{f.computed === "pricing" ? pricingSummary(p) : p.comparison[f.key] ?? "—"}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pairs.length > 0 && (
              <ul className="list">
                {pairs.map((pair) => (
                  <li key={pair.slug}><Link href={routes.compare(pair.productA, pair.productB)}><strong>{nameOf(pair.productA)} vs {nameOf(pair.productB)}</strong></Link> — {pair.summary}</li>
                ))}
              </ul>
            )}
          </section>

          {/* 12. Alternatives */}
          {alts.length > 0 && (
            <section className="panel section-gap" id="alternatives">
              <h2>{p.name} alternatives</h2>
              {alts.map(({ product: a, ref }) => (
                <div className="faq" key={a.slug}>
                  <h3><Link href={routes.product(a.slug)}>{a.name}</Link></h3>
                  <p className="muted">{ref.rationale}</p>
                </div>
              ))}
              <Link className="btn secondary" href={routes.alternatives(p.slug)}>All {p.name} alternatives →</Link>
            </section>
          )}

          {/* 13. FAQs */}
          <FaqSection faqs={p.faqs} title={`${p.name} FAQs`} />

          {/* 14. Affiliate CTA */}
          <section className="panel section-gap cta-panel" id="cta">
            <h2>Check {p.name}&apos;s current plans</h2>
            <p className="muted">Confirm current plans, limits and terms directly with {p.vendor ?? p.name}.</p>
            <AffiliateCta product={p} ctaType="button" placement="footer" {...cta} />
          </section>

          {/* 15. Disclosure */}
          <AffiliateDisclosure />

          <LinkGroups groups={productLinks(catalog, p)} />

          {p.changelog.length > 0 && (
            <section className="panel section-gap" id="changelog">
              <h2>Update history</h2>
              <ul className="list">
                {p.changelog.map((c) => <li key={`${c.version}-${c.changedAt}`}><strong>{formatDate(c.changedAt)}</strong> — {c.summary}</li>)}
              </ul>
            </section>
          )}
        </div>

        <aside className="sidebar">
          <div className="panel">
            <h2>At a glance</h2>
            <p className="muted small">{lastCheckedText(p)}</p>
            <AffiliateCta product={p} ctaType="button" placement="sidebar" {...cta} />
          </div>
          <SponsorSlot pageType="product" pageSlug={p.slug} />
        </aside>
      </div>
    </>
  );
}
