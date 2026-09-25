import type { Catalog, Product } from "@/lib/content/types";
import { publishProblems } from "@/lib/content/publish-validation";
import { comparePairSlug } from "@/lib/seo/routes";
import { seedCategories } from "@/lib/content/seed/categories";
import { seedProducts } from "@/lib/content/seed/products";
import { seedUseCases } from "@/lib/content/seed/use-cases";
import { seedPairs } from "@/lib/content/seed/pairs";
import type { SeedProduct } from "@/lib/content/seed/types";

// Editorial date of the seed content set; used as the content timestamp when no database is present.
export const SEED_CONTENT_DATE = "2026-09-25T00:00:00.000Z";

export function seedProductProblems(p: SeedProduct): string[] {
  return publishProblems({
    slug: p.slug,
    name: p.name,
    categorySlug: p.category,
    tagline: p.tagline,
    description: p.description,
    officialUrl: p.officialUrl,
    pricingUrl: p.pricingUrl,
    features: p.features,
    comparison: p.comparison,
    alternativesIntro: p.alternativesIntro,
    review: p.review,
    faqCount: p.faqs.length,
    alternativeCount: p.alternatives.length,
  });
}

function toProduct(p: SeedProduct): Product {
  return {
    slug: p.slug,
    name: p.name,
    vendor: p.vendor,
    categorySlug: p.category,
    subcategory: p.subcategory,
    tagline: p.tagline,
    description: p.description,
    officialUrl: p.officialUrl,
    pricingUrl: p.pricingUrl,
    affiliate: null,
    status: seedProductProblems(p).length === 0 ? "PUBLISHED" : "DRAFT",
    features: p.features,
    comparison: p.comparison,
    alternativesIntro: p.alternativesIntro,
    seoTitle: null,
    seoDescription: null,
    review: { ...p.review, reviewStatus: "NOT_STARTED", lastReviewedAt: null },
    tags: p.tags,
    faqs: p.faqs,
    // Seed pricing notes are unverified, so no price points are exposed.
    pricing: [],
    pricingLastChecked: null,
    changelog: [],
    refreshIntervalDays: null,
    contentUpdatedAt: SEED_CONTENT_DATE,
    alternatives: p.alternatives.map((a) => ({ slug: a.slug, rationale: a.rationale, keyDifference: a.keyDifference, useCaseSlug: null })),
  };
}

export function seedCatalog(): Catalog {
  const products = seedProducts.map(toProduct);
  const categoryOf = new Map(products.map((p) => [p.slug, p.categorySlug]));
  return {
    categories: seedCategories.map((c) => ({ ...c, updatedAt: SEED_CONTENT_DATE })),
    products,
    useCases: seedUseCases.map((u) => ({
      slug: u.slug,
      title: u.title,
      audience: u.audience,
      intro: u.intro,
      criteria: u.criteria,
      categorySlug: u.category,
      status: "PUBLISHED",
      seoTitle: u.seoTitle,
      seoDescription: u.seoDescription,
      faqs: u.faqs,
      products: u.products.map((x) => ({ slug: x.slug, rationale: x.rationale, caveat: x.caveat })),
      contentUpdatedAt: SEED_CONTENT_DATE,
    })),
    pairs: seedPairs.map((pair) => ({
      slug: comparePairSlug(pair.a, pair.b),
      productA: pair.a,
      productB: pair.b,
      categorySlug: categoryOf.get(pair.a) ?? "",
      summary: pair.summary,
      chooseA: pair.chooseA,
      chooseB: pair.chooseB,
      highlights: pair.highlights,
      updatedAt: SEED_CONTENT_DATE,
    })),
  };
}
