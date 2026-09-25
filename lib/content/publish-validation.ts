import { storedComparisonKeys } from "@/lib/content/comparison-schema";
import { isHttpUrl } from "@/lib/validation";
import { productSlugProblem } from "@/lib/seo/routes";

// Completeness rules that gate PUBLISHED status. Pricing is intentionally NOT required: without a
// verified snapshot the page shows the "Pricing varies" fallback instead of an invented price.

export type PublishCandidate = {
  slug: string;
  name: string;
  categorySlug: string;
  tagline: string;
  description: string;
  officialUrl: string;
  pricingUrl: string | null;
  features: string[];
  comparison: Record<string, string>;
  alternativesIntro: string | null;
  review: { editorialSummary: string; pros: string[]; cons: string[]; bestFor: string[]; limitations: string[] } | null;
  faqCount: number;
  alternativeCount: number;
};

export const PUBLISH_MINIMUMS = { features: 3, pros: 2, cons: 2, bestFor: 1, limitations: 1, faqs: 1, alternatives: 1 } as const;

const filled = (list: string[] | undefined) => (list ?? []).filter((x) => x.trim().length > 0).length;

export function publishProblems(p: PublishCandidate): string[] {
  const problems: string[] = [];
  const slugProblem = productSlugProblem(p.slug);
  if (slugProblem) problems.push(`slug is ${slugProblem}`);
  if (!p.name.trim()) problems.push("name is required");
  if (!p.categorySlug) problems.push("category is required");
  if (!p.tagline.trim()) problems.push("tagline is required");
  if (!p.description.trim()) problems.push("description is required");
  if (!isHttpUrl(p.officialUrl)) problems.push("official URL must be a valid http(s) URL");
  if (!p.pricingUrl || !isHttpUrl(p.pricingUrl)) problems.push("official pricing URL is required");
  if (filled(p.features) < PUBLISH_MINIMUMS.features) problems.push(`at least ${PUBLISH_MINIMUMS.features} features`);
  if (!p.alternativesIntro?.trim()) problems.push("alternatives introduction is required");
  const missingComparison = storedComparisonKeys(p.categorySlug).filter((k) => !p.comparison[k]?.trim());
  if (missingComparison.length) problems.push(`comparison values missing: ${missingComparison.join(", ")}`);
  if (!p.review) {
    problems.push("review metadata is required");
  } else {
    if (!p.review.editorialSummary.trim()) problems.push("editorial summary is required");
    if (filled(p.review.pros) < PUBLISH_MINIMUMS.pros) problems.push(`at least ${PUBLISH_MINIMUMS.pros} pros`);
    if (filled(p.review.cons) < PUBLISH_MINIMUMS.cons) problems.push(`at least ${PUBLISH_MINIMUMS.cons} cons`);
    if (filled(p.review.bestFor) < PUBLISH_MINIMUMS.bestFor) problems.push("at least 1 best-for audience");
    if (filled(p.review.limitations) < PUBLISH_MINIMUMS.limitations) problems.push("at least 1 limitation");
  }
  if (p.faqCount < PUBLISH_MINIMUMS.faqs) problems.push("at least 1 FAQ");
  if (p.alternativeCount < PUBLISH_MINIMUMS.alternatives) problems.push("at least 1 curated alternative");
  return problems;
}

export function canPublish(p: PublishCandidate): boolean {
  return publishProblems(p).length === 0;
}
