// Evidence rules shared by the research import gate (scripts/import-research.ts) and the automated
// weekly sync (lib/sync). A claim counts as supported only when its verbatim quote appears on the
// official page — entity-decoded and whitespace-collapsed, never paraphrased or fuzzy-matched.

/** Vendors whose official pages live on a parent-company domain. */
export const EXTRA_DOMAINS: Record<string, string[]> = { trello: ["atlassian.com"], "adobe-express": ["adobe.com"], monday: ["monday.com"], figma: ["figma.com"] };

export const registrable = (host: string) => host.toLowerCase().replace(/^www\./, "").split(".").slice(-2).join(".");

export function officialDomains(slug: string, officialUrl: string): Set<string> {
  const out = new Set(EXTRA_DOMAINS[slug] ?? []);
  try {
    out.add(registrable(new URL(officialUrl).host));
  } catch {
    // An unparseable official URL yields no domain: nothing can be treated as official.
  }
  return out;
}

/** HTTPS URL on one of the vendor's own registrable domains. */
export function isOfficialUrl(url: string, domains: Set<string>): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && domains.has(registrable(u.host));
  } catch {
    return false;
  }
}

export const decode = (s: string) =>
  s
    .replace(/&nbsp;|&#160;| /g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/\\u002F/gi, "/")
    .replace(/\\"/g, '"');
/** Visible-text form: tags removed. */
export const norm = (s: string) => decode(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
/** Raw form: markup kept (for quotes taken from JSON-LD or attributes). */
export const normRaw = (s: string) => decode(s).replace(/\s+/g, " ").trim().toLowerCase();

export type PageIndex = { raw: string; text: string; inner: string };

/** Pre-normalizes a page once so many claims can be checked against it cheaply. */
export function indexPage(html: string, innerText = ""): PageIndex {
  return { raw: normRaw(html), text: norm(html), inner: innerText ? innerText.replace(/\s+/g, " ").trim().toLowerCase() : "" };
}

export const MIN_EVIDENCE_LENGTH = 6;

export function evidenceOnPage(page: PageIndex, evidence: string | null | undefined): boolean {
  if (!evidence || evidence.trim().length < MIN_EVIDENCE_LENGTH) return false;
  const e = normRaw(evidence);
  const eText = norm(evidence);
  if (!eText) return false;
  return page.raw.includes(e) || page.text.includes(eText) || page.raw.includes(eText) || (page.inner !== "" && page.inner.includes(eText));
}

/** The price number itself must appear inside its evidence quote. */
export function priceInEvidence(price: number, evidence: string): boolean {
  // Numbers are often split across tags (e.g. `117</span><span>.33`): strip tags, then whitespace.
  const e = decode(evidence).replace(/<[^>]*>/g, "").replace(/\s/g, "");
  const variants = new Set([String(price), price.toFixed(2), price.toLocaleString("en-US"), price.toLocaleString("en-US", { minimumFractionDigits: 2 }), price.toLocaleString("en-IN"), String(price).replace(".", ",")]);
  return [...variants].some((v) => e.includes(v));
}
