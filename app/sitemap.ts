import type { MetadataRoute } from "next";
import { alternativesFor, findProduct, loadCatalog, productsInCategory } from "@/lib/catalog";
import { buildSitemapEntries } from "@/lib/seo/sitemap";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalog = await loadCatalog();
  return buildSitemapEntries(catalog, { alternativesFor, findProduct, productsInCategory }, Boolean(process.env.CONTACT_EMAIL));
}
