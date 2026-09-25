import assert from "node:assert/strict";
import test from "node:test";
import { seedCatalog, seedProductProblems } from "../lib/content/seed-catalog";
import { seedProducts } from "../lib/content/seed/products";
import { seedUseCases } from "../lib/content/seed/use-cases";
import { seedPairs } from "../lib/content/seed/pairs";
import { seedCategories } from "../lib/content/seed/categories";
import { sanitizeCatalog } from "../lib/content/sanitize";
import { publishProblems } from "../lib/content/publish-validation";
import { storedComparisonKeys } from "../lib/content/comparison-schema";
import { comparePairSlug, productSlugProblem } from "../lib/seo/routes";
import { alternativesFor } from "../lib/catalog";
import { research } from "../lib/content/seed/research";

test("seed catalog has 10–20 complete, publishable products with unique slugs", () => {
  assert.ok(seedProducts.length >= 10 && seedProducts.length <= 20, `${seedProducts.length} products`);
  assert.equal(new Set(seedProducts.map((p) => p.slug)).size, seedProducts.length);
  for (const p of seedProducts) {
    assert.deepEqual(seedProductProblems(p), [], p.slug);
    assert.equal(productSlugProblem(p.slug), null, p.slug);
  }
});

test("seed content never contains prices or currency amounts", () => {
  const text = JSON.stringify({ seedProducts, seedUseCases, seedPairs, seedCategories });
  assert.equal(/[$€£¥]/.test(text), false);
  for (const p of seedProducts) assert.equal(/\d/.test(p.pricingNote), false, p.slug);
});

test("every displayed price traces to an evidence-matched research record", () => {
  for (const p of seedCatalog().products) {
    const r = research[p.slug];
    for (const pt of p.pricing) {
      const src = r?.pricing.plans.find((x) => x.plan === pt.plan && x.billingPeriod === pt.billingPeriod && x.price === pt.price);
      assert.ok(src && src.evidence.length >= 6, `${p.slug} ${pt.plan} ${pt.billingPeriod} has evidence`);
      assert.ok(pt.sourceUrl?.startsWith("https://"), `${p.slug} price has an official source URL`);
    }
    if (!p.pricing.length) assert.equal(p.pricingLastChecked, null, `${p.slug} is not shown as checked without verified pricing`);
    for (const f of p.facts) assert.ok(f.evidence && f.sourceUrl?.startsWith("https://"), `${p.slug}.${f.key} sourced`);
  }
});

test("unscored seed products stay unscored (no invented ratings)", () => {
  for (const slug of ["pipedrive", "zoho-crm", "clickup", "trello", "figma"]) {
    assert.equal(seedProducts.find((p) => p.slug === slug)?.review.rating, null, slug);
  }
});

test("product narratives are unique", () => {
  for (const key of ["description", "tagline", "alternativesIntro"] as const) {
    const values = seedProducts.map((p) => p[key]);
    assert.equal(new Set(values).size, values.length, key);
  }
  const summaries = seedProducts.map((p) => p.review.editorialSummary);
  assert.equal(new Set(summaries).size, summaries.length);
  const rationales = seedProducts.flatMap((p) => p.alternatives.map((a) => a.rationale));
  assert.equal(new Set(rationales).size, rationales.length, "alternative rationales must be unique");
});

test("every product fills its category comparison schema", () => {
  for (const p of seedProducts) for (const k of storedComparisonKeys(p.category)) assert.ok(p.comparison[k]?.trim(), `${p.slug}.${k}`);
});

test("seed pairs and use cases are canonical and non-duplicated", () => {
  const slugs = seedPairs.map((p) => comparePairSlug(p.a, p.b));
  assert.equal(new Set(slugs).size, slugs.length);
  assert.equal(new Set(seedUseCases.map((u) => u.slug)).size, seedUseCases.length);
  for (const u of seedUseCases) assert.ok(u.products.length >= 2, u.slug);
});

test("publishProblems blocks incomplete products", () => {
  const problems = publishProblems({
    slug: "admin", name: "", categorySlug: "crm", tagline: "", description: "", officialUrl: "javascript:alert(1)", pricingUrl: null, features: ["a"],
    comparison: {}, alternativesIntro: null, review: { editorialSummary: "", pros: [], cons: [], bestFor: [], limitations: [] }, faqCount: 0, alternativeCount: 0,
  });
  for (const fragment of ["slug is reserved", "name is required", "official URL", "pricing URL", "features", "comparison values missing", "editorial summary", "pros", "limitation", "FAQ", "alternative"]) {
    assert.ok(problems.some((p) => p.includes(fragment)), fragment);
  }
});

test("sanitizeCatalog drops drafts and every reference to them", () => {
  const raw = seedCatalog();
  raw.products = raw.products.map((p) => (p.slug === "squarespace" ? { ...p, status: "DRAFT" } : p));
  const c = sanitizeCatalog(raw);
  assert.equal(c.products.some((p) => p.slug === "squarespace"), false);
  assert.equal(c.products.some((p) => p.alternatives.some((a) => a.slug === "squarespace")), false);
  assert.equal(c.pairs.some((p) => p.productA === "squarespace" || p.productB === "squarespace"), false);
  assert.equal(c.useCases.some((u) => u.products.some((x) => x.slug === "squarespace")), false);
});

test("sanitizeCatalog canonicalizes pairs and swaps choose copy with them", () => {
  const raw = seedCatalog();
  raw.pairs = [{ ...raw.pairs[0], productA: "wix", productB: "squarespace", chooseA: "WIX", chooseB: "SQS", slug: "x" }];
  const [pair] = sanitizeCatalog(raw).pairs;
  assert.equal(pair.slug, "squarespace-vs-wix");
  assert.equal(pair.productA, "squarespace");
  assert.equal(pair.chooseA, "SQS");
  assert.equal(pair.chooseB, "WIX");
});

test("every published product has an alternatives page", () => {
  const c = sanitizeCatalog(seedCatalog());
  for (const p of c.products) assert.ok(alternativesFor(c, p).length > 0, p.slug);
});
