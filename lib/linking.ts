import type { Catalog, Product, UseCase } from "@/lib/content/types";
import { alternativesFor, findCategory, findProduct, pairsForProduct, pairsInCategory, guidesForProduct, guidesInCategory } from "@/lib/catalog";
import { routes } from "@/lib/seo/routes";

// Internal linking engine. Every function returns canonical paths built through `routes`, only for
// pages that exist in the sanitized catalog, deduplicated and in a stable order.

export type InternalLink = { href: string; label: string; kind: "category" | "product" | "alternatives" | "compare" | "best" };
export type LinkGroup = { title: string; links: InternalLink[] };

function dedupe(links: InternalLink[], exclude?: string): InternalLink[] {
  const seen = new Set<string>(exclude ? [exclude] : []);
  return links.filter((l) => (seen.has(l.href) ? false : (seen.add(l.href), true)));
}

const hasAlternativesPage = (c: Catalog, p: Product) => alternativesFor(c, p).length > 0;
const nameOf = (c: Catalog, slug: string) => findProduct(c, slug)?.name ?? slug;

function compareLinks(c: Catalog, slug: string): InternalLink[] {
  return pairsForProduct(c, slug).map((pair) => pairLink(c, pair));
}

function pairLink(c: Catalog, pair: { productA: string; productB: string }): InternalLink {
  return ({
    href: routes.compare(pair.productA, pair.productB),
    label: `${nameOf(c, pair.productA)} vs ${nameOf(c, pair.productB)}`,
    kind: "compare",
  });
}

function categoryLink(c: Catalog, categorySlug: string): InternalLink[] {
  const category = findCategory(c, categorySlug);
  return category ? [{ href: routes.category(category.slug), label: `${category.name} hub`, kind: "category" }] : [];
}

const bestLink = (u: UseCase): InternalLink => ({ href: routes.best(u.slug), label: u.title, kind: "best" });

/** Product review → category, alternatives, best-for, compare. */
export function productLinks(c: Catalog, p: Product): LinkGroup[] {
  const self = routes.product(p.slug);
  return [
    { title: "Category", links: categoryLink(c, p.categorySlug) },
    { title: "Alternatives", links: hasAlternativesPage(c, p) ? [{ href: routes.alternatives(p.slug), label: `${p.name} alternatives`, kind: "alternatives" as const }] : [] },
    { title: "Best-for guides", links: guidesForProduct(c, p.slug).map(bestLink) },
    { title: "Comparisons", links: compareLinks(c, p.slug) },
  ].map((g) => ({ ...g, links: dedupe(g.links, self) })).filter((g) => g.links.length > 0);
}

/** Alternatives → original product, alternative products, category, compare. */
export function alternativesLinks(c: Catalog, p: Product): LinkGroup[] {
  const self = routes.alternatives(p.slug);
  const alts = alternativesFor(c, p);
  const altSlugs = new Set(alts.map((a) => a.product.slug));
  return [
    { title: "Original review", links: [{ href: routes.product(p.slug), label: `${p.name} review`, kind: "product" as const }] },
    { title: "Alternative reviews", links: alts.map((a) => ({ href: routes.product(a.product.slug), label: `${a.product.name} review`, kind: "product" as const })) },
    { title: "Category", links: categoryLink(c, p.categorySlug) },
    {
      title: "Comparisons",
      links: pairsForProduct(c, p.slug)
        .filter((pair) => altSlugs.has(pair.productA === p.slug ? pair.productB : pair.productA))
        .map((pair) => pairLink(c, pair)),
    },
  ].map((g) => ({ ...g, links: dedupe(g.links, self) })).filter((g) => g.links.length > 0);
}

/** Compare → product A, product B, category, alternatives. */
export function compareLinksFor(c: Catalog, a: Product, b: Product): LinkGroup[] {
  const self = routes.compare(a.slug, b.slug);
  return [
    { title: "Full reviews", links: [a, b].map((p) => ({ href: routes.product(p.slug), label: `${p.name} review`, kind: "product" as const })) },
    { title: "Category", links: categoryLink(c, a.categorySlug).concat(a.categorySlug === b.categorySlug ? [] : categoryLink(c, b.categorySlug)) },
    { title: "Alternatives", links: [a, b].filter((p) => hasAlternativesPage(c, p)).map((p) => ({ href: routes.alternatives(p.slug), label: `${p.name} alternatives`, kind: "alternatives" as const })) },
  ].map((g) => ({ ...g, links: dedupe(g.links, self) })).filter((g) => g.links.length > 0);
}

/** Best-for → product reviews, alternatives, category. */
export function bestForLinks(c: Catalog, u: UseCase): LinkGroup[] {
  const self = routes.best(u.slug);
  const picks = u.products.map((x) => findProduct(c, x.slug)).filter((p): p is Product => Boolean(p));
  return [
    { title: "Product reviews", links: picks.map((p) => ({ href: routes.product(p.slug), label: `${p.name} review`, kind: "product" as const })) },
    { title: "Alternatives", links: picks.filter((p) => hasAlternativesPage(c, p)).map((p) => ({ href: routes.alternatives(p.slug), label: `${p.name} alternatives`, kind: "alternatives" as const })) },
    { title: "Category", links: categoryLink(c, u.categorySlug) },
    { title: "Related guides", links: guidesInCategory(c, u.categorySlug).filter((x) => x.slug !== u.slug).map(bestLink) },
  ].map((g) => ({ ...g, links: dedupe(g.links, self) })).filter((g) => g.links.length > 0);
}

/** Category hub → reviews, best-for guides, alternatives, comparisons. */
export function categoryLinks(c: Catalog, categorySlug: string): LinkGroup[] {
  const products = c.products.filter((p) => p.categorySlug === categorySlug);
  return [
    { title: "Best-for guides", links: guidesInCategory(c, categorySlug).map(bestLink) },
    { title: "Alternatives", links: products.filter((p) => hasAlternativesPage(c, p)).map((p) => ({ href: routes.alternatives(p.slug), label: `${p.name} alternatives`, kind: "alternatives" as const })) },
    { title: "Comparisons", links: pairsInCategory(c, categorySlug).map((pair) => pairLink(c, pair)) },
  ].map((g) => ({ ...g, links: dedupe(g.links) })).filter((g) => g.links.length > 0);
}
