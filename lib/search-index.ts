import type { Catalog } from "@/lib/content/types";
import { alternativesFor } from "@/lib/catalog";
import { routes } from "@/lib/seo/routes";

import type { SearchItem } from "@/lib/search-score";

export type { SearchItem, SearchKind } from "@/lib/search-score";

/** Compact, public search index built only from published catalog pages. */
export function buildSearchIndex(c: Catalog): SearchItem[] {
  const catName = new Map(c.categories.map((x) => [x.slug, x.name]));
  const name = (slug: string) => c.products.find((p) => p.slug === slug)?.name ?? slug;
  return [
    ...c.products.map((p) => ({ k: "product" as const, l: p.name, h: routes.product(p.slug), m: catName.get(p.categorySlug) ?? "", c: p.categorySlug, x: [p.tagline, p.subcategory, ...p.tags, ...p.review.bestFor].join(" ") })),
    ...c.categories.map((x) => ({ k: "category" as const, l: x.name, h: routes.category(x.slug), m: "Category hub", c: x.slug, x: x.description })),
    ...c.useCases.map((u) => ({ k: "best" as const, l: u.title, h: routes.best(u.slug), m: "Best-for guide", c: u.categorySlug, x: u.audience })),
    ...c.pairs.map((p) => ({ k: "compare" as const, l: `${name(p.productA)} vs ${name(p.productB)}`, h: routes.compare(p.productA, p.productB), m: "Comparison", c: p.categorySlug, x: "" })),
    ...c.products.filter((p) => alternativesFor(c, p).length).map((p) => ({ k: "alternatives" as const, l: `${p.name} alternatives`, h: routes.alternatives(p.slug), m: "Alternatives", c: p.categorySlug, x: alternativesFor(c, p).map((a) => a.product.name).join(" ") })),
  ];
}
