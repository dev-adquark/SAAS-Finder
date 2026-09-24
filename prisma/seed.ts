import { PrismaClient, ContentStatus } from "@prisma/client";
import { products as sourceProducts } from "../lib/data";

const db = new PrismaClient();

const slugify = (value: string) =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function main() {
  const categoryNames = [...new Set(sourceProducts.map((p) => p.category))];

  for (const name of categoryNames) {
    await db.category.upsert({
      where: { slug: slugify(name) },
      update: { name },
      create: { name, slug: slugify(name) },
    });
  }

  for (const source of sourceProducts) {
    const category = await db.category.findUniqueOrThrow({
      where: { slug: slugify(source.category) },
    });

    const product = await db.product.upsert({
      where: { slug: source.slug },
      update: {
        name: source.name,
        categoryId: category.id,
        subcategory: source.subcategory,
        tagline: source.tagline,
        description: source.description,
        rating: source.rating,
        officialUrl: source.officialUrl,
        pricingUrl: source.pricingUrl,
        bestFor: source.bestFor,
        features: source.features,
        pros: source.pros,
        cons: source.cons,
        tags: [source.category, source.subcategory],
        comparison: source.comparison,
        status: ContentStatus.DRAFT,
      },
      create: {
        slug: source.slug,
        name: source.name,
        categoryId: category.id,
        subcategory: source.subcategory,
        tagline: source.tagline,
        description: source.description,
        rating: source.rating,
        officialUrl: source.officialUrl,
        pricingUrl: source.pricingUrl,
        bestFor: source.bestFor,
        features: source.features,
        pros: source.pros,
        cons: source.cons,
        tags: [source.category, source.subcategory],
        comparison: source.comparison,
        status: ContentStatus.DRAFT,
      },
    });

    await db.faq.deleteMany({ where: { productId: product.id } });
    await db.pricingSnapshot.deleteMany({ where: { productId: product.id } });
    await db.affiliateLink.deleteMany({ where: { productId: product.id } });
    await db.alternative.deleteMany({
      where: { OR: [{ productId: product.id }, { alternativeId: product.id }] },
    });
    await db.changeLog.deleteMany({ where: { productId: product.id } });
    await db.contentRefresh.deleteMany({ where: { productId: product.id } });

    await db.faq.createMany({
      data: source.faqs.map((faq, index) => ({
        productId: product.id,
        question: faq.q,
        answer: faq.a,
        sortOrder: index,
      })),
    });

    await db.pricingSnapshot.create({
      data: {
        productId: product.id,
        snapshotType: "PRICING",
        capturedAt: new Date(source.pricingUpdated),
        sourceUrl: source.pricingUrl,
        summary: source.pricing,
      },
    });

    await db.changeLog.create({
      data: {
        productId: product.id,
        version: "seed-1",
        summary: "Imported editorial seed review data.",
      },
    });

    const dueAt = new Date(source.pricingUpdated);
    dueAt.setDate(dueAt.getDate() + 90);
    await db.contentRefresh.create({
      data: {
        productId: product.id,
        dueAt,
        reason: "Quarterly pricing and review freshness check.",
      },
    });
  }

  for (const source of sourceProducts) {
    const product = await db.product.findUniqueOrThrow({ where: { slug: source.slug } });

    for (const [index, alternativeSlug] of source.alternatives.entries()) {
      const alternative = await db.product.findUnique({
        where: { slug: alternativeSlug },
      });
      if (!alternative || alternative.id === product.id) continue;

      await db.alternative.create({
        data: {
          productId: product.id,
          alternativeId: alternative.id,
          sortOrder: index,
        },
      });
    }
  }

  console.log(`Seeded ${sourceProducts.length} products with FAQs, pricing snapshots, alternatives and refresh schedules.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
