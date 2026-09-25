import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { alternativesFor, findCategory, findProduct, guidesForProduct, loadCatalog, pairsForProduct } from "@/lib/catalog";
import { comparisonSchemaFor } from "@/lib/content/comparison-schema";
import { productLinks } from "@/lib/linking";
import { buildMetadata } from "@/lib/seo/metadata";
import { productJsonLd, hasPublishableRating } from "@/lib/seo/jsonld";
import { routes } from "@/lib/seo/routes";
import { absolute } from "@/lib/site";
import { formatDate } from "@/lib/freshness-rules";
import { lastCheckedText, pricingState, pricingSummary } from "@/lib/pricing";
import { INDICATOR_LABEL, indicatorFor } from "@/lib/indicators";
import { AffiliateCta } from "@/components/cta";
import { AffiliateDisclosure } from "@/components/disclosure";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { FaqSection } from "@/components/faq-section";
import { JsonLd } from "@/components/json-ld";
import { LinkGroups } from "@/components/link-groups";
import { PricingSnapshot } from "@/components/pricing-snapshot";
import { ScoreBadge } from "@/components/score";
import { SponsorSlot } from "@/components/sponsor-slot";
import { ShareButton } from "@/components/share-button";
import { Prism } from "@/components/prism";
import { Monogram, catStyle } from "@/components/identity";
import { CategoryIcon, IconAlert, IconCheck, IconShield, IconSpark, IconUsers, IconX, IconLayers } from "@/components/icons";
import { FactsTable, FreshnessStrip, PlanTable, ResourceCenter, SourcesPanel, TrustBadges, fact, verifiedSources } from "@/components/verification";

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

const REVIEW_STATUS: Record<string, { label: string; tone: string }> = {
  REVIEWED: { label: "Editor reviewed", tone: "ok" },
  IN_PROGRESS: { label: "Review in progress", tone: "info" },
  NEEDS_UPDATE: { label: "Update pending", tone: "pending" },
  NOT_STARTED: { label: "Hands-on review pending", tone: "info" },
};

const TOC = [
  ["summary", "Overview"], ["features", "Features"], ["pricing", "Pricing"], ["best-for", "Who it's for"], ["limitations", "Limitations"],
  ["pros-cons", "Strengths & weaknesses"], ["platforms", "Platforms"], ["use-cases", "Use cases"], ["comparison", "Competitors"], ["alternatives", "Alternatives"],
  ["facts", "Product facts"], ["sources", "Sources"], ["faq", "FAQs"],
] as const;

export default async function ProductReview({ params }: Params) {
  const { slug } = await params;
  const catalog = await loadCatalog();
  const p = findProduct(catalog, slug);
  if (!p) notFound();
  const category = findCategory(catalog, p.categorySlug);
  const alts = alternativesFor(catalog, p);
  const pairs = pairsForProduct(catalog, p.slug);
  const guides = guidesForProduct(catalog, p.slug);
  const schema = comparisonSchemaFor(p.categorySlug);
  const cta = { pageType: "product" as const, pageSlug: p.slug };
  const other = (pair: (typeof pairs)[number]) => findProduct(catalog, pair.productA === p.slug ? pair.productB : pair.productA)!;
  const ps = pricingState(p);
  const status = REVIEW_STATUS[p.review.reviewStatus];

  return (
    <div style={catStyle(p.categorySlug)} className="has-sticky-cta">
      <div className="progress" aria-hidden="true" />
      <JsonLd data={productJsonLd(p, category?.name ?? "")} />

      {/* 1. Hero */}
      <section className="detail-hero">
        <div className="container">
          <Breadcrumbs items={[...(category ? [{ name: category.name, path: routes.category(category.slug) }] : []), { name: `${p.name} review`, path: routes.product(p.slug) }]} />
          <div className="id-hero">
            <Prism size={150} className="hero-prism" />
            <div className="enter">
              <div className="chip-row" style={{ marginTop: 16 }}>
                {category && <Link className="chip" href={routes.category(category.slug)}><CategoryIcon slug={category.slug} size={13} /> {category.name}</Link>}
                {p.subcategory && <span className="chip">{p.subcategory}</span>}
                <span className={`status ${status.tone}`}>{status.label}</span>
              </div>
              <div className="id-title">
                <Monogram name={p.name} slug={p.slug} categorySlug={p.categorySlug} size="xl" />
                <h1>{p.name} review</h1>
              </div>
              <p className="lead">{p.tagline}</p>
              <TrustBadges product={p} />
              <div className="actions" style={{ marginTop: 20 }}>
                <AffiliateCta product={p} ctaType="hero" placement="hero" {...cta} />
                {alts.length > 0 && <Link className="btn secondary" href={routes.alternatives(p.slug)}>{alts.length} alternatives</Link>}
                <ShareButton url={absolute(routes.product(p.slug))} />
              </div>
            </div>
            <aside className="hero-card glass enter-2" aria-label={`${p.name} at a glance`}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>At a glance</strong>
                <ScoreBadge product={p} />
              </div>
              <dl>
                <div><dt>Category</dt><dd>{category?.name}</dd></div>
                <div><dt>Pricing</dt><dd><span className={`status ${ps.tone}`}>{ps.label}</span></dd></div>
                <div><dt>Free plan</dt><dd>{fact(p, "freePlan")?.value ?? "Not verified"}</dd></div>
                <div><dt>Free trial</dt><dd>{fact(p, "freeTrial")?.value ?? "Not verified"}</dd></div>
                <div><dt>Best for</dt><dd>{p.review.bestFor[0]}</dd></div>
                <div><dt>Last checked</dt><dd>{formatDate(p.pricingLastChecked) ?? "Not yet"}</dd></div>
                <div><dt>Updated</dt><dd>{formatDate(p.contentUpdatedAt)}</dd></div>
                {p.vendor && <div><dt>Vendor</dt><dd>{fact(p, "company")?.value ?? p.vendor}</dd></div>}
                <div><dt>Official sources</dt><dd>{verifiedSources(p).length || "Not yet verified"}</dd></div>
              </dl>
              <a className="text-link small" href={p.officialUrl} target="_blank" rel="nofollow noopener">Official website ↗</a>
            </aside>
          </div>
        </div>
      </section>

      <div className="container detail-layout">
        <div>
          {/* 2. Editorial summary */}
          <section className="panel glow-border" id="summary">
            <span className="eyebrow">Editorial summary</span>
            <h2 className="sr-only">Editorial summary</h2>
            <p style={{ fontSize: "1.08rem", marginTop: 12 }}>{p.review.editorialSummary}</p>
            <p className="muted">{p.description}</p>
            {fact(p, "officialDescription") && (
              <blockquote className="official-quote">
                <p>&ldquo;{fact(p, "officialDescription")!.value}&rdquo;</p>
                <footer className="tiny muted">— {p.vendor ?? p.name}, <a className="text-link" href={fact(p, "officialDescription")!.sourceUrl ?? p.officialUrl} target="_blank" rel="nofollow noopener noreferrer">official site</a></footer>
              </blockquote>
            )}
            {p.review.verdict && <p className="notice" style={{ marginBottom: 0 }}><strong>Verdict:</strong> {p.review.verdict}</p>}
          </section>

          {/* 3. Review metadata — quick facts */}
          <section className="section-gap reveal" id="review-meta" aria-labelledby="facts-title">
            <h2 id="facts-title" className="sr-only">Quick facts</h2>
            <div className="stat-grid">
              <div className="stat"><div className="k">Category</div><div className="v">{category?.name}</div></div>
              <div className="stat"><div className="k">Pricing</div><div className="v">{p.pricing.length ? pricingSummary(p) : "Varies"}</div></div>
              <div className="stat"><div className="k">Best for</div><div className="v">{p.review.bestFor.slice(0, 2).join(", ")}</div></div>
              <div className="stat"><div className="k">Editorial score</div><div className="v"><ScoreBadge product={p} /></div></div>
              <div className="stat"><div className="k">Key features</div><div className="v">{p.features.length} tracked</div></div>
              <div className="stat"><div className="k">Last checked</div><div className="v">{formatDate(p.pricingLastChecked) ?? "Not yet verified"}</div></div>
            </div>
            {!hasPublishableRating(p) && p.review.rating !== null && (
              <p className="muted small" style={{ marginTop: 10 }}>The score is a provisional editorial signal based on positioning and documented features, not a completed hands-on review. See our <Link href={routes.methodology()}>methodology</Link>.</p>
            )}
          </section>

          {/* 4. Key features */}
          <section className="section-gap reveal" id="features">
            <h2>Key features</h2>
            <div className="feature-grid reveal-stagger">
              {p.features.map((x) => <div className="feature" key={x}><span className="fi"><IconSpark size={16} /></span><span>{x}</span></div>)}
            </div>
            <h3 className="section-gap">Feature breakdown</h3>
            <div className="breakdown reveal-stagger">
              {schema.filter((f) => !f.computed).map((f) => {
                const v = p.comparison[f.key];
                const ind = indicatorFor(v);
                return (
                  <div className="bd" key={f.key}>
                    <span className="tiny muted">{f.label}</span>
                    <strong className="small">{v ?? "—"}</strong>
                    {ind && <span className={`ind ${ind}`}>{INDICATOR_LABEL[ind]}</span>}
                  </div>
                );
              })}
            </div>
            <p className="tiny muted" style={{ marginTop: 8 }}>Feature breakdown is SaaSFinder&apos;s editorial assessment of documented capabilities.</p>
          </section>

          {/* 5 + 6. Pricing snapshot and last checked */}
          <PricingSnapshot product={p} cta={cta} />

          {/* 7. Best for */}
          <section className="section-gap reveal" id="best-for">
            <h2>Who {p.name} is for</h2>
            <div className="bestfor-tags">{p.review.bestFor.map((x) => <span key={x}>{x}</span>)}</div>
            {fact(p, "audience") && <p className="small" style={{ marginTop: 12 }}><strong>Vendor&apos;s stated audience:</strong> {fact(p, "audience")!.value}</p>}
            {guides.length > 0 && (
              <p className="small muted" style={{ marginTop: 12 }}>
                Featured in: {guides.map((g, i) => <span key={g.slug}>{i > 0 && " · "}<Link href={routes.best(g.slug)}>{g.title}</Link></span>)}
              </p>
            )}
          </section>

          {/* 8. Limitations */}
          <section className="section-gap reveal" id="limitations">
            <h2>Who should avoid it — limitations</h2>
            <ul className="limit-list">{p.review.limitations.map((x) => <li key={x}><IconAlert size={16} />{x}</li>)}</ul>
          </section>

          {/* 9 + 10. Pros and cons */}
          <section className="section-gap proscons reveal" id="pros-cons">
            <div className="pc pros"><h2><IconCheck /> Pros</h2><ul>{p.review.pros.map((x) => <li key={x}><IconCheck size={16} />{x}</li>)}</ul></div>
            <div className="pc cons"><h2><IconX /> Cons</h2><ul>{p.review.cons.map((x) => <li key={x}><IconX size={16} />{x}</li>)}</ul></div>
          </section>

          <section className="section-gap reveal" id="platforms">
            <h2><IconLayers /> Platforms &amp; integrations</h2>
            <FactsTable product={p} keys={["platforms", "mobileApps", "browser", "integrations"]} title="Platforms and integrations" />
          </section>

          <section className="section-gap three-up reveal-stagger" id="ease-security-support">
            <div className="panel mini-panel">
              <h3><IconSpark size={18} /> Ease of use</h3>
              <p className="small">{p.comparison.ease ?? p.comparison.learning ?? p.comparison.setup ?? "Not assessed"}</p>
              <span className="tiny muted">Editorial assessment</span>
            </div>
            <div className="panel mini-panel">
              <h3><IconShield size={18} /> Security &amp; privacy</h3>
              <p className="small">{fact(p, "security")?.value ?? "Not verified"}</p>
              {p.sources.find((x) => x.kind === "SECURITY" && x.status === "VERIFIED") ? <a className="tiny text-link" href={p.sources.find((x) => x.kind === "SECURITY" && x.status === "VERIFIED")!.url} target="_blank" rel="nofollow noopener noreferrer">Official security page ↗</a> : <span className="tiny muted">No official security page verified yet</span>}
            </div>
            <div className="panel mini-panel">
              <h3><IconUsers size={18} /> Support</h3>
              <p className="small">{fact(p, "support")?.value ?? "Not verified"}</p>
              {p.sources.find((x) => x.kind === "HELP_CENTER" && x.status === "VERIFIED") ? <a className="tiny text-link" href={p.sources.find((x) => x.kind === "HELP_CENTER" && x.status === "VERIFIED")!.url} target="_blank" rel="nofollow noopener noreferrer">Official help center ↗</a> : <span className="tiny muted">No help center verified yet</span>}
            </div>
          </section>

          <section className="section-gap reveal" id="use-cases">
            <h2>Use cases</h2>
            {fact(p, "useCases") && <p><strong>Vendor-stated use cases:</strong> {fact(p, "useCases")!.value}</p>}
            {guides.length > 0 ? (
              <div className="grid two-col">
                {guides.map((g) => (
                  <Link key={g.slug} className="card ucard accent-top" href={routes.best(g.slug)}>
                    <span className="tag">For {g.audience}</span>
                    <h3>{g.title}</h3>
                    <span className="tiny muted">Ranked #{g.products.findIndex((x) => x.slug === p.slug) + 1} of {g.products.length}</span>
                  </Link>
                ))}
              </div>
            ) : <p className="muted small">Not yet featured in a best-for guide.</p>}
          </section>

          {/* 11. Comparison highlights */}
          <section className="section-gap reveal" id="comparison">
            <h2>Competitors &amp; comparison highlights</h2>
            <div className="table-wrap">
              <table className="compare slim">
                <tbody>
                  {schema.map((f) => {
                    const value = f.computed === "pricing" ? pricingSummary(p) : p.comparison[f.key] ?? "—";
                    const ind = f.computed === "pricing" ? (p.pricing.length ? null : "verify") : indicatorFor(value);
                    return <tr key={f.key}><th scope="row">{f.label}</th><td><span className="cell">{ind && <span className={`ind ${ind}`}>{INDICATOR_LABEL[ind]}</span>}{value}</span></td></tr>;
                  })}
                </tbody>
              </table>
            </div>
            {pairs.length > 0 && (
              <div className="grid section-gap">
                {pairs.map((pair) => {
                  const o = other(pair);
                  return (
                    <Link key={pair.slug} className="card vscard" href={routes.compare(pair.productA, pair.productB)}>
                      <span className="side"><Monogram name={p.name} slug={p.slug} categorySlug={p.categorySlug} size="sm" />{p.name}</span>
                      <span className="vs" aria-hidden="true">VS</span>
                      <span className="side"><Monogram name={o.name} slug={o.slug} categorySlug={o.categorySlug} size="sm" />{o.name}</span>
                      <span className="sr-only"> versus </span>
                      <span className="sum">{pair.summary}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* 12. Alternatives */}
          {alts.length > 0 && (
            <section className="section-gap reveal" id="alternatives">
              <div className="section-head" style={{ marginBottom: 12 }}>
                <h2 style={{ margin: 0 }}>{p.name} alternatives</h2>
                <Link className="btn ghost" href={routes.alternatives(p.slug)}>Compare all alternatives →</Link>
              </div>
              <div className="grid two-col">
                {alts.map(({ product: a, ref }) => (
                  <article className="card hoverable pcard" key={a.slug} style={catStyle(a.categorySlug)}>
                    <div className="pcard-head">
                      <Monogram name={a.name} slug={a.slug} categorySlug={a.categorySlug} />
                      <div><h3><Link className="stretch" href={routes.product(a.slug)}>{a.name}</Link></h3><div className="sub">{a.subcategory}</div></div>
                    </div>
                    <p>{ref.rationale}</p>
                    <div className="pcard-foot"><ScoreBadge product={a} /><span className="tiny muted">Read review →</span></div>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className="section-gap reveal" id="facts">
            <h2>{p.name} product facts</h2>
            <FactsTable product={p} keys={["company", "founded", "headquarters", "audience", "freePlan", "freeTrial", "billingOptions", "usageLimits"]} title={`${p.name} product facts`} />
          </section>

          <ResourceCenter product={p} />
          <SourcesPanel product={p} />
          <section className="section-gap reveal" id="freshness">
            <h2>Freshness</h2>
            <FreshnessStrip product={p} />
          </section>

          {/* 13. FAQs */}
          <FaqSection faqs={p.faqs} title={`${p.name} FAQs`} />

          <section className="panel section-gap reveal" id="editorial-notes">
            <h2>Editorial notes</h2>
            <p className="small">{p.review.verdict ?? p.review.editorialSummary}</p>
            <p className="tiny muted">Review status: {status.label}. Editorial judgements (summary, pros, cons, scores, feature breakdown) are SaaSFinder&apos;s opinion; vendor facts and prices are shown only when verified against official sources.</p>
          </section>

          {/* 14. Affiliate CTA */}
          <section className="cta-band section-gap reveal" id="cta">
            <div>
              <h2>Ready to try {p.name}?</h2>
              <p className="muted">Confirm current plans, limits and terms directly with {p.vendor ?? p.name}.</p>
            </div>
            <div className="actions" style={{ justifyContent: "flex-end" }}>
              <AffiliateCta product={p} ctaType="button" placement="footer" {...cta} />
            </div>
          </section>

          {/* 15. Disclosure */}
          <AffiliateDisclosure />

          <LinkGroups groups={productLinks(catalog, p)} />

          {p.changelog.length > 0 && (
            <section className="panel section-gap reveal" id="changelog">
              <h2>Update history</h2>
              <ol className="timeline">
                {p.changelog.map((c) => <li key={`${c.version}-${c.changedAt}`}><time dateTime={c.changedAt}>{formatDate(c.changedAt)}</time>{c.summary}</li>)}
              </ol>
            </section>
          )}
        </div>

        <aside className="sidebar" aria-label="Review sidebar">
          <div className="panel">
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <Monogram name={p.name} slug={p.slug} categorySlug={p.categorySlug} size="sm" />
              <strong>{p.name}</strong>
            </div>
            <p className="muted small" style={{ margin: "10px 0 12px" }}>{lastCheckedText(p)}</p>
            <AffiliateCta product={p} ctaType="button" placement="sidebar" {...cta} />
          </div>
          <nav className="panel" aria-label="On this page">
            <strong className="small">On this page</strong>
            <ul className="list" style={{ listStyle: "none", padding: 0, marginTop: 8 }}>
              {TOC.filter(([id]) => id !== "alternatives" || alts.length > 0).map(([id, label]) => <li key={id}><a href={`#${id}`}>{label}</a></li>)}
            </ul>
          </nav>
          <SponsorSlot pageType="product" pageSlug={p.slug} />
        </aside>
      </div>

      <div className="sticky-cta" aria-label={`Visit ${p.name}`}>
        <span style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
          <Monogram name={p.name} slug={p.slug} categorySlug={p.categorySlug} size="sm" />
          <span style={{ display: "grid", minWidth: 0 }}>
            <strong style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</strong>
            <span className="tiny muted">{p.affiliate ? "Affiliate link" : "Official site"}</span>
          </span>
        </span>
        <AffiliateCta product={p} ctaType="button" variant="sticky" placement="sticky" label="Visit" hideNote {...cta} />
      </div>
    </div>
  );
}
