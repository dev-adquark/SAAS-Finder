import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { findCategory, findPair, findProduct, loadCatalog } from "@/lib/catalog";
import { comparisonSchemaFor } from "@/lib/content/comparison-schema";
import { compareLinksFor } from "@/lib/linking";
import { buildMetadata } from "@/lib/seo/metadata";
import { webPageJsonLd } from "@/lib/seo/jsonld";
import { parseCompareSlug, routes } from "@/lib/seo/routes";
import { AffiliateCta } from "@/components/cta";
import { AffiliateDisclosure } from "@/components/disclosure";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { LinkGroups } from "@/components/link-groups";
import { lastCheckedText, pricingSummary } from "@/components/pricing-snapshot";
import { ScoreBadge } from "@/components/score";
import { SponsorSlot } from "@/components/sponsor-slot";

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

export default async function ComparePage({ params }: Params) {
  const r = await resolve((await params).slugs);
  if (!r) notFound();
  const { c, parsed, pair, a, b } = r;
  // Reverse order (b-vs-a) permanently redirects to the single canonical URL.
  if (!parsed.isCanonical) permanentRedirect(routes.compare(a.slug, b.slug));
  const path = routes.compare(a.slug, b.slug);
  const category = findCategory(c, pair.categorySlug);
  const schema = comparisonSchemaFor(pair.categorySlug);
  const cta = { pageType: "compare" as const, pageSlug: pair.slug };

  return (
    <>
      <JsonLd data={{ ...webPageJsonLd("Article", `${a.name} vs ${b.name}`, path, pair.summary, pair.updatedAt), about: [a, b].map((p) => ({ "@type": "SoftwareApplication", name: p.name, url: p.officialUrl })) }} />
      <section className="section">
        <div className="container">
          <Breadcrumbs items={[{ name: "Comparisons", path: routes.comparisons() }, { name: `${a.name} vs ${b.name}`, path }]} />
          <span className="eyebrow">{category?.name} comparison</span>
          <h1>{a.name} vs {b.name}</h1>
          <p className="section-intro">{pair.summary}</p>

          <div className="two section-gap">
            {[{ p: a, why: pair.chooseA }, { p: b, why: pair.chooseB }].map(({ p, why }) => (
              <div className="panel" key={p.slug}>
                <h2>Choose {p.name} if…</h2>
                <p>{why}</p>
                <p className="small muted"><ScoreBadge product={p} /></p>
                <AffiliateCta product={p} ctaType="comparison" placement={`choose-${p.slug}`} {...cta} />
              </div>
            ))}
          </div>

          <section className="section-gap" id="comparison-table">
            <h2>Side-by-side comparison</h2>
            <div className="table-wrap">
              <table className="compare">
                <thead><tr><th scope="col">Criterion</th><th scope="col">{a.name}</th><th scope="col">{b.name}</th></tr></thead>
                <tbody>
                  {schema.map((f) => (
                    <tr key={f.key}>
                      <th scope="row">{f.label}</th>
                      <td>{f.computed === "pricing" ? pricingSummary(a) : a.comparison[f.key] ?? "—"}</td>
                      <td>{f.computed === "pricing" ? pricingSummary(b) : b.comparison[f.key] ?? "—"}</td>
                    </tr>
                  ))}
                  <tr><th scope="row">Best for</th><td>{a.review.bestFor.join(", ")}</td><td>{b.review.bestFor.join(", ")}</td></tr>
                  <tr><th scope="row">Main limitation</th><td>{a.review.limitations[0] ?? "—"}</td><td>{b.review.limitations[0] ?? "—"}</td></tr>
                </tbody>
              </table>
            </div>
            <p className="muted small">{a.name}: {lastCheckedText(a)} · {b.name}: {lastCheckedText(b)}</p>
          </section>

          <section className="panel section-gap" id="key-differences">
            <h2>Key differences</h2>
            <ul className="list">{pair.highlights.map((h) => <li key={h}>{h}</li>)}</ul>
          </section>

          <div className="two section-gap">
            {[a, b].map((p) => (
              <div className="panel" key={p.slug}>
                <h2>{p.name} at a glance</h2>
                <h3>Pros</h3><ul className="list">{p.review.pros.slice(0, 3).map((x) => <li key={x}>✓ {x}</li>)}</ul>
                <h3>Cons</h3><ul className="list">{p.review.cons.slice(0, 3).map((x) => <li key={x}>— {x}</li>)}</ul>
                <div className="actions">
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
      </section>
    </>
  );
}
