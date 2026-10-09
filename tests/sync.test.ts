import assert from "node:assert/strict";
import test from "node:test";
import { classifyLink, discoverLinks, findPlanPrice, jsonLdOffers, normalizeUrl, validateItem } from "../lib/sync/extract";
import { dedupeKey, evaluateDiscovered, evaluatePage, type Claims } from "../lib/sync/diff";
import { crawlInput, PAGE_FUNCTION } from "../lib/sync/crawl-input";
import { autoApplicable, cycleKey, cycleStart, nextScheduledRun, targetUrls } from "../lib/sync/run";
import { budgetOk, checkRequestInput, checkToken, DEFAULT_BUDGET } from "../lib/sync/preflight";
import { claimOutboundCall, runAsTrigger } from "../lib/sync/trigger-guard";
import { autoFill, changedFields, g2Actor, g2Input, matchListing, mergeField, normalizeDomain, normalizeName, parseG2Item, type CatalogEntry } from "../lib/sync/g2";
import { apifyActor } from "../lib/sync/apify";
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
});

test("31-day schedule: fixed cycles, one key per cycle, next run at the next cycle's first tick", () => {
  const sat = new Date("2026-09-26T12:00:00Z");
  assert.equal(cycleKey(sat), "cycle-2026-09-06");
  assert.equal(cycleKey(new Date("2026-09-06T00:00:00Z")), "cycle-2026-09-06", "cycle start belongs to its own cycle");
  assert.equal(cycleKey(new Date("2026-10-06T23:59:59Z")), "cycle-2026-09-06");
  assert.equal(cycleKey(new Date("2026-10-07T00:00:00Z")), "cycle-2026-10-07", "exactly 31 days later a new cycle starts");
  assert.equal(cycleKey(new Date("2026-01-01T00:00:00Z")), "cycle-2026-01-01");
  assert.equal(cycleKey(new Date("2025-12-31T00:00:00Z")), "cycle-2025-12-01", "dates before the anchor still map to 31-day cycles");
  assert.equal((new Date("2026-10-07").getTime() - cycleStart(sat).getTime()) / 86_400_000, 31);
  assert.equal(nextScheduledRun(sat, false).toISOString(), "2026-09-27T04:00:00.000Z", "not yet synced this cycle: next daily tick");
  assert.equal(nextScheduledRun(sat, true).toISOString(), "2026-10-07T04:00:00.000Z", "already synced: first tick of the next 31-day cycle");
  assert.equal(nextScheduledRun(new Date("2026-09-27T03:00:00Z"), false).toISOString(), "2026-09-27T04:00:00.000Z", "same-day tick still ahead");
});

test("auto-apply policy: complete updates apply now, removals need a second run, unknown billing periods wait", () => {
  assert.equal(autoApplicable("PRICE_CHANGED", { billingPeriod: "MONTHLY" }, false), true);
  assert.equal(autoApplicable("PRICE_CHANGED", { billingPeriod: null }, true), false);
  assert.equal(autoApplicable("NEW_PLAN", { billingPeriod: null }, true), false, "a plan without a stated billing period is never published");
  assert.equal(autoApplicable("NEW_PLAN", { billingPeriod: "ANNUAL" }, false), true);
  for (const k of ["FACT_CHANGED", "NEW_SOURCE", "SOURCE_UPDATED"]) assert.equal(autoApplicable(k, {}, false), true, k);
  for (const k of ["FACT_NOT_FOUND", "PLAN_NOT_FOUND", "SOURCE_NOT_FOUND"]) {
    assert.equal(autoApplicable(k, {}, false), false, `${k} first sighting`);
    assert.equal(autoApplicable(k, {}, true), true, `${k} confirmed by a second run`);
  }
  assert.equal(autoApplicable("SOMETHING_ELSE", {}, true), false);
});

// Shapes captured from real memo23~g2-scraper output.
const g2Search = {
  scrapedAt: "2026-09-30T12:01:44.077Z", itemType: "Software", resultRank: 1, foundVia: "g2", isSponsored: false, pricingType: null, productName: "Wrike", productId: 1382,
  productUrl: "https://www.g2.com/products/wrike/reviews", reviewsUrl: "https://www.g2.com/products/wrike/reviews", thumbImageUrl: "https://images.g2crowd.com/uploads/product/image/x/wrike.png",
  descriptionSnippet: "Wrike is a collaborative work management platform.", vendorName: "Wrike, Inc.", ratingOutOfFive: 0, ratingOutOfTen: 0, reviewCount: 0,
  relatedCategories: ["Project Management", "Work Management"], companyDomain: "wrike.com", companyWebsite: "https://wrike.com",
};

test("G2 records: validated and normalized; zero ratings, sponsored and junk rows handled; review text dropped", () => {
  const l = parseG2Item(g2Search);
  assert.ok(l.ok && l.record.kind === "listing");
  if (l.ok && l.record.kind === "listing") {
    assert.equal(l.record.g2Slug, "wrike");
    assert.equal(l.record.rating, null, "0 rating with 0 reviews is missing data, not a rating");
    assert.equal(l.record.reviewCount, null);
    assert.equal(l.record.companyDomain, "wrike.com");
    assert.deepEqual(l.record.categories, ["Project Management", "Work Management"]);
  }
  const rated = parseG2Item({ ...g2Search, ratingOutOfFive: 4.26, reviewCount: 4538 });
  assert.ok(rated.ok && rated.record.kind === "listing" && rated.record.rating === 4.3 && rated.record.reviewCount === 4538);
  const tenOnly = parseG2Item({ ...g2Search, ratingOutOfFive: null, ratingOutOfTen: 8.4, reviewCount: 10 });
  assert.ok(tenOnly.ok && tenOnly.record.kind === "listing" && tenOnly.record.rating === 4.2, "10-point scale converted");

  const five = parseG2Item({ type: "review_summary", productSlug: "asana", aggregateRating: 4.4, totalReviews: 13994 });
  assert.ok(five.ok && five.record.kind === "review_summary" && five.record.data.rating === 4.4, "a value up to 5 is on the 5-point scale (real Asana record)");
  const summary = parseG2Item({ type: "review_summary", productSlug: "wrike", pros: [{ label: "Ease of Use", mentions: 400 }, { bogus: 1 }], cons: [{ label: "Learning Curve", mentions: 364 }], aggregateRating: 8.4, totalReviews: 4538, dataAsOf: "2026-09-30T08:38:59.137Z" });
  assert.ok(summary.ok && summary.record.kind === "review_summary");
  if (summary.ok && summary.record.kind === "review_summary") {
    assert.equal(summary.record.data.rating, 4.2, "a value above 5 is out of 10 (real Wrike record)");
    assert.deepEqual(summary.record.data.pros, [{ label: "Ease of Use", mentions: 400 }]);
  }
  const pricing = parseG2Item({ type: "pricing", productSlug: "wrike", tiers: [], priceMin: 0, priceMax: 0, currency: "USD", status: "SUCCEEDED", companyDomain: "wrike.com", faqs: [{ question: "Q?", answer: "A." }] });
  assert.ok(pricing.ok && pricing.record.kind === "pricing" && pricing.record.data.priceMin === null, "0/0 without tiers is unknown, not free");
  assert.equal(parseG2Item({ type: "pricing", productSlug: "wrike", status: "FAILED" }).ok, false);

  const numericId = parseG2Item({ type: "review", review_id: 13660168, review_title: "Excellent", review_rating: 4.5, product_slug: "asana", review_link: "https://www.g2.com/products/asana/reviews/asana-review-13660168" });
  assert.ok(numericId.ok && numericId.record.kind === "review" && numericId.record.data.id === "13660168", "real G2 review ids are numbers");
  assert.equal(parseG2Item({ ...g2Search, itemType: "Provider" }).ok, false, "vendor (Provider) rows are not product listings");
  const review = parseG2Item({ type: "review", review_id: "1", review_title: "Great", review_content: "Long copyrighted text", review_rating: 5, product_slug: "wrike", review_link: "https://www.g2.com/products/wrike/reviews/wrike-review-1", reviewer: { business_size: "Mid-Market" } });
  assert.ok(review.ok && review.record.kind === "review");
  assert.ok(!JSON.stringify(review).includes("copyrighted"), "review text is never stored");

  const comp = parseG2Item({ type: "competitor", sourceProductSlug: "wrike", competitorRank: 1, productName: "ClickUp", productSlug: "clickup", productUrl: "https://www.g2.com/products/clickup/reviews", descriptionSnippet: "By ClickUp", ratingOutOfFive: 4.6, reviewCount: 14467, companyDomain: "clickup.com", companyWebsite: "https://clickup.com" });
  assert.ok(comp.ok && comp.record.kind === "competitor" && comp.record.listing.description === null, "'By <vendor>' is not a description");
  assert.equal(parseG2Item({ type: "competitor", sourceProductSlug: "wrike", productName: "Wrike", productSlug: "wrike" }).ok, false, "self-competitor rejected");

  for (const bad of [null, "x", [], { type: "review" }, { productName: "No slug" }, { ...g2Search, productUrl: "https://evil.example/products/x", reviewsUrl: "https://evil.example/x" }, { type: "mystery", productSlug: "x" }]) {
    assert.equal(parseG2Item(bad).ok, false, JSON.stringify(bad));
  }
});

test("G2 matching: G2 link, then official domain, then exact name — never fuzzy, never across domains", () => {
  const cat = (over: Partial<CatalogEntry>): CatalogEntry => ({ id: "x", slug: "x", name: "X", vendor: null, domains: new Set(), g2Slug: null, ...over });
  const catalog = [
    cat({ id: "wrike", slug: "wrike", name: "Wrike", domains: new Set(["wrike.com"]) }),
    cat({ id: "slack", slug: "slack", name: "Slack", vendor: "Salesforce", domains: new Set(["slack.com"]) }),
    cat({ id: "hub", slug: "hubspot", name: "HubSpot", domains: new Set(["hubspot.com"]), g2Slug: "hubspot-crm" }),
    cat({ id: "z1", slug: "zoho-crm", name: "Zoho CRM", domains: new Set(["zoho.com"]) }),
    cat({ id: "z2", slug: "zoho-books", name: "Zoho Books", domains: new Set(["zoho.com"]) }),
  ];
  const L = (o: Record<string, unknown>) => ({ g2Slug: "q", name: "Q", vendorName: null, companyDomain: null, ...o });
  assert.deepEqual(matchListing(L({ g2Slug: "hubspot-crm", name: "Totally different" }), catalog), { productId: "hub", by: "g2Slug" });
  assert.deepEqual(matchListing(L({ g2Slug: "slack-tech", name: "Slack by Salesforce", companyDomain: "slack.com" }), catalog), { productId: "slack", by: "domain" }, "name variants resolve via official domain");
  assert.equal(matchListing(L({ name: "Writesonic", companyDomain: "writesonic.com" }), catalog), null, "fuzzy search noise never matches");
  assert.equal(matchListing(L({ name: "Wrike", companyDomain: "wrike-clone.io" }), catalog), null, "same name on another domain is a different product");
  assert.deepEqual(matchListing(L({ name: "Zoho CRM", companyDomain: "zoho.com" }), catalog), { productId: "z1", by: "domain" }, "shared vendor domain disambiguated by exact name");
  assert.equal(matchListing(L({ name: "Zoho Desk", companyDomain: "zoho.com" }), catalog), null, "ambiguous shared domain never guesses");
  assert.deepEqual(matchListing(L({ name: "WRIKE, Inc.", companyDomain: null }), catalog), { productId: "wrike", by: "name" }, "exact normalized name when G2 gives no domain");
  assert.equal(normalizeName("Slack Technologies, LLC"), "slack");
  assert.equal(normalizeDomain("https://www.Wrike.com/pricing"), "wrike.com");
  assert.equal(normalizeDomain("not a domain"), null);
});

test("G2 change detection and merge: exact changed fields; missing data never blanks a value", () => {
  assert.deepEqual(changedFields({ rating: 4.2, reviewCount: 10, categories: ["A"] }, { rating: 4.2, reviewCount: 11, categories: ["A"] }), ["reviewCount"]);
  assert.deepEqual(changedFields({ pricing: { b: 1, a: 2 } }, { pricing: { a: 2, b: 1 } }), [], "key order is not a change");
  assert.deepEqual(changedFields(null, { name: "X", rating: null }).sort(), ["name", "rating"]);
  assert.equal(mergeField(4.2, null), 4.2);
  assert.equal(mergeField(4.2, undefined), 4.2);
  assert.equal(mergeField(4.2, 4.4), 4.4);
  assert.deepEqual(mergeField(["A"], []), ["A"], "empty list keeps existing");
  assert.deepEqual(autoFill({ vendor: null }, { vendorName: "Wrike, Inc." }), { vendor: "Wrike, Inc." });
  assert.deepEqual(autoFill({ vendor: "Wrike" }, { vendorName: "Wrike, Inc." }), {}, "editor value is never replaced");
});

test("G2 actor input and actor ids: known listings by URL, unknown by name; crawler never gets the G2 actor", () => {
  const input = g2Input([{ productId: "1", name: "Wrike", g2Slug: "wrike" }, { productId: "2", name: "Asana", g2Slug: null }]) as Record<string, unknown>;
  assert.deepEqual((input.startUrls as { url: string }[]).map((u) => u.url), ["https://www.g2.com/products/wrike/reviews", "https://www.g2.com/products/wrike/pricing", "https://www.g2.com/products/wrike/competitors/alternatives"]);
  assert.deepEqual(input.searchQueries, ["Asana"]);
  assert.deepEqual(input.proxy, { useApifyProxy: true, apifyProxyGroups: ["RESIDENTIAL"] });
  const prev = { a: process.env.APIFY_ACTOR_ID, g: process.env.APIFY_G2_ACTOR_ID };
  delete process.env.APIFY_G2_ACTOR_ID;
  process.env.APIFY_ACTOR_ID = "memo23~g2-scraper";
  assert.equal(apifyActor(), "apify~playwright-scraper", "a G2 actor in APIFY_ACTOR_ID never replaces the official crawler");
  assert.equal(g2Actor(), "memo23~g2-scraper");
  delete process.env.APIFY_ACTOR_ID;
  assert.equal(g2Actor(), "memo23~g2-scraper", "default");
  process.env.APIFY_G2_ACTOR_ID = "someone/other-g2";
  assert.equal(g2Actor(), "someone~other-g2");
  if (prev.a === undefined) delete process.env.APIFY_ACTOR_ID; else process.env.APIFY_ACTOR_ID = prev.a;
  if (prev.g === undefined) delete process.env.APIFY_G2_ACTOR_ID; else process.env.APIFY_G2_ACTOR_ID = prev.g;
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

test("discovered links: login / sign-up pages (and links that redirect to them) are never proposed", async () => {
  const { isAuthPage } = await import("../lib/sync/diff");
  const real = { status: "OK" as const, reason: null, httpStatus: 200, page: { loadedUrl: "https://app.acme.com/-/login", title: "Log in - Acme", text: "x", html: "", contentHash: "h", fetchedAt: new Date(), links: [], description: null, jsonLd: [] } };
  assert.equal(evaluateDiscovered(claims(), "PRICING", real as never), null, "a gated pricing link that redirects to a login page is dropped");
  for (const [u, t] of [["https://acme.com/login", "Acme"], ["https://acme.com/users/sign_in", "Sign in to Acme"], ["https://acme.com/auth/", ""], ["https://acme.com/x", "Sign up | Acme"], ["https://acme.com/signup?plan=pro", ""]] as const) {
    assert.equal(isAuthPage(u, t), true, `${u} ${t}`);
  }
  for (const [u, t] of [["https://acme.com/pricing", "Pricing | Acme"], ["https://acme.com/blog/logging-in-best-practices", "Logging best practices"], ["https://acme.com/trust", "Trust at Acme"]] as const) {
    assert.equal(isAuthPage(u, t), false, `${u} ${t}`);
  }
});

test("preflight: checkToken rejects missing, whitespace and placeholder credentials", () => {
  assert.equal(checkToken("APIFY_API_TOKEN", undefined).ok, false);
  assert.equal(checkToken("APIFY_API_TOKEN", "").ok, false);
  assert.equal(checkToken("APIFY_API_TOKEN", "   ").ok, false);
  assert.equal(checkToken("APIFY_API_TOKEN", "has a space").ok, false);
  assert.equal(checkToken("APIFY_API_TOKEN", "changeme").ok, false);
  assert.equal(checkToken("APIFY_API_TOKEN", "your-token").ok, false);
  const bad = checkToken("APIFY_API_TOKEN", "");
  assert.ok(!bad.ok && bad.reason.includes("APIFY_API_TOKEN"), "reason names the exact env var");
  assert.equal(checkToken("APIFY_API_TOKEN", "apify_api_realLookingToken123").ok, true);
});

test("preflight: checkRequestInput rejects empty, malformed and oversized payloads", () => {
  assert.equal(checkRequestInput(null).ok, false);
  assert.equal(checkRequestInput("not an object").ok, false);
  assert.equal(checkRequestInput({}).ok, false, "no startUrls or searchQueries at all");
  assert.equal(checkRequestInput({ startUrls: [] }).ok, false, "empty array still has nothing to fetch");
  assert.equal(checkRequestInput({ startUrls: [{ url: "https://acme.com/" }] }).ok, true);
  assert.equal(checkRequestInput({ searchQueries: ["Acme"] }).ok, true);
  const huge = { startUrls: Array.from({ length: 50_000 }, (_, i) => ({ url: `https://acme.com/${i}` })) };
  const r = checkRequestInput(huge);
  assert.equal(r.ok, false);
  assert.ok(!r.ok && /byte safety cap/.test(r.reason));
});

test("preflight: budgetOk enforces a hard cap on actor calls per run attempt", () => {
  assert.equal(budgetOk(0).ok, true);
  assert.equal(budgetOk(DEFAULT_BUDGET.perRun).ok, false, "at the cap");
  assert.equal(budgetOk(DEFAULT_BUDGET.perRun - 1).ok, true, "one under the cap still passes");
  assert.equal(budgetOk(DEFAULT_BUDGET.perRun + 1).ok, false, "over the cap");
  const caps = { perRun: 2 };
  assert.equal(budgetOk(1, caps).ok, true);
  const exhausted = budgetOk(2, caps);
  assert.ok(!exhausted.ok && exhausted.reason.includes("2/2"), "reason states the exact used/cap counts");
});

test("trigger guard: a second claim for the same key within one trigger is refused, never retried", async () => {
  const seen: boolean[] = [];
  await runAsTrigger("test-trigger", async () => {
    seen.push(claimOutboundCall("apify-actor:run1:1").ok);
    seen.push(claimOutboundCall("apify-actor:run1:1").ok); // same key again: a bug, or a retry after failure
    seen.push(claimOutboundCall("apify-actor:run1:1").ok); // a third attempt: still refused
  });
  assert.deepEqual(seen, [true, false, false]);
});

test("trigger guard: distinct keys within the same trigger are each allowed once (different required data, not duplicates)", async () => {
  await runAsTrigger("test-trigger", async () => {
    assert.equal(claimOutboundCall("apify-actor:run1:1").ok, true, "official crawl");
    assert.equal(claimOutboundCall("apify-actor:run1:3").ok, true, "G2, a different phase/call");
    assert.equal(claimOutboundCall("apify-actor:run1:1").ok, false, "the first one again: refused");
  });
});

test("trigger guard: outside any trigger context, claims always succeed (manual/admin syncs are unaffected)", () => {
  assert.equal(claimOutboundCall("apify-actor:run1:1").ok, true);
  assert.equal(claimOutboundCall("apify-actor:run1:1").ok, true, "no context means no per-trigger cap at all");
});

test("trigger guard: concurrent triggers each get their own independent claim (no cross-contamination)", async () => {
  const results = await Promise.all([
    runAsTrigger("trigger-a", async () => [claimOutboundCall("k").ok, claimOutboundCall("k").ok]),
    runAsTrigger("trigger-b", async () => [claimOutboundCall("k").ok, claimOutboundCall("k").ok]),
  ]);
  assert.deepEqual(results, [[true, false], [true, false]], "each trigger makes its own one call; neither blocks the other");
});

test("startActorRun: never retries — a 429, a 500, and a network error each make exactly one fetch call and reject immediately", async () => {
  const prev = { token: process.env.APIFY_API_TOKEN, fetch: globalThis.fetch };
  process.env.APIFY_API_TOKEN = "apify_api_SECRETSECRET123456";
  let calls = 0;
  const respond = (fn: () => Response | never) => {
    globalThis.fetch = (async () => {
      calls++;
      return fn();
    }) as typeof fetch;
  };
  try {
    const { startActorRun, ApifyError } = await import("../lib/sync/apify");
    const opts = { timeoutSecs: 60, memoryMbytes: 512 };

    calls = 0;
    respond(() => new Response(JSON.stringify({ error: { message: "rate limited" } }), { status: 429, headers: { "retry-after": "0" } }));
    await assert.rejects(startActorRun({}, opts), ApifyError);
    assert.equal(calls, 1, "a 429 — retryable for every other Apify call — is not retried here");

    calls = 0;
    respond(() => new Response(JSON.stringify({ error: { message: "platform error" } }), { status: 500 }));
    await assert.rejects(startActorRun({}, opts), ApifyError);
    assert.equal(calls, 1, "a 500 is not retried either");

    calls = 0;
    respond(() => {
      throw new Error("network error");
    });
    await assert.rejects(startActorRun({}, opts));
    assert.equal(calls, 1, "a network-level failure is not retried");

    // A failure never poisons the next, separate call: a fresh startActorRun (the next trigger's own
    // one attempt) succeeds normally on its own first try.
    calls = 0;
    respond(() => new Response(JSON.stringify({ data: { id: "run1", status: "RUNNING", defaultDatasetId: "ds1" } }), { status: 200 }));
    const r = await startActorRun({}, opts);
    assert.equal(r.id, "run1");
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = prev.fetch;
    if (prev.token === undefined) delete process.env.APIFY_API_TOKEN;
    else process.env.APIFY_API_TOKEN = prev.token;
  }
});
