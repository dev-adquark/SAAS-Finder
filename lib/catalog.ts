import { db } from "@/lib/db";
import { products as seed, Product } from "@/lib/data";
import type { Prisma } from "@prisma/client";

const hasDatabase = () => Boolean(process.env.DATABASE_URL);

type CatalogProduct = Prisma.ProductGetPayload<{
  include: {
    category: true;
    faqs: true;
    snapshots: true;
    links: true;
    alternativesFrom: { include: { alternative: true } };
  };
}>;

function mapProduct(p: CatalogProduct): Product {
  return {
    slug: p.slug,
    name: p.name,
    category: p.category?.name ?? "",
    subcategory: p.subcategory ?? "",
    tagline: p.tagline,
    description: p.description,
    rating: p.rating ?? 0,
    pricing: p.snapshots[0]?.summary ?? "Pricing data pending",
    pricingUpdated: p.snapshots[0]?.capturedAt?.toISOString().slice(0, 10) ?? "Not verified",
    contentUpdated: p.updatedAt.toISOString(),
    officialUrl: p.officialUrl,
    pricingUrl: p.pricingUrl ?? p.officialUrl,
    affiliateUrl: p.links.find((x) => x.active)?.url,
    affiliateAvailable: p.links.some((x) => x.active),
    features: Array.isArray(p.features) ? p.features.filter((x): x is string => typeof x === "string") : [],
    pros: Array.isArray(p.pros) ? p.pros.filter((x): x is string => typeof x === "string") : [],
    cons: Array.isArray(p.cons) ? p.cons.filter((x): x is string => typeof x === "string") : [],
    bestFor: Array.isArray(p.bestFor) ? p.bestFor.filter((x): x is string => typeof x === "string") : [],
    alternatives: p.alternativesFrom.map((x) => x.alternative?.slug).filter((x): x is string => Boolean(x)),
    comparison:
      p.comparison && typeof p.comparison === "object" && !Array.isArray(p.comparison)
        ? Object.fromEntries(
            Object.entries(p.comparison as Record<string, unknown>)
              .filter(([, value]) => typeof value === "string")
              .map(([key, value]) => [key, value as string]),
          )
        : {},
    faqs: p.faqs.map((x) => ({ q: x.question, a: x.answer })),
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
        alternativesFrom: { include: { alternative: true }, orderBy: { sortOrder: "asc" } },
      },
    });
    return rows.map(mapProduct);
  } catch (error) {
    console.error("[catalog] database read failed", error);
    return [];
  }
}

export async function getProduct(slug: string) {
  const all = await getProducts();
  return all.find((p) => p.slug === slug);
}

export async function getCategories() {
  return [...new Set((await getProducts()).map((p) => p.category))].filter(Boolean).sort();
}

export async function getCategoryProducts(category: string) {
  return (await getProducts()).filter((p) => p.category.toLowerCase() === category.toLowerCase());
}

export async function getAlternatives(p: Product) {
  const all = await getProducts();
  return p.alternatives.map((slug) => all.find((x) => x.slug === slug)).filter((x): x is Product => Boolean(x));
}
