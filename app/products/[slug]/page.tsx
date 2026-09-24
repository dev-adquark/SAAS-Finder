import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAlternatives, getProduct, getProducts } from "@/lib/catalog";
import { VendorCTA } from "@/components/cta";
import { SponsorSlot } from "@/components/sponsor-slot";
import { absolute } from "@/lib/site";

export async function generateStaticParams() {
  return (await getProducts()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) return {};
  return {
    title: p.name + " review, pricing and alternatives",
    description: p.description,
    alternates: { canonical: absolute("/products/" + p.slug) },
    openGraph: {
      title: p.name + " review, pricing and alternatives",
      description: p.description,
      url: absolute("/products/" + p.slug),
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: p.name + " review, pricing and alternatives",
      description: p.description,
    },
  };
}

export default async function Product({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) notFound();

  const alts = await getAlternatives(p);
  const faqJsonLd = p.faqs.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: p.faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }
    : null;

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: p.name,
    description: p.description,
    applicationCategory: p.category,
    url: absolute("/products/" + p.slug),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      {faqJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      )}

      <div className="container breadcrumbs">
        <Link href="/products">Products</Link> / {p.name}
      </div>

      <section className="detail-hero">
        <div className="container">
          <span className="tag">{p.category} · {p.subcategory}</span>
          <h1>{p.name}</h1>
          <p className="section-intro">{p.description}</p>
          <div className="actions">
            <VendorCTA product={p} />
            <Link className="btn secondary" href={"/alternatives/" + p.slug}>Alternatives</Link>
            {alts[0] && (
              <Link className="btn secondary" href={"/compare/" + p.slug + "-vs-" + alts[0].slug}>Compare</Link>
            )}
          </div>
          <p className="small muted">
            Editorial score <strong>{p.rating.toFixed(1)}/5</strong> · Pricing snapshot: {p.pricingUpdated}
          </p>
        </div>
      </section>

      <div className="container detail-layout">
        <div>
          <section className="panel">
            <h2>Quick review</h2>
            <p>{p.tagline}</p>
            <div className="two">
              <div>
                <h3>Best for</h3>
                <ul className="list">{p.bestFor.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
              <div>
                <h3>Key features</h3>
                <ul className="list">{p.features.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            </div>
          </section>

          <section className="panel section">
            <h2>Pros and limitations</h2>
            <div className="two">
              <div><h3>Pros</h3><ul className="list">{p.pros.map((x) => <li key={x}>✓ {x}</li>)}</ul></div>
              <div><h3>Limitations</h3><ul className="list">{p.cons.map((x) => <li key={x}>— {x}</li>)}</ul></div>
            </div>
          </section>

          <section className="panel section">
            <h2>Pricing snapshot</h2>
            <p className="price">{p.pricing}</p>
            <p className="muted">Snapshot: {p.pricingUpdated}. Vendor prices, limits and promotions can change.</p>
            <a className="btn secondary" href={p.pricingUrl} target="_blank" rel="noopener">Verify live pricing ↗</a>
          </section>

          <section className="panel section">
            <h2>Comparison data</h2>
            <div className="table-wrap">
              <table className="compare"><tbody>
                {Object.entries(p.comparison).map(([k, v]) => <tr key={k}><td>{k}</td><td>{String(v)}</td></tr>)}
              </tbody></table>
            </div>
          </section>

          <section className="panel section">
            <h2>Related comparisons</h2>
            {alts.map((a) => (
              <p key={a.slug}>
                <Link href={p.slug < a.slug ? `/compare/${p.slug}-vs-${a.slug}` : `/compare/${a.slug}-vs-${p.slug}`}>
                  <strong>{p.name} vs {a.name}</strong>
                </Link>
              </p>
            ))}
          </section>

          <section className="panel section">
            <h2>FAQs</h2>
            {p.faqs.map((f) => <div className="faq" key={f.q}><h3>{f.q}</h3><p className="muted">{f.a}</p></div>)}
          </section>
        </div>

        <aside>
          <div className="panel"><h2>Vendor</h2><p className="muted">Check the vendor for current plans and terms.</p><VendorCTA product={p} /></div>
          <SponsorSlot />
          <div className="panel">
            <h2>Alternatives</h2>
            {alts.map((a) => <p key={a.slug}><Link href={"/products/" + a.slug}><strong>{a.name}</strong></Link><br /><span className="muted">{a.tagline}</span></p>)}
            {alts.length > 0 && <Link className="btn secondary" href={"/alternatives/" + p.slug}>View all alternatives →</Link>}
          </div>
        </aside>
      </div>
    </>
  );
}