import { db } from "@/lib/db";
import { products as seed, Product } from "@/lib/data";

const hasDatabase = () => Boolean(process.env.DATABASE_URL);

function mapProduct(p: any): Product {
  return {
    slug: p.slug,
    name: p.name,
    category: p.category?.name ?? "",
    subcategory: p.subcategory ?? "",
    tagline: p.tagline,
    description: p.description,
    rating: p.rating ?? 0,
    pricing: p.snapshots?.[0]?.summary ?? "Pricing data pending",
    pricingUpdated: p.snapshots?.[0]?.capturedAt?.toISOString().slice(0, 10) ?? "Not verified",
    officialUrl: p.officialUrl,
    pricingUrl: p.pricingUrl ?? p.officialUrl,
    affiliateUrl: p.links?.find((x: any) => x.active)?.url,
    affiliateAvailable: Boolean(p.links?.some((x: any) => x.active)),
    features: Array.isArray(p.features) ? p.features : [],
    pros: Array.isArray(p.pros) ? p.pros : [],
    cons: Array.isArray(p.cons) ? p.cons : [],
    bestFor: Array.isArray(p.bestFor) ? p.bestFor : [],
    alternatives: (p.alternativesFrom ?? [])
      .map((x: any) => x.alternative?.slug)
      .filter(Boolean),
    comparison: p.comparison && typeof p.comparison === "object" ? p.comparison : {},
    faqs: (p.faqs ?? []).map((x: any) => ({ q: x.question, a: x.answer })),
  };
}

export async function getProducts(): Promise<Product[]> {
  if (!hasDatabase()) return seed;

  try {
    const rows = await db.product.findMany({
      where: { status: "PUBLISHED" },
      include: {
        category: true,
        faqs: { orderBy: { sortOrder: "asc" } },
        snapshots: { orderBy: { capturedAt: "desc" }, take: 1 },
        links: true,
        alternativesFrom: {
          include: { alternative: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    return rows.length ? rows.map(mapProduct) : seed;
  } catch {
    return seed;
  }
}

export async function getProduct(slug: string) {
  const all = await getProducts();
  return all.find((p) => p.slug === slug);
}

export async function getCategories() {
  return [...new Set((await getProducts()).map((p) => p.category))].sort();
}

export async function getCategoryProducts(category: string) {
  return (await getProducts()).filter(
    (p) => p.category.toLowerCase() === category.toLowerCase(),
  );
}

export async function getAlternatives(p: Product) {
  const all = await getProducts();
  return p.alternatives
    .map((slug) => all.find((x) => x.slug === slug))
    .filter((x): x is Product => Boolean(x));
}
