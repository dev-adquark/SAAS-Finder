import type { MetadataRoute } from "next";
import { getCategories, getProducts } from "@/lib/catalog";
import { absolute } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);
  const staticUrls = [
    ["/", 1],
    ["/products", 0.8],
    ["/categories", 0.8],
    ["/alternatives", 0.8],
    ["/comparisons", 0.8],
    ["/methodology", 0.5],
    ["/disclosure", 0.5],
    ["/privacy", 0.3],
    ["/contact", 0.4],
  ] as const;

  const entries: MetadataRoute.Sitemap = staticUrls.map(([path, priority]) => ({
    url: absolute(path),
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority,
  }));

  for (const product of products) {
    entries.push({
      url: absolute(`/products/${product.slug}`),
      lastModified: new Date(product.pricingUpdated),
      changeFrequency: "monthly",
      priority: 0.8,
    });
    entries.push({
      url: absolute(`/alternatives/${product.slug}`),
      lastModified: new Date(product.pricingUpdated),
      changeFrequency: "monthly",
      priority: 0.7,
    });

    for (const alternative of product.alternatives) {
      entries.push({
        url: absolute(`/compare/${product.slug}-vs-${alternative}`),
        lastModified: new Date(product.pricingUpdated),
        changeFrequency: "monthly",
        priority: 0.7,
      });
    }
  }

  for (const category of categories) {
    entries.push({
      url: absolute(`/categories/${encodeURIComponent(category.toLowerCase())}`),
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.75,
    });
  }

  return entries;
}
