import type { MetadataRoute } from "next";
import type { Catalog, Product } from "@/lib/content/types";
import { absolute } from "@/lib/site";
import { routes } from "@/lib/seo/routes";

/** Category FAQ pages are only published (and indexed) with enough visible questions. */
export const MIN_CATEGORY_FAQS = 3;

type Helpers = {
  alternativesFor: (c: Catalog, p: Product) => { product: Product }[];
  findProduct: (c: Catalog, slug: string) => Product | undefined;
  productsInCategory: (c: Catalog, slug: string) => Product[];
};

const latest = (...dates: (string | null | undefined)[]): Date | undefined => {
  const times = dates.map((d) => (d ? new Date(d).getTime() : NaN)).filter((t) => Number.isFinite(t));
  return times.length ? new Date(Math.max(...times)) : undefined;
};

/** A product page changes when its editorial content changes or when pricing is re-checked. */
const productModified = (p: Product) => latest(p.contentUpdatedAt, p.pricingLastChecked);

/** Builds the sitemap from canonical routes only: published pages, one URL per page. */
export function buildSitemapEntries(c: Catalog, h: Helpers, includeContact: boolean): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  const add = (path: string, lastModified: Date | undefined, priority: number, changeFrequency: "daily" | "weekly" | "monthly" = "weekly") =>
    entries.push({ url: absolute(path), ...(lastModified ? { lastModified } : {}), changeFrequency, priority });

  const siteModified = latest(...c.products.map((p) => p.contentUpdatedAt));
  add(routes.home(), siteModified, 1, "daily");
  add(routes.products(), siteModified, 0.8);
  add(routes.categories(), siteModified, 0.8);
  add(routes.bestIndex(), latest(...c.useCases.map((u) => u.contentUpdatedAt)), 0.8);
  add(routes.comparisons(), latest(...c.pairs.map((p) => p.updatedAt)), 0.7);
  add(routes.alternativesIndex(), siteModified, 0.7);
  add(routes.methodology(), undefined, 0.4, "monthly");
  add(routes.disclosure(), undefined, 0.4, "monthly");
  add(routes.privacy(), undefined, 0.2, "monthly");
  if (includeContact) add(routes.contact(), undefined, 0.2, "monthly");

  for (const cat of c.categories) {
    add(routes.category(cat.slug), latest(cat.updatedAt, ...h.productsInCategory(c, cat.slug).map((p) => p.contentUpdatedAt)), 0.8);
    if (cat.faqs.length >= MIN_CATEGORY_FAQS) add(routes.categoryFaq(cat.slug), latest(cat.updatedAt), 0.5, "monthly");
  }
  for (const p of c.products) {
    add(routes.product(p.slug), productModified(p), 0.9);
    const alts = h.alternativesFor(c, p);
    if (alts.length) add(routes.alternatives(p.slug), latest(p.contentUpdatedAt, ...alts.map((a) => a.product.contentUpdatedAt)), 0.7);
  }
  for (const pair of c.pairs) {
    const a = h.findProduct(c, pair.productA);
    const b = h.findProduct(c, pair.productB);
    if (a && b) add(routes.compare(a.slug, b.slug), latest(pair.updatedAt, a.contentUpdatedAt, b.contentUpdatedAt), 0.7);
  }
  for (const u of c.useCases) add(routes.best(u.slug), latest(u.contentUpdatedAt), 0.8);

  // Guarantee one entry per canonical URL.
  const seen = new Set<string>();
  return entries.filter((e) => (seen.has(e.url) ? false : (seen.add(e.url), true)));
}
