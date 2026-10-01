import assert from "node:assert/strict";
import test from "node:test";
import { ATLAS_TILES, atlasQuota, atlasSelection } from "../components/atlas/atlas";
import { productsInCategory } from "../lib/catalog";
import { seedCatalog } from "../lib/content/seed-catalog";

test("atlas shows at most 3 of each category's most-referenced products, with no repeated logos", () => {
  const c = seedCatalog();
  for (const cat of c.categories) {
    const all = productsInCategory(c, cat.slug);
    const shown = atlasSelection(c, cat.slug);
    assert.equal(shown.length, Math.min(3, all.length), cat.slug);
    assert.equal(new Set(shown.map((p) => p.slug)).size, shown.length, "no duplicates");
    const refs = (slug: string) => c.pairs.filter((p) => p.productA === slug || p.productB === slug).length * 2 + c.useCases.filter((u) => u.products.some((x) => x.slug === slug)).length + c.products.filter((o) => o.alternatives.some((a) => a.slug === slug)).length;
    const hidden = all.filter((p) => !shown.includes(p));
    for (const h of hidden) assert.ok(shown.every((s) => refs(s.slug) >= refs(h.slug)), `${h.slug} is not more referenced than a shown product`);
    assert.deepEqual(atlasSelection(c, cat.slug).map((p) => p.slug), shown.map((p) => p.slug), "deterministic");
  }
  const twin = structuredClone(c);
  const [a, b] = productsInCategory(twin, twin.categories[0].slug);
  a.logo = { base: "x", domain: "same.example" };
  b.logo = { base: "y", domain: "same.example" };
  const picked = atlasSelection(twin, twin.categories[0].slug).filter((p) => p.logo?.domain === "same.example");
  assert.equal(picked.length, 1, "two products sharing a company logo never both appear");
});

test("atlas tile budget: 20 tiles spread evenly over categories (2 each across 10), never more than a category has", () => {
  const c = seedCatalog();
  const q = atlasQuota(c);
  const cap = (slug: string) => Math.min(3, productsInCategory(c, slug).length);
  const total = [...q.values()].reduce((a, b) => a + b, 0);
  assert.equal(total, Math.min(ATLAS_TILES, c.categories.reduce((n, cat) => n + cap(cat.slug), 0)));
  for (const cat of c.categories) assert.ok(q.get(cat.slug)! <= cap(cat.slug));
  const open = c.categories.filter((cat) => q.get(cat.slug)! < cap(cat.slug)).map((cat) => q.get(cat.slug)!);
  const all = [...q.values()];
  if (open.length) assert.ok(Math.max(...all) - Math.min(...open) <= 1, "even split");
  // Ten categories with plenty of products → exactly 2 each = 20.
  const big = structuredClone(c);
  const base = big.products[0];
  big.categories = Array.from({ length: 10 }, (_, i) => ({ ...big.categories[0], slug: `cat${i}`, name: `Cat ${i}` }));
  big.products = big.categories.flatMap((cat) => [0, 1, 2, 3, 4].map((k) => ({ ...base, slug: `${cat.slug}-p${k}`, name: `${cat.name} P${k}`, categorySlug: cat.slug, logo: undefined })));
  const bq = atlasQuota(big);
  assert.deepEqual([...bq.values()], Array(10).fill(2));
  assert.equal(big.categories.reduce((n, cat) => n + atlasSelection(big, cat.slug, bq.get(cat.slug)).length, 0), 20);
});
