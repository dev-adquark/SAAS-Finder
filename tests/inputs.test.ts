import assert from "node:assert/strict";
import test from "node:test";
import { InputError, formToObject, parseCategory, parsePair, parseProduct, parseSnapshot, parseSponsor, parseUseCase } from "../lib/admin/inputs";

const problems = (fn: () => unknown) => {
  try {
    fn();
    return [];
  } catch (e) {
    assert.ok(e instanceof InputError);
    return e.problems;
  }
};

test("product create requires core fields and rejects reserved slugs", () => {
  assert.ok(problems(() => parseProduct({}, true)).length >= 6);
  assert.ok(problems(() => parseProduct({ slug: "admin", name: "X", categoryId: "c1", tagline: "t", description: "d", officialUrl: "https://x.example" }, true)).some((p) => p.includes("reserved")));
  assert.ok(problems(() => parseProduct({ slug: "a-vs-b" }, false)).some((p) => p.includes("-vs-")));
  const ok = parseProduct({ slug: "New Tool", name: "New Tool", categoryId: "c1", tagline: "t", description: "d", officialUrl: "https://x.example", features: "A\nB\n\nA", rating: "4.25" }, true);
  assert.equal(ok.product.slug, "new-tool");
  assert.deepEqual(ok.product.features, ["A", "B"]);
  assert.equal(ok.review.rating, 4.3);
});

test("product update validates enums, URLs, numbers and lengths", () => {
  const p = problems(() => parseProduct({ status: "LIVE", officialUrl: "javascript:alert(1)", rating: 7, refreshIntervalDays: 0, name: "x".repeat(500), features: Array.from({ length: 50 }, (_, i) => `f${i}`) }, false));
  for (const f of ["status", "officialUrl", "rating", "refreshIntervalDays", "name", "features"]) assert.ok(p.some((x) => x.startsWith(f)), f);
  assert.deepEqual(parseProduct({ comparison: "templates: Large\nhosting: Included" }, false).product.comparison, { templates: "Large", hosting: "Included" });
  assert.ok(problems(() => parseProduct({ comparison: { "bad key!": "x" } }, false)).length > 0);
});

test("snapshot prices require currency and source; never negative", () => {
  assert.ok(problems(() => parseSnapshot({ summary: "x", price: 10 })).some((p) => p.includes("currency")));
  assert.ok(problems(() => parseSnapshot({ summary: "x", price: 10, currency: "USD" })).some((p) => p.includes("source URL")));
  assert.ok(problems(() => parseSnapshot({ summary: "x", price: -1 })).length > 0);
  assert.ok(problems(() => parseSnapshot({ summary: "x", currency: "dollars" })).length > 0);
  assert.equal(parseSnapshot({ summary: "x", price: "19.999", currency: "usd", sourceUrl: "https://v.example/pricing" }).price, 20);
  assert.equal(parseSnapshot({ summary: "Free plan available" }).price, undefined);
});

test("sponsor validation", () => {
  assert.ok(problems(() => parseSponsor({ title: "A", pageType: "home", placement: "sidebar" }, true)).some((p) => p.startsWith("pageType")));
  assert.ok(problems(() => parseSponsor({ title: "A", pageType: "product", placement: "sidebar", url: "http://x.example" }, true)).some((p) => p.includes("https")));
  assert.ok(problems(() => parseSponsor({ title: "A", pageType: "product", placement: "sidebar", label: "Partner" }, true)).some((p) => p.includes("Sponsored")));
  assert.ok(problems(() => parseSponsor({ title: "A", pageType: "product", placement: "sidebar", startsAt: "2026-10-02", endsAt: "2026-10-01" }, true)).length > 0);
  assert.equal(parseSponsor({ title: "A", pageType: "product", placement: "sidebar", active: "on", priority: "5" }, true).active, true);
});

test("category, pair and use-case parsers", () => {
  assert.equal(parseCategory({ name: "Analytics", slug: "Analytics Tools" }, true).slug, "analytics-tools");
  assert.ok(problems(() => parsePair({}, true)).length >= 5);
  const u = parseUseCase({ slug: "crm-for-x", title: "Best CRM for X", audience: "x", intro: "Freelancers need a CRM that stays out of the way: quick capture, simple follow-ups and pricing that makes sense for one person. ".repeat(2), categoryId: "c", criteria: "Price: fair\nEase: simple" }, true);
  assert.deepEqual(u.criteria, [{ name: "Price", description: "fair" }, { name: "Ease", description: "simple" }]);
  assert.ok(problems(() => parseUseCase({ criteria: "No description" }, false)).some((p) => p.startsWith("criteria")));
  assert.ok(problems(() => parseUseCase({ intro: "Too short." }, false)).some((p) => p.includes("thin content")));
  assert.ok(problems(() => parsePair({ productAId: "a", productBId: "b", summary: "s", chooseA: "a", chooseB: "b" }, true)).filter((p) => p.includes("thin content")).length === 3);
});

test("formToObject keeps repeated keys and ignores action internals", () => {
  const fd = new FormData();
  fd.append("a", "1");
  fd.append("a", "2");
  fd.append("$ACTION_ID_x", "y");
  assert.deepEqual(formToObject(fd), { a: ["1", "2"] });
});
