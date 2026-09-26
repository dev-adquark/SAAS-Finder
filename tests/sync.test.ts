import assert from "node:assert/strict";
import test from "node:test";
import { classifyLink, discoverLinks, findPlanPrice, jsonLdOffers, normalizeUrl, validateItem } from "../lib/sync/extract";
import { dedupeKey, evaluateDiscovered, evaluatePage, type Claims } from "../lib/sync/diff";
import { crawlInput, PAGE_FUNCTION } from "../lib/sync/crawl-input";
import { isoWeekKey, nextScheduledRun, targetUrls } from "../lib/sync/run";
import { officialDomains } from "../lib/research/evidence";

const domains = officialDomains("acme", "https://acme.com/");
const filler = " Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(6);

function item(over: Record<string, unknown> = {}) {
  const text = `Acme pricing. Starter $12 per user/month, billed monthly. Pro $30 per user/month, billed monthly. Free plan available forever.${filler}`;
  return {
    requestUrl: "https://acme.com/pricing",
    loadedUrl: "https://acme.com/pricing",
    status: 200,
    title: "Pricing | Acme",
    description: "Acme is the work platform for small teams.",
    text,
    html: `<html><head><meta name="description" content="Acme is the work platform for small teams."></head><body><p>${text}</p></body></html>`,
    jsonLd: [],
    links: [],
    fetchedAt: "2026-09-28T04:10:00.000Z",
    ...over,
  };
}

function claims(over: Partial<Claims> = {}): Claims {
  return {
    productId: "p1",
    officialUrl: "https://acme.com/",
    pricingUrl: "https://acme.com/pricing",
    domains,
    known: new Set(["https://acme.com/", "https://acme.com/pricing"]),
    sources: [{ id: "s1", url: "https://acme.com/pricing", kind: "PRICING", name: "Acme pricing", status: "VERIFIED" }],
    facts: [{ id: "f1", key: "freePlan", value: "Free plan available", evidence: "Free plan available forever.", sourceUrl: "https://acme.com/pricing", status: "VERIFIED" }],
    plans: [
      { id: "pl1", plan: "Starter", price: 12, currency: "USD", billingPeriod: "MONTHLY", unit: "per user per month, billed monthly", perSeat: true, evidence: "Starter $12 per user/month, billed monthly.", sourceUrl: "https://acme.com/pricing" },
      { id: "pl2", plan: "Pro", price: 30, currency: "USD", billingPeriod: "MONTHLY", unit: "per user per month, billed monthly", perSeat: true, evidence: "Pro $30 per user/month, billed monthly.", sourceUrl: "https://acme.com/pricing" },
    ],
    ...over,
  };
}

test("validateItem: accepts a real page and rejects malformed, blocked, missing and off-domain results", () => {
  assert.equal(validateItem(item(), domains).status, "OK");
  assert.equal(validateItem(null, domains).status, "MALFORMED");
  assert.equal(validateItem({ text: "x" }, domains).status, "MALFORMED");
  assert.equal(validateItem(item({ status: 404 }), domains).status, "NOT_FOUND");
  assert.equal(validateItem(item({ status: 410 }), domains).status, "NOT_FOUND");
  assert.equal(validateItem(item({ status: 403 }), domains).status, "BLOCKED");
  assert.equal(validateItem(item({ status: 429 }), domains).status, "BLOCKED");
  assert.equal(validateItem(item({ status: 503 }), domains).status, "UNAVAILABLE");
  assert.equal(validateItem(item({ text: "Just a moment... verify you are human", html: "<html></html>", title: "Attention Required" }), domains).status, "BLOCKED");
  assert.equal(validateItem(item({ text: "", html: "<html></html>" }), domains).status, "MALFORMED");
  const off = validateItem(item({ loadedUrl: "https://evil.example/pricing" }), domains);
  assert.equal(off.status, "MALFORMED");
  assert.match(off.reason ?? "", /off the official domain/);
});

test("unchanged page re-confirms every claim and proposes nothing", () => {
  const o = evaluatePage(claims(), "https://acme.com/pricing", validateItem(item(), domains), null);
  assert.deepEqual(o.reverified, { sources: ["s1"], facts: ["f1"], plans: ["pl1", "pl2"] });
  assert.deepEqual(o.checked, { sources: 1, facts: 1, plans: 2 });
  assert.equal(o.proposals.length, 0);
});

test("changed price is proposed with a verbatim snippet and never re-confirmed", () => {
  const text = `Acme pricing. Starter $15 per user/month, billed monthly. Pro $30 per user/month, billed monthly. Free plan available forever.${filler}`;
  const o = evaluatePage(claims(), "https://acme.com/pricing", validateItem(item({ text, html: `<p>${text}</p>` }), domains), null);
  assert.deepEqual(o.reverified.plans, ["pl2"]);
  const p = o.proposals.find((x) => x.targetId === "pl1")!;
  assert.equal(p.kind, "PRICE_CHANGED");
  assert.equal(p.payload?.price, 15);
  assert.equal(p.payload?.billingPeriod, "MONTHLY");
  assert.ok(text.includes(p.evidence!), "evidence is cut from the page itself");
  assert.match(p.previousValue!, /\$12/);
  assert.match(p.newValue!, /\$15/);
});

test("removed plan is flagged, not deleted", () => {
  const text = `Acme pricing. Pro $30 per user/month, billed monthly. Free plan available forever.${filler}`;
  const o = evaluatePage(claims(), "https://acme.com/pricing", validateItem(item({ text, html: `<p>${text}</p>` }), domains), null);
  const p = o.proposals.find((x) => x.targetId === "pl1")!;
  assert.equal(p.kind, "PLAN_NOT_FOUND");
  assert.equal(p.payload, null);
});

test("blocked, failed or malformed pages change nothing and propose nothing", () => {
  for (const r of [item({ status: 403 }), item({ status: 500 }), item({ text: "", html: "" }), { nonsense: true }]) {
    const o = evaluatePage(claims(), "https://acme.com/pricing", validateItem(r, domains), null);
    assert.deepEqual(o.reverified, { sources: [], facts: [], plans: [] });
    assert.equal(o.proposals.length, 0);
  }
});

test("only an explicit 404/410 proposes that a source is gone", () => {
  const o = evaluatePage(claims(), "https://acme.com/pricing", validateItem(item({ status: 404 }), domains), null);
  assert.equal(o.proposals.length, 1);
  assert.equal(o.proposals[0].kind, "SOURCE_NOT_FOUND");
  assert.equal(o.proposals[0].targetId, "s1");
});

test("missing fact evidence is flagged; a changed official description is proposed with its own quote", () => {
  const text = `Acme pricing. Starter $12 per user/month, billed monthly. Pro $30 per user/month, billed monthly.${filler}`;
  const c = claims({ facts: [...claims().facts, { id: "f2", key: "officialDescription", value: "Acme is a to-do app.", evidence: "Acme is a to-do app.", sourceUrl: "https://acme.com/pricing", status: "VERIFIED" }] });
  const o = evaluatePage(c, "https://acme.com/pricing", validateItem(item({ text, html: `<meta name="description" content="Acme is the work platform for small teams."><p>${text}</p>` }), domains), null);
  assert.equal(o.proposals.find((x) => x.targetId === "f1")?.kind, "FACT_NOT_FOUND");
  const d = o.proposals.find((x) => x.targetId === "f2")!;
  assert.equal(d.kind, "FACT_CHANGED");
  assert.equal(d.newValue, "Acme is the work platform for small teams.");
});

test("findPlanPrice ignores other plans, contradicting periods and metered add-ons", () => {
  assert.equal(findPlanPrice("Starter, Pro and Enterprise plans $0.50 per AI request", "Starter", "USD", { otherPlans: ["Pro", "Enterprise"] }), null);
  assert.equal(findPlanPrice("Starter includes AI at $0.50 per AI request", "Starter", "USD"), null);
  assert.equal(findPlanPrice("Basic $15 /mo billed yearly", "Basic", "USD", { billingPeriod: "MONTHLY" }), null);
  assert.equal(findPlanPrice("Basic $15 /mo billed yearly", "Basic", "USD", { billingPeriod: "ANNUAL" })?.price, 15);
  assert.equal(findPlanPrice("Standard ₹1,200/user/month", "Standard", "INR")?.price, 1200);
  assert.equal(findPlanPrice("Standard ₹1,200/user/month", "Standard", "USD"), null, "never converts or mixes currencies");
  assert.equal(findPlanPrice("Team 29 EUR per month", "Team", "EUR")?.price, 29);
});

test("JSON-LD offers become new-plan proposals with a verbatim snippet; known plans are not re-proposed", () => {
  const ld = JSON.stringify({ "@type": "Product", name: "Acme", offers: [{ "@type": "Offer", name: "Starter", price: "12", priceCurrency: "USD" }, { "@type": "Offer", name: "Business", price: "55.00", priceCurrency: "USD" }] });
  const offers = jsonLdOffers([ld, "{not json"]);
  assert.deepEqual(offers.map((o) => [o.name, o.price, o.currency]), [["Starter", 12, "USD"], ["Business", 55, "USD"]]);
  assert.ok(offers.every((o) => ld.includes(o.snippet)));
  const o = evaluatePage(claims(), "https://acme.com/pricing", validateItem(item({ jsonLd: [ld], html: `${item().html}<script type="application/ld+json">${ld}</script>` }), domains), null);
  const np = o.proposals.filter((p) => p.kind === "NEW_PLAN");
  assert.equal(np.length, 1);
  assert.equal(np[0].payload?.plan, "Business");
  assert.equal(np[0].payload?.billingPeriod, null, "billing period is left for the editor to confirm");
});

test("link discovery: official domain only, classified, one per kind, never re-proposing known URLs", () => {
  assert.equal(classifyLink("https://acme.com/security"), "SECURITY");
  assert.equal(classifyLink("https://trust.acme.com/"), "SECURITY");
  assert.equal(classifyLink("https://docs.acme.com/api"), "DOCUMENTATION");
  assert.equal(classifyLink("https://help.acme.com/hc/en-us"), "HELP_CENTER");
  assert.equal(classifyLink("https://status.acme.com/"), "STATUS");
  assert.equal(classifyLink("https://acme.com/legal/privacy"), "PRIVACY");
  assert.equal(classifyLink("https://acme.com/terms-of-service"), "TERMS");
  assert.equal(classifyLink("https://acme.com/blog/post"), null);
  const found = discoverLinks(
    [{ href: "https://acme.com/security" }, { href: "https://acme.com/security/overview-long" }, { href: "https://evil.com/security" }, { href: "https://acme.com/pricing" }, { href: "https://acme.com/fr/privacy" }, { href: "https://acme.com/privacy" }, { href: "http://acme.com/terms" }, { href: "https://acme.com/changelog#top" }],
    domains, new Set(["https://acme.com/pricing"]),
  );
  assert.deepEqual(found.sort((a, b) => a.kind.localeCompare(b.kind)), [
    { kind: "CHANGELOG", url: "https://acme.com/changelog" },
    { kind: "PRIVACY", url: "https://acme.com/privacy" },
    { kind: "SECURITY", url: "https://acme.com/security" },
  ]);
  const ok = evaluateDiscovered(claims(), "SECURITY", validateItem(item({ requestUrl: "https://acme.com/security", loadedUrl: "https://acme.com/security", title: "Security at Acme" }), domains));
  assert.equal(ok?.kind, "NEW_SOURCE");
  assert.deepEqual(ok?.payload, { kind: "SECURITY", url: "https://acme.com/security", name: "Security at Acme" });
  assert.equal(evaluateDiscovered(claims(), "SECURITY", validateItem(item({ status: 404 }), domains)), null, "a link that does not load is never proposed");
});

test("dedupe key is stable for the same detection and differs for a different value", () => {
  const p = { kind: "PRICE_CHANGED" as const, field: "Pricing · Starter (monthly)", targetId: "pl1", newValue: "$15 per month", payload: null };
  assert.equal(dedupeKey(p), dedupeKey({ ...p }));
  assert.equal(dedupeKey(p), dedupeKey({ ...p, newValue: "  $15   PER month " }));
  assert.notEqual(dedupeKey(p), dedupeKey({ ...p, newValue: "$16 per month" }));
});

test("crawl input fetches exactly the listed official URLs with bounded retries and no link following", () => {
  const input = crawlInput(["https://acme.com/", "https://acme.com/", "https://acme.com/pricing"]);
  assert.deepEqual(input.startUrls, [{ url: "https://acme.com/" }, { url: "https://acme.com/pricing" }]);
  assert.equal(input.linkSelector, "");
  assert.equal(input.maxCrawlingDepth, 0);
  assert.equal(input.maxPagesPerCrawl, 2);
  assert.ok(input.maxRequestRetries <= 3 && input.maxConcurrency <= 5);
  // Shape required by apify/playwright-scraper's published input schema.
  assert.equal(typeof input.waitUntil, "string");
  assert.ok(["networkidle", "load", "domcontentloaded"].includes(input.waitUntil));
  assert.equal(input.launcher, "chromium");
  assert.deepEqual(input.proxyConfiguration, { useApifyProxy: true });
  assert.doesNotThrow(() => new Function(`return (${PAGE_FUNCTION})`)());
  assert.ok(!/token/i.test(JSON.stringify(input)), "no credentials in actor input");
});

test("target URLs: only official, verified or cited pages, deduplicated", () => {
  const c = claims({ sources: [...claims().sources, { id: "s2", url: "https://acme.com/security/", status: "VERIFIED", kind: "SECURITY", name: "Security" }, { id: "s3", url: "https://acme.com/draft", status: "NEEDS_VERIFICATION", kind: "PRODUCT", name: "Draft" }, { id: "s4", url: "https://review-site.com/acme", status: "VERIFIED", kind: "INDEPENDENT", name: "Review" }] });
  assert.deepEqual(targetUrls(c), ["https://acme.com/", "https://acme.com/pricing", "https://acme.com/security"]);
});

test("normalizeUrl and schedule helpers", () => {
  assert.equal(normalizeUrl("https://Acme.com/pricing/#plans"), "https://acme.com/pricing");
  assert.equal(normalizeUrl("https://acme.com/"), "https://acme.com/");
  assert.equal(isoWeekKey(new Date("2026-09-28T10:00:00Z")), "2026-W40");
  assert.equal(isoWeekKey(new Date("2027-01-01T10:00:00Z")), "2026-W53");
  const sat = new Date("2026-09-26T12:00:00Z");
  assert.equal(nextScheduledRun(sat, false).toISOString(), "2026-09-27T04:00:00.000Z", "not yet synced this week: next daily tick");
  assert.equal(nextScheduledRun(sat, true).toISOString(), "2026-09-28T04:00:00.000Z", "already synced: first tick of next ISO week (Monday)");
});

test("Apify client: token only in the Authorization header, retries 429/5xx, scrubs errors", async () => {
  const prev = { token: process.env.APIFY_API_TOKEN, fetch: globalThis.fetch };
  process.env.APIFY_API_TOKEN = "apify_api_SECRETSECRET123456";
  const calls: { url: string; auth: string | null }[] = [];
  let n = 0;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), auth: new Headers(init.headers).get("authorization") });
    n++;
    if (n === 1) return new Response(JSON.stringify({ error: { message: "rate limited" } }), { status: 429, headers: { "retry-after": "0" } });
    if (n === 2) return new Response(JSON.stringify({ data: { id: "run1", status: "RUNNING", defaultDatasetId: "ds1" } }), { status: 200 });
    return new Response(JSON.stringify({ error: { message: "bad token apify_api_SECRETSECRET123456" } }), { status: 401 });
  }) as typeof fetch;
  try {
    const { getRun, ApifyError } = await import("../lib/sync/apify");
    const r = await getRun("run1");
    assert.equal(r.id, "run1");
    assert.equal(calls.length, 2, "retried once after 429");
    assert.ok(calls.every((c) => c.auth === "Bearer apify_api_SECRETSECRET123456" && !c.url.includes("SECRET")));
    await assert.rejects(getRun("run2"), (e: unknown) => e instanceof ApifyError && !e.message.includes("SECRET") && e.message.includes("[redacted]"));
    assert.equal(calls.length, 3, "401 is not retried");
  } finally {
    globalThis.fetch = prev.fetch;
    if (prev.token === undefined) delete process.env.APIFY_API_TOKEN;
    else process.env.APIFY_API_TOKEN = prev.token;
  }
});
