import Link from "next/link";
import { alternativesFor, findProduct, loadCatalog, pairsForProduct, productsInCategory } from "@/lib/catalog";
import type { Catalog, Product } from "@/lib/content/types";
import { ProductCard } from "@/components/product-card";
import { JsonLd } from "@/components/json-ld";
import { Ecosystem } from "@/components/ecosystem/ecosystem";
import { CategoryIcon, IconClock, IconCompass, IconRight, IconScale, IconSearch, IconShield, IconSpark } from "@/components/icons";
import { Monogram, catStyle } from "@/components/identity";
import { buildMetadata } from "@/lib/seo/metadata";
import { itemListJsonLd } from "@/lib/seo/jsonld";
import { absolute, SITE_NAME } from "@/lib/site";
import { routes } from "@/lib/seo/routes";
import { formatDate } from "@/lib/freshness-rules";
import { pricingState } from "@/lib/pricing";

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

function AlternativesGraph({ c, product }: { c: Catalog; product: Product }) {
  const alts = alternativesFor(c, product).slice(0, 4);
  const category = c.categories.find((x) => x.slug === product.categorySlug);
  const H = Math.max(alts.length, 1) * 74 + 40;
  const y = (i: number) => 40 + i * 74;
  const mid = H / 2;
  return (
    <svg className="altgraph" viewBox={`0 0 760 ${H}`} role="img" aria-label={`${product.name} and its curated alternatives in ${category?.name}`} style={catStyle(product.categorySlug)}>
      <defs>
        <linearGradient id="ag" x1="0" x2="1"><stop offset="0" stopColor="#7c6cff" /><stop offset="1" stopColor="#22d3ee" /></linearGradient>
      </defs>
      {alts.map((a, i) => (
        <g key={a.product.slug}>
          <path className="edge" d={`M190 ${mid} C 260 ${mid}, 260 ${y(i)}, 330 ${y(i)}`} />
          <path className="edge" d={`M530 ${y(i)} C 600 ${y(i)}, 600 ${mid}, 590 ${mid}`} />
        </g>
      ))}
      <a href={routes.product(product.slug)}>
        <rect x="10" y={mid - 30} width="180" height="60" rx="16" fill="url(#ag)" stroke="transparent" />
        <text x="100" y={mid + 6} textAnchor="middle" fontSize="18" style={{ fill: "#07091a" }}>{product.name}</text>
      </a>
      {alts.map((a, i) => (
        <a key={a.product.slug} href={routes.product(a.product.slug)}>
          <rect x="330" y={y(i) - 24} width="200" height="48" rx="14" fill="#141a31" stroke="rgba(148,163,214,0.3)" />
          <text x="430" y={y(i) + 6} textAnchor="middle" fontSize="15">{a.product.name}</text>
        </a>
      ))}
      <a href={routes.category(product.categorySlug)}>
        <rect x="590" y={mid - 26} width="160" height="52" rx="26" fill="rgba(124,108,255,0.14)" stroke="rgba(160,143,255,0.5)" />
        <text x="670" y={mid + 5} textAnchor="middle" fontSize="14">{category?.name}</text>
      </a>
    </svg>
  );
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
              <Link className="btn primary" href={routes.products()}>Browse all reviews <IconRight size={16} className="arrow" /></Link>
              <Link className="btn secondary" href={routes.bestIndex()}>Find the best tool for you</Link>
            </div>
            <div className="hero-stats" aria-label="Catalog size">
              <div><strong>{c.products.length}</strong><span>published reviews</span></div>
              <div><strong>{c.pairs.length}</strong><span>head-to-heads</span></div>
              <div><strong>{c.useCases.length}</strong><span>best-for guides</span></div>
              <div><strong>{c.categories.length}</strong><span>categories</span></div>
            </div>
          </div>
          <div>
            <Ecosystem total={c.products.length} nodes={c.categories.map((x) => ({ slug: x.slug, name: x.name, href: routes.category(x.slug), count: productsInCategory(c, x.slug).length, products: productsInCategory(c, x.slug).map((p) => p.name) }))} />
            <p className="eco-caption">The SaaSFinder ecosystem — every node is a live category hub.</p>
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
                  <span className="side"><Monogram name={a.name} categorySlug={a.categorySlug} />{a.name}</span>
                  <span className="vs" aria-hidden="true">VS</span>
                  <span className="side"><Monogram name={b.name} categorySlug={b.categorySlug} />{b.name}</span>
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
              <p className="muted small">Curated alternatives to {graphProduct.name}, and the category they belong to. Every node is a page.</p>
              <AlternativesGraph c={c} product={graphProduct} />
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
            <h3 className="section-gap">Pricing verification progress</h3>
            <div className="meter" role="img" aria-label={`${verifiedCount} of ${c.products.length} products have editor-verified pricing`}><span style={{ width: `${(verifiedCount / Math.max(c.products.length, 1)) * 100}%` }} /></div>
            <p className="small muted" style={{ marginTop: 8 }}>{verifiedCount} of {c.products.length} products have editor-verified pricing. The rest show &ldquo;Pricing varies&rdquo; until checked — we never estimate prices.</p>
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
                  <Monogram name={p.name} categorySlug={p.categorySlug} />
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

      {/* How we review */}
      <section className="section zone-light">
        <div className="container">
          <div className="section-head"><div><span className="eyebrow">How we review</span><h2>Research → Compare → Verify</h2><p>Every page follows the same editorial pipeline. Nothing is scored or priced on a guess.</p></div><Link className="btn" style={{ background: "#121633", color: "#fff" }} href={routes.methodology()}>Read the methodology</Link></div>
          <div className="steps reveal-stagger">
            <div className="step"><span className="num">1</span><h3>Research</h3><p>We build a structured profile from the vendor&apos;s public site: features, positioning, audiences and hard limitations.</p></div>
            <div className="step"><span className="num">2</span><h3>Compare</h3><p>Products are compared on category-specific criteria and curated into alternatives and best-for picks, each with a stated reason.</p></div>
            <div className="step"><span className="num">3</span><h3>Verify</h3><p>Prices appear only after an editor verifies them against the official pricing page. Each check is dated and logged.</p></div>
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
