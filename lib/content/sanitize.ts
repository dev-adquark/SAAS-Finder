import type { Catalog } from "@/lib/content/types";
import { canonicalPair, comparePairSlug } from "@/lib/seo/routes";

export const MIN_USE_CASE_PRODUCTS = 2;

/**
 * Reduces a raw catalog to what may be rendered publicly: published products only, and every
 * cross-reference (alternatives, use-case picks, pairs) pointing at a published product in the
 * same catalog. This is what guarantees zero broken internal links.
 */
export function sanitizeCatalog(raw: Catalog): Catalog {
  const products = raw.products.filter((p) => p.status === "PUBLISHED");
  const slugs = new Set(products.map((p) => p.slug));
  const categorySlugs = new Set(products.map((p) => p.categorySlug));

  const cleanProducts = products
    .map((p) => ({
      ...p,
      alternatives: dedupeBy(p.alternatives.filter((a) => a.slug !== p.slug && slugs.has(a.slug) && a.rationale.trim().length > 0), (a) => a.slug),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const categories = raw.categories
    .filter((c) => categorySlugs.has(c.slug))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  const useCases = raw.useCases
    .filter((u) => u.status === "PUBLISHED" && categorySlugs.has(u.categorySlug))
    .map((u) => ({ ...u, products: dedupeBy(u.products.filter((x) => slugs.has(x.slug)), (x) => x.slug) }))
    .filter((u) => u.products.length >= MIN_USE_CASE_PRODUCTS);

  const bySlug = new Map(cleanProducts.map((p) => [p.slug, p]));
  const pairs = dedupeBy(
    raw.pairs
      .filter((pair) => pair.productA !== pair.productB && slugs.has(pair.productA) && slugs.has(pair.productB))
      .map((pair) => {
        const [a, b] = canonicalPair(pair.productA, pair.productB);
        const swapped = a !== pair.productA;
        return {
          ...pair,
          productA: a,
          productB: b,
          chooseA: swapped ? pair.chooseB : pair.chooseA,
          chooseB: swapped ? pair.chooseA : pair.chooseB,
          slug: comparePairSlug(a, b),
          categorySlug: bySlug.get(a)?.categorySlug ?? pair.categorySlug,
        };
      }),
    (pair) => pair.slug,
  ).sort((x, y) => x.slug.localeCompare(y.slug));

  return { categories, products: cleanProducts, useCases, pairs };
}

function dedupeBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
