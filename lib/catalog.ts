import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { lastCheckedAt } from "@/lib/freshness-rules";
import { sanitizeCatalog } from "@/lib/content/sanitize";
import { seedCatalog } from "@/lib/content/seed-catalog";
import type { Catalog, Category, ComparisonPair, Criterion, PricePoint, Product, UseCase } from "@/lib/content/types";
import { isHttpUrl } from "@/lib/validation";
import { comparePairSlug } from "@/lib/seo/routes";

export const hasDatabase = () => Boolean(process.env.DATABASE_URL);

export const strArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];

export const strRecord = (value: unknown): Record<string, string> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === "string"))
    : {};

const criteria = (value: unknown): Criterion[] =>
  Array.isArray(value)
    ? value
        .filter((x): x is { name: string; description: string } => Boolean(x) && typeof x === "object" && typeof (x as Criterion).name === "string" && typeof (x as Criterion).description === "string")
        .map((x) => ({ name: x.name, description: x.description }))
    : [];

const productInclude = {
  category: { select: { slug: true } },
  review: true,
  tags: { include: { tag: true } },
  faqs: { orderBy: { sortOrder: "asc" } },
  snapshots: { where: { status: "VERIFIED", snapshotType: "PRICING" }, orderBy: { capturedAt: "desc" } },
  links: { where: { active: true }, orderBy: { updatedAt: "desc" } },
  alternativesFrom: { where: { active: true }, include: { alternative: { select: { slug: true } }, useCase: { select: { slug: true } } }, orderBy: { sortOrder: "asc" } },
  changelog: { orderBy: { changedAt: "desc" }, take: 10 },
  sources: { orderBy: [{ kind: "asc" }, { name: "asc" }] },
  facts: { include: { source: { select: { url: true } } }, orderBy: { key: "asc" } },
  relationships: { where: { agreementStatus: "ACTIVE", verifiedAt: { not: null } } },
} satisfies Prisma.ProductInclude;

type DbProduct = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

function mapPricing(rows: DbProduct["snapshots"]): PricePoint[] {
  return rows.map((s) => ({
    plan: s.plan,
    price: s.price === null ? null : Number(s.price),
    currency: s.currency,
    billingPeriod: s.billingPeriod,
    note: s.summary,
    sourceUrl: s.sourceUrl,
    sourceType: s.sourceType,
    capturedAt: s.capturedAt.toISOString(),
    unit: s.unit,
    perSeat: s.perSeat,
    promotional: s.promotional,
    regionDependent: s.regionDependent,
  }));
}

/** A relationship is public only while documented, active and within its dates. */
export function isActiveRelationship(r: { agreementStatus: string; verifiedAt: Date | null; startDate: Date | null; endDate: Date | null }, now = new Date()) {
  return r.agreementStatus === "ACTIVE" && Boolean(r.verifiedAt) && (!r.startDate || r.startDate <= now) && (!r.endDate || r.endDate >= now);
}

export function mapDbProduct(p: DbProduct): Product {
  const affiliateRow = p.links.find((l) => l.active && isHttpUrl(l.url) && l.url.startsWith("https://"));
  const checked = lastCheckedAt(p.pricingCheckedAt, p.snapshots[0]?.capturedAt);
  return {
    slug: p.slug,
    name: p.name,
    vendor: p.vendor,
    categorySlug: p.category.slug,
    subcategory: p.subcategory,
    tagline: p.tagline,
    description: p.description,
    officialUrl: p.officialUrl,
    pricingUrl: p.pricingUrl,
    affiliate: affiliateRow ? { url: affiliateRow.url, label: affiliateRow.label, provider: affiliateRow.provider } : null,
    status: p.status,
    features: strArray(p.features),
    comparison: strRecord(p.comparison),
    alternativesIntro: p.alternativesIntro,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    review: {
      rating: p.review?.rating ?? null,
      editorialSummary: p.review?.editorialSummary ?? "",
      verdict: p.review?.verdict ?? null,
      pros: strArray(p.review?.pros),
      cons: strArray(p.review?.cons),
      bestFor: strArray(p.review?.bestFor),
      limitations: strArray(p.review?.limitations),
      reviewStatus: p.review?.reviewStatus ?? "NOT_STARTED",
      lastReviewedAt: p.review?.lastReviewedAt?.toISOString() ?? null,
    },
    tags: p.tags.map((t) => t.tag.name),
    faqs: p.faqs.map((f) => ({ question: f.question, answer: f.answer })),
    pricing: mapPricing(p.snapshots),
    pricingLastChecked: checked?.toISOString() ?? null,
    pricingRegionNote: p.pricingRegionNote,
    sources: p.sources.map((x) => ({ kind: x.kind, url: x.url, name: x.name, section: x.section, checkedAt: x.checkedAt?.toISOString() ?? null, status: x.status })),
    facts: p.facts.map((f) => ({ key: f.key, value: f.value, evidence: f.evidence, sourceUrl: f.source?.url ?? null, checkedAt: f.checkedAt?.toISOString() ?? null, status: f.status })),
    relationships: p.relationships.filter((r) => isActiveRelationship(r)).map((r) => ({ type: r.relationshipType, brand: r.brand, sourceUrl: r.sourceUrl })),
    featuresCheckedAt: p.featuresCheckedAt?.toISOString() ?? null,
    sourceCheckedAt: p.sourceCheckedAt?.toISOString() ?? null,
    changelog: p.changelog.map((c) => ({ version: c.version, summary: c.summary, changedAt: c.changedAt.toISOString() })),
    refreshIntervalDays: p.refreshIntervalDays,
    contentUpdatedAt: p.contentUpdatedAt.toISOString(),
    alternatives: p.alternativesFrom.map((a) => ({ slug: a.alternative.slug, rationale: a.rationale, keyDifference: a.keyDifference, useCaseSlug: a.useCase?.slug ?? null })),
  };
}

async function databaseCatalog(): Promise<Catalog> {
  const [categories, products, useCases, pairs] = await Promise.all([
    db.category.findMany({ include: { faqs: { orderBy: { sortOrder: "asc" } } } }),
    db.product.findMany({ where: { status: "PUBLISHED" }, include: productInclude }),
    db.useCase.findMany({
      where: { status: "PUBLISHED" },
      include: {
        category: { select: { slug: true } },
        faqs: { orderBy: { sortOrder: "asc" } },
        products: { where: { active: true }, include: { product: { select: { slug: true } } }, orderBy: { position: "asc" } },
      },
    }),
    db.competitorPair.findMany({ where: { active: true }, include: { productA: { select: { slug: true } }, productB: { select: { slug: true } }, category: { select: { slug: true } } } }),
  ]);

  return {
    categories: categories.map<Category>((c) => ({
      slug: c.slug,
      name: c.name,
      description: c.description ?? "",
      intro: c.intro ?? "",
      seoTitle: c.seoTitle,
      seoDescription: c.seoDescription,
      sortOrder: c.sortOrder,
      faqs: c.faqs.map((f) => ({ question: f.question, answer: f.answer })),
      updatedAt: c.updatedAt.toISOString(),
    })),
    products: products.map(mapDbProduct),
    useCases: useCases.map<UseCase>((u) => ({
      slug: u.slug,
      title: u.title,
      audience: u.audience,
      intro: u.intro,
      criteria: criteria(u.criteria),
      categorySlug: u.category.slug,
      status: u.status,
      seoTitle: u.seoTitle,
      seoDescription: u.seoDescription,
      faqs: u.faqs.map((f) => ({ question: f.question, answer: f.answer })),
      products: u.products.map((x) => ({ slug: x.product.slug, rationale: x.rationale, caveat: x.caveat })),
      contentUpdatedAt: u.contentUpdatedAt.toISOString(),
    })),
    pairs: pairs.map<ComparisonPair>((pair) => ({
      slug: comparePairSlug(pair.productA.slug, pair.productB.slug),
      productA: pair.productA.slug,
      productB: pair.productB.slug,
      categorySlug: pair.category.slug,
      summary: pair.summary,
      chooseA: pair.chooseA,
      chooseB: pair.chooseB,
      highlights: strArray(pair.highlights),
      updatedAt: pair.updatedAt.toISOString(),
    })),
  };
}

/**
 * Loads the public catalog once per request. Database errors are thrown rather than swallowed so
 * ISR keeps serving the last good page instead of caching an empty one.
 */
export const loadCatalog = cache(async (): Promise<Catalog> => {
  if (!hasDatabase()) return sanitizeCatalog(seedCatalog());
  try {
    return sanitizeCatalog(await databaseCatalog());
  } catch (error) {
    console.error("[catalog] database read failed", error instanceof Error ? error.message : "unknown error");
    throw error;
  }
});

// ---- Query helpers over a loaded catalog (pure, deterministic) ----

export const findProduct = (c: Catalog, slug: string) => c.products.find((p) => p.slug === slug);
export const findCategory = (c: Catalog, slug: string) => c.categories.find((x) => x.slug === slug);
export const findUseCase = (c: Catalog, slug: string) => c.useCases.find((u) => u.slug === slug);
export const findPair = (c: Catalog, slug: string) => c.pairs.find((p) => p.slug === slug);
export const productsInCategory = (c: Catalog, categorySlug: string) => c.products.filter((p) => p.categorySlug === categorySlug);
export const guidesInCategory = (c: Catalog, categorySlug: string) => c.useCases.filter((u) => u.categorySlug === categorySlug);
export const guidesForProduct = (c: Catalog, slug: string) => c.useCases.filter((u) => u.products.some((x) => x.slug === slug));
export const pairsForProduct = (c: Catalog, slug: string) => c.pairs.filter((p) => p.productA === slug || p.productB === slug);
export const pairsInCategory = (c: Catalog, categorySlug: string) => c.pairs.filter((p) => p.categorySlug === categorySlug);

export function alternativesFor(c: Catalog, product: Product) {
  return product.alternatives
    .map((ref) => ({ ref, product: findProduct(c, ref.slug) }))
    .filter((x): x is { ref: (typeof product.alternatives)[number]; product: Product } => Boolean(x.product));
}

export function pairFor(c: Catalog, slugA: string, slugB: string) {
  if (slugA === slugB) return undefined;
  return findPair(c, comparePairSlug(slugA, slugB));
}
