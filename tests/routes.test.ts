import assert from "node:assert/strict";
import test from "node:test";
import { canonicalPair, comparePairSlug, isValidSlug, normalizePath, parseCompareSlug, productSlugProblem, RESERVED_ROOT_SLUGS, routes, slugify } from "../lib/seo/routes";

test("slugify is deterministic and URL-safe", () => {
  assert.equal(slugify("Website Builders"), "website-builders");
  assert.equal(slugify("  CRM / Sales & Marketing "), "crm-sales-and-marketing");
  assert.equal(slugify("Café Déjà"), "cafe-deja");
  assert.equal(slugify("---a---b---"), "a-b");
  assert.equal(slugify("x".repeat(200)).length <= 80, true);
  assert.equal(slugify(slugify("Project Management")), "project-management");
});

test("product slugs cannot collide with site routes or compare URLs", () => {
  for (const r of ["admin", "api", "category", "compare", "best", "alternatives", "go", "sponsor", "products", "methodology", "disclosure"]) {
    assert.equal(RESERVED_ROOT_SLUGS.has(r), true, r);
    assert.equal(productSlugProblem(r), "reserved");
  }
  assert.equal(productSlugProblem("wix"), null);
  assert.equal(productSlugProblem("a-vs-b"), "contains-vs");
  assert.equal(productSlugProblem("Wix"), "invalid");
  assert.equal(productSlugProblem("wix/pro"), "invalid");
  assert.equal(isValidSlug("-bad"), false);
});

test("compare pairs are canonicalized so reverse order shares one URL", () => {
  assert.deepEqual(canonicalPair("wix", "squarespace"), ["squarespace", "wix"]);
  assert.equal(comparePairSlug("wix", "squarespace"), comparePairSlug("squarespace", "wix"));
  assert.equal(routes.compare("wix", "squarespace"), "/compare/squarespace-vs-wix");
  assert.throws(() => canonicalPair("wix", "wix"));
});

test("parseCompareSlug detects canonical and reversed forms", () => {
  assert.deepEqual(parseCompareSlug("squarespace-vs-wix"), { first: "squarespace", second: "wix", canonicalSlug: "squarespace-vs-wix", isCanonical: true });
  assert.equal(parseCompareSlug("wix-vs-squarespace")?.isCanonical, false);
  assert.equal(parseCompareSlug("wix-vs-squarespace")?.canonicalSlug, "squarespace-vs-wix");
  assert.equal(parseCompareSlug("wix-vs-wix"), null);
  assert.equal(parseCompareSlug("wix"), null);
  assert.equal(parseCompareSlug("a-vs-b-vs-c"), null);
  assert.equal(parseCompareSlug("Wix-vs-webflow"), null);
});

test("route builders produce the canonical patterns", () => {
  assert.equal(routes.category("crm"), "/category/crm");
  assert.equal(routes.product("wix"), "/wix");
  assert.equal(routes.alternatives("wix"), "/alternatives/wix");
  assert.equal(routes.best("crm-for-freelancers"), "/best/crm-for-freelancers");
  assert.equal(routes.go("wix"), "/go/wix");
});

test("normalizePath strips query strings, fragments and trailing slashes", () => {
  assert.equal(normalizePath("/wix/?utm_source=x#top"), "/wix");
  assert.equal(normalizePath("//category//crm/"), "/category/crm");
  assert.equal(normalizePath("/"), "/");
  assert.equal(normalizePath("wix"), "/wix");
});
