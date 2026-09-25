// Single source of truth for public URL patterns. Every internal link, canonical, sitemap entry and
// redirect must be generated through these helpers so each page has exactly one canonical URL.

export const PAGE_TYPES = [
  "home",
  "category",
  "product",
  "alternatives",
  "compare",
  "best",
  "faq",
  "methodology",
  "disclosure",
  "index",
] as const;
export type PageType = (typeof PAGE_TYPES)[number];

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_SLUG_LENGTH = 80;
const COMPARE_SEPARATOR = "-vs-";

// Product reviews live at the site root (`/{product-slug}`), so every top-level static segment is
// reserved and can never be used as a product slug.
export const RESERVED_ROOT_SLUGS = new Set([
  "admin",
  "alternatives",
  "api",
  "best",
  "categories",
  "category",
  "compare",
  "comparisons",
  "contact",
  "disclosure",
  "favicon-ico",
  "go",
  "icon",
  "methodology",
  "next",
  "privacy",
  "products",
  "robots-txt",
  "search",
  "sitemap-xml",
  "sponsor",
  "static",
  "vercel",
]);

export function slugify(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
}

export function isValidSlug(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_SLUG_LENGTH && SLUG_PATTERN.test(value);
}

export type SlugProblem = "invalid" | "reserved" | "contains-vs";

/** Validates a slug for a root-level product page. Returns null when usable. */
export function productSlugProblem(slug: string): SlugProblem | null {
  if (!isValidSlug(slug)) return "invalid";
  if (RESERVED_ROOT_SLUGS.has(slug)) return "reserved";
  // "-vs-" would make compare URLs ambiguous to parse.
  if (slug.includes(COMPARE_SEPARATOR) || slug.startsWith("vs-") || slug.endsWith("-vs") || slug === "vs") return "contains-vs";
  return null;
}

export const routes = {
  home: () => "/",
  products: () => "/products",
  categories: () => "/categories",
  comparisons: () => "/comparisons",
  alternativesIndex: () => "/alternatives",
  bestIndex: () => "/best",
  methodology: () => "/methodology",
  disclosure: () => "/disclosure",
  privacy: () => "/privacy",
  contact: () => "/contact",
  category: (slug: string) => `/category/${slug}`,
  product: (slug: string) => `/${slug}`,
  alternatives: (productSlug: string) => `/alternatives/${productSlug}`,
  compare: (slugA: string, slugB: string) => `/compare/${comparePairSlug(slugA, slugB)}`,
  best: (useCaseSlug: string) => `/best/${useCaseSlug}`,
  go: (productSlug: string) => `/go/${productSlug}`,
  sponsor: (sponsorId: string) => `/sponsor/${sponsorId}`,
} as const;

/** Orders two product slugs deterministically so `a-vs-b` and `b-vs-a` share one canonical URL. */
export function canonicalPair(slugA: string, slugB: string): [string, string] {
  if (slugA === slugB) throw new Error("A comparison needs two different products.");
  return slugA < slugB ? [slugA, slugB] : [slugB, slugA];
}

export function comparePairSlug(slugA: string, slugB: string): string {
  const [first, second] = canonicalPair(slugA, slugB);
  return `${first}${COMPARE_SEPARATOR}${second}`;
}

export type ParsedCompare = { first: string; second: string; canonicalSlug: string; isCanonical: boolean };

/** Parses `/compare/{a}-vs-{b}`. Returns null when the segment is not a well-formed pair. */
export function parseCompareSlug(segment: string): ParsedCompare | null {
  const parts = segment.split(COMPARE_SEPARATOR);
  if (parts.length !== 2) return null;
  const [a, b] = parts;
  if (!isValidSlug(a) || !isValidSlug(b) || a === b) return null;
  const canonicalSlug = comparePairSlug(a, b);
  return { first: a, second: b, canonicalSlug, isCanonical: canonicalSlug === segment };
}

/** Strips query strings, fragments and trailing slashes so canonicals never carry tracking noise. */
export function normalizePath(path: string): string {
  const clean = path.split(/[?#]/)[0] || "/";
  const withSlash = clean.startsWith("/") ? clean : `/${clean}`;
  const collapsed = withSlash.replace(/\/{2,}/g, "/");
  return collapsed.length > 1 ? collapsed.replace(/\/+$/, "") : collapsed;
}
