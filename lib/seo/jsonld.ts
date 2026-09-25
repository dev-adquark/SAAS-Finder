import type { Faq, Product } from "@/lib/content/types";
import { absolute, SITE_NAME } from "@/lib/site";
import { routes } from "@/lib/seo/routes";

// Structured-data builders. They only describe content that is visible on the page and never
// synthesize ratings, reviews or offers.

type Json = Record<string, unknown>;
const CONTEXT = "https://schema.org";

export function breadcrumbJsonLd(items: { name: string; path: string }[]): Json {
  return {
    "@context": CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: absolute(item.path) })),
  };
}

export function itemListJsonLd(name: string, path: string, items: { name: string; path: string }[]): Json {
  return {
    "@context": CONTEXT,
    "@type": "ItemList",
    name,
    url: absolute(path),
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, url: absolute(item.path) })),
  };
}

/** Returns null unless there is at least one complete, visible FAQ. */
export function faqJsonLd(faqs: Faq[]): Json | null {
  const visible = faqs.filter((f) => f.question.trim() && f.answer.trim());
  if (!visible.length) return null;
  return {
    "@context": CONTEXT,
    "@type": "FAQPage",
    mainEntity: visible.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  };
}

/** Only offers with a verified numeric price and ISO currency are complete enough to publish. */
function completeOffers(p: Product) {
  return p.pricing
    .filter((pt) => pt.price !== null && pt.currency && /^[A-Z]{3}$/.test(pt.currency))
    .map((pt) => ({ "@type": "Offer", name: pt.plan ?? undefined, price: pt.price!.toFixed(2), priceCurrency: pt.currency, url: pt.sourceUrl ?? p.pricingUrl ?? undefined }));
}

/** A published editorial rating counts only when a human review has been completed. */
export function hasPublishableRating(p: Product): boolean {
  return p.review.reviewStatus === "REVIEWED" && typeof p.review.rating === "number" && Boolean(p.review.lastReviewedAt);
}

export function productJsonLd(p: Product, categoryName: string): Json {
  const offers = completeOffers(p);
  const software: Json = {
    "@context": CONTEXT,
    "@type": "SoftwareApplication",
    name: p.name,
    description: p.description,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: p.subcategory ?? categoryName,
    operatingSystem: "Web",
    url: p.officialUrl,
    ...(p.vendor ? { publisher: { "@type": "Organization", name: p.vendor } } : {}),
    ...(offers.length ? { offers } : {}),
  };
  if (hasPublishableRating(p)) {
    software.review = {
      "@type": "Review",
      author: { "@type": "Organization", name: SITE_NAME },
      datePublished: p.review.lastReviewedAt,
      reviewBody: p.review.editorialSummary,
      url: absolute(routes.product(p.slug)),
      reviewRating: { "@type": "Rating", ratingValue: p.review.rating, bestRating: 5, worstRating: 0 },
    };
  }
  return software;
}

export function webPageJsonLd(type: "WebPage" | "CollectionPage" | "Article", name: string, path: string, description: string, dateModified?: string): Json {
  return {
    "@context": CONTEXT,
    "@type": type,
    ...(type === "Article" ? { headline: name } : { name }),
    description,
    url: absolute(path),
    ...(dateModified ? { dateModified } : {}),
    publisher: { "@type": "Organization", name: SITE_NAME },
  };
}

/** Serializes JSON-LD safely for inline <script> tags. */
export function serializeJsonLd(data: Json): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
