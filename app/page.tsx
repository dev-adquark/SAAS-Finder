import Link from "next/link";
import { alternativesFor, findProduct, loadCatalog, pairsForProduct, productsInCategory } from "@/lib/catalog";
import type { Catalog, Product } from "@/lib/content/types";
import { ProductCard } from "@/components/product-card";
import { JsonLd } from "@/components/json-ld";
import { Ecosystem } from "@/components/ecosystem/ecosystem";
import { AltNetwork } from "@/components/alt-network";
import { CategoryIcon, IconClock, IconCompass, IconRight, IconScale, IconSearch, IconShield, IconSpark } from "@/components/icons";
import { Monogram, catStyle } from "@/components/identity";
import { buildMetadata } from "@/lib/seo/metadata";
import { itemListJsonLd } from "@/lib/seo/jsonld";
import { absolute, SITE_NAME } from "@/lib/site";
import { routes } from "@/lib/seo/routes";
import { formatDate } from "@/lib/freshness-rules";
import { pricingState, type PricingStatusKind } from "@/lib/pricing";
import { CountUp } from "@/components/count-up";
import { Magnetic } from "@/components/magnetic";

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

export default async function Home() {
  const c = await loadCatalog();
  const catName = new Map(c.categories.map((x) => [x.slug, x.name]));
  const mostCompared = [...c.products].sort((a, b) => referenceCount(c, b) - referenceCount(c, a) || a.name.localeCompare(b.name)).slice(0, 10);
  const graphProduct = [...c.products].sort((a, b) => alternativesFor(c, b).length - alternativesFor(c, a).length || referenceCount(c, b) - referenceCount(c, a))[0];
  const recent = [...c.products]
    .sort((a, b) => Math.max(+new Date(b.contentUpdatedAt), +new Date(b.pricingLastChecked ?? 0)) - Math.max(+new Date(a.contentUpdatedAt), +new Date(a.pricingLastChecked ?? 0)) || a.name.localeCompare(b.name))
    .slice(0, 8);
  const verifiedCount = c.products.filter((p) => p.pricing.length > 0).length;
  const sourceCount = c.products.reduce((n, p) => n + p.sources.filter((s) => s.status === "VERIFIED").length, 0);
  const byStatus = c.products.reduce<Record<PricingStatusKind, number>>((m, p) => ((m[pricingState(p).kind] += 1), m), { verified: 0, region: 0, custom: 0, unverified: 0 });
  const sourceKinds = Object.entries(c.products.flatMap((p) => p.sources.filter((s) => s.status === "VERIFIED").map((s) => s.kind)).reduce<Record<string, number>>((m, k) => ((m[k] = (m[k] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxKind = Math.max(1, ...sourceKinds.map(([, n]) => n));
  const timeline = [...c.products].filter((p) => p.pricingLastChecked || p.sourceCheckedAt).sort((a, b) => +new Date(b.pricingLastChecked ?? b.sourceCheckedAt!) - +new Date(a.pricingLastChecked ?? a.sourceCheckedAt!)).slice(0, 10);
  const maxCount = Math.max(...c.categories.map((x) => productsInCategory(c, x.slug).length), 1);
  // One comparison per category first, then the rest, so the grid is varied.
  const firstPerCategory = c.categories.map((x) => c.pairs.find((p) => p.categorySlug === x.slug)).filter((p): p is (typeof c.pairs)[number] => Boolean(p));
  const pairs = [...firstPerCategory, ...c.pairs.filter((p) => !firstPerCategory.includes(p))].slice(0, 8);
  const quick = c.pairs.slice(0, 3);
  const nameOf = (s: string) => findProduct(c, s)?.name ?? s;

  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: absolute("/"), description: "Structured SaaS reviews, alternatives and comparisons." }} />
      <JsonLd data={itemListJsonLd("Most compared SaaS tools", routes.home(), mostCompared.map((p) => ({ name: p.name, path: routes.product(p.slug) })))} />

      {/* Hero */}
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow enter">Independent SaaS research</span>
            <h1 className="enter-2"><span className="grad-text">Discover. Compare.</span><br />Choose the right SaaS.</h1>
            <p className="lead enter-3">Structured reviews, curated alternatives and side-by-side comparisons across {c.categories.length} categories — with dated pricing checks and commercial links that never decide our picks.</p>
            <form className="hero-search enter-3" action={routes.products()} method="get" role="search">
              <IconSearch size={18} className="muted" />
              <label className="sr-only" htmlFor="hero-q">Search reviews</label>
              <input id="hero-q" name="q" type="search" placeholder="Try “CRM for freelancers” or “Wix”" autoComplete="off" />
              <button className="btn primary" type="submit">Search</button>
            </form>
            <div className="hero-quick">
              <span className="tiny">Popular:</span>
              {quick.map((p) => <Link key={p.slug} className="chip" href={routes.compare(p.productA, p.productB)} style={catStyle(p.categorySlug)}>{nameOf(p.productA)} vs {nameOf(p.productB)}</Link>)}
            </div>
            <div className="actions" style={{ marginTop: 22 }}>
              <Magnetic><Link className="btn primary" href={routes.products()}>Browse all reviews <IconRight size={16} className="arrow" /></Link></Magnetic>
              <Link className="btn secondary" href={routes.bestIndex()}>Find the best tool for you</Link>
            </div>
            <div className="hero-stats" aria-label="Catalog size">
              <div><strong><CountUp value={c.products.length} /></strong><span>published reviews</span></div>
              <div><strong><CountUp value={c.pairs.length} /></strong><span>head-to-heads</span></div>
              <div><strong><CountUp value={verifiedCount} /></strong><span>pricing-verified tools</span></div>
              <div><strong><CountUp value={sourceCount} /></strong><span>official sources cited</span></div>
            </div>
          </div>
          <div>
            <Ecosystem total={c.products.length} nodes={c.categories.map((x) => ({ slug: x.slug, name: x.name, href: routes.category(x.slug), count: productsInCategory(c, x.slug).length, products: productsInCategory(c, x.slug).map((p) => ({ name: p.name, href: routes.product(p.slug) })) }))} />
            <p className="eco-caption">The SaaSFinder ecosystem — every node is a live category hub.</p>
          </div>
        </div>
      </section>

      {/* Brand wall */}
      <section className="section tight">
        <div className="container">
          <div className="section-head"><div><span className="eyebrow">SaaS ecosystem</span><h2>Reviewed &amp; researched</h2><p>Every tool we cover, researched from official vendor sources. Reviewed does not mean partnered — see our <Link href={routes.disclosure()}>disclosure</Link>.</p></div></div>
          <div className="brand-wall">
            {c.products.map((p, i) => {
              const ps = pricingState(p);
              return (
                <Link key={p.slug} href={routes.product(p.slug)} className="bw" style={{ ...catStyle(p.categorySlug), ["--i" as string]: i }}>
                  <span className="bw-tip">{p.tagline}</span>
                  <Monogram name={p.name} slug={p.slug} categorySlug={p.categorySlug} />
                  <strong>{p.name}</strong>
                  <span className="bw-meta">{catName.get(p.categorySlug)} · {ps.kind === "unverified" ? "pricing pending" : "pricing verified"}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Most compared rail */}
      <section className="section tight">
        <div className="container">
          <div className="section-head">
            <div><span className="eyebrow">Most compared</span><h2>Tools buyers weigh up most</h2><p>Ranked by how many of our curated comparisons and alternatives lists include them.</p></div>
            <Link className="btn ghost" href={routes.products()}>All {c.products.length} reviews <IconRight size={16} /></Link>
          </div>
          <div className="rail" tabIndex={0} aria-label="Most compared tools, scroll horizontally">
            {mostCompared.map((p) => <ProductCard key={p.slug} product={p} categoryName={catName.get(p.categorySlug)} />)}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="section">
        <div className="container">
          <div className="section-head"><div><span className="eyebrow">Explore categories</span><h2>Start where your problem is</h2></div><Link className="btn ghost" href={routes.categories()}>All categories <IconRight size={16} /></Link></div>
          <div className="bento reveal-stagger">
            {c.categories.map((x) => {
              const items = productsInCategory(c, x.slug);
              return (
                <Link key={x.slug} href={routes.category(x.slug)} className="card catcard" style={catStyle(x.slug)}>
                  <span className="cat-ic"><CategoryIcon slug={x.slug} size={26} /></span>
                  <span className="tag">{items.length} reviews</span>
                  <h3>{x.name}</h3>
                  <p>{x.description}</p>
                  <span className="names">{items.map((p) => p.name).join(" · ")}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Comparisons */}
      <section className="section zone">
        <div className="container">
          <div className="section-head"><div><span className="eyebrow">Popular comparisons</span><h2>Head-to-head, criterion by criterion</h2></div><Link className="btn ghost" href={routes.comparisons()}>All {c.pairs.length} comparisons <IconRight size={16} /></Link></div>
          <div className="grid four reveal-stagger">
            {pairs.map((p) => {
              const a = findProduct(c, p.productA)!;
              const b = findProduct(c, p.productB)!;
              return (
                <Link key={p.slug} href={routes.compare(a.slug, b.slug)} className="card vscard" style={catStyle(p.categorySlug)}>
                  <span className="side"><Monogram name={a.name} slug={a.slug} categorySlug={a.categorySlug} />{a.name}</span>
                  <span className="vs" aria-hidden="true">VS</span>
                  <span className="side"><Monogram name={b.name} slug={b.slug} categorySlug={b.categorySlug} />{b.name}</span>
                  <span className="sr-only"> versus </span>
                  <span className="sum">{p.summary}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Best for */}
      <section className="section">
        <div className="container">
          <div className="section-head"><div><span className="eyebrow">Best for</span><h2>Buying guides for your situation</h2></div><Link className="btn ghost" href={routes.bestIndex()}>All guides <IconRight size={16} /></Link></div>
          <div className="grid four reveal-stagger">
            {c.useCases.map((u) => (
              <Link key={u.slug} href={routes.best(u.slug)} className="card ucard accent-top" style={catStyle(u.categorySlug)}>
                <span className="tag">{catName.get(u.categorySlug)}</span>
                <h3>{u.title}</h3>
                <span className="picks" aria-label={`${u.products.length} picks`}>
                  {u.products.slice(0, 4).map((x) => { const p = findProduct(c, x.slug); return p ? <Monogram key={x.slug} name={p.name} categorySlug={p.categorySlug} size="sm" /> : null; })}
                  <span className="tiny muted" style={{ marginLeft: 10 }}>{u.products.length} picks</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Alternatives graph + coverage */}
      <section className="section zone">
        <div className="container two" style={{ alignItems: "stretch" }}>
          {graphProduct && (
            <div className="panel reveal">
              <span className="eyebrow">Alternatives map</span>
              <h2>From one tool to its best alternatives</h2>
              <p className="muted small">Curated alternatives to {graphProduct.name} and the category they share. Every node is a page; the full map with best-for guides is on the alternatives page.</p>
              <div className="table-wrap" style={{ background: "transparent", border: 0 }}><div style={{ minWidth: 480 }}><AltNetwork c={c} product={graphProduct} compact /></div></div>
              <Link className="btn secondary" href={routes.alternatives(graphProduct.slug)}>Explore {graphProduct.name} alternatives <IconRight size={16} /></Link>
            </div>
          )}
          <div className="panel reveal">
            <span className="eyebrow">Coverage</span>
            <h2>What we cover</h2>
            <div className="bars section-gap">
              {c.categories.map((x) => {
                const n = productsInCategory(c, x.slug).length;
                return (
                  <div className="bar-row" key={x.slug} style={catStyle(x.slug)}>
                    <Link href={routes.category(x.slug)}>{x.name}</Link>
                    <div className="bar-track"><div className="bar-fill" style={{ width: `${(n / maxCount) * 100}%` }} /></div>
                    <strong>{n}</strong>
                  </div>
                );
              })}
            </div>
            <h3 className="section-gap">Pricing verification</h3>
            <div className="segbar" role="img" aria-label={`Pricing status: ${byStatus.verified} verified, ${byStatus.region} region-dependent, ${byStatus.custom} custom, ${byStatus.unverified} not yet verified`}>
              <span style={{ width: `${(byStatus.verified / c.products.length) * 100}%`, background: "var(--c-emerald)" }} />
              <span style={{ width: `${(byStatus.region / c.products.length) * 100}%`, background: "var(--c-cyan)" }} />
              <span style={{ width: `${(byStatus.custom / c.products.length) * 100}%`, background: "var(--c-violet)" }} />
              <span style={{ width: `${(byStatus.unverified / c.products.length) * 100}%`, background: "var(--c-amber)" }} />
            </div>
            <div className="seg-legend">
              <div><i style={{ background: "var(--c-emerald)" }} />Verified<strong>{byStatus.verified}</strong></div>
              <div><i style={{ background: "var(--c-cyan)" }} />Verified · region-dependent<strong>{byStatus.region}</strong></div>
              <div><i style={{ background: "var(--c-violet)" }} />Custom pricing<strong>{byStatus.custom}</strong></div>
              <div><i style={{ background: "var(--c-amber)" }} />Not yet verified<strong>{byStatus.unverified}</strong></div>
            </div>
            <p className="tiny muted" style={{ marginTop: 10 }}>Unverified tools show &ldquo;Pricing varies — check the official pricing page&rdquo;. We never estimate prices.</p>
          </div>
        </div>
      </section>

      {/* Recently updated */}
      <section className="section">
        <div className="container">
          <div className="section-head"><div><span className="eyebrow">Recently updated</span><h2>Freshly reviewed</h2><p>Content update date and pricing-check status for each profile.</p></div></div>
          <div className="grid four reveal-stagger">
            {recent.map((p) => {
              const ps = pricingState(p);
              return (
                <Link key={p.slug} href={routes.product(p.slug)} className="card hoverable" style={{ ...catStyle(p.categorySlug), display: "flex", gap: 14, alignItems: "center" }}>
                  <Monogram name={p.name} slug={p.slug} categorySlug={p.categorySlug} />
                  <span style={{ display: "grid", gap: 4 }}>
                    <strong>{p.name}</strong>
                    <span className="tiny muted"><IconClock size={12} /> Updated {formatDate(p.contentUpdatedAt)}</span>
                    <span className={`status ${ps.tone}`} style={{ justifySelf: "start" }}>{ps.label}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Official sources + freshness */}
      <section className="section">
        <div className="container two" style={{ alignItems: "stretch" }}>
          <div className="panel reveal">
            <span className="eyebrow">Official sources</span>
            <h2><CountUp value={sourceCount} /> official sources cited</h2>
            <p className="muted small">Pricing pages, product pages, documentation, help centers and security pages — linked on every review.</p>
            <div className="bars section-gap">
              {sourceKinds.map(([k, n]) => (
                <div className="bar-row" key={k} style={{ ["--cat" as string]: "var(--c-emerald)" }}>
                  <span className="small">{k.replace("_", " ").toLowerCase().replace(/^\w/, (x) => x.toUpperCase())}</span>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${(n / maxKind) * 100}%` }} /></div>
                  <strong>{n}</strong>
                </div>
              ))}
            </div>
          </div>
          <div className="panel reveal">
            <span className="eyebrow">Freshness</span>
            <h2>Latest verification checks</h2>
            <p className="muted small">When each tool&apos;s pricing or sources were last checked against the vendor.</p>
            <div className="ftimeline" tabIndex={0} aria-label="Verification timeline">
              {timeline.map((p) => (
                <Link key={p.slug} className="ft-item" href={`${routes.product(p.slug)}#sources`} style={catStyle(p.categorySlug)}>
                  <strong>{p.name}</strong>
                  <span className="tiny muted">{formatDate(p.pricingLastChecked ?? p.sourceCheckedAt)}</span>
                  <span className={`status ${pricingState(p).tone}`} style={{ justifySelf: "start" }}>{pricingState(p).kind === "unverified" ? "Sources only" : "Pricing"}</span>
                </Link>
              ))}
              {!timeline.length && <p className="muted small">No verification checks recorded yet.</p>}
            </div>
          </div>
        </div>
      </section>

      {/* How we review */}
      <section className="section zone-light">
        <div className="container">
          <div className="section-head"><div><span className="eyebrow">How we review</span><h2>Research → Compare → Verify → Publish → Refresh</h2><p>Every page follows the same editorial pipeline. Nothing is scored or priced on a guess.</p></div><Link className="btn" style={{ background: "#121633", color: "#fff" }} href={routes.methodology()}>Read the methodology</Link></div>
          <div className="steps five reveal-stagger">
            <div className="step"><span className="num">1</span><h3>Research</h3><p>We build a structured profile from the vendor&apos;s public site: features, positioning, audiences and hard limitations.</p></div>
            <div className="step"><span className="num">2</span><h3>Compare</h3><p>Products are compared on category-specific criteria and curated into alternatives and best-for picks, each with a stated reason.</p></div>
            <div className="step"><span className="num">3</span><h3>Verify</h3><p>Prices and facts are published only when an exact quote from the official vendor page supports them. Each check is dated.</p></div>
            <div className="step"><span className="num">4</span><h3>Publish</h3><p>Pages go live only when complete, with sources, check dates and commercial labels visible.</p></div>
            <div className="step"><span className="num">5</span><h3>Refresh</h3><p>A 90-day freshness queue re-checks pricing and sources; changes are logged in each product&apos;s update history.</p></div>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="section">
        <div className="container trust reveal-stagger">
          <div className="card"><h3><IconShield /> Editorial independence</h3><p className="muted">Affiliate commissions and sponsorships never decide which products we include, how we order them or what we say.</p><Link className="text-link" href={routes.disclosure()}>Our disclosure</Link></div>
          <div className="card"><h3><IconSpark /> Clearly labelled</h3><p className="muted">Affiliate links say so next to the button. Paid placements are always marked &ldquo;Sponsored&rdquo; and sit in their own slots.</p><Link className="text-link" href={routes.methodology()}>How commercial links work</Link></div>
          <div className="card"><h3><IconScale /> Honest data</h3><p className="muted">No invented prices, scores or similarity numbers. Where something is unverified or unscored, the page says so.</p><Link className="text-link" href={routes.methodology()}>Verification policy</Link></div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="section tight">
        <div className="container">
          <div className="cta-band reveal">
            <div>
              <span className="eyebrow">Start discovering</span>
              <h2>Know what you need? Find it in seconds.</h2>
              <p className="muted">Search every review, comparison, alternatives list and buying guide. Press <kbd>⌘K</kbd> anywhere.</p>
            </div>
            <div className="actions" style={{ justifyContent: "flex-end" }}>
              <Link className="btn primary" href={routes.products()}><IconCompass size={18} /> Browse reviews</Link>
              <Link className="btn secondary" href={routes.comparisons()}>See comparisons</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
