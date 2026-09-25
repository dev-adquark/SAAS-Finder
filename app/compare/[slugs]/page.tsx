import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { findCategory, findPair, findProduct, loadCatalog } from "@/lib/catalog";
import { comparisonSchemaFor } from "@/lib/content/comparison-schema";
import type { Product } from "@/lib/content/types";
import { compareLinksFor } from "@/lib/linking";
import { buildMetadata } from "@/lib/seo/metadata";
import { webPageJsonLd } from "@/lib/seo/jsonld";
import { parseCompareSlug, routes } from "@/lib/seo/routes";
import { absolute } from "@/lib/site";
import { lastCheckedText, pricingState, pricingSummary } from "@/lib/pricing";
import { INDICATOR_LABEL, indicatorFor, type Indicator } from "@/lib/indicators";
import { AffiliateCta } from "@/components/cta";
import { AffiliateDisclosure } from "@/components/disclosure";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { LinkGroups } from "@/components/link-groups";
import { ScoreBadge } from "@/components/score";
import { SponsorSlot } from "@/components/sponsor-slot";
import { ShareButton } from "@/components/share-button";
import { Rings } from "@/components/prism";
import { Monogram, catStyle } from "@/components/identity";
import { IconAlert, IconArrow, IconCheck, IconX } from "@/components/icons";
import { FACT_LABELS, fact } from "@/components/verification";
import { formatDate } from "@/lib/freshness-rules";
import { formatPrice } from "@/lib/pricing";

export const revalidate = 3600;

type Params = { params: Promise<{ slugs: string }> };

export async function generateStaticParams() {
  return (await loadCatalog()).pairs.map((p) => ({ slugs: p.slug }));
}

async function resolve(segment: string) {
  const parsed = parseCompareSlug(segment);
  if (!parsed) return null;
  const c = await loadCatalog();
  const pair = findPair(c, parsed.canonicalSlug);
  const a = pair && findProduct(c, pair.productA);
  const b = pair && findProduct(c, pair.productB);
  return pair && a && b ? { c, parsed, pair, a, b } : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const r = await resolve((await params).slugs);
  if (!r) return {};
  return buildMetadata({
    title: `${r.a.name} vs ${r.b.name}: which is better for you?`,
    description: `${r.a.name} vs ${r.b.name} compared side by side: ${r.pair.summary}`,
    path: routes.compare(r.a.slug, r.b.slug),
    type: "article",
    modifiedTime: r.pair.updatedAt,
  });
}

function Cell({ value, ind }: { value: string; ind: Indicator | null }) {
  return <span className="cell">{ind && <span className={`ind ${ind}`}>{INDICATOR_LABEL[ind]}</span>}{value}</span>;
}

/** A sourced fact cell: the verified value with a direct source link, or "Not verified". */
function FactCell({ p, k }: { p: Product; k: string }) {
  const f = fact(p, k);
  if (!f) return <span className="muted">Not verified</span>;
  return (
    <span className="cell">
      <span>{f.value}</span>
      {f.sourceUrl && <a className="tiny text-link" href={f.sourceUrl} target="_blank" rel="nofollow noopener noreferrer">Source · {formatDate(f.checkedAt)} <IconArrow size={10} /></a>}
    </span>
  );
}

/** Lowest listed price for a billing period, exactly as captured (same-currency only). */
function priceFor(p: Product, period: "MONTHLY" | "ANNUAL") {
  const rows = p.pricing.filter((x) => x.billingPeriod === period && typeof x.price === "number" && x.price > 0);
  if (!rows.length) return null;
  const cheapest = rows.reduce((a, b) => (b.price! < a.price! ? b : a));
  return { text: `From ${formatPrice(cheapest)}`, plan: cheapest.plan, unit: cheapest.unit, promo: cheapest.promotional };
}

export default async function ComparePage({ params }: Params) {
  const r = await resolve((await params).slugs);
  if (!r) notFound();
  const { c, parsed, pair, a, b } = r;
  // Reverse order is normally redirected by proxy.ts; this is a fallback.
  if (!parsed.isCanonical) permanentRedirect(routes.compare(a.slug, b.slug));
  const path = routes.compare(a.slug, b.slug);
  const category = findCategory(c, pair.categorySlug);
  const schema = comparisonSchemaFor(pair.categorySlug);
  const cta = { pageType: "compare" as const, pageSlug: pair.slug };
  const value = (p: Product, key: string, computed?: string) => (computed === "pricing" ? pricingSummary(p) : p.comparison[key] ?? "—");
  const ind = (p: Product, key: string, computed?: string): Indicator | null => (computed === "pricing" ? (p.pricing.length ? null : "verify") : indicatorFor(p.comparison[key]));

  return (
    <div style={catStyle(pair.categorySlug)}>
      <div className="progress" aria-hidden="true" />
      <JsonLd data={{ ...webPageJsonLd("Article", `${a.name} vs ${b.name}`, path, pair.summary, pair.updatedAt), about: [a, b].map((p) => ({ "@type": "SoftwareApplication", name: p.name, url: p.officialUrl })) }} />
      <section className="detail-hero">
        <div className="container">
          <Breadcrumbs items={[{ name: "Comparisons", path: routes.comparisons() }, { name: `${a.name} vs ${b.name}`, path }]} />
          <div style={{ textAlign: "center", marginTop: 20 }}>
            <span className="eyebrow">{category?.name} comparison</span>
            <h1 style={{ marginTop: 14 }}>{a.name} <span className="grad-text">vs</span> {b.name}</h1>
            <p className="lead" style={{ marginInline: "auto" }}>{pair.summary}</p>
          </div>
          <div className="duel">
            {[{ p: a, why: pair.chooseA, side: "a" }, { p: b, why: pair.chooseB, side: "b" }].map(({ p, why, side }, i) => (
              <div key={p.slug} style={{ display: "contents" }}>
                {i === 1 && <div className="duel-mid" aria-hidden="true"><Rings /><span className="vs">VS</span></div>}
                <div className={`duel-side ${side}`} style={catStyle(p.categorySlug)}>
                  <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                    <Monogram name={p.name} slug={p.slug} categorySlug={p.categorySlug} size="lg" />
                    <div><h2>{p.name}</h2><span className="tiny muted">{p.subcategory}</span></div>
                  </div>
                  <div className="chip-row"><ScoreBadge product={p} /><span className={`status ${pricingState(p).tone}`}>{pricingState(p).label}</span></div>
                  <p style={{ margin: 0 }}><strong>Choose {p.name} if…</strong> {why}</p>
                  <AffiliateCta product={p} ctaType="comparison" placement={`choose-${p.slug}`} {...cta} />
                </div>
              </div>
            ))}
          </div>
          <div className="actions" style={{ justifyContent: "center", marginTop: 16 }}><ShareButton url={absolute(path)} label="Copy comparison link" /></div>
        </div>
      </section>

      <div className="container">
        <section className="panel reveal" id="key-differences">
          <h2>Key differences</h2>
          <div className="grid three reveal-stagger section-gap">
            {pair.highlights.map((h, i) => <div className="feature" key={h}><span className="fi">{i + 1}</span><span>{h}</span></div>)}
          </div>
        </section>

        <section className="section-gap reveal" id="comparison-table">
          <h2>Side-by-side comparison</h2>
          <div className="table-wrap">
            <table className="compare">
              <thead>
                <tr>
                  <th scope="col">Criterion</th>
                  {[a, b].map((p) => <th scope="col" key={p.slug}><span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}><Monogram name={p.name} slug={p.slug} categorySlug={p.categorySlug} size="sm" />{p.name}</span></th>)}
                </tr>
              </thead>
              <tbody>
                {schema.map((f) => (
                  <tr key={f.key}>
                    <th scope="row">{f.label}</th>
                    <td><Cell value={value(a, f.key, f.computed)} ind={ind(a, f.key, f.computed)} /></td>
                    <td><Cell value={value(b, f.key, f.computed)} ind={ind(b, f.key, f.computed)} /></td>
                  </tr>
                ))}
                {(["freePlan", "freeTrial", "platforms", "integrations", "support"] as const).map((k) => (
                  <tr key={k} className="sourced"><th scope="row">{FACT_LABELS[k]}</th><td><FactCell p={a} k={k} /></td><td><FactCell p={b} k={k} /></td></tr>
                ))}
                <tr><th scope="row">Best for</th><td>{a.review.bestFor.join(", ")}</td><td>{b.review.bestFor.join(", ")}</td></tr>
                <tr><th scope="row">Main limitation</th><td>{a.review.limitations[0] ?? "—"}</td><td>{b.review.limitations[0] ?? "—"}</td></tr>
                <tr><th scope="row">Editorial score</th><td><ScoreBadge product={a} /></td><td><ScoreBadge product={b} /></td></tr>
              </tbody>
            </table>
          </div>
          <p className="muted small" style={{ marginTop: 10 }}>
            Indicators summarise the text beside them: <span className="ind included">Included</span> <span className="ind varies">Varies</span> <span className="ind none">Not available</span> <span className="ind verify">Verify</span> (pricing not yet editor-verified). {a.name}: {lastCheckedText(a)} · {b.name}: {lastCheckedText(b)}.
          </p>
        </section>

        <section className="section-gap reveal" id="pricing-matrix">
          <h2>Pricing matrix</h2>
          <div className="price-matrix">
            {[a, b].map((p) => {
              const m = priceFor(p, "MONTHLY");
              const y = priceFor(p, "ANNUAL");
              const st = pricingState(p);
              return (
                <div className="pm-col" key={p.slug} style={catStyle(p.categorySlug)}>
                  <div className="pm-head"><Monogram name={p.name} slug={p.slug} categorySlug={p.categorySlug} size="sm" /><strong>{p.name}</strong><span className={`status ${st.tone}`}>{st.label}</span></div>
                  <div className="pm-row"><span className="tiny muted">Billed monthly</span><strong>{m ? m.text : "—"}</strong>{m && <span className="tiny muted">{m.plan}{m.unit ? ` · ${m.unit}` : ""}</span>}</div>
                  <div className="pm-row"><span className="tiny muted">Billed annually</span><strong>{y ? y.text : "—"}</strong>{y && <span className="tiny muted">{y.plan}{y.unit ? ` · ${y.unit}` : ""}</span>}</div>
                  <div className="pm-row"><span className="tiny muted">Free plan</span><FactCell p={p} k="freePlan" /></div>
                  {!p.pricing.length && <p className="small">Pricing varies — check the official pricing page.</p>}
                  {p.pricingUrl && <a className="text-link small" href={p.pricingUrl} target="_blank" rel="nofollow noopener noreferrer">Official {p.name} pricing ↗</a>}
                </div>
              );
            })}
          </div>
          <p className="tiny muted" style={{ marginTop: 8 }}>&ldquo;From&rdquo; is the lowest paid price listed for that billing period, as captured from the official page on the check date. Currencies are never converted; plans and limits differ, so compare the full plan tables on each review.</p>
        </section>

        <div className="two section-gap reveal-stagger">
          {[a, b].map((p) => (
            <div className="panel" key={p.slug} style={catStyle(p.categorySlug)}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}><Monogram name={p.name} slug={p.slug} categorySlug={p.categorySlug} /><h2 style={{ margin: 0 }}>{p.name} at a glance</h2></div>
              <div className="proscons">
                <div className="pc pros"><h3><IconCheck size={16} /> Pros</h3><ul>{p.review.pros.slice(0, 3).map((x) => <li key={x}><IconCheck size={14} />{x}</li>)}</ul></div>
                <div className="pc cons"><h3><IconX size={16} /> Cons</h3><ul>{p.review.cons.slice(0, 3).map((x) => <li key={x}><IconX size={14} />{x}</li>)}</ul></div>
              </div>
              <ul className="limit-list section-gap">{p.review.limitations.slice(0, 2).map((x) => <li key={x}><IconAlert size={16} />{x}</li>)}</ul>
              <div className="actions section-gap">
                <AffiliateCta product={p} ctaType="button" placement={`summary-${p.slug}`} {...cta} />
                <Link className="btn secondary" href={routes.product(p.slug)}>Full {p.name} review</Link>
              </div>
            </div>
          ))}
        </div>

        <SponsorSlot pageType="compare" pageSlug={pair.slug} placement="inline" />
        <AffiliateDisclosure />
        <LinkGroups groups={compareLinksFor(c, a, b)} />
      </div>
    </div>
  );
}
