/* Verified-research import gate.
 *
 *   tsx scripts/import-research.ts <research-dir>
 *
 * Input: per product `<slug>.json` produced from official vendor pages, plus the raw HTML files
 * those pages were saved to. A claim is accepted only if:
 *   - its source URL is on the vendor's own domain(s),
 *   - its `evidence` quote appears verbatim in the saved page (entity-decoded, whitespace-collapsed),
 *   - for prices, the price number itself appears inside that evidence,
 *   - its fact key is on the allowlist.
 * Accepted data is written to lib/content/seed/research.ts; everything rejected is reported.
 */
import fs from "node:fs";
import path from "node:path";
import { seedProducts } from "../lib/content/seed/products";
import { EXTRA_DOMAINS, norm, normRaw, priceInEvidence, registrable } from "../lib/research/evidence";

export {};

const dir = process.argv[2];
if (!dir) throw new Error("usage: tsx scripts/import-research.ts <research-dir>");

const FACT_KEYS = new Set(["company", "founded", "headquarters", "officialDescription", "audience", "useCases", "integrations", "platforms", "mobileApps", "browser", "security", "support", "freePlan", "freeTrial", "billingOptions", "usageLimits"]);
const SOURCE_KINDS = new Set(["PRICING", "PRODUCT", "DOCUMENTATION", "HELP_CENTER", "SECURITY", "CHANGELOG", "NEWSROOM", "ABOUT", "CONTACT", "INTEGRATIONS", "STATUS"]);
const PERIODS = new Set(["MONTHLY", "ANNUAL", "FREE", "CUSTOM"]);
// Editorial exclusions after human review of flagged items (claim evidenced but unsuitable to publish).
const EXCLUSIONS: Record<string, { match: string; reason: string }[]> = {
  hubspot: [{ match: "fact:audience", reason: "evidence is a navigation label, not an audience statement" }],
  monday: [{ match: "plan:Pro:MONTHLY", reason: "JSON-LD price conflicts with the visible strikethrough total" }],
  trello: [{ match: "plan:Enterprise:ANNUAL", reason: "volume-dependent estimate for 50 users, not a list price" }],
};
const excluded = (slug: string, id: string) => EXCLUSIONS[slug]?.find((x) => x.match === id);

type Rejection = { slug: string; item: string; reason: string };
const rejected: Rejection[] = [];
const cache = new Map<string, { text: string; raw: string }>();

function page(file: string) {
  if (!cache.has(file)) {
    const html = fs.readFileSync(path.join(dir, file), "utf8");
    cache.set(file, { text: norm(html), raw: normRaw(html) });
  }
  return cache.get(file)!;
}

function evidenced(file: string | undefined, evidence: string | undefined): boolean {
  if (!file || !evidence || evidence.trim().length < 6) return false;
  try {
    const p = page(file);
    const e = normRaw(evidence);
    const eText = norm(evidence);
    return p.raw.includes(e) || p.text.includes(eText) || p.raw.includes(eText);
  } catch {
    return false;
  }
}

type Out = {
  checkedAt: string;
  sources: { kind: string; url: string; name: string }[];
  facts: { key: string; value: string; sourceUrl: string; evidence: string }[];
  pricing: { status: "verified" | "js_rendered" | "custom_only" | "unavailable"; sourceUrl: string | null; currencySeen: string | null; regionDependent: boolean; regionNote: string | null; plans: { plan: string; price: number | null; currency: string | null; billingPeriod: string; unit: string | null; perSeat: boolean; promotional: boolean; notes: string | null; evidence: string }[] };
};

const out: Record<string, Out> = {};
const summary: string[] = [];

for (const product of seedProducts) {
  const file = path.join(dir, `${product.slug}.json`);
  if (!fs.existsSync(file)) {
    rejected.push({ slug: product.slug, item: "research file", reason: "missing" });
    continue;
  }
  const r = JSON.parse(fs.readFileSync(file, "utf8"));
  const allowed = new Set([registrable(new URL(product.officialUrl).host), ...(EXTRA_DOMAINS[product.slug] ?? [])]);
  const official = (url: string) => {
    try {
      const u = new URL(url);
      return u.protocol === "https:" && allowed.has(registrable(u.host));
    } catch {
      return false;
    }
  };
  const fileFor = new Map<string, string>();
  const sources: Out["sources"] = [];
  for (const s of r.sources ?? []) {
    if (!SOURCE_KINDS.has(s.kind)) { rejected.push({ slug: product.slug, item: `source ${s.url}`, reason: `kind ${s.kind}` }); continue; }
    if (!official(s.url)) { rejected.push({ slug: product.slug, item: `source ${s.url}`, reason: "not an official vendor domain" }); continue; }
    if (s.httpStatus !== 200 || !s.file || !fs.existsSync(path.join(dir, s.file))) { rejected.push({ slug: product.slug, item: `source ${s.url}`, reason: "not fetched (HTTP/file)" }); continue; }
    if (sources.some((x) => x.url === s.url)) continue;
    fileFor.set(s.url, s.file);
    sources.push({ kind: s.kind, url: s.url, name: String(s.name).slice(0, 120) });
  }
  const facts: Out["facts"] = [];
  for (const f of r.facts ?? []) {
    const ex = excluded(product.slug, `fact:${f.key}`);
    if (ex) { rejected.push({ slug: product.slug, item: `fact ${f.key}`, reason: `editorial exclusion: ${ex.reason}` }); continue; }
    const reason = !FACT_KEYS.has(f.key) ? `key ${f.key} not allowed` : !official(f.sourceUrl) ? "source not official" : !evidenced(f.file ?? fileFor.get(f.sourceUrl), f.evidence) ? "evidence not found in saved page" : facts.some((x) => x.key === f.key) ? "duplicate key" : null;
    if (reason) { rejected.push({ slug: product.slug, item: `fact ${f.key}`, reason }); continue; }
    if (!sources.some((x) => x.url === f.sourceUrl)) { rejected.push({ slug: product.slug, item: `fact ${f.key}`, reason: "source not in accepted sources" }); continue; }
    facts.push({ key: f.key, value: String(f.value).slice(0, 300), sourceUrl: f.sourceUrl, evidence: String(f.evidence).slice(0, 300) });
  }
  const pr = r.pricing ?? {};
  const plans: Out["pricing"]["plans"] = [];
  const pricingFile = pr.file ?? fileFor.get(pr.sourceUrl);
  const pricingOfficial = pr.sourceUrl && official(pr.sourceUrl) && sources.some((x) => x.url === pr.sourceUrl);
  for (const pl of pr.plans ?? []) {
    const label = `plan ${pl.plan} ${pl.billingPeriod} ${pl.price}`;
    const ex = excluded(product.slug, `plan:${pl.plan}:${pl.billingPeriod}`);
    if (ex) { rejected.push({ slug: product.slug, item: label, reason: `editorial exclusion: ${ex.reason}` }); continue; }
    if (!pricingOfficial) { rejected.push({ slug: product.slug, item: label, reason: "pricing source not official/accepted" }); continue; }
    if (!PERIODS.has(pl.billingPeriod)) { rejected.push({ slug: product.slug, item: label, reason: "billing period" }); continue; }
    if (!evidenced(pricingFile, pl.evidence)) { rejected.push({ slug: product.slug, item: label, reason: "evidence not found in saved page" }); continue; }
    if (typeof pl.price === "number") {
      if (!(pl.price >= 0 && pl.price < 1_000_000)) { rejected.push({ slug: product.slug, item: label, reason: "price range" }); continue; }
      if (!pl.currency || !/^[A-Z]{3}$/.test(pl.currency)) { rejected.push({ slug: product.slug, item: label, reason: "currency" }); continue; }
      if (!priceInEvidence(pl.price, pl.evidence)) { rejected.push({ slug: product.slug, item: label, reason: "price number not in evidence" }); continue; }
    } else if (pl.billingPeriod !== "CUSTOM" && pl.billingPeriod !== "FREE") {
      rejected.push({ slug: product.slug, item: label, reason: "missing price" });
      continue;
    }
    if (plans.some((x) => x.plan === pl.plan && x.billingPeriod === pl.billingPeriod)) continue;
    plans.push({ plan: String(pl.plan).slice(0, 100), price: typeof pl.price === "number" ? pl.price : null, currency: typeof pl.price === "number" ? pl.currency : null, billingPeriod: pl.billingPeriod, unit: pl.unit ? String(pl.unit).slice(0, 120) : null, perSeat: pl.perSeat === true, promotional: pl.promotional === true, notes: pl.notes ? String(pl.notes).slice(0, 300) : null, evidence: String(pl.evidence).slice(0, 300) });
  }
  const status: Out["pricing"]["status"] = plans.length ? (plans.every((p) => p.billingPeriod === "CUSTOM") ? "custom_only" : "verified") : pr.status === "js_rendered" ? "js_rendered" : "unavailable";
  out[product.slug] = {
    checkedAt: /^\d{4}-\d{2}-\d{2}$/.test(r.checkedAt) ? r.checkedAt : new Date().toISOString().slice(0, 10),
    sources,
    facts,
    pricing: { status, sourceUrl: pricingOfficial ? pr.sourceUrl : null, currencySeen: plans.find((p) => p.currency)?.currency ?? null, regionDependent: pr.regionDependent === true, regionNote: pr.regionNote ? String(pr.regionNote).slice(0, 200) : null, plans },
  };
  summary.push(`${product.slug.padEnd(14)} pricing=${status.padEnd(12)} plans=${String(plans.length).padStart(2)} facts=${String(facts.length).padStart(2)} sources=${String(sources.length).padStart(2)}`);
}

const header = `// GENERATED by scripts/import-research.ts — do not edit by hand.
// Every item below was extracted from an official vendor page and accepted only because its
// verbatim evidence quote was found in the saved copy of that page on the check date.
import type { ResearchRecord } from "@/lib/content/seed/research-types";

export const research: Record<string, ResearchRecord> = `;
fs.writeFileSync(path.join(process.cwd(), "lib/content/seed/research.ts"), header + JSON.stringify(out, null, 2) + ";\n");
fs.writeFileSync(path.join(dir, "import-report.json"), JSON.stringify({ summary, rejected }, null, 2));
console.log(summary.join("\n"));
console.log(`\nrejected ${rejected.length} item(s); details in ${path.join(dir, "import-report.json")}`);
const byReason = rejected.reduce<Record<string, number>>((m, x) => ((m[x.reason] = (m[x.reason] ?? 0) + 1), m), {});
console.log(byReason);
