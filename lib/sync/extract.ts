// Pure validation and extraction over one crawled page. Nothing here guesses: every extracted value
// carries a verbatim snippet cut from the fetched page itself.
import { createHash } from "node:crypto";
import type { SourceKind } from "@/lib/content/types";
import { indexPage, isOfficialUrl, type PageIndex } from "@/lib/research/evidence";

export type PageStatus = "OK" | "UNAVAILABLE" | "BLOCKED" | "NOT_FOUND" | "MALFORMED";

export type CrawledPage = {
  requestUrl: string;
  loadedUrl: string;
  httpStatus: number | null;
  title: string;
  description: string | null;
  text: string;
  html: string;
  jsonLd: string[];
  links: { href: string; text: string }[];
  fetchedAt: Date;
  contentHash: string;
  index: PageIndex;
};

export type ItemResult = { requestUrl: string | null; status: PageStatus; reason: string | null; httpStatus: number | null; page: CrawledPage | null };

/** Canonical key used to match crawl results to the URLs we asked for. */
export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    u.hostname = u.hostname.toLowerCase();
    let s = u.toString();
    if (u.pathname !== "/" && s.endsWith("/") && !u.search) s = s.slice(0, -1);
    return s;
  } catch {
    return raw.trim();
  }
}

const BLOCK_MARKERS = /(captcha|verify you are (a )?human|are you a robot|access denied|attention required|just a moment\.\.\.|request blocked|unusual traffic|pardon our interruption|enable javascript and cookies)/i;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** Validates one raw dataset item. Anything malformed, blocked or empty is never used as data. */
export function validateItem(raw: unknown, domains: Set<string>): ItemResult {
  if (!raw || typeof raw !== "object") return { requestUrl: null, status: "MALFORMED", reason: "Result is not an object", httpStatus: null, page: null };
  const r = raw as Record<string, unknown>;
  const requestUrl = typeof r.requestUrl === "string" ? r.requestUrl : typeof r.url === "string" ? r.url : null;
  if (!requestUrl) return { requestUrl: null, status: "MALFORMED", reason: "Result has no request URL", httpStatus: null, page: null };
  const httpStatus = typeof r.status === "number" && Number.isFinite(r.status) ? r.status : null;
  const fail = (status: PageStatus, reason: string): ItemResult => ({ requestUrl, status, reason, httpStatus, page: null });
  if (httpStatus === 404 || httpStatus === 410) return fail("NOT_FOUND", `HTTP ${httpStatus}`);
  if (httpStatus === 401 || httpStatus === 403 || httpStatus === 429) return fail("BLOCKED", `HTTP ${httpStatus}`);
  if (httpStatus !== null && httpStatus >= 500) return fail("UNAVAILABLE", `HTTP ${httpStatus}`);
  if (httpStatus !== null && (httpStatus < 200 || httpStatus >= 400)) return fail("UNAVAILABLE", `HTTP ${httpStatus}`);
  const loadedUrl = typeof r.loadedUrl === "string" && r.loadedUrl ? r.loadedUrl : requestUrl;
  if (!isOfficialUrl(loadedUrl, domains)) return fail("MALFORMED", `Redirected off the official domain (${safeHost(loadedUrl)})`);
  const text = str(r.text, 400_000);
  const html = str(r.html, 3_000_000);
  if (text.trim().length < 200 && BLOCK_MARKERS.test(text + " " + str(r.title, 300))) return fail("BLOCKED", "Anti-bot or captcha page returned");
  if (text.trim().length < 80 && html.length < 2_000) return fail("MALFORMED", "Empty or truncated page");
  const jsonLd = Array.isArray(r.jsonLd) ? r.jsonLd.filter((x): x is string => typeof x === "string").slice(0, 30) : [];
  const links = Array.isArray(r.links)
    ? r.links.filter((l): l is { href: string; text?: string } => !!l && typeof (l as { href?: unknown }).href === "string").slice(0, 1500).map((l) => ({ href: l.href, text: typeof l.text === "string" ? l.text.slice(0, 120) : "" }))
    : [];
  const fetched = typeof r.fetchedAt === "string" ? new Date(r.fetchedAt) : new Date();
  const normalizedText = text.replace(/\s+/g, " ").trim();
  return {
    requestUrl,
    status: "OK",
    reason: null,
    httpStatus,
    page: {
      requestUrl,
      loadedUrl,
      httpStatus,
      title: str(r.title, 300).trim(),
      description: typeof r.description === "string" ? r.description.slice(0, 1000).trim() || null : null,
      text,
      html,
      jsonLd,
      links,
      fetchedAt: Number.isNaN(fetched.getTime()) ? new Date() : fetched,
      contentHash: createHash("sha256").update(normalizedText).digest("hex"),
      index: indexPage(html + "\n" + jsonLd.join("\n"), text),
    },
  };
}

function safeHost(u: string) {
  try {
    return new URL(u).host;
  } catch {
    return "invalid URL";
  }
}

// ---------------- Official link discovery ----------------

const LINK_RULES: [SourceKind, RegExp][] = [
  ["PRICING", /\/(pricing|plans|prices)(\/|$)/],
  ["SECURITY", /(^|\.)(trust|security)\.|\/(security|trust|trust-center|compliance)(\/|$)/],
  ["PRIVACY", /\/(privacy|privacy-policy|legal\/privacy)(\/|$|[-_.])/],
  ["TERMS", /\/(terms|terms-of-service|terms-of-use|tos|legal\/terms)(\/|$|[-_.])/],
  ["DOCUMENTATION", /(^|\.)(docs|developers?|dev)\.|\/(docs|documentation|developers?|api|api-docs)(\/|$)/],
  ["HELP_CENTER", /(^|\.)(help|support|knowledge|kb)\.|\/(help|support|help-center|knowledge-base)(\/|$)/],
  ["CHANGELOG", /\/(changelog|release-notes|releases|whats-new|what-s-new|updates)(\/|$)/],
  ["INTEGRATIONS", /\/(integrations|apps|marketplace|app-marketplace)(\/|$)/],
  ["STATUS", /(^|\.)status\./],
];

export function classifyLink(url: string): SourceKind | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  // Host rules ("docs.", "status.") and path rules ("/pricing") both match against host + path.
  const hostPath = `${u.hostname.toLowerCase()}${u.pathname.toLowerCase()}`;
  return LINK_RULES.find(([, re]) => re.test(hostPath))?.[0] ?? null;
}

/** Candidate official resource links found on a page: same vendor domain, one per kind, never guessed. */
export function discoverLinks(links: { href: string }[], domains: Set<string>, known: Set<string>, max = 8): { url: string; kind: SourceKind }[] {
  const best = new Map<SourceKind, string>();
  for (const l of links) {
    if (!isOfficialUrl(l.href, domains)) continue;
    const url = normalizeUrl(l.href.split("#")[0]);
    if (known.has(url)) continue;
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      continue;
    }
    if (u.search || /\.(pdf|zip|png|jpe?g|svg|mp4)$/i.test(u.pathname)) continue;
    // Locale-prefixed duplicates ("/fr/pricing") are skipped in favour of the default page.
    if (/^\/[a-z]{2}(-[a-z]{2})?\//i.test(u.pathname) && !/^\/(en|en-us)\//i.test(u.pathname)) continue;
    const kind = classifyLink(url);
    if (!kind) continue;
    const current = best.get(kind);
    if (!current || url.length < current.length) best.set(kind, url);
  }
  return [...best.entries()].slice(0, max).map(([kind, url]) => ({ kind, url }));
}

// ---------------- Pricing extraction ----------------

const SYMBOLS: [RegExp, string][] = [[/^US\$$/, "USD"], [/^A\$$/, "AUD"], [/^C\$$/, "CAD"], [/^R\$$/, "BRL"], [/^\$$/, "USD"], [/^€$/, "EUR"], [/^£$/, "GBP"], [/^₹$/, "INR"], [/^¥$/, "JPY"]];
const AMOUNT = /(US\$|A\$|C\$|R\$|\$|€|£|₹|¥)\s?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)|(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\s?(USD|EUR|GBP|INR|JPY|AUD|CAD|BRL)\b/g;

export type Amount = { price: number; currency: string; index: number; end: number };

export function amountsIn(text: string): Amount[] {
  const out: Amount[] = [];
  for (const m of text.matchAll(AMOUNT)) {
    const sym = m[1];
    const currency = sym ? SYMBOLS.find(([re]) => re.test(sym))?.[1] : m[4];
    const num = Number((m[2] ?? m[3]).replace(/,/g, ""));
    if (currency && Number.isFinite(num)) out.push({ price: num, currency, index: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
  }
  return out;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Nearest price in the plan's currency after an occurrence of the plan name, with a verbatim snippet
 * from plan name to price. Returns null when the plan or a same-currency price cannot be located.
 */
const MONTHLY_WORDS = /\b(billed|paid|pay) monthly\b|\bmonthly billing\b|\bmonth-to-month\b/i;
const ANNUAL_WORDS = /\b(billed|paid|pay) (annually|yearly)\b|\bannual billing\b|\bper year\b|\/yr\b|\byearly billing\b/i;
// Amounts that are metered add-ons rather than plan prices.
const NON_PLAN_UNIT = /^\s*(\/\s*)?(per|\/)\s*(ai |extra |additional )?(request|credit|contact|1,000|1000|message|minute|token|report|add-?on|gb|sms|email)/i;

/**
 * Nearest price in the plan's currency after an occurrence of the plan name, with a verbatim snippet
 * from plan name to price. A candidate is discarded when another plan's name sits between the name and
 * the amount, when the surrounding wording states the opposite billing period, or when the amount is a
 * metered add-on (e.g. "per AI request"). Returns null when nothing trustworthy is found.
 */
export function findPlanPrice(text: string, planName: string, currency: string, opts: { otherPlans?: string[]; billingPeriod?: string | null; window?: number } = {}): { price: number; snippet: string } | null {
  const window = opts.window ?? 220;
  const flat = text.replace(/\s+/g, " ");
  const re = new RegExp(`(^|[^A-Za-z0-9])(${escapeRe(planName.trim())})(?=$|[^A-Za-z0-9])`, "gi");
  const others = (opts.otherPlans ?? []).map((n) => n.trim()).filter((n) => n && n.toLowerCase() !== planName.trim().toLowerCase());
  const otherRe = others.length ? new RegExp(`(^|[^A-Za-z0-9])(${others.map(escapeRe).join("|")})(?=$|[^A-Za-z0-9])`, "i") : null;
  let best: { price: number; snippet: string; dist: number } | null = null;
  for (const m of flat.matchAll(re)) {
    const start = (m.index ?? 0) + m[1].length;
    const slice = flat.slice(start, start + window);
    for (const hit of amountsIn(slice)) {
      if (hit.currency !== currency) continue;
      const between = slice.slice(planName.length, hit.index);
      if (otherRe?.test(between)) break; // the amount belongs to a different plan
      const after = slice.slice(hit.end, hit.end + 60);
      if (NON_PLAN_UNIT.test(after)) continue;
      const context = slice.slice(0, Math.min(slice.length, hit.end + 60));
      if (opts.billingPeriod === "MONTHLY" && ANNUAL_WORDS.test(context) && !MONTHLY_WORDS.test(context)) break;
      if (opts.billingPeriod === "ANNUAL" && MONTHLY_WORDS.test(context) && !ANNUAL_WORDS.test(context)) break;
      if (!best || hit.index < best.dist) best = { price: hit.price, snippet: flat.slice(start, Math.min(start + hit.end + 30, start + 300)).trim(), dist: hit.index };
      break;
    }
  }
  return best ? { price: best.price, snippet: best.snippet } : null;
}

export type Offer = { name: string; price: number; currency: string; snippet: string };

/** Offers declared in the page's own JSON-LD (Product / SoftwareApplication / Offer). */
export function jsonLdOffers(scripts: string[]): Offer[] {
  const out: Offer[] = [];
  const visit = (node: unknown, raw: string) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach((n) => visit(n, raw));
    const o = node as Record<string, unknown>;
    const types = ([] as unknown[]).concat(o["@type"] ?? []).map(String);
    if (types.includes("Offer") && typeof o.name === "string" && o.name.trim() && o.priceCurrency && o.price !== undefined) {
      const price = Number(String(o.price).replace(/,/g, ""));
      const currency = String(o.priceCurrency).toUpperCase();
      const at = raw.indexOf(JSON.stringify(o.name).slice(1, -1));
      if (Number.isFinite(price) && /^[A-Z]{3}$/.test(currency) && at >= 0) {
        out.push({ name: o.name.trim().slice(0, 100), price, currency, snippet: raw.slice(Math.max(0, at - 10), at + 190).trim() });
      }
    }
    for (const v of Object.values(o)) if (v && typeof v === "object") visit(v, raw);
  };
  for (const raw of scripts) {
    try {
      visit(JSON.parse(raw), raw);
    } catch {
      // Invalid JSON-LD is ignored, never repaired or guessed.
    }
  }
  const seen = new Set<string>();
  return out.filter((o) => {
    const k = `${o.name.toLowerCase()}|${o.price}|${o.currency}`;
    return seen.has(k) ? false : (seen.add(k), true);
  });
}
