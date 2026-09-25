import type { Criterion, Faq } from "@/lib/content/types";

// Authoring format for editorial seed content. Consumed by `prisma/seed.ts` and by the
// no-database fallback catalog. Contains no prices: pricing notes are stored as unverified
// snapshots that editors must confirm before anything price-related renders publicly.

export type SeedCategory = {
  slug: string;
  name: string;
  description: string;
  intro: string;
  seoTitle: string;
  seoDescription: string;
  sortOrder: number;
  faqs: Faq[];
};

export type SeedProduct = {
  slug: string;
  name: string;
  vendor: string;
  category: string;
  subcategory: string;
  tagline: string;
  description: string;
  officialUrl: string;
  pricingUrl: string;
  features: string[];
  comparison: Record<string, string>;
  alternativesIntro: string;
  review: {
    rating: number | null;
    editorialSummary: string;
    verdict: string;
    pros: string[];
    cons: string[];
    bestFor: string[];
    limitations: string[];
  };
  tags: string[];
  faqs: Faq[];
  alternatives: { slug: string; rationale: string; keyDifference: string }[];
  /** Qualitative, unverified note for the editor pricing queue. Never rendered publicly. */
  pricingNote: string;
};

export type SeedUseCase = {
  slug: string;
  title: string;
  audience: string;
  intro: string;
  criteria: Criterion[];
  category: string;
  seoTitle: string;
  seoDescription: string;
  faqs: Faq[];
  products: { slug: string; rationale: string; caveat: string }[];
};

export type SeedPair = {
  a: string;
  b: string;
  summary: string;
  chooseA: string;
  chooseB: string;
  highlights: string[];
};
