import { isHttpUrl } from "@/lib/validation";
import { isValidSlug, productSlugProblem, slugify } from "@/lib/seo/routes";
import { CTA_TYPES } from "@/lib/analytics";
import { isSponsorPageType, isSponsorPlacement, SPONSOR_PAGE_TYPES, SPONSOR_PLACEMENTS } from "@/lib/sponsors";

// Input parsing for admin writes. Works on JSON bodies and on FormData converted with
// `formToObject`. Only keys that are present are returned (PATCH semantics). Every string is
// trimmed and length-bounded, lists are bounded, numbers are range-checked and enums whitelisted.

export class InputError extends Error {
  constructor(public readonly problems: string[]) {
    super(problems.join("; "));
  }
}

type Body = Record<string, unknown>;
const has = (b: Body, k: string) => Object.prototype.hasOwnProperty.call(b, k) && b[k] !== undefined;

export const CONTENT_STATUSES = ["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"] as const;
export const REVIEW_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "NEEDS_UPDATE", "REVIEWED"] as const;
export const BILLING_PERIODS = ["FREE", "MONTHLY", "ANNUAL", "ONE_TIME", "USAGE", "CUSTOM"] as const;
export const PRICE_SOURCE_TYPES = ["OFFICIAL_PRICING_PAGE", "VENDOR_CONFIRMATION", "MANUAL_CHECK", "AUTOMATED_DETECTION"] as const;
export const SNAPSHOT_TYPES = ["PRICING", "FEATURE", "GENERAL"] as const;
export { CTA_TYPES, SPONSOR_PAGE_TYPES, SPONSOR_PLACEMENTS };

class Reader {
  problems: string[] = [];
  out: Record<string, unknown> = {};
  constructor(private b: Body) {}

  private put(key: string, as: string | undefined, value: unknown) {
    this.out[as ?? key] = value;
  }

  str(key: string, o: { max?: number; min?: number; required?: boolean; nullable?: boolean; as?: string } = {}) {
    const max = o.max ?? 500;
    if (!has(this.b, key)) {
      if (o.required) this.problems.push(`${key} is required`);
      return this;
    }
    const v = this.b[key];
    if (v === null || (typeof v === "string" && !v.trim())) {
      if (o.nullable) this.put(key, o.as, null);
      else this.problems.push(`${key} must not be empty`);
      return this;
    }
    if (typeof v !== "string") this.problems.push(`${key} must be a string`);
    else if (v.trim().length > max) this.problems.push(`${key} must be at most ${max} characters`);
    else if (o.min && v.trim().length < o.min) this.problems.push(`${key} must be at least ${o.min} characters (avoid thin content)`);
    else this.put(key, o.as, v.trim());
    return this;
  }

  url(key: string, o: { required?: boolean; nullable?: boolean; httpsOnly?: boolean } = {}) {
    if (!has(this.b, key)) {
      if (o.required) this.problems.push(`${key} is required`);
      return this;
    }
    const v = this.b[key];
    if (v === null || v === "") {
      if (o.nullable) this.out[key] = null;
      else this.problems.push(`${key} is required`);
      return this;
    }
    if (!isHttpUrl(v) || v.trim().length > 2000) this.problems.push(`${key} must be a valid http(s) URL`);
    else if (o.httpsOnly && !v.trim().startsWith("https://")) this.problems.push(`${key} must use https`);
    else this.out[key] = v.trim();
    return this;
  }

  list(key: string, o: { maxItems?: number; maxLen?: number; as?: string } = {}) {
    if (!has(this.b, key)) return this;
    const raw = this.b[key];
    const items = typeof raw === "string" ? raw.split(/\r?\n/) : Array.isArray(raw) ? raw : null;
    if (!items || items.some((x) => typeof x !== "string")) {
      this.problems.push(`${key} must be a list of strings`);
      return this;
    }
    const clean = [...new Set((items as string[]).map((x) => x.trim()).filter(Boolean))];
    const maxItems = o.maxItems ?? 30;
    const maxLen = o.maxLen ?? 300;
    if (clean.length > maxItems) this.problems.push(`${key} can have at most ${maxItems} items`);
    else if (clean.some((x) => x.length > maxLen)) this.problems.push(`${key} items must be at most ${maxLen} characters`);
    else this.put(key, o.as, clean);
    return this;
  }

  /** Object of string values, or "key: value" lines from a textarea. */
  record(key: string, o: { maxKeys?: number; maxLen?: number } = {}) {
    if (!has(this.b, key)) return this;
    const raw = this.b[key];
    let entries: [string, unknown][];
    if (typeof raw === "string") {
      entries = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
        const i = l.indexOf(":");
        return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : [l, ""];
      });
    } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      entries = Object.entries(raw as Body);
    } else {
      this.problems.push(`${key} must be an object`);
      return this;
    }
    const maxLen = o.maxLen ?? 200;
    if (entries.length > (o.maxKeys ?? 20)) this.problems.push(`${key} has too many entries`);
    else if (entries.some(([k, v]) => !/^[A-Za-z][A-Za-z0-9]{0,40}$/.test(k) || typeof v !== "string" || v.length > maxLen)) this.problems.push(`${key} must map short keys to strings (≤ ${maxLen} chars)`);
    else this.out[key] = Object.fromEntries(entries.filter(([, v]) => (v as string).trim()).map(([k, v]) => [k, (v as string).trim()]));
    return this;
  }

  int(key: string, o: { min: number; max: number; nullable?: boolean; required?: boolean }) {
    if (!has(this.b, key)) {
      if (o.required) this.problems.push(`${key} is required`);
      return this;
    }
    const raw = this.b[key];
    if (raw === null || raw === "") {
      if (o.nullable) this.out[key] = null;
      else this.problems.push(`${key} is required`);
      return this;
    }
    const n = typeof raw === "string" ? Number(raw) : raw;
    if (typeof n !== "number" || !Number.isInteger(n) || n < o.min || n > o.max) this.problems.push(`${key} must be an integer from ${o.min} to ${o.max}`);
    else this.out[key] = n;
    return this;
  }

  num(key: string, o: { min: number; max: number; nullable?: boolean; decimals?: number }) {
    if (!has(this.b, key)) return this;
    const raw = this.b[key];
    if (raw === null || raw === "") {
      if (o.nullable) this.out[key] = null;
      else this.problems.push(`${key} is required`);
      return this;
    }
    const n = typeof raw === "string" ? Number(raw) : raw;
    if (typeof n !== "number" || !Number.isFinite(n) || n < o.min || n > o.max) this.problems.push(`${key} must be a number from ${o.min} to ${o.max}`);
    else this.out[key] = o.decimals === undefined ? n : Math.round(n * 10 ** o.decimals) / 10 ** o.decimals;
    return this;
  }

  bool(key: string) {
    if (!has(this.b, key)) return this;
    const v = this.b[key];
    if (typeof v === "boolean") this.out[key] = v;
    else if (v === "on" || v === "true") this.out[key] = true;
    else if (v === "false" || v === "off") this.out[key] = false;
    else this.problems.push(`${key} must be boolean`);
    return this;
  }

  oneOf<T extends string>(key: string, allowed: readonly T[], o: { required?: boolean; nullable?: boolean } = {}) {
    if (!has(this.b, key)) {
      if (o.required) this.problems.push(`${key} is required`);
      return this;
    }
    const v = this.b[key];
    if ((v === null || v === "") && o.nullable) this.out[key] = null;
    else if (typeof v !== "string" || !(allowed as readonly string[]).includes(v)) this.problems.push(`${key} must be one of ${allowed.join(", ")}`);
    else this.out[key] = v;
    return this;
  }

  date(key: string, o: { nullable?: boolean; required?: boolean } = {}) {
    if (!has(this.b, key)) {
      if (o.required) this.problems.push(`${key} is required`);
      return this;
    }
    const v = this.b[key];
    if (v === null || v === "") {
      if (o.nullable) this.out[key] = null;
      else this.problems.push(`${key} is required`);
      return this;
    }
    const d = new Date(String(v));
    if (typeof v !== "string" || Number.isNaN(d.getTime()) || d.getUTCFullYear() < 2000 || d.getUTCFullYear() > 2100) this.problems.push(`${key} must be a valid date`);
    else this.out[key] = d;
    return this;
  }

  slug(key: string, o: { required?: boolean; product?: boolean } = {}) {
    if (!has(this.b, key)) {
      if (o.required) this.problems.push(`${key} is required`);
      return this;
    }
    const v = slugify(this.b[key]);
    const problem = o.product ? productSlugProblem(v) : isValidSlug(v) ? null : "invalid";
    if (problem) this.problems.push(`${key} is ${problem === "reserved" ? "reserved for a site route" : problem === "contains-vs" ? "not allowed to contain \"-vs-\"" : "invalid"}`);
    else this.out[key] = v;
    return this;
  }

  id(key: string, o: { required?: boolean; nullable?: boolean } = {}) {
    if (!has(this.b, key)) {
      if (o.required) this.problems.push(`${key} is required`);
      return this;
    }
    const v = this.b[key];
    if ((v === null || v === "") && o.nullable) this.out[key] = null;
    else if (typeof v !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(v)) this.problems.push(`${key} must be a valid id`);
    else this.out[key] = v;
    return this;
  }

  done<T>(): T {
    if (this.problems.length) throw new InputError(this.problems);
    return this.out as T;
  }
}

export const read = (b: unknown) => {
  if (!b || typeof b !== "object" || Array.isArray(b)) throw new InputError(["body must be a JSON object"]);
  return new Reader(b as Body);
};

/** FormData → plain object; repeated keys become arrays; checkboxes stay "on". */
export function formToObject(form: FormData): Body {
  const out: Body = {};
  for (const [k, v] of form.entries()) {
    if (typeof v !== "string" || k.startsWith("$ACTION")) continue;
    out[k] = k in out ? ([] as unknown[]).concat(out[k], v) : v;
  }
  return out;
}

// ---- Entity parsers ----

export type ProductInput = Partial<{
  slug: string; name: string; vendor: string | null; categoryId: string; subcategory: string | null; tagline: string; description: string;
  officialUrl: string; pricingUrl: string | null; features: string[]; comparison: Record<string, string>; alternativesIntro: string | null;
  seoTitle: string | null; seoDescription: string | null; refreshIntervalDays: number | null; status: (typeof CONTENT_STATUSES)[number]; tags: string[];
}>;

export type ReviewInput = Partial<{
  rating: number | null; editorialSummary: string | null; verdict: string | null; pros: string[]; cons: string[]; bestFor: string[]; limitations: string[];
  reviewStatus: (typeof REVIEW_STATUSES)[number]; reviewedBy: string | null; lastReviewedAt: Date | null;
}>;

export function parseProduct(b: unknown, create: boolean): { product: ProductInput; review: ReviewInput } {
  const product = read(b)
    .slug("slug", { required: create, product: true })
    .str("name", { max: 120, required: create })
    .str("vendor", { max: 120, nullable: true })
    .id("categoryId", { required: create })
    .str("subcategory", { max: 120, nullable: true })
    .str("tagline", { max: 300, required: create })
    .str("description", { max: 5000, required: create })
    .url("officialUrl", { required: create })
    .url("pricingUrl", { nullable: true })
    .list("features", { maxItems: 20, maxLen: 200 })
    .record("comparison")
    .str("alternativesIntro", { max: 3000, nullable: true })
    .str("seoTitle", { max: 70, nullable: true })
    .str("seoDescription", { max: 170, nullable: true })
    .int("refreshIntervalDays", { min: 1, max: 3650, nullable: true })
    .oneOf("status", CONTENT_STATUSES)
    .list("tags", { maxItems: 10, maxLen: 50 });
  const src = (b as Body).review && typeof (b as Body).review === "object" ? ((b as Body).review as Body) : (b as Body);
  const review = read(src)
    .num("rating", { min: 0, max: 5, nullable: true, decimals: 1 })
    .str("editorialSummary", { max: 5000, nullable: true })
    .str("verdict", { max: 1000, nullable: true })
    .list("pros", { maxItems: 12 })
    .list("cons", { maxItems: 12 })
    .list("bestFor", { maxItems: 8, maxLen: 120 })
    .list("limitations", { maxItems: 10 })
    .oneOf("reviewStatus", REVIEW_STATUSES)
    .str("reviewedBy", { max: 120, nullable: true })
    .date("lastReviewedAt", { nullable: true });
  // Report product and review problems together.
  const problems = [...product.problems, ...review.problems];
  if (problems.length) throw new InputError(problems);
  return { product: product.done<ProductInput>(), review: review.done<ReviewInput>() };
}

export type CategoryInput = Partial<{ name: string; slug: string; description: string | null; intro: string | null; seoTitle: string | null; seoDescription: string | null; sortOrder: number }>;
export const parseCategory = (b: unknown, create: boolean) =>
  read(b)
    .str("name", { max: 120, required: create })
    .slug("slug", { required: create })
    .str("description", { max: 500, nullable: true })
    .str("intro", { max: 5000, nullable: true })
    .str("seoTitle", { max: 70, nullable: true })
    .str("seoDescription", { max: 170, nullable: true })
    .int("sortOrder", { min: 0, max: 1000 })
    .done<CategoryInput>();

export type FaqInput = { question: string; answer: string; sortOrder?: number };
export const parseFaq = (b: unknown) => read(b).str("question", { max: 300, required: true }).str("answer", { max: 3000, required: true }).int("sortOrder", { min: 0, max: 1000 }).done<FaqInput>();

export type SnapshotInput = {
  summary: string; snapshotType?: (typeof SNAPSHOT_TYPES)[number]; plan?: string | null; price?: number | null; currency?: string | null;
  billingPeriod?: (typeof BILLING_PERIODS)[number] | null; sourceUrl?: string | null; sourceType?: (typeof PRICE_SOURCE_TYPES)[number]; capturedAt?: Date | null;
};
export function parseSnapshot(b: unknown): SnapshotInput {
  const s = read(b)
    .str("summary", { max: 2000, required: true })
    .oneOf("snapshotType", SNAPSHOT_TYPES)
    .str("plan", { max: 100, nullable: true })
    .num("price", { min: 0, max: 1_000_000, nullable: true, decimals: 2 })
    .str("currency", { max: 3, nullable: true })
    .oneOf("billingPeriod", BILLING_PERIODS, { nullable: true })
    .url("sourceUrl", { nullable: true })
    .oneOf("sourceType", PRICE_SOURCE_TYPES)
    .date("capturedAt", { nullable: true })
    .done<SnapshotInput>();
  if (s.currency) s.currency = s.currency.toUpperCase();
  const problems: string[] = [];
  if (s.currency && !/^[A-Z]{3}$/.test(s.currency)) problems.push("currency must be a 3-letter ISO code");
  if (typeof s.price === "number" && !s.currency) problems.push("a price needs a currency");
  if (typeof s.price === "number" && !s.sourceUrl) problems.push("a price needs the source URL it was verified against");
  if (problems.length) throw new InputError(problems);
  return s;
}

export type LinkInput = Partial<{ label: string; url: string; provider: string | null; active: boolean }>;
export const parseLink = (b: unknown, create: boolean) =>
  read(b).str("label", { max: 120, required: create }).url("url", { required: create, httpsOnly: true }).str("provider", { max: 120, nullable: true }).bool("active").done<LinkInput>();

export type AlternativeInput = Partial<{ alternativeId: string; rationale: string; keyDifference: string | null; sortOrder: number; active: boolean; useCaseId: string | null }>;
export const parseAlternative = (b: unknown, create: boolean) =>
  read(b)
    .id("alternativeId", { required: create })
    .str("rationale", { max: 1000, min: 30, required: create })
    .str("keyDifference", { max: 500, nullable: true })
    .int("sortOrder", { min: 0, max: 1000 })
    .bool("active")
    .id("useCaseId", { nullable: true })
    .done<AlternativeInput>();

export type PairInput = Partial<{ productAId: string; productBId: string; summary: string; chooseA: string; chooseB: string; highlights: string[]; active: boolean }>;
export const parsePair = (b: unknown, create: boolean) =>
  read(b)
    .id("productAId", { required: create })
    .id("productBId", { required: create })
    .str("summary", { max: 1500, min: 60, required: create })
    .str("chooseA", { max: 1000, min: 30, required: create })
    .str("chooseB", { max: 1000, min: 30, required: create })
    .list("highlights", { maxItems: 8, maxLen: 400 })
    .bool("active")
    .done<PairInput>();

export type UseCaseInput = Partial<{ slug: string; title: string; audience: string; intro: string; criteria: { name: string; description: string }[]; categoryId: string; status: (typeof CONTENT_STATUSES)[number]; seoTitle: string | null; seoDescription: string | null }>;
export function parseUseCase(b: unknown, create: boolean): UseCaseInput {
  const r = read(b)
    .slug("slug", { required: create })
    .str("title", { max: 150, required: create })
    .str("audience", { max: 120, required: create })
    .str("intro", { max: 5000, min: 150, required: create })
    .id("categoryId", { required: create })
    .oneOf("status", CONTENT_STATUSES)
    .str("seoTitle", { max: 70, nullable: true })
    .str("seoDescription", { max: 170, nullable: true });
  const raw = (b as Body).criteria;
  if (raw !== undefined) {
    const lines = typeof raw === "string" ? raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : null;
    const items = lines
      ? lines.map((l) => { const i = l.indexOf(":"); return i > 0 ? { name: l.slice(0, i).trim(), description: l.slice(i + 1).trim() } : { name: l, description: "" }; })
      : Array.isArray(raw) ? raw : null;
    if (!items || items.length > 10 || items.some((x) => !x || typeof x.name !== "string" || typeof x.description !== "string" || !x.name.trim() || !x.description.trim() || x.name.length > 80 || x.description.length > 400)) {
      r.problems.push("criteria must be 1–10 lines of \"Name: description\"");
    } else r.out.criteria = items.map((x) => ({ name: x.name.trim(), description: x.description.trim() }));
  }
  return r.done<UseCaseInput>();
}

export type UseCaseProductInput = Partial<{ productId: string; rationale: string; caveat: string | null; position: number; active: boolean }>;
export const parseUseCaseProduct = (b: unknown, create: boolean) =>
  read(b).id("productId", { required: create }).str("rationale", { max: 1500, min: 40, required: create }).str("caveat", { max: 800, nullable: true }).int("position", { min: 0, max: 1000 }).bool("active").done<UseCaseProductInput>();

export type SponsorInput = Partial<{ title: string; label: string; description: string | null; pageType: string; placement: string; priority: number; campaign: string | null; active: boolean; url: string | null; startsAt: Date | null; endsAt: Date | null }>;
export function parseSponsor(b: unknown, create: boolean): SponsorInput {
  const s = read(b)
    .str("title", { max: 120, required: create })
    .str("label", { max: 60 })
    .str("description", { max: 300, nullable: true })
    .oneOf("pageType", SPONSOR_PAGE_TYPES, { required: create })
    .oneOf("placement", SPONSOR_PLACEMENTS, { required: create })
    .int("priority", { min: 0, max: 100 })
    .str("campaign", { max: 120, nullable: true })
    .bool("active")
    .url("url", { nullable: true, httpsOnly: true })
    .date("startsAt", { nullable: true })
    .date("endsAt", { nullable: true })
    .done<SponsorInput>();
  if (s.startsAt && s.endsAt && s.startsAt > s.endsAt) throw new InputError(["startsAt must be before endsAt"]);
  if (s.label !== undefined && !/sponsored/i.test(s.label)) throw new InputError(["label must contain the word \"Sponsored\""]);
  if (s.pageType !== undefined && !isSponsorPageType(s.pageType)) throw new InputError(["invalid pageType"]);
  if (s.placement !== undefined && !isSponsorPlacement(s.placement)) throw new InputError(["invalid placement"]);
  return s;
}

export type ChangelogInput = { version: string; summary: string };
export const parseChangelog = (b: unknown) => read(b).str("version", { max: 60, required: true }).str("summary", { max: 2000, required: true }).done<ChangelogInput>();

export type RefreshInput = { reason: string; dueAt: Date };
export const parseRefresh = (b: unknown) => read(b).str("reason", { max: 500, required: true }).date("dueAt", { required: true }).done<RefreshInput>();
