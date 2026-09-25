import assert from "node:assert/strict";
import test from "node:test";
import { seedCatalog } from "../lib/content/seed-catalog";
import { sanitizeCatalog } from "../lib/content/sanitize";
import { alternativesFor, findProduct, productsInCategory } from "../lib/catalog";
import { alternativesLinks, bestForLinks, categoryLinks, compareLinksFor, productLinks } from "../lib/linking";
import { buildSitemapEntries } from "../lib/seo/sitemap";
import { buildMetadata } from "../lib/seo/metadata";
import { faqJsonLd, hasPublishableRating, productJsonLd, serializeJsonLd } from "../lib/seo/jsonld";
import { parseCompareSlug, routes } from "../lib/seo/routes";
import { absolute } from "../lib/site";

const c = sanitizeCatalog(seedCatalog());

/** Every public page path the catalog can render. */
function knownPaths(): Set<string> {
  const s = new Set<string>(["/", "/products", "/categories", "/comparisons", "/alternatives", "/best", "/methodology", "/disclosure", "/privacy", "/contact"]);
  c.categories.forEach((x) => {
    s.add(routes.category(x.slug));
    if (x.faqs.length >= 3) s.add(routes.categoryFaq(x.slug));
  });
  c.products.forEach((p) => {
    s.add(routes.product(p.slug));
    if (alternativesFor(c, p).length) s.add(routes.alternatives(p.slug));
  });
  c.pairs.forEach((p) => s.add(routes.compare(p.productA, p.productB)));
  c.useCases.forEach((u) => s.add(routes.best(u.slug)));
  return s;
}

test("internal linking engine only emits canonical, existing, non-duplicate links", () => {
  const known = knownPaths();
  const groups = [
    ...c.products.flatMap((p) => [...productLinks(c, p), ...alternativesLinks(c, p)]),
    ...c.pairs.flatMap((pair) => compareLinksFor(c, findProduct(c, pair.productA)!, findProduct(c, pair.productB)!)),
    ...c.useCases.flatMap((u) => bestForLinks(c, u)),
    ...c.categories.flatMap((x) => categoryLinks(c, x.slug)),
  ];
  assert.ok(groups.length > 50);
  for (const g of groups) {
    const hrefs = g.links.map((l) => l.href);
    assert.equal(new Set(hrefs).size, hrefs.length, `duplicate in ${g.title}`);
    for (const h of hrefs) {
      assert.ok(known.has(h), `unknown link ${h}`);
      assert.equal(/[?#A-Z]/.test(h), false, `non-canonical ${h}`);
      if (h.startsWith("/compare/")) assert.equal(parseCompareSlug(h.slice(9))?.isCanonical, true, h);
    }
  }
});

test("linking rules: each page type links to the required targets", () => {
  const wix = findProduct(c, "wix")!;
  const titles = (gs: { title: string }[]) => gs.map((g) => g.title);
  assert.deepEqual(titles(productLinks(c, wix)), ["Category", "Alternatives", "Best-for guides", "Comparisons"]);
  assert.deepEqual(titles(alternativesLinks(c, wix)), ["Original review", "Alternative reviews", "Category", "Comparisons"]);
  const pair = c.pairs[0];
  assert.deepEqual(titles(compareLinksFor(c, findProduct(c, pair.productA)!, findProduct(c, pair.productB)!)), ["Full reviews", "Category", "Alternatives"]);
  assert.deepEqual(titles(bestForLinks(c, c.useCases[0])).slice(0, 3), ["Product reviews", "Alternatives", "Category"]);
  for (const p of c.products) assert.ok(!productLinks(c, p).flatMap((g) => g.links).some((l) => l.href === routes.product(p.slug)), "no self link");
});

test("sitemap covers every page type once, excludes admin/api and uses content timestamps", () => {
  const entries = buildSitemapEntries(c, { alternativesFor, findProduct, productsInCategory }, false);
  const urls = entries.map((e) => e.url);
  assert.equal(new Set(urls).size, urls.length, "no duplicate canonical URLs");
  for (const path of knownPaths()) if (path !== "/contact") assert.ok(urls.includes(absolute(path)), `missing ${path}`);
  assert.equal(urls.includes(absolute("/contact")), false, "contact excluded while it has no inbox");
  assert.equal(urls.some((u) => /\/(admin|api|go|sponsor)(\/|$)/.test(new URL(u).pathname)), false);
  const reverse = absolute("/compare/wix-vs-squarespace");
  assert.equal(urls.includes(reverse), false);
  const wix = entries.find((e) => e.url === absolute("/wix"))!;
  assert.equal((wix.lastModified as Date).toISOString(), findProduct(c, "wix")!.contentUpdatedAt);
});

test("metadata canonical is absolute, clean and robots indexable", () => {
  const m = buildMetadata({ title: "T", description: "D".repeat(300), path: "/wix/?utm_source=x" });
  assert.equal(m.alternates?.canonical, absolute("/wix"));
  assert.ok(String(m.description).length <= 160);
  assert.deepEqual(m.robots, { index: true, follow: true });
  assert.deepEqual(buildMetadata({ title: "T", description: "D", path: "/contact", noindex: true }).robots, { index: false, follow: true });
});

test("structured data is truthful", () => {
  assert.equal(faqJsonLd([]), null);
  assert.equal(faqJsonLd([{ question: " ", answer: "x" }]), null);
  assert.equal((faqJsonLd([{ question: "Q", answer: "A" }]) as { mainEntity: unknown[] }).mainEntity.length, 1);
  const wix = findProduct(c, "wix")!;
  assert.equal(hasPublishableRating(wix), false, "seed reviews are not completed hands-on reviews");
  const ld = productJsonLd(wix, "Website Builders");
  assert.equal("review" in ld, false);
  assert.equal("aggregateRating" in ld, false);
  assert.equal("offers" in ld, false, "no Offer without verified price");
  const reviewed = { ...wix, review: { ...wix.review, reviewStatus: "REVIEWED" as const, lastReviewedAt: "2026-09-01T00:00:00.000Z" }, pricing: [{ plan: "Core", price: 29, currency: "USD", billingPeriod: "MONTHLY" as const, note: "", sourceUrl: "https://www.wix.com/upgrade/website", sourceType: "OFFICIAL_PRICING_PAGE" as const, capturedAt: "2026-09-01T00:00:00.000Z", unit: null, perSeat: false, promotional: false, regionDependent: false }, { plan: "Custom", price: null, currency: null, billingPeriod: "CUSTOM" as const, note: "", sourceUrl: null, sourceType: "OFFICIAL_PRICING_PAGE" as const, capturedAt: "2026-09-01T00:00:00.000Z", unit: null, perSeat: false, promotional: false, regionDependent: false }] };
  const ld2 = productJsonLd(reviewed, "Website Builders") as { review?: { reviewRating: { ratingValue: number } }; offers?: unknown[] };
  assert.equal(ld2.review?.reviewRating.ratingValue, wix.review.rating);
  assert.equal(ld2.offers?.length ?? 0, 0, "offers without the vendor's unit wording are dropped");
  const withUnit = { ...reviewed, pricing: reviewed.pricing.map((x) => ({ ...x, unit: "per user per month, billed annually" })) };
  const ld3 = productJsonLd(withUnit, "Website Builders") as { offers?: { priceSpecification?: { unitText: string } }[] };
  assert.equal(ld3.offers?.length, 1, "incomplete offers (no price/currency) are dropped");
  assert.equal(ld3.offers?.[0].priceSpecification?.unitText, "per user per month, billed annually");
  assert.equal(serializeJsonLd({ x: "</script><script>" }).includes("</script>"), false);
});
