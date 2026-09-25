import { PrismaClient, type Prisma } from "@prisma/client";
import { seedCategories } from "../lib/content/seed/categories";
import { seedProducts } from "../lib/content/seed/products";
import { seedUseCases } from "../lib/content/seed/use-cases";
import { seedPairs } from "../lib/content/seed/pairs";
import { seedProductProblems } from "../lib/content/seed-catalog";
import { canonicalPair, comparePairSlug, slugify } from "../lib/seo/routes";

// Seeds editorial content. Safe for production:
// - default mode only CREATES records that do not exist yet; existing rows are never modified;
// - `--refresh-seed` updates seed-owned editorial fields (products, categories, use cases, pairs
//   whose slugs are in the seed set) but never deletes pricing snapshots, affiliate links,
//   analytics, sponsors or change-log history;
// - no prices are seeded: pricing notes become PENDING snapshots for editors to verify.

const db = new PrismaClient();
const refresh = process.argv.includes("--refresh-seed");
const now = new Date();

async function seedCategory(c: (typeof seedCategories)[number]) {
  const data = { name: c.name, description: c.description, intro: c.intro, seoTitle: c.seoTitle, seoDescription: c.seoDescription, sortOrder: c.sortOrder };
  const existing = await db.category.findUnique({ where: { slug: c.slug } });
  if (existing && !refresh) return { row: existing, created: false };
  const row = existing ? await db.category.update({ where: { id: existing.id }, data }) : await db.category.create({ data: { ...data, slug: c.slug } });
  await db.faq.deleteMany({ where: { categoryId: row.id } });
  await db.faq.createMany({ data: c.faqs.map((f, i) => ({ categoryId: row.id, question: f.question, answer: f.answer, sortOrder: i })) });
  return { row, created: !existing };
}

async function setTags(tx: Prisma.TransactionClient, productId: string, tags: string[]) {
  await tx.productTag.deleteMany({ where: { productId } });
  for (const name of tags) {
    const slug = slugify(name);
    if (!slug) continue;
    const tag = await tx.tag.upsert({ where: { slug }, update: {}, create: { name, slug } });
    await tx.productTag.create({ data: { productId, tagId: tag.id } });
  }
}

async function main() {
  const categoryIds = new Map<string, string>();
  let created = 0;
  let updated = 0;
  for (const c of seedCategories) {
    const { row } = await seedCategory(c);
    categoryIds.set(c.slug, row.id);
  }

  const touched = new Set<string>();
  for (const s of seedProducts) {
    const categoryId = categoryIds.get(s.category);
    if (!categoryId) throw new Error(`Unknown category ${s.category} for ${s.slug}`);
    const problems = seedProductProblems(s);
    const status = problems.length ? "DRAFT" : "PUBLISHED";
    if (problems.length) console.warn(`[seed] ${s.slug} left as DRAFT: ${problems.join("; ")}`);
    const existing = await db.product.findUnique({ where: { slug: s.slug } });
    if (existing && !refresh) continue;
    const fields = {
      name: s.name, vendor: s.vendor, categoryId, subcategory: s.subcategory, tagline: s.tagline, description: s.description,
      officialUrl: s.officialUrl, pricingUrl: s.pricingUrl, features: s.features, comparison: s.comparison, alternativesIntro: s.alternativesIntro,
      status, contentUpdatedAt: now, ...(status === "PUBLISHED" && !existing?.publishedAt ? { publishedAt: now } : {}),
    } as const;
    const review = { rating: s.review.rating, editorialSummary: s.review.editorialSummary, verdict: s.review.verdict, pros: s.review.pros, cons: s.review.cons, bestFor: s.review.bestFor, limitations: s.review.limitations };

    await db.$transaction(async (tx) => {
      const product = existing ? await tx.product.update({ where: { id: existing.id }, data: fields }) : await tx.product.create({ data: { ...fields, slug: s.slug } });
      await tx.reviewMetadata.upsert({ where: { productId: product.id }, update: review, create: { ...review, productId: product.id } });
      await setTags(tx, product.id, s.tags);
      await tx.faq.deleteMany({ where: { productId: product.id } });
      await tx.faq.createMany({ data: s.faqs.map((f, i) => ({ productId: product.id, question: f.question, answer: f.answer, sortOrder: i })) });
      const noteExists = await tx.pricingSnapshot.count({ where: { productId: product.id, summary: s.pricingNote } });
      if (!noteExists) {
        await tx.pricingSnapshot.create({ data: { productId: product.id, summary: s.pricingNote, sourceUrl: s.pricingUrl, sourceType: "MANUAL_CHECK", status: "PENDING" } });
      }
      await tx.changeLog.create({ data: { productId: product.id, version: existing ? "seed-refresh" : "seed-1", summary: existing ? "Editorial profile refreshed from the seed content set." : "Initial structured editorial profile published." } });
    });
    touched.add(s.slug);
    if (existing) updated++;
    else created++;
  }

  // Alternatives for created/refreshed products (after all products exist).
  const ids = new Map((await db.product.findMany({ select: { id: true, slug: true } })).map((p) => [p.slug, p.id]));
  for (const s of seedProducts) {
    if (!touched.has(s.slug)) continue;
    const productId = ids.get(s.slug)!;
    for (const [i, a] of s.alternatives.entries()) {
      const alternativeId = ids.get(a.slug);
      if (!alternativeId || alternativeId === productId) continue;
      await db.alternative.upsert({
        where: { productId_alternativeId: { productId, alternativeId } },
        update: { rationale: a.rationale, keyDifference: a.keyDifference, sortOrder: i, active: true },
        create: { productId, alternativeId, rationale: a.rationale, keyDifference: a.keyDifference, sortOrder: i },
      });
    }
  }

  for (const u of seedUseCases) {
    const existing = await db.useCase.findUnique({ where: { slug: u.slug } });
    if (existing && !refresh) continue;
    const data = { title: u.title, audience: u.audience, intro: u.intro, criteria: u.criteria, categoryId: categoryIds.get(u.category)!, seoTitle: u.seoTitle, seoDescription: u.seoDescription, status: "PUBLISHED" as const, contentUpdatedAt: now };
    const row = existing ? await db.useCase.update({ where: { id: existing.id }, data }) : await db.useCase.create({ data: { ...data, slug: u.slug } });
    await db.faq.deleteMany({ where: { useCaseId: row.id } });
    await db.faq.createMany({ data: u.faqs.map((f, i) => ({ useCaseId: row.id, question: f.question, answer: f.answer, sortOrder: i })) });
    await db.useCaseProduct.deleteMany({ where: { useCaseId: row.id } });
    await db.useCaseProduct.createMany({
      data: u.products.filter((x) => ids.has(x.slug)).map((x, i) => ({ useCaseId: row.id, productId: ids.get(x.slug)!, rationale: x.rationale, caveat: x.caveat, position: i })),
    });
  }

  for (const pair of seedPairs) {
    const slug = comparePairSlug(pair.a, pair.b);
    const existing = await db.competitorPair.findUnique({ where: { slug } });
    if (existing && !refresh) continue;
    const swap = canonicalPair(pair.a, pair.b)[0] !== pair.a;
    const [a, b] = swap ? [pair.b, pair.a] : [pair.a, pair.b];
    const product = seedProducts.find((p) => p.slug === a)!;
    const data = {
      productAId: ids.get(a)!, productBId: ids.get(b)!, categoryId: categoryIds.get(product.category)!, summary: pair.summary,
      chooseA: swap ? pair.chooseB : pair.chooseA, chooseB: swap ? pair.chooseA : pair.chooseB, highlights: pair.highlights, active: true,
    };
    if (existing) await db.competitorPair.update({ where: { id: existing.id }, data });
    else await db.competitorPair.create({ data: { ...data, slug } });
  }

  console.log(`[seed] mode=${refresh ? "refresh" : "create-only"} products created=${created} refreshed=${updated}; categories=${seedCategories.length}, use cases=${seedUseCases.length}, pairs=${seedPairs.length}.`);
}

main()
  .catch((error) => {
    console.error("[seed] failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
