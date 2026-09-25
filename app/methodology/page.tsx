import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { webPageJsonLd } from "@/lib/seo/jsonld";
import { routes } from "@/lib/seo/routes";
import { DEFAULT_REFRESH_AFTER_DAYS } from "@/lib/freshness-rules";

export const metadata = buildMetadata({
  title: "Methodology: how we select, review and update software",
  description: "How SaaSFinder selects products, writes reviews, verifies pricing, keeps content fresh and separates affiliate and sponsor relationships from editorial decisions.",
  path: routes.methodology(),
});

export default function Methodology() {
  const path = routes.methodology();
  return (
    <section className="section">
      <JsonLd data={webPageJsonLd("WebPage", "SaaSFinder methodology", path, "How SaaSFinder selects, reviews and updates software content.")} />
      <div className="container prose">
        <Breadcrumbs items={[{ name: "Methodology", path }]} />
        <span className="eyebrow">Editorial policy</span>
        <h1 style={{ marginTop: 12 }}>Methodology</h1>
        <p className="lead">How every review, comparison and buying guide on SaaSFinder is researched, verified and kept current.</p>
        <div className="zone-light section-gap" style={{ borderRadius: 24, padding: 24 }}>
          <div className="steps">
            <div className="step"><span className="num">1</span><h3>Research</h3><p>Structured profile from public vendor information: features, audiences, limitations.</p></div>
            <div className="step"><span className="num">2</span><h3>Compare</h3><p>Category-specific criteria, curated alternatives and best-for picks with stated reasons.</p></div>
            <div className="step"><span className="num">3</span><h3>Verify</h3><p>Editor-verified, dated pricing snapshots; a {DEFAULT_REFRESH_AFTER_DAYS}-day refresh cycle and a public change log.</p></div>
          </div>
        </div>
        <div className="panel section-gap">
          <h2>Selection criteria</h2>
          <p>We cover products that are widely used by our audience — small businesses, creators, marketers and IT buyers — and that a buyer can evaluate from public information: an official website, a public pricing page and documented features. Alternatives, comparisons and best-for picks are chosen for fit with a specific audience or job, not for commercial value.</p>
          <h2>Editorial process</h2>
          <p>Every review is a structured record: factual fields (vendor, official URLs, dated pricing checks) are stored separately from editorial judgement (summary, pros, cons, limitations, best-for audiences and scores). A product cannot be published until the required fields are complete: summary, features, pros, cons, limitations, best-for audiences, FAQs, comparison values and at least one curated alternative. Each review shows its review status; where a hands-on review has not been completed we say so.</p>
          <h2>Scores</h2>
          <p>Editorial scores are an overall judgement on a 0–5 scale. They are not user ratings, polls or laboratory measurements. Products that have not been scored show &ldquo;Not yet scored&rdquo; rather than an estimated number. Review structured data is only published for reviews an editor has completed.</p>
          <h2>Sources and verification</h2>
          <p>Factual claims — pricing, free plans and trials, platforms, integrations, security and support details — come from the vendor&apos;s own official pages: pricing pages, product pages, documentation, help centers, security pages and newsrooms. We fetch the official page, keep a copy, and publish a fact or price as <strong>verified</strong> only when an exact quote from that page supports it on the check date. Research is AI-assisted, but nothing is published from memory or from third-party sites: an automated check rejects any claim whose quote does not appear in the saved official page. Every product page lists its sources with direct links and check dates.</p>
          <p>Where something could not be verified — for example, a pricing page that only renders prices in the browser — the page says &ldquo;Not verified&rdquo; or &ldquo;Pricing varies — check the official pricing page.&rdquo; instead of guessing.</p>
          <h2>Pricing verification</h2>
          <p>Each verified price records the plan, amount, currency, billing period (monthly or annual), whether it is per seat, whether it is promotional, the source URL and the capture date. Prices are shown exactly as the vendor served them to our research location and are never converted between currencies. Vendors often price by region, so we label regional pricing and link to the official page. Plans that require contacting sales are shown as &ldquo;Custom pricing — contact vendor.&rdquo; Automated checks may flag a possible change, but they never replace verified pricing without review.</p>
          <h2>Update policy</h2>
          <p>Each product has a freshness target — {DEFAULT_REFRESH_AFTER_DAYS} days by default, shorter for fast-changing products. When a product is due, it enters an editorial refresh queue. The editor either confirms nothing changed (updating the &ldquo;Last checked&rdquo; date) or records a new pricing snapshot and a change-log entry. Pages show both the pricing &ldquo;Last checked&rdquo; date and the content update date.</p>
          <h2>Affiliate relationships</h2>
          <p>Some outbound links may be affiliate links, which can earn SaaSFinder a commission. Affiliate links are labelled, marked <code>rel=&quot;sponsored&quot;</code>, and only used once a real partner relationship is verified. Whether a product has an affiliate programme has no bearing on whether it is included, how it is scored or where it is ranked. See our <Link href={routes.disclosure()}>disclosure</Link>.</p>
          <h2>Sponsor relationships</h2>
          <p>Sponsored placements are paid, always labelled &ldquo;Sponsored&rdquo;, shown in dedicated slots, and technically separate from editorial content: the code that selects alternatives, comparisons, best-for picks and featured products never reads sponsor data. A sponsor cannot buy a position in a list, a score or a recommendation.</p>
          <h2>Corrections</h2>
          <p>If something is wrong or out of date, please <Link href={routes.contact()}>contact us</Link>. Confirmed corrections are recorded in the product&apos;s update history.</p>
        </div>
      </div>
    </section>
  );
}
