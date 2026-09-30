// G2 source adapter (memo23~g2-scraper): input building, record validation/normalization, product
// matching and change detection. Pure functions only — database writes live in lib/sync/run.ts.
//
// G2 is a third-party, additional source. Its data is stored as G2Listing source data; the official
// crawl stays authoritative for published pricing and facts, and editorial scores never come from G2.
import { createHash } from "node:crypto";
import { registrable } from "@/lib/research/evidence";

export const DEFAULT_G2_ACTOR = "memo23~g2-scraper";

/**
 * The G2 actor id. APIFY_G2_ACTOR_ID overrides it; an APIFY_ACTOR_ID that names a G2 actor (as some
 * setup guides suggest) is honoured here too, so the official crawler never gets the G2 actor.
 */
export function g2Actor(): string {
  const explicit = process.env.APIFY_G2_ACTOR_ID?.trim();
  if (explicit) return explicit.replace("/", "~");
  const shared = process.env.APIFY_ACTOR_ID?.trim();
  if (shared && /g2/i.test(shared)) return shared.replace("/", "~");
  return DEFAULT_G2_ACTOR;
}

export const G2 = {
  maxReviewsPerProduct: 3,
  /** Search results per product name considered for matching (search is fuzzy; see matchRecord). */
  searchResultsPerQuery: 8,
  maxItems: 3000,
  /** Candidate products are created only when this many catalog products list them as a competitor. */
  candidateMinMentions: 2,
  maxCandidatesCreatedPerRun: 10,
  maxCompetitorsKept: 10,
};

const G2_HOST = /^https:\/\/(www\.)?g2\.com\//;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,99}$/;

export const g2ProductUrl = (slug: string) => `https://www.g2.com/products/${slug}/reviews`;

export type G2Target = { productId: string; name: string; g2Slug: string | null };

/** Actor input for one G2 phase: known listings by URL (details), unknown products by name (search). */
export function g2Input(targets: G2Target[], proxyGroups = ["RESIDENTIAL"]) {
  const known = targets.filter((t) => t.g2Slug);
  const unknown = targets.filter((t) => !t.g2Slug);
  const startUrls = known.flatMap((t) => [
    { url: g2ProductUrl(t.g2Slug!) },
    { url: `https://www.g2.com/products/${t.g2Slug}/pricing` },
    { url: `https://www.g2.com/products/${t.g2Slug}/competitors/alternatives` },
  ]);
  const input: Record<string, unknown> = {
    maxItems: Math.min(G2.maxItems, known.length * (G2.maxReviewsPerProduct + G2.maxCompetitorsKept + 4) + unknown.length * G2.searchResultsPerQuery + 20),
    maxReviews: G2.maxReviewsPerProduct,
    sortOrder: "most_recent",
    proxy: { useApifyProxy: true, apifyProxyGroups: proxyGroups },
  };
  if (startUrls.length) input.startUrls = startUrls;
  if (unknown.length) input.searchQueries = unknown.map((t) => t.name);
  return input;
}

/** Placeholder SyncPage URL for a product in a G2 phase (one row per product, per phase). */
export const g2PageUrl = (t: G2Target) => (t.g2Slug ? g2ProductUrl(t.g2Slug) : `https://www.g2.com/search?query=${encodeURIComponent(t.name)}`);

// ---------------- Normalization ----------------

export function normalizeDomain(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  let host = v.trim().toLowerCase();
  try {
    host = new URL(/^https?:\/\//.test(host) ? host : `https://${host}`).host;
  } catch {
    return null;
  }
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) return null;
  return registrable(host);
}

export const normalizeName = (v: string) =>
  v.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/\b(inc|llc|ltd|gmbh|corp|corporation|software|technologies|app|the)\b/g, " ").replace(/\s+/g, " ").trim();

const str = (v: unknown, max = 2000): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);
const httpsUrl = (v: unknown): string | null => {
  const s = str(v, 2000);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
};
const date = (v: unknown): Date | null => {
  const s = str(v, 60);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) || d.getTime() > Date.now() + 86_400_000 ? null : d;
};
const slugFromUrl = (v: unknown): string | null => {
  const s = str(v, 2000);
  const m = s?.match(/g2\.com\/products\/([a-z0-9-]+)/i);
  return m ? m[1].toLowerCase() : null;
};
const g2Slug = (v: unknown, url?: unknown): string | null => {
  const s = str(v, 100)?.toLowerCase() ?? slugFromUrl(url);
  return s && SLUG_RE.test(s) ? s : null;
};

/** G2 reports "no rating" as 0 with 0 reviews; that is missing data, not a rating. */
function rating5(r5: unknown, r10: unknown, reviews: number | null): number | null {
  const a = num(r5);
  const b = num(r10);
  const v = a && a > 0 ? a : b && b > 0 ? b / 2 : null;
  if (v === null || v > 5 || (reviews !== null && reviews <= 0)) return null;
  return Math.round(v * 10) / 10;
}

// ---------------- Records ----------------

export type G2Listing = {
  kind: "listing";
  g2Slug: string;
  name: string;
  vendorName: string | null;
  g2Url: string;
  companyDomain: string | null;
  companyWebsite: string | null;
  description: string | null;
  imageUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  pricingType: string | null;
  categories: string[];
  sponsored: boolean;
  dataAsOf: Date | null;
};
export type G2Competitor = { kind: "competitor"; sourceSlug: string; rank: number; listing: G2Listing };
export type G2Pricing = { kind: "pricing"; g2Slug: string; companyDomain: string | null; data: { pricingUrl: string | null; tiers: unknown[]; tierCount: number; priceMin: number | null; priceMax: number | null; currency: string | null; keyInsights: string | null; faqs: { question: string; answer: string }[] }; dataAsOf: Date | null };
export type G2Summary = { kind: "review_summary"; g2Slug: string; data: { pros: { label: string; mentions: number }[]; cons: { label: string; mentions: number }[]; summaryText: string | null; rating: number | null; totalReviews: number | null }; dataAsOf: Date | null };
export type G2Review = { kind: "review"; g2Slug: string; data: { id: string; title: string; rating: number | null; publishedAt: string | null; link: string | null; businessSize: string | null; validated: boolean; incentivized: boolean } };
export type G2Record = G2Listing | G2Competitor | G2Pricing | G2Summary | G2Review;
export type G2Validation = { ok: true; record: G2Record } | { ok: false; reason: string };

const labels = (v: unknown) =>
  Array.isArray(v)
    ? v.flatMap((x) => {
        const label = str((x as Record<string, unknown>)?.label, 120);
        const mentions = num((x as Record<string, unknown>)?.mentions);
        return label ? [{ label, mentions: mentions && mentions > 0 ? Math.round(mentions) : 0 }] : [];
      }).slice(0, 12)
    : [];

function listing(r: Record<string, unknown>): G2Listing | string {
  const slug = g2Slug(r.productSlug, r.productUrl ?? r.reviewsUrl);
  if (!slug) return "no valid G2 product slug";
  const name = str(r.productName, 120);
  if (!name) return "no product name";
  const g2Url = httpsUrl(r.reviewsUrl) ?? httpsUrl(r.productUrl) ?? g2ProductUrl(slug);
  if (!G2_HOST.test(g2Url)) return "G2 URL is not on g2.com";
  const website = httpsUrl(r.companyWebsite);
  const domain = normalizeDomain(r.companyDomain) ?? normalizeDomain(website);
  const reviews = num(r.reviewCount);
  const reviewCount = reviews !== null && reviews >= 0 ? Math.round(reviews) : null;
  const cats = Array.isArray(r.relatedCategories) ? r.relatedCategories : Array.isArray(r.categoriesDetailed) ? (r.categoriesDetailed as Record<string, unknown>[]).map((c) => c?.name) : [];
  const snippet = str(r.descriptionSnippet, 1000);
  return {
    kind: "listing",
    g2Slug: slug,
    name,
    vendorName: str(r.vendorName, 120) ?? str(r.sellerName, 120),
    g2Url,
    companyDomain: domain,
    companyWebsite: website,
    // Competitor rows carry "By <vendor>" instead of a description.
    description: snippet && !/^by\s/i.test(snippet) ? snippet : null,
    imageUrl: httpsUrl(r.thumbImageUrl),
    rating: rating5(r.ratingOutOfFive, r.ratingOutOfTen, reviewCount),
    reviewCount: reviewCount && reviewCount > 0 ? reviewCount : null,
    pricingType: str(r.pricingType, 60),
    categories: [...new Set(cats.map((c) => str(c, 120)).filter((c): c is string => !!c))].slice(0, 25),
    sponsored: r.isSponsored === true,
    dataAsOf: date(r.dataAsOf) ?? date(r.scrapedAt),
  };
}

/** Validates and normalizes one dataset item. Unknown or malformed items are rejected, never guessed. */
export function parseG2Item(raw: unknown): G2Validation {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, reason: "not an object" };
  const r = raw as Record<string, unknown>;
  // Search/category rows carry itemType instead of type; only software listings are products
  // ("Provider" rows describe the vendor, not a product).
  if (typeof r.type !== "string" && typeof r.itemType === "string" && r.itemType !== "Software") return { ok: false, reason: `not a software listing (${r.itemType.slice(0, 40)})` };
  const type = typeof r.type === "string" ? r.type : r.itemType || r.productName ? "product" : null;
  switch (type) {
    case "product":
    case "search":
    case "category": {
      const l = listing(r);
      return typeof l === "string" ? { ok: false, reason: l } : { ok: true, record: l };
    }
    case "competitor": {
      const source = g2Slug(r.sourceProductSlug);
      if (!source) return { ok: false, reason: "competitor without a source product" };
      const l = listing(r);
      if (typeof l === "string") return { ok: false, reason: l };
      if (l.g2Slug === source) return { ok: false, reason: "competitor is the product itself" };
      return { ok: true, record: { kind: "competitor", sourceSlug: source, rank: Math.max(1, Math.round(num(r.competitorRank) ?? 99)), listing: l } };
    }
    case "pricing": {
      const slug = g2Slug(r.productSlug, r.productUrl);
      if (!slug) return { ok: false, reason: "pricing without a product slug" };
      if (typeof r.status === "string" && r.status !== "SUCCEEDED") return { ok: false, reason: `pricing page ${r.status.toLowerCase()}` };
      const faqs = Array.isArray(r.faqs)
        ? r.faqs.flatMap((f) => {
            const q = str((f as Record<string, unknown>)?.question, 300);
            const a = str((f as Record<string, unknown>)?.answer, 2000);
            return q && a ? [{ question: q, answer: a }] : [];
          }).slice(0, 10)
        : [];
      const tiers = Array.isArray(r.tiers) ? r.tiers.slice(0, 20) : [];
      const min = num(r.priceMin);
      const max = num(r.priceMax);
      return {
        ok: true,
        record: {
          kind: "pricing", g2Slug: slug, companyDomain: normalizeDomain(r.companyDomain) ?? normalizeDomain(r.companyWebsite), dataAsOf: date(r.dataAsOf) ?? date(r.scrapedAt),
          // 0/0 with no tiers means G2 did not list prices; keep it as "unknown", not "free".
          data: { pricingUrl: httpsUrl(r.pricingUrl), tiers, tierCount: tiers.length, priceMin: tiers.length && min !== null && min >= 0 ? min : null, priceMax: tiers.length && max !== null && max >= 0 ? max : null, currency: str(r.currency, 3), keyInsights: str(r.keyInsights, 2000), faqs },
        },
      };
    }
    case "review_summary": {
      const slug = g2Slug(r.productSlug, r.productUrl);
      if (!slug) return { ok: false, reason: "summary without a product slug" };
      const total = num(r.totalReviews);
      const agg = num(r.aggregateRating);
      // aggregateRating arrives on either scale (observed: 4.4 for one product, 8.4 for another); only a
      // value above 5 is unambiguously out of 10. Listing rows state their scale and are preferred.
      const rating = agg && agg > 0 && agg <= 10 && total && total > 0 ? Math.round((agg > 5 ? agg / 2 : agg) * 10) / 10 : null;
      return { ok: true, record: { kind: "review_summary", g2Slug: slug, dataAsOf: date(r.dataAsOf) ?? date(r.scrapedAt), data: { pros: labels(r.pros), cons: labels(r.cons), summaryText: str(r.summaryText, 2000), rating, totalReviews: total && total > 0 ? Math.round(total) : null } } };
    }
    case "review": {
      const slug = g2Slug(r.product_slug, r.review_link);
      const id = typeof r.review_id === "number" && Number.isFinite(r.review_id) ? String(r.review_id) : str(r.review_id, 60);
      const title = str(r.review_title, 300);
      if (!slug || !id || !title) return { ok: false, reason: "review without slug, id or title" };
      const reviewer = (r.reviewer ?? {}) as Record<string, unknown>;
      const rating = num(r.review_rating);
      const link = httpsUrl(r.review_link);
      return {
        ok: true,
        record: {
          kind: "review", g2Slug: slug,
          // Review text is G2 users' copyrighted content: only metadata and the link are kept.
          data: { id, title, rating: rating !== null && rating >= 0 && rating <= 5 ? rating : null, publishedAt: date(r.publish_date)?.toISOString() ?? null, link: link && G2_HOST.test(link) ? link : null, businessSize: str(reviewer.business_size, 80), validated: r.validated_reviewer === true, incentivized: r.incentivized === true },
        },
      };
    }
    default:
      return { ok: false, reason: `unsupported record type ${String(type ?? "(none)")}` };
  }
}

// ---------------- Matching ----------------

export type CatalogEntry = { id: string; slug: string; name: string; vendor: string | null; domains: Set<string>; g2Slug: string | null };
export type Match = { productId: string; by: "g2Slug" | "domain" | "name" } | null;

/**
 * Deterministic match of a G2 listing to one catalog product: an existing G2 slug link first, then the
 * official domain, then an exact normalized name (or vendor + name) — but a name match is refused when
 * the listing's domain belongs to a different company. Ambiguity (several candidates) never matches.
 */
export function matchListing(l: Pick<G2Listing, "g2Slug" | "name" | "vendorName" | "companyDomain">, catalog: CatalogEntry[]): Match {
  const bySlug = catalog.filter((c) => c.g2Slug === l.g2Slug);
  if (bySlug.length === 1) return { productId: bySlug[0].id, by: "g2Slug" };
  if (l.companyDomain) {
    const byDomain = catalog.filter((c) => c.domains.has(l.companyDomain!));
    if (byDomain.length === 1) return { productId: byDomain[0].id, by: "domain" };
    if (byDomain.length > 1) {
      // One vendor, several products (e.g. suites): the exact name decides.
      const named = byDomain.filter((c) => normalizeName(c.name) === normalizeName(l.name));
      return named.length === 1 ? { productId: named[0].id, by: "domain" } : null;
    }
  }
  const n = normalizeName(l.name);
  if (!n) return null;
  const byName = catalog.filter((c) => {
    if (normalizeName(c.name) !== n && !(c.vendor && l.vendorName && normalizeName(`${c.vendor} ${c.name}`) === normalizeName(`${l.vendorName} ${l.name}`))) return false;
    // Same name, different official domain: a different product.
    return !l.companyDomain || c.domains.size === 0;
  });
  return byName.length === 1 ? { productId: byName[0].id, by: "name" } : null;
}

// ---------------- Change detection ----------------

/** Fields compared between runs; `changedFields` lists exactly which of them differ. */
export const LISTING_FIELDS = ["name", "vendorName", "g2Url", "companyDomain", "companyWebsite", "description", "imageUrl", "rating", "reviewCount", "pricingType", "categories", "pricing", "competitors", "reviewSummary", "recentReviews"] as const;
export type ListingFields = Partial<Record<(typeof LISTING_FIELDS)[number], unknown>>;

const canon = (v: unknown): string => JSON.stringify(v ?? null, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));

export function changedFields(prev: ListingFields | null, next: ListingFields): string[] {
  if (!prev) return Object.keys(next).filter((k) => next[k as keyof ListingFields] !== undefined);
  return (Object.keys(next) as (keyof ListingFields)[]).filter((k) => next[k] !== undefined && canon(prev[k]) !== canon(next[k]));
}

/**
 * Merge rule for one field: new valid data replaces old; missing data (null/undefined/empty list) keeps
 * the existing value, so a partial G2 response can never blank a listing.
 */
export function mergeField<T>(prev: T | null | undefined, next: T | null | undefined): T | null {
  if (next === undefined || next === null) return prev ?? null;
  if (Array.isArray(next) && next.length === 0 && Array.isArray(prev) && prev.length) return prev;
  return next;
}

export const listingHash = (f: ListingFields) => createHash("sha256").update(canon(Object.fromEntries(LISTING_FIELDS.map((k) => [k, f[k] ?? null])))).digest("hex").slice(0, 32);

// ---------------- Auto-sync into product fields ----------------

/**
 * Product fields G2 may fill automatically. Fill-if-empty only: an editor-maintained value is never
 * replaced by G2 data. Extend deliberately — every other product field is editorial or official-crawl.
 */
export const G2_AUTO_FIELDS = ["vendor"] as const;

export function autoFill(product: { vendor: string | null }, l: Pick<G2Listing, "vendorName">): Partial<Record<(typeof G2_AUTO_FIELDS)[number], string>> {
  const out: Partial<Record<(typeof G2_AUTO_FIELDS)[number], string>> = {};
  if (!product.vendor?.trim() && l.vendorName) out.vendor = l.vendorName.slice(0, 120);
  return out;
}
