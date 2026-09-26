// Compares one crawled page with the product's existing verified claims. Pure: returns which claims
// the page re-confirms (verbatim evidence still present) and which differences need an editor.
import { createHash } from "node:crypto";
import type { PricePoint, SourceKind } from "@/lib/content/types";
import { evidenceOnPage, norm, priceInEvidence } from "@/lib/research/evidence";
import { priceWithUnit } from "@/lib/pricing";
import { discoverLinks, findPlanPrice, jsonLdOffers, normalizeUrl, type ItemResult } from "@/lib/sync/extract";

export type ChangeKind = "PRICE_CHANGED" | "NEW_PLAN" | "PLAN_NOT_FOUND" | "FACT_NOT_FOUND" | "FACT_CHANGED" | "NEW_SOURCE" | "SOURCE_NOT_FOUND" | "SOURCE_UPDATED";

export type ClaimSource = { id: string; url: string; kind: SourceKind; name: string; status: string };
export type ClaimFact = { id: string; key: string; value: string; evidence: string | null; sourceUrl: string | null; status: string };
export type ClaimPlan = { id: string; plan: string | null; price: number | null; currency: string | null; billingPeriod: string | null; unit: string | null; perSeat: boolean; evidence: string | null; sourceUrl: string | null };

export type Claims = {
  productId: string;
  officialUrl: string;
  pricingUrl: string | null;
  domains: Set<string>;
  sources: ClaimSource[];
  facts: ClaimFact[];
  plans: ClaimPlan[];
  /** Normalized URLs already known for this product (never re-proposed as discoveries). */
  known: Set<string>;
};

export type Proposal = {
  kind: ChangeKind;
  field: string;
  targetId: string | null;
  previousValue: string | null;
  newValue: string | null;
  sourceUrl: string;
  evidence: string | null;
  payload: Record<string, unknown> | null;
};

export type Outcome = {
  checked: { sources: number; facts: number; plans: number };
  reverified: { sources: string[]; facts: string[]; plans: string[] };
  proposals: Proposal[];
  discovered: { url: string; kind: SourceKind }[];
};

const PERIOD_LABEL: Record<string, string> = { MONTHLY: "monthly", ANNUAL: "annual", FREE: "free", ONE_TIME: "one-time", USAGE: "usage", CUSTOM: "custom" };
export const planField = (p: Pick<ClaimPlan, "plan" | "billingPeriod">) => `Pricing · ${p.plan ?? "General"}${p.billingPeriod ? ` (${PERIOD_LABEL[p.billingPeriod] ?? p.billingPeriod.toLowerCase()})` : ""}`;
const planText = (p: ClaimPlan) => priceWithUnit({ price: p.price, currency: p.currency, billingPeriod: p.billingPeriod as PricePoint["billingPeriod"], unit: p.unit });
const sourceField = (kind: string, url: string) => {
  try {
    const u = new URL(url);
    return `Source · ${kind} · ${u.host.replace(/^www\./, "")}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    return `Source · ${kind}`;
  }
};

export function dedupeKey(p: Pick<Proposal, "kind" | "field" | "targetId" | "newValue" | "payload">): string {
  const extra = p.payload && typeof p.payload.url === "string" ? p.payload.url : p.payload && typeof p.payload.hash === "string" ? p.payload.hash : "";
  return createHash("sha256").update([p.kind, p.targetId ?? "", p.field, norm(p.newValue ?? ""), extra].join("␟")).digest("hex").slice(0, 40);
}

const sameName = (a: string, b: string) => {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  return x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `) || x.startsWith(`${y} —`) || y.startsWith(`${x} —`);
};

/**
 * Phase-1 evaluation of a page we asked for because existing claims cite it.
 * `previousHash` is the content hash from the last successful fetch of this URL, if any.
 */
export function evaluatePage(claims: Claims, url: string, result: ItemResult, previousHash: string | null): Outcome {
  const key = normalizeUrl(url);
  const at = (u: string | null | undefined) => !!u && normalizeUrl(u) === key;
  const out: Outcome = { checked: { sources: 0, facts: 0, plans: 0 }, reverified: { sources: [], facts: [], plans: [] }, proposals: [], discovered: [] };
  const sources = claims.sources.filter((s) => s.status === "VERIFIED" && at(s.url));
  out.checked.sources = sources.length;

  if (result.status !== "OK" || !result.page) {
    // Only an explicit 404/410 is evidence that a page is gone. Blocks, timeouts and errors never are.
    if (result.status === "NOT_FOUND") {
      for (const s of sources) out.proposals.push({ kind: "SOURCE_NOT_FOUND", field: sourceField(s.kind, s.url), targetId: s.id, previousValue: `${s.name} (verified)`, newValue: `Official page returned ${result.reason ?? "not found"}`, sourceUrl: s.url, evidence: null, payload: { httpStatus: result.httpStatus } });
    }
    return out;
  }
  const page = result.page;
  out.reverified.sources = sources.map((s) => s.id);

  // Facts cite exactly one source page.
  for (const f of claims.facts) {
    if (f.status !== "VERIFIED" || !f.evidence || !at(f.sourceUrl)) continue;
    out.checked.facts++;
    if (evidenceOnPage(page.index, f.evidence)) {
      out.reverified.facts.push(f.id);
      continue;
    }
    const d = page.description;
    if (f.key === "officialDescription" && d && norm(d) !== norm(f.value) && evidenceOnPage(page.index, d)) {
      out.proposals.push({ kind: "FACT_CHANGED", field: `Fact · ${f.key}`, targetId: f.id, previousValue: f.value, newValue: d, sourceUrl: page.loadedUrl, evidence: d, payload: { key: f.key, value: d, sourceUrl: normalizeUrl(page.loadedUrl) } });
    } else {
      out.proposals.push({ kind: "FACT_NOT_FOUND", field: `Fact · ${f.key}`, targetId: f.id, previousValue: f.value, newValue: "Supporting quote no longer found on the source page", sourceUrl: f.sourceUrl!, evidence: null, payload: null });
    }
  }

  // Verified prices cite their pricing page (snapshot source, else the product's pricing URL).
  const plans = claims.plans.filter((p) => p.plan && at(p.sourceUrl ?? claims.pricingUrl));
  const isPricingPage = plans.length > 0 || at(claims.pricingUrl) || claims.sources.some((s) => s.kind === "PRICING" && at(s.url));
  const offers = isPricingPage ? jsonLdOffers(page.jsonLd) : [];
  for (const p of plans) {
    out.checked.plans++;
    const quoteOk = evidenceOnPage(page.index, p.evidence) && (p.price === null || priceInEvidence(p.price, p.evidence!));
    if (quoteOk) {
      out.reverified.plans.push(p.id);
      continue;
    }
    const otherPlans = claims.plans.map((x) => x.plan).filter((n): n is string => !!n && n !== p.plan);
    let candidate: { price: number; snippet: string } | null = p.price !== null && p.currency ? findPlanPrice(page.text, p.plan!, p.currency, { otherPlans, billingPeriod: p.billingPeriod }) : null;
    if (!candidate && p.currency) {
      const o = offers.find((x) => sameName(x.name, p.plan!) && x.currency === p.currency);
      if (o) candidate = { price: o.price, snippet: o.snippet };
    }
    if (candidate && evidenceOnPage(page.index, candidate.snippet)) {
      const next = { ...p, price: candidate.price };
      out.proposals.push({
        kind: "PRICE_CHANGED",
        field: planField(p),
        targetId: p.id,
        previousValue: planText(p),
        newValue: candidate.price === p.price ? `${planText(next)} (same price, new wording)` : planText(next),
        sourceUrl: page.loadedUrl,
        evidence: candidate.snippet,
        payload: { plan: p.plan, price: candidate.price, currency: p.currency, billingPeriod: p.billingPeriod, unit: p.unit, perSeat: p.perSeat, sourceUrl: normalizeUrl(page.loadedUrl) },
      });
    } else {
      out.proposals.push({ kind: "PLAN_NOT_FOUND", field: planField(p), targetId: p.id, previousValue: planText(p), newValue: "Plan or price no longer found on the pricing page", sourceUrl: p.sourceUrl ?? claims.pricingUrl ?? page.loadedUrl, evidence: null, payload: null });
    }
  }
  // Plans the vendor declares in its own structured data that we do not list yet.
  if (isPricingPage) {
    const verifiedNames = claims.plans.map((p) => p.plan).filter((n): n is string => !!n);
    for (const o of offers) {
      if (verifiedNames.some((n) => sameName(n, o.name))) continue;
      if (!evidenceOnPage(page.index, o.snippet)) continue;
      out.proposals.push({
        kind: "NEW_PLAN",
        field: `Pricing · ${o.name}`,
        targetId: null,
        previousValue: null,
        newValue: `${o.name}: ${priceWithUnit({ price: o.price, currency: o.currency, billingPeriod: null, unit: null })} (billing period to confirm)`,
        sourceUrl: page.loadedUrl,
        evidence: o.snippet,
        payload: { plan: o.name, price: o.price, currency: o.currency, billingPeriod: null, unit: null, perSeat: false, sourceUrl: normalizeUrl(page.loadedUrl) },
      });
    }
  }

  // Release notes / announcements: a content change is surfaced for review, not interpreted.
  for (const s of sources) {
    if ((s.kind === "CHANGELOG" || s.kind === "NEWSROOM") && previousHash && previousHash !== page.contentHash) {
      out.proposals.push({ kind: "SOURCE_UPDATED", field: sourceField(s.kind, s.url), targetId: s.id, previousValue: "Previously checked content", newValue: `New content published${page.title ? ` — ${page.title}` : ""}`, sourceUrl: s.url, evidence: null, payload: { hash: page.contentHash } });
    }
  }

  // Resource discovery only from the vendor's homepage and pricing page.
  if (at(claims.officialUrl) || at(claims.pricingUrl)) out.discovered = discoverLinks(page.links, claims.domains, claims.known);
  return out;
}

/** Phase-2 evaluation: a discovered link is proposed only if it actually loaded on the vendor's domain. */
export function evaluateDiscovered(claims: Claims, kind: SourceKind, result: ItemResult): Proposal | null {
  if (result.status !== "OK" || !result.page) return null;
  const url = normalizeUrl(result.page.loadedUrl);
  if (claims.known.has(url)) return null;
  const name = (result.page.title || kind.replace(/_/g, " ").toLowerCase()).replace(/\s+/g, " ").slice(0, 120);
  return { kind: "NEW_SOURCE", field: sourceField(kind, url), targetId: null, previousValue: null, newValue: `${name} — ${url}`, sourceUrl: url, evidence: result.page.title || null, payload: { kind, url, name } };
}
