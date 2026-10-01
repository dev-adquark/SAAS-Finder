import Link from "next/link";
import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { webPageJsonLd } from "@/lib/seo/jsonld";
import { routes } from "@/lib/seo/routes";

const PATH = "/mx.html";
const TITLE = "Smart Buying Guide: how to compare products and pricing";
const DESCRIPTION = "A practical, plain-English guide to comparing products and pricing before you buy.";

export const metadata = buildMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

type Section = { id: string; kicker: string; heading: string; body: ReactNode };

const SECTIONS: Section[] = [
  {
    id: "getting-started", kicker: "Getting started", heading: "How to compare before you buy",
    body: (
      <>
        <p>Most buying mistakes come from comparing the wrong things. A lower headline price often hides a shorter warranty, a smaller capacity, or a subscription that starts after the first year. Before comparing options, write down what you actually need the product to do.</p>
        <h3>Start with requirements, not products</h3>
        <ul><li>List the two or three things the product must do well.</li><li>Note the limits you cannot move: budget, size, compatibility.</li><li>Everything else is a preference, not a requirement.</li></ul>
        <p>This single step removes most of the noise, because it turns an open-ended search into a short checklist you can apply to any option.</p>
      </>
    ),
  },
  {
    id: "pricing", kicker: "Pricing", heading: "Reading a price properly",
    body: (
      <>
        <p>The advertised price is rarely the amount you pay. Shipping, taxes, mandatory accessories and renewal rates all change the real figure, and they are usually disclosed somewhere less prominent.</p>
        <h3>Work out the total cost</h3>
        <ul><li>Add delivery, setup and any required extras.</li><li>Check what the price becomes at renewal, not just the introductory rate.</li><li>For anything with consumables, estimate a year of running costs.</li></ul>
        <div className="notice">A useful habit: compare the cost over the period you expect to own the thing, rather than the price on the day you buy it.</div>
      </>
    ),
  },
  {
    id: "specifications", kicker: "Specifications", heading: "Which specs actually matter",
    body: (
      <>
        <p>Specification sheets are written to make products sound impressive, not to help you choose. A handful of numbers usually determine whether something suits you; the rest are there to fill the table.</p>
        <h3>Separate the meaningful from the decorative</h3>
        <ul><li>Identify which spec maps to the job you listed earlier.</li><li>Treat any number without units or test conditions as marketing.</li><li>Where two products differ by a few percent, treat them as equivalent.</li></ul>
        <p>If you cannot explain why a number matters for your use, it probably does not.</p>
      </>
    ),
  },
  {
    id: "reviews", kicker: "Reviews", heading: "Getting value from reviews",
    body: (
      <>
        <p>Reviews are most useful for finding failure modes, not for ranking. A review that only lists features tells you little; one that describes what went wrong after six months tells you a great deal.</p>
        <h3>Read for patterns</h3>
        <ul><li>Look for the same complaint repeated by unrelated people.</li><li>Weight long-term reviews above first-impression ones.</li><li>Ignore both extremes; the useful detail sits in the middle ratings.</li></ul>
        <p>One specific, repeated complaint is worth more than a hundred generic five-star ratings.</p>
      </>
    ),
  },
  {
    id: "timing", kicker: "Timing", heading: "When to buy, and when to wait",
    body: (
      <>
        <p>Prices move in predictable cycles. New models arrive on a schedule, and the previous generation drops in price shortly before and after that date — often while remaining perfectly adequate.</p>
        <h3>A simple approach</h3>
        <ul><li>Check whether a refresh is due within a couple of months.</li><li>Track the price for a week before buying; discounts are often measured against inflated reference prices.</li><li>If the improvement in the new model does not affect your requirement list, buy the old one.</li></ul>
      </>
    ),
  },
  {
    id: "guarantees", kicker: "Guarantees", heading: "Warranty, returns and support",
    body: (
      <>
        <p>The return policy matters more than most specifications, because it is what protects you when the comparison turns out to be wrong. It is also the thing most people skim.</p>
        <h3>Check before, not after</h3>
        <ul><li>How long is the return window, and who pays return shipping?</li><li>Is the warranty handled by the seller or the manufacturer?</li><li>Is there a real support channel, or only a contact form?</li></ul>
        <div className="notice">A shorter warranty from a company that answers the phone is often worth more than a longer one that requires a claim process.</div>
      </>
    ),
  },
  {
    id: "common-traps", kicker: "Common traps", heading: "Mistakes that are easy to avoid",
    body: (
      <>
        <p>A few patterns account for most regretted purchases, and all of them are easy to spot once you know to look.</p>
        <h3>Watch for these</h3>
        <ul><li>Buying capacity you will never use because the step up seemed cheap.</li><li>Choosing on brand familiarity rather than the requirement list.</li><li>Treating a countdown timer or stock warning as real information.</li><li>Comparing a discounted price against a reference price that never applied.</li></ul>
        <p>Urgency is the most reliable warning sign. A genuinely good option is still a good option tomorrow.</p>
      </>
    ),
  },
  {
    id: "wrapping-up", kicker: "Wrapping up", heading: "A short checklist",
    body: (
      <>
        <p>Comparison gets easier when it is reduced to a repeatable process rather than an open search.</p>
        <h3>Before you commit</h3>
        <ul><li>Does it meet every item on your requirement list?</li><li>Do you know the total cost, including renewal and running costs?</li><li>Have you read the failure modes, not just the ratings?</li><li>Do you understand the return window?</li></ul>
        <p>If all four are yes, further research usually changes very little.</p>
      </>
    ),
  },
];

export default function SmartBuyingGuide() {
  return (
    <section className="section">
      <JsonLd data={webPageJsonLd("WebPage", TITLE, PATH, DESCRIPTION)} />
      <div className="container prose">
        <Breadcrumbs items={[{ name: "Smart Buying Guide", path: PATH }]} />
        <span className="eyebrow">Buying Guide</span>
        <h1 style={{ marginTop: 12 }}>Smart Buying Guide</h1>
        <p className="lead">{DESCRIPTION}</p>

        <nav className="panel section-gap" aria-label="Guide sections">
          <h2 style={{ fontSize: "1.1rem", marginBottom: 10 }}>In this guide</h2>
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            {SECTIONS.map((s) => <li key={s.id}><a className="text-link" href={`#${s.id}`}>{s.heading}</a></li>)}
          </ol>
        </nav>

        {SECTIONS.map((s, i) => {
          const next = SECTIONS[i + 1];
          return (
            <article key={s.id} id={s.id} className="panel section-gap" style={{ scrollMarginTop: 90 }}>
              <span className="eyebrow">{s.kicker}</span>
              <h2 style={{ marginTop: 8 }}>{s.heading}</h2>
              {s.body}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", borderTop: "1px solid var(--line)", marginTop: 20, paddingTop: 14 }}>
                <span className="tiny muted">Section {i + 1} of {SECTIONS.length}</span>
                {next ? (
                  <a className="btn primary" href={`#${next.id}`}>Next section <span className="arrow-right" aria-hidden="true">→</span></a>
                ) : (
                  <Link className="btn primary" href={routes.home()}>Back to home <span className="arrow-right" aria-hidden="true">→</span></Link>
                )}
              </div>
            </article>
          );
        })}

        <p className="tiny muted section-gap">Independent research. We may earn a commission from some links. <Link className="text-link" href={routes.disclosure()}>Our disclosure</Link></p>
      </div>
    </section>
  );
}
