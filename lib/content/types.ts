// Domain types shared by the public site, seed data and the database mapper.

export type ContentStatus = "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED";
export type ReviewStatus = "NOT_STARTED" | "IN_PROGRESS" | "NEEDS_UPDATE" | "REVIEWED";
export type BillingPeriod = "FREE" | "MONTHLY" | "ANNUAL" | "ONE_TIME" | "USAGE" | "CUSTOM";
export type PriceSourceType = "OFFICIAL_PRICING_PAGE" | "VENDOR_CONFIRMATION" | "MANUAL_CHECK" | "AUTOMATED_DETECTION";

export type Faq = { question: string; answer: string };
export type Criterion = { name: string; description: string };

/** A verified pricing observation. Unverified snapshots never reach this type. */
export type PricePoint = {
  plan: string | null;
  price: number | null;
  currency: string | null;
  billingPeriod: BillingPeriod | null;
  note: string;
  sourceUrl: string | null;
  sourceType: PriceSourceType;
  capturedAt: string;
};

export type ReviewMeta = {
  rating: number | null;
  editorialSummary: string;
  verdict: string | null;
  pros: string[];
  cons: string[];
  bestFor: string[];
  limitations: string[];
  reviewStatus: ReviewStatus;
  lastReviewedAt: string | null;
};

export type AlternativeRef = {
  slug: string;
  rationale: string;
  keyDifference: string | null;
  useCaseSlug: string | null;
};

export type AffiliateConfig = { url: string; label: string; provider: string | null };

export type Category = {
  slug: string;
  name: string;
  description: string;
  intro: string;
  seoTitle: string | null;
  seoDescription: string | null;
  sortOrder: number;
  faqs: Faq[];
  updatedAt: string;
};

export type Product = {
  slug: string;
  name: string;
  vendor: string | null;
  categorySlug: string;
  subcategory: string | null;
  tagline: string;
  description: string;
  officialUrl: string;
  pricingUrl: string | null;
  /** Only present when a verified, active affiliate link exists. */
  affiliate: AffiliateConfig | null;
  status: ContentStatus;
  features: string[];
  /** Keyed by the category comparison-schema field keys. */
  comparison: Record<string, string>;
  alternativesIntro: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  review: ReviewMeta;
  tags: string[];
  faqs: Faq[];
  pricing: PricePoint[];
  pricingLastChecked: string | null;
  changelog: { version: string; summary: string; changedAt: string }[];
  refreshIntervalDays: number | null;
  contentUpdatedAt: string;
  alternatives: AlternativeRef[];
};

export type UseCaseProductRef = { slug: string; rationale: string; caveat: string | null };

export type UseCase = {
  slug: string;
  title: string;
  audience: string;
  intro: string;
  criteria: Criterion[];
  categorySlug: string;
  status: ContentStatus;
  seoTitle: string | null;
  seoDescription: string | null;
  faqs: Faq[];
  products: UseCaseProductRef[];
  contentUpdatedAt: string;
};

export type ComparisonPair = {
  slug: string;
  productA: string;
  productB: string;
  categorySlug: string;
  summary: string;
  chooseA: string;
  chooseB: string;
  highlights: string[];
  updatedAt: string;
};

export type Catalog = {
  categories: Category[];
  products: Product[];
  useCases: UseCase[];
  pairs: ComparisonPair[];
};
