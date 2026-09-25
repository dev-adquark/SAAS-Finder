import Link from "next/link";
import type { CSSProperties } from "react";
import { alternativesFor, findProduct, loadCatalog, pairsForProduct, productsInCategory } from "@/lib/catalog";
import type { Catalog, Product } from "@/lib/content/types";
import { JsonLd } from "@/components/json-ld";
import { Atlas } from "@/components/atlas/atlas";
import { CategoryArt } from "@/components/category-art";
import { RadialNetwork } from "@/components/radial-network";
import { IconShield, IconScale, IconSpark } from "@/components/icons";
import { Monogram, catStyle, monogram } from "@/components/identity";
import { CountUp } from "@/components/count-up";
import { Magnetic } from "@/components/magnetic";
import { buildMetadata } from "@/lib/seo/metadata";
import { itemListJsonLd } from "@/lib/seo/jsonld";
import { absolute, SITE_NAME } from "@/lib/site";
import { routes } from "@/lib/seo/routes";
import { formatDate } from "@/lib/freshness-rules";
import { pricingState, type PricingStatusKind } from "@/lib/pricing";

export const revalidate = 3600;

export const metadata = buildMetadata({
  title: "Discover, compare and choose SaaS",
  description: "Structured SaaS reviews, curated alternatives, side-by-side comparisons and best-for buying guides — with dated pricing checks and transparent commercial labels.",
  path: routes.home(),
});

/** How often a product is referenced by curated comparisons and alternatives sets (real data). */
function referenceCount(c: Catalog, p: Product) {
  return pairsForProduct(c, p.slug).length + c.products.filter((x) => x.alternatives.some((a) => a.slug === p.slug)).length;
}

const EXAMPLES: [string, string][] = [
  ["CRM for a small sales team", "/best/crm-for-small-sales-teams"],
  ["Best website builder for creators", "/best/website-builders-for-creators"],
  ["Alternatives to Asana", "/alternatives/asana"],
  ["SEO tools for agencies", "/best/seo-tools-for-agencies"],
];

function Marker({ no, label }: { no: string; label: string }) {
  return <p className="marker"><b>{no}</b>{label}</p>;
}

export default async function Home() {
  const c = await loadCatalog();
  const catName = new Map(c.categories.map((x) => [x.slug, x.name]));
  const ranked = [...c.products].sort((a, b) => referenceCount(c, b) - referenceCount(c, a) || a.name.localeCompare(b.name));
  const mostCompared = ranked.slice(0, 10);
  const graphProduct = [...c.products].sort((a, b) => alternativesFor(c, b).length - alternativesFor(c, a).length || referenceCount(c, b) - referenceCount(c, a))[0];
  const verifiedCount = c.products.filter((p) => p.pricing.length > 0).length;
  const sourceCount = c.products.reduce((n, p) => n + p.sources.filter((s) => s.status === "VERIFIED").length, 0);
  const byStatus = c.products.reduce<Record<PricingStatusKind, number>>((m, p) => ((m[pricingState(p).kind] += 1), m), { verified: 0, region: 0, custom: 0, unverified: 0 });
  const timeline = [...c.products].filter((p) => p.pricingLastChecked || p.sourceCheckedAt).sort((a, b) => +new Date(b.pricingLastChecked ?? b.sourceCheckedAt!) - +new Date(a.pricingLastChecked ?? a.sourceCheckedAt!)).slice(0, 8);
  const firstPerCategory = c.categories.map((x) => c.pairs.find((p) => p.categorySlug === x.slug)).filter((p): p is (typeof c.pairs)[number] => Boolean(p));
  const pairs = [...firstPerCategory, ...c.pairs.filter((p) => !firstPerCategory.includes(p))].slice(0, 8);
  const statusRows: [string, number, string][] = [
    ["Verified", byStatus.verified, "var(--c-emerald)"],
    ["Verified · region-dependent", byStatus.region, "var(--c-sky)"],
    ["Custom pricing", byStatus.custom, "var(--c-violet)"],
    ["Not yet verified", byStatus.unverified, "var(--c-amber)"],
  ];

  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: absolute("/"), description: "Structured SaaS reviews, alternatives and comparisons." }} />
      <JsonLd data={itemListJsonLd("Most compared SaaS tools", routes.home(), mostCompared.map((p) => ({ name: p.name, path: routes.product(p.slug) })))} />

      {/* Hero — editorial split */}
      <section className="hero">
        <div className="hero-blobs" aria-hidden="true"><span /><span /><span /><span /><span /></div>
        <div className="container hero-grid">
          <div>
            <span className="eyebrow enter">Independent SaaS research</span>
            <h1>
              <span className="line"><span>Find software</span></span>
              <span className="line"><span>that <em>actually</em> fits.</span></span>
            </h1>
            <p className="lead enter-2">An atlas of {c.products.length} tools across {c.categories.length} categories — structured reviews, curated alternatives and head-to-head comparisons, traced back to official sources.</p>
            <form className="hero-search enter-3" action={routes.products()} method="get" role="search">
              <label className="q" htmlFor="hero-q">What are you trying to accomplish?</label>
              <input id="hero-q" name="q" type="search" placeholder="e.g. a CRM for a small sales team" autoComplete="off" />
              <button className="btn primary" type="submit">Search <span className="arrow-right" aria-hidden="true">→</span></button>
            </form>
            <div className="examples enter-3">
              <span className="lbl">Try</span>
              {EXAMPLES.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
            </div>
            <div className="actions enter-3" style={{ marginTop: 28 }}>
              <Magnetic><Link className="btn primary" href={routes.products()}>Explore SaaS <span className="arrow-right" aria-hidden="true">→</span></Link></Magnetic>
              <Link className="btn" href={routes.comparisons()}>Compare tools <span className="arrow-right" aria-hidden="true">→</span></Link>
            </div>
          </div>
          <Atlas c={c} />
        </div>
      </section>

      {/* Trust strip */}
      <section className="trust-strip" aria-label="Coverage">
        <div className="container">
          <ul>
            <li><strong><CountUp value={c.products.length} /></strong><span>Products researched</span></li>
            <li><strong><CountUp value={c.categories.length} /></strong><span>Categories</span></li>
            <li><strong><CountUp value={c.pairs.length} /></strong><span>Comparisons</span></li>
            <li><strong><CountUp value={c.useCases.length} /></strong><span>Buying guides</span></li>
            <li><strong><CountUp value={sourceCount} /></strong><span>Official sources</span></li>
          </ul>
        </div>
      </section>

      {/* Colour marquee — decorative index of the atlas (duplicated once for a seamless loop) */}
      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[0, 1].flatMap((k) => ranked.map((p) => (
            <span key={`${k}-${p.slug}`} style={catStyle(p.categorySlug)}>{p.name}<small>{catName.get(p.categorySlug)}</small></span>
          )))}
        </div>
      </div>

      {/* Product discovery — asymmetric */}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <div><Marker no="01" label="Discover" /><h2>The tools buyers weigh up most</h2><p>Ordered by how many of our curated comparisons and alternatives lists include each tool.</p></div>
            <Link className="btn ghost" href={routes.products()}>All {c.products.length} reviews <span className="arrow-right">→</span></Link>
          </div>
          <div className="discovery reveal-stagger">
            {ranked.map((p, i) => {
              const ps = pricingState(p);
              // Sizes chosen so every row of the 12-column grid fills exactly (xl, 2×md, 3×wide, rest small).
              const size = i === 0 ? "xl" : i <= 2 ? "md" : [3, 8, 13].includes(i) ? "wide" : "";
              const sources = p.sources.filter((s) => s.status === "VERIFIED").length;
              return (
                <article key={p.slug} className={`dcard ${size}`} style={catStyle(p.categorySlug)}>
                  <span className="initials" aria-hidden="true">{monogram(p.name)}</span>
                  <span className="meta"><span>{catName.get(p.categorySlug)}</span><span aria-hidden="true">·</span><span>{p.subcategory}</span></span>
                  <h3><Link className="stretch" href={routes.product(p.slug)}>{p.name}</Link></h3>
                  <p className={i > 0 && i <= 2 ? "clamp-6" : undefined}>{i <= 2 ? p.review.editorialSummary : p.tagline}</p>
                  <span className="chip-row" style={{ position: "relative" }}>
                    <span className={`status ${ps.tone}`}>{ps.label}</span>
                    {sources > 0 && <span className="status neutral">{sources} sources</span>}
                  </span>
                  <span className="extra">Best for {p.review.bestFor.slice(0, 2).join(" · ")}</span>
                  <span className="go"><span>Explore review</span><span className="arrow-right" aria-hidden="true">→</span></span>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Categories — editorial blocks */}
      <section className="section zone">
        <div className="container">
          <div className="section-head"><div><Marker no="02" label="Explore" /><h2>Five territories of software</h2></div><Link className="btn ghost" href={routes.categories()}>All categories <span className="arrow-right">→</span></Link></div>
          <div className="cat-blocks">
            {c.categories.map((x, i) => {
              const items = productsInCategory(c, x.slug);
              return (
                <article key={x.slug} className="cat-block reveal" style={catStyle(x.slug)}>
                  <span className="cat-no" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="cat-title"><Link href={routes.category(x.slug)}>{x.name}</Link></h3>
                  <div className="cat-desc">
                    <p className="tagline">{x.description}</p>
                    <p className="names">{items.map((p) => p.name).join(" · ")}</p>
                    <span className="explore">Explore {items.length} tools <span className="arrow-right" aria-hidden="true">→</span></span>
                  </div>
                  <div className="cat-art"><CategoryArt slug={x.slug} /></div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Comparisons — A vs B */}
      <section className="section">
        <div className="container">
          <div className="section-head"><div><Marker no="03" label="Compare" /><h2>Head-to-head, criterion by criterion</h2></div><Link className="btn ghost" href={routes.comparisons()}>All {c.pairs.length} comparisons <span className="arrow-right">→</span></Link></div>
          <div className="vs-list">
            {pairs.map((pair) => {
              const a = findProduct(c, pair.productA)!;
              const b = findProduct(c, pair.productB)!;
              return (
                <article key={pair.slug} className="vs-row reveal" style={catStyle(pair.categorySlug)}>
                  <Link className="stretch" href={routes.compare(a.slug, b.slug)} aria-label={`${a.name} versus ${b.name}`} />
                  <span className="vs-side vs-a"><Monogram name={a.name} slug={a.slug} categorySlug={a.categorySlug} /><span><strong>{a.name}</strong><small>{pricingState(a).kind === "unverified" ? "Pricing pending" : "Pricing verified"}</small></span></span>
                  <span className="vs-mark" aria-hidden="true"><span>vs</span></span>
                  <span className="vs-side vs-b"><Monogram name={b.name} slug={b.slug} categorySlug={b.categorySlug} /><span><strong>{b.name}</strong><small>{pricingState(b).kind === "unverified" ? "Pricing pending" : "Pricing verified"}</small></span></span>
                  <p className="vs-sum">{pair.highlights[0] ?? pair.summary}</p>
                  <span className="vs-go">Compare <span className="arrow-right" aria-hidden="true">→</span></span>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Alternatives network */}
      {graphProduct && (
        <section className="section zone">
          <div className="container split-2-1" style={{ alignItems: "center" }}>
            <div className="reveal"><RadialNetwork c={c} product={graphProduct} /></div>
            <div className="reveal">
              <Marker no="04" label="Alternatives" />
              <h2 style={{ marginTop: 10 }}>Every tool sits in a <em className="serif">network</em> of options.</h2>
              <p className="lead">Curated alternatives to {graphProduct.name}, the category they share and the guides it appears in. Every node is a page.</p>
              <div className="actions">
                <Link className="btn primary" href={routes.alternatives(graphProduct.slug)}>{graphProduct.name} alternatives <span className="arrow-right">→</span></Link>
                <Link className="btn" href={routes.alternativesIndex()}>All alternatives <span className="arrow-right">→</span></Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Best for */}
      <section className="section">
        <div className="container">
          <div className="section-head"><div><Marker no="05" label="Best for" /><h2>Buying guides, written for a situation</h2></div><Link className="btn ghost" href={routes.bestIndex()}>All guides <span className="arrow-right">→</span></Link></div>
          <div className="guides reveal-stagger">
            {c.useCases.map((u, i) => (
              <article key={u.slug} className="guide" style={catStyle(u.categorySlug)}>
                <span className="bar" aria-hidden="true" />
                <span className="gno">{String(i + 1).padStart(2, "0")} — {catName.get(u.categorySlug)}</span>
                <span className="for">For {u.audience}</span>
                <h3><Link href={routes.best(u.slug)}>{u.title}</Link></h3>
                <ol>{u.products.map((x) => { const p = findProduct(c, x.slug); return p ? <li key={x.slug}><Monogram name={p.name} slug={p.slug} categorySlug={p.categorySlug} size="sm" />{p.name}</li> : null; })}</ol>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Verification — research you can trace */}
      <section className="section zone-ink">
        <div className="container trace">
          <div>
            <Marker no="06" label="Verification" />
            <h2 style={{ marginTop: 14 }}>Research you can <em>trace.</em></h2>
            <p>Every price and product fact is published only when an exact quote from the vendor&apos;s official page supports it — with the source linked and the check date shown.</p>
            <div className="trace-stats">
              <div><strong><CountUp value={sourceCount} /></strong><span>Official sources</span></div>
              <div><strong><CountUp value={verifiedCount} /></strong><span>Pricing verified</span></div>
              <div><strong><CountUp value={c.products.length} /></strong><span>Products researched</span></div>
            </div>
            <div className="coverage" aria-label="Pricing verification by status">
              {statusRows.map(([label, n, color]) => (
                <div className="cov-row" key={label} style={{ ["--cat" as string]: color } as CSSProperties}>
                  <span>{label}</span>
                  <div className="cov-track"><div className="cov-fill" style={{ width: `${(n / Math.max(c.products.length, 1)) * 100}%` }} /></div>
                  <strong>{n}/{c.products.length}</strong>
                </div>
              ))}
            </div>
            <p className="tiny" style={{ marginTop: 14 }}>Unverified tools show &ldquo;Pricing varies — check the official pricing page&rdquo;. We never estimate prices.</p>
          </div>
          <div>
            <ol className="pipeline">
              <li><div><strong>Research</strong><p>A structured profile from the vendor&apos;s public pages: features, audiences, limitations.</p></div></li>
              <li><div><strong>Compare</strong><p>Category-specific criteria, curated alternatives and best-for picks, each with a stated reason.</p></div></li>
              <li><div><strong>Verify</strong><p>Prices and facts are accepted only with a verbatim quote from the official page.</p></div></li>
              <li><div><strong>Publish</strong><p>Pages go live only when complete — sources, check dates and commercial labels visible.</p></div></li>
              <li><div><strong>Refresh</strong><p>A 90-day freshness queue re-checks pricing and sources; changes are logged.</p></div></li>
            </ol>
            {timeline.length > 0 && (
              <div className="ftimeline" tabIndex={0} aria-label="Latest verification checks" style={{ marginTop: 20 }}>
                {timeline.map((p) => (
                  <Link key={p.slug} className="ft-item" href={`${routes.product(p.slug)}#sources`} style={catStyle(p.categorySlug)}>
                    <strong style={{ color: "var(--paper)" }}>{p.name}</strong>
                    <span className="tiny">{formatDate(p.pricingLastChecked ?? p.sourceCheckedAt)}</span>
                  </Link>
                ))}
              </div>
            )}
            <Link className="btn" style={{ marginTop: 22 }} href={routes.methodology()}>Read the methodology <span className="arrow-right">→</span></Link>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="section">
        <div className="container">
          <div className="trust reveal-stagger">
            <div className="card"><h3><IconShield /> Editorial independence</h3><p className="muted">Affiliate commissions and sponsorships never decide which products we include, how we order them or what we say.</p><Link className="text-link" href={routes.disclosure()}>Our disclosure</Link></div>
            <div className="card"><h3><IconSpark /> Clearly labelled</h3><p className="muted">Affiliate links say so beside the button. Paid placements are always marked &ldquo;Sponsored&rdquo; and sit in their own slots.</p><Link className="text-link" href={routes.methodology()}>How commercial links work</Link></div>
            <div className="card"><h3><IconScale /> Honest data</h3><p className="muted">No invented prices, scores or similarity numbers. Where something is unverified or unscored, the page says so.</p><Link className="text-link" href={routes.methodology()}>Verification policy</Link></div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="section tight">
        <div className="container">
          <div className="cta-band reveal">
            <div>
              <span className="eyebrow">Start exploring</span>
              <h2 style={{ marginTop: 12 }}>Know what you need? Find it in seconds.</h2>
              <p>Search every review, comparison, alternatives list and buying guide. Press <kbd>⌘K</kbd> anywhere.</p>
            </div>
            <div className="actions" style={{ justifyContent: "flex-end" }}>
              <Link className="btn primary" href={routes.products()}>Explore SaaS <span className="arrow-right">→</span></Link>
              <Link className="btn" href={routes.comparisons()}>Compare tools <span className="arrow-right">→</span></Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
