import assert from "node:assert/strict";
import test from "node:test";
import { atlasSelection } from "../components/atlas/atlas";
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
