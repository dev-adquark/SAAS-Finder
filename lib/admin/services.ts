import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { publishProblems } from "@/lib/content/publish-validation";
import { MIN_USE_CASE_PRODUCTS } from "@/lib/content/sanitize";
import { strArray, strRecord } from "@/lib/catalog";
import { canonicalPair, comparePairSlug, slugify } from "@/lib/seo/routes";
import { formatPrice } from "@/lib/pricing";
import { EVENT_NAMES, LEGACY_EVENT_NAMES } from "@/lib/analytics";
import {
  InputError,
  type AlternativeInput,
  type CategoryInput,
  type ChangelogInput,
  type FaqInput,
  type LinkInput,
  type PairInput,
  type ProductInput,
  type RefreshInput,
  type ReviewInput,
  type SnapshotInput,
  type SponsorInput,
  type UseCaseInput,
  type UseCaseProductInput,
} from "@/lib/admin/inputs";

// Single write path for all admin mutations (JSON API and admin UI). Every write validates first,
// enforces publish rules inside a transaction, and revalidates cached public pages afterwards.

export class NotFoundError extends Error {}

type Tx = Prisma.TransactionClient;

/** Revalidates every public page. Safe outside a Next.js request (e.g. scripts/tests). */
export function revalidateSite() {
  try {
    revalidatePath("/", "layout");
  } catch {
    // Not running inside Next.js — nothing to revalidate.
  }
}

/** Maps Prisma constraint errors to user-facing validation errors. */
export function friendly(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") throw new InputError([`A record with this ${String((error.meta?.target as string[] | undefined)?.join(", ") ?? "value")} already exists`]);
    if (error.code === "P2003") throw new InputError(["This record is still referenced by other content"]);
    if (error.code === "P2025") throw new NotFoundError("Not found");
  }
  throw error;
}

async function run<T>(fn: () => Promise<T>): Promise<T> {
  try {
    const out = await fn();
    revalidateSite();
    return out;
  } catch (e) {
    if (e instanceof InputError || e instanceof NotFoundError) throw e;
    return friendly(e);
  }
}

// ---------------- Products ----------------

const EDITORIAL_KEYS = ["name", "vendor", "subcategory", "tagline", "description", "features", "comparison", "alternativesIntro", "officialUrl", "pricingUrl"] as const;

async function assertPublishable(tx: Tx, productId: string) {
  const p = await tx.product.findUniqueOrThrow({
    where: { id: productId },
    include: { category: { select: { slug: true } }, review: true, _count: { select: { faqs: true, alternativesFrom: { where: { active: true } } } } },
  });
  const problems = publishProblems({
    slug: p.slug,
    name: p.name,
    categorySlug: p.category.slug,
    tagline: p.tagline,
    description: p.description,
    officialUrl: p.officialUrl,
    pricingUrl: p.pricingUrl,
    features: strArray(p.features),
    comparison: strRecord(p.comparison),
    alternativesIntro: p.alternativesIntro,
    review: p.review ? { editorialSummary: p.review.editorialSummary, pros: strArray(p.review.pros), cons: strArray(p.review.cons), bestFor: strArray(p.review.bestFor), limitations: strArray(p.review.limitations) } : null,
    faqCount: p._count.faqs,
    alternativeCount: p._count.alternativesFrom,
  });
  if (problems.length) throw new InputError([`Cannot publish ${p.name}: ${problems.join("; ")}`]);
}

async function setTags(tx: Tx, productId: string, tags: string[]) {
  await tx.productTag.deleteMany({ where: { productId } });
  for (const name of tags) {
    const slug = slugify(name);
    if (!slug) continue;
    const tag = await tx.tag.upsert({ where: { slug }, update: {}, create: { name, slug } });
    await tx.productTag.create({ data: { productId, tagId: tag.id } });
  }
}

async function syncPairSlugs(tx: Tx, productId: string) {
  const pairs = await tx.competitorPair.findMany({ where: { OR: [{ productAId: productId }, { productBId: productId }] }, include: { productA: true, productB: true } });
  for (const pair of pairs) {
    const [a, b] = pair.productA.slug < pair.productB.slug ? [pair.productA, pair.productB] : [pair.productB, pair.productA];
    await tx.competitorPair.update({ where: { id: pair.id }, data: { slug: comparePairSlug(a.slug, b.slug), productAId: a.id, productBId: b.id, ...(a.id !== pair.productAId ? { chooseA: pair.chooseB, chooseB: pair.chooseA } : {}) } });
  }
}

function reviewData(r: ReviewInput) {
  const data: Record<string, unknown> = { ...r };
  if (r.editorialSummary === null) data.editorialSummary = "";
  if (r.reviewStatus === "REVIEWED" && r.lastReviewedAt == null) data.lastReviewedAt = new Date();
  return data;
}

export async function createProduct(input: { product: ProductInput; review: ReviewInput }) {
  return run(() =>
    db.$transaction(async (tx) => {
      const { tags, ...p } = input.product;
      if (!(await tx.category.findUnique({ where: { id: p.categoryId! } }))) throw new InputError(["category not found"]);
      const created = await tx.product.create({
        data: {
          slug: p.slug!, name: p.name!, vendor: p.vendor ?? null, categoryId: p.categoryId!, subcategory: p.subcategory ?? null, tagline: p.tagline!, description: p.description!,
          officialUrl: p.officialUrl!, pricingUrl: p.pricingUrl ?? null, features: p.features ?? [], comparison: p.comparison ?? {}, alternativesIntro: p.alternativesIntro ?? null,
          seoTitle: p.seoTitle ?? null, seoDescription: p.seoDescription ?? null, refreshIntervalDays: p.refreshIntervalDays ?? null, status: "DRAFT",
          review: { create: { editorialSummary: "", pros: [], cons: [], bestFor: [], limitations: [], ...reviewData(input.review) } },
        },
      });
      if (tags) await setTags(tx, created.id, tags);
      // New products always start as drafts: FAQs and alternatives must exist before publishing.
      if (p.status && p.status !== "DRAFT") throw new InputError(["New products are created as DRAFT; add FAQs and alternatives, then publish"]);
      return created;
    }),
  );
}

export async function updateProduct(id: string, input: { product: ProductInput; review: ReviewInput }) {
  return run(() =>
    db.$transaction(async (tx) => {
      const current = await tx.product.findUnique({ where: { id }, include: { review: true, tags: { include: { tag: true } } } });
      if (!current) throw new NotFoundError("Product not found");
      const { tags, ...p } = input.product;
      if (p.categoryId && !(await tx.category.findUnique({ where: { id: p.categoryId } }))) throw new InputError(["category not found"]);
      // Only real editorial changes move the public "content updated" date (and sitemap lastmod).
      const differs = (a: unknown, b: unknown) => a !== undefined && JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);
      const reviewChanged = Object.entries(reviewData(input.review)).some(([k, v]) => {
        const cur = current.review ? (current.review as Record<string, unknown>)[k] : undefined;
        return differs(v instanceof Date ? v.toISOString() : v, cur instanceof Date ? cur.toISOString() : cur);
      });
      const tagsChanged = tags !== undefined && differs([...tags].sort(), current.tags.map((t) => t.tag.name).sort());
      const editorialChange = EDITORIAL_KEYS.some((k) => differs(p[k], current[k])) || reviewChanged || tagsChanged;
      const publishing = p.status === "PUBLISHED" && current.status !== "PUBLISHED";
      const updated = await tx.product.update({
        where: { id },
        data: {
          ...p,
          ...(editorialChange ? { contentUpdatedAt: new Date() } : {}),
          ...(publishing && !current.publishedAt ? { publishedAt: new Date() } : {}),
          ...(p.features ? { features: p.features } : {}),
          ...(p.comparison ? { comparison: p.comparison } : {}),
        },
      });
      if (Object.keys(input.review).length) {
        await tx.reviewMetadata.upsert({
          where: { productId: id },
          update: reviewData(input.review),
          create: { productId: id, editorialSummary: "", pros: [], cons: [], bestFor: [], limitations: [], ...reviewData(input.review) },
        });
      }
      if (tags && tagsChanged) await setTags(tx, id, tags);
      if (p.slug && p.slug !== current.slug) await syncPairSlugs(tx, id);
      if (updated.status === "PUBLISHED") await assertPublishable(tx, id);
      return updated;
    }),
  );
}

/** Safe delete: published products must be unpublished (archived/drafted) first. */
export async function deleteProduct(id: string) {
  return run(async () => {
    const p = await db.product.findUnique({ where: { id }, select: { status: true, name: true } });
    if (!p) throw new NotFoundError("Product not found");
    if (p.status === "PUBLISHED") throw new InputError([`${p.name} is published. Archive it before deleting.`]);
    await db.product.delete({ where: { id } });
    return { ok: true };
  });
}

// ---------------- Categories ----------------

export const createCategory = (c: CategoryInput) => run(() => db.category.create({ data: { name: c.name!, slug: c.slug!, description: c.description ?? null, intro: c.intro ?? null, seoTitle: c.seoTitle ?? null, seoDescription: c.seoDescription ?? null, sortOrder: c.sortOrder ?? 0 } }));
export const updateCategory = (id: string, c: CategoryInput) => run(() => db.category.update({ where: { id }, data: c }));
export async function deleteCategory(id: string) {
  return run(async () => {
    const counts = await db.category.findUnique({ where: { id }, select: { _count: { select: { products: true, useCases: true, pairs: true } } } });
    if (!counts) throw new NotFoundError("Category not found");
    const { products, useCases, pairs } = counts._count;
    if (products + useCases + pairs > 0) throw new InputError([`Category is still used by ${products} products, ${useCases} use cases and ${pairs} comparisons`]);
    await db.category.delete({ where: { id } });
    return { ok: true };
  });
}

// ---------------- FAQs (product / category / use case) ----------------

export type FaqOwner = { productId: string } | { categoryId: string } | { useCaseId: string };

export async function addFaq(owner: FaqOwner, f: FaqInput) {
  return run(async () => {
    const exists =
      "productId" in owner ? await db.product.count({ where: { id: owner.productId } }) : "categoryId" in owner ? await db.category.count({ where: { id: owner.categoryId } }) : await db.useCase.count({ where: { id: owner.useCaseId } });
    if (!exists) throw new NotFoundError("Owner not found");
    return db.faq.create({ data: { ...owner, question: f.question, answer: f.answer, sortOrder: f.sortOrder ?? 0 } });
  });
}
export const updateFaq = (id: string, f: Partial<FaqInput>) => run(() => db.faq.update({ where: { id }, data: f }));
export async function deleteFaq(id: string) {
  return run(async () => {
    const faq = await db.faq.findUnique({ where: { id }, include: { product: { select: { status: true, _count: { select: { faqs: true } } } } } });
    if (!faq) throw new NotFoundError("FAQ not found");
    if (faq.product?.status === "PUBLISHED" && faq.product._count.faqs <= 1) throw new InputError(["A published product needs at least one FAQ"]);
    await db.faq.delete({ where: { id } });
    return { ok: true };
  });
}

// ---------------- Pricing snapshots & freshness workflow ----------------

/**
 * Records a pricing observation. Automated detections are always PENDING; an editor may record a
 * manual/official check as verified in one step (`verify`).
 */
export async function addSnapshot(productId: string, s: SnapshotInput, opts: { verify?: boolean; by?: string } = {}) {
  const snap = await run(async () => {
    if (!(await db.product.count({ where: { id: productId } }))) throw new NotFoundError("Product not found");
    return db.pricingSnapshot.create({
      data: {
        productId, summary: s.summary, snapshotType: s.snapshotType ?? "PRICING", plan: s.plan ?? null, price: s.price ?? null, currency: s.currency ?? null,
        billingPeriod: s.billingPeriod ?? null, sourceUrl: s.sourceUrl ?? null, sourceType: s.sourceType ?? "MANUAL_CHECK", status: "PENDING", ...(s.capturedAt ? { capturedAt: s.capturedAt } : {}),
      },
    });
  });
  if (opts.verify) {
    if (snap.sourceType === "AUTOMATED_DETECTION") throw new InputError(["Automated detections must be reviewed before verification"]);
    return verifySnapshot(snap.id, opts.by);
  }
  return snap;
}

/** Editor approval: publishes the snapshot, supersedes the previous price for the same plan, logs it. */
export async function verifySnapshot(id: string, by?: string) {
  return run(() =>
    db.$transaction(async (tx) => {
      const s = await tx.pricingSnapshot.findUnique({ where: { id } });
      if (!s) throw new NotFoundError("Snapshot not found");
      if (s.status !== "PENDING") throw new InputError([`Snapshot is already ${s.status.toLowerCase()}`]);
      if (s.price !== null && (!s.currency || !s.sourceUrl)) throw new InputError(["A priced snapshot needs a currency and source URL before verification"]);
      const now = new Date();
      await tx.pricingSnapshot.updateMany({
        where: { productId: s.productId, status: "VERIFIED", snapshotType: s.snapshotType, plan: s.plan === null ? null : { equals: s.plan, mode: "insensitive" } },
        data: { status: "SUPERSEDED" },
      });
      const verified = await tx.pricingSnapshot.update({ where: { id }, data: { status: "VERIFIED", verifiedAt: now, verifiedBy: by ?? null } });
      await tx.product.update({ where: { id: s.productId }, data: { pricingCheckedAt: now } });
      const priceText = formatPrice({ plan: s.plan, price: s.price === null ? null : Number(s.price), currency: s.currency, billingPeriod: s.billingPeriod, note: s.summary, sourceUrl: s.sourceUrl, sourceType: s.sourceType, capturedAt: s.capturedAt.toISOString() });
      await tx.changeLog.create({ data: { productId: s.productId, version: `pricing-${now.toISOString().slice(0, 10)}`, summary: `Pricing verified${s.plan ? ` for ${s.plan}` : ""}: ${priceText}. ${s.summary}`.slice(0, 2000) } });
      await tx.contentRefresh.updateMany({ where: { productId: s.productId, completedAt: null }, data: { completedAt: now, resolution: "New pricing snapshot verified." } });
      return verified;
    }),
  );
}

export async function rejectSnapshot(id: string) {
  return run(async () => {
    const s = await db.pricingSnapshot.findUnique({ where: { id } });
    if (!s) throw new NotFoundError("Snapshot not found");
    if (s.status !== "PENDING") throw new InputError([`Snapshot is already ${s.status.toLowerCase()}`]);
    return db.pricingSnapshot.update({ where: { id }, data: { status: "REJECTED" } });
  });
}

/** Retires a verified price (e.g. a discontinued plan) without deleting its history. */
export const retireSnapshot = (id: string) => run(() => db.pricingSnapshot.update({ where: { id, status: "VERIFIED" }, data: { status: "SUPERSEDED" } }));

export const addRefresh = (productId: string, r: RefreshInput) =>
  run(async () => {
    if (!(await db.product.count({ where: { id: productId } }))) throw new NotFoundError("Product not found");
    return db.contentRefresh.create({ data: { productId, reason: r.reason, dueAt: r.dueAt } });
  });

/** Editor confirmed vendor pricing is unchanged: closes the task and bumps "Last checked". */
export async function resolveRefreshNoChange(refreshId: string, note: string, productId?: string) {
  return run(() =>
    db.$transaction(async (tx) => {
      const r = await tx.contentRefresh.findFirst({ where: { id: refreshId, ...(productId ? { productId } : {}) } });
      if (!r) throw new NotFoundError("Refresh task not found");
      if (r.completedAt) throw new InputError(["Refresh task is already completed"]);
      const now = new Date();
      await tx.product.update({ where: { id: r.productId }, data: { pricingCheckedAt: now } });
      await tx.changeLog.create({ data: { productId: r.productId, version: `check-${now.toISOString().slice(0, 10)}`, summary: `Pricing re-checked against the vendor; no change. ${note}`.trim().slice(0, 2000) } });
      return tx.contentRefresh.update({ where: { id: refreshId }, data: { completedAt: now, resolution: note || "Checked; no change." } });
    }),
  );
}

export const reopenRefresh = (refreshId: string, productId?: string) =>
  run(async () => {
    const r = await db.contentRefresh.findFirst({ where: { id: refreshId, ...(productId ? { productId } : {}) } });
    if (!r) throw new NotFoundError("Refresh task not found");
    return db.contentRefresh.update({ where: { id: refreshId }, data: { completedAt: null, resolution: null } });
  });

export const addChangelog = (productId: string, c: ChangelogInput) =>
  run(async () => {
    if (!(await db.product.count({ where: { id: productId } }))) throw new NotFoundError("Product not found");
    return db.changeLog.create({ data: { productId, version: c.version, summary: c.summary } });
  });

// ---------------- Affiliate links ----------------

export const addLink = (productId: string, l: LinkInput) =>
  run(async () => {
    if (!(await db.product.count({ where: { id: productId } }))) throw new NotFoundError("Product not found");
    return db.affiliateLink.create({ data: { productId, label: l.label!, url: l.url!, provider: l.provider ?? null, active: l.active === true, verifiedAt: l.active ? new Date() : null } });
  });

export const updateLink = (id: string, l: LinkInput) =>
  run(async () => {
    const current = await db.affiliateLink.findUnique({ where: { id } });
    if (!current) throw new NotFoundError("Link not found");
    // Changing the URL of an active link requires re-verification.
    const urlChanged = l.url !== undefined && l.url !== current.url;
    const active = l.active ?? (urlChanged ? false : current.active);
    return db.affiliateLink.update({ where: { id }, data: { ...l, active, verifiedAt: active ? (current.verifiedAt && !urlChanged ? current.verifiedAt : new Date()) : null } });
  });

export const deleteLink = (id: string) => run(() => db.affiliateLink.delete({ where: { id } }));

// ---------------- Alternatives ----------------

export const addAlternative = (productId: string, a: AlternativeInput) =>
  run(async () => {
    if (a.alternativeId === productId) throw new InputError(["A product cannot be its own alternative"]);
    const [source, target] = await Promise.all([db.product.count({ where: { id: productId } }), db.product.count({ where: { id: a.alternativeId! } })]);
    if (!source) throw new NotFoundError("Product not found");
    if (!target) throw new InputError(["alternative product not found"]);
    return db.alternative.create({ data: { productId, alternativeId: a.alternativeId!, rationale: a.rationale!, keyDifference: a.keyDifference ?? null, sortOrder: a.sortOrder ?? 0, active: a.active ?? true, useCaseId: a.useCaseId ?? null } });
  });

export const updateAlternative = (id: string, a: AlternativeInput) =>
  run(async () => {
    const { alternativeId: _ignored, ...rest } = a;
    void _ignored;
    return db.alternative.update({ where: { id }, data: rest });
  });

export async function deleteAlternative(id: string) {
  return run(async () => {
    const alt = await db.alternative.findUnique({ where: { id }, include: { product: { select: { status: true, _count: { select: { alternativesFrom: { where: { active: true } } } } } } } });
    if (!alt) throw new NotFoundError("Alternative not found");
    if (alt.product.status === "PUBLISHED" && alt.active && alt.product._count.alternativesFrom <= 1) throw new InputError(["A published product needs at least one active alternative"]);
    await db.alternative.delete({ where: { id } });
    return { ok: true };
  });
}

// ---------------- Comparison pairs ----------------

export async function createPair(p: PairInput) {
  return run(async () => {
    if (p.productAId === p.productBId) throw new InputError(["A comparison needs two different products"]);
    const [x, y] = await Promise.all([db.product.findUnique({ where: { id: p.productAId! } }), db.product.findUnique({ where: { id: p.productBId! } })]);
    if (!x || !y) throw new InputError(["both products must exist"]);
    if (x.categoryId !== y.categoryId) throw new InputError(["compared products must share a category so the comparison schema applies"]);
    // Canonical order: productA has the alphabetically smaller slug. Swap the "choose" copy with it.
    const [slugA] = canonicalPair(x.slug, y.slug);
    const swap = slugA !== x.slug;
    const [a, b] = swap ? [y, x] : [x, y];
    return db.competitorPair.create({
      data: { slug: comparePairSlug(a.slug, b.slug), productAId: a.id, productBId: b.id, categoryId: a.categoryId, summary: p.summary!, chooseA: swap ? p.chooseB! : p.chooseA!, chooseB: swap ? p.chooseA! : p.chooseB!, highlights: p.highlights ?? [], active: p.active ?? true },
    });
  });
}

export const updatePair = (id: string, p: PairInput) =>
  run(async () => {
    const { productAId: _a, productBId: _b, ...rest } = p;
    void _a;
    void _b;
    return db.competitorPair.update({ where: { id }, data: rest });
  });

export const deletePair = (id: string) => run(() => db.competitorPair.delete({ where: { id } }));

// ---------------- Use cases (best-for pages) ----------------

async function assertUseCasePublishable(tx: Tx, id: string) {
  const u = await tx.useCase.findUniqueOrThrow({ where: { id }, include: { products: { where: { active: true, product: { status: "PUBLISHED" } } } } });
  const problems: string[] = [];
  if (!u.intro.trim()) problems.push("intro is required");
  if (!Array.isArray(u.criteria) || u.criteria.length === 0) problems.push("at least one selection criterion");
  if (u.products.length < MIN_USE_CASE_PRODUCTS) problems.push(`at least ${MIN_USE_CASE_PRODUCTS} active picks that are published products`);
  if (u.products.some((x) => !x.rationale.trim())) problems.push("every pick needs a rationale");
  if (problems.length) throw new InputError([`Cannot publish ${u.title}: ${problems.join("; ")}`]);
}

export const createUseCase = (u: UseCaseInput) =>
  run(async () => {
    if (!(await db.category.count({ where: { id: u.categoryId! } }))) throw new InputError(["category not found"]);
    if (u.status && u.status !== "DRAFT") throw new InputError(["New use cases are created as DRAFT; add picks, then publish"]);
    return db.useCase.create({ data: { slug: u.slug!, title: u.title!, audience: u.audience!, intro: u.intro!, criteria: u.criteria ?? [], categoryId: u.categoryId!, seoTitle: u.seoTitle ?? null, seoDescription: u.seoDescription ?? null } });
  });

export const updateUseCase = (id: string, u: UseCaseInput) =>
  run(() =>
    db.$transaction(async (tx) => {
      const updated = await tx.useCase.update({ where: { id }, data: { ...u, ...(u.criteria ? { criteria: u.criteria } : {}), contentUpdatedAt: new Date() } });
      if (updated.status === "PUBLISHED") await assertUseCasePublishable(tx, id);
      return updated;
    }),
  );

export async function deleteUseCase(id: string) {
  return run(async () => {
    const u = await db.useCase.findUnique({ where: { id } });
    if (!u) throw new NotFoundError("Use case not found");
    if (u.status === "PUBLISHED") throw new InputError(["Archive the use case before deleting it"]);
    await db.useCase.delete({ where: { id } });
    return { ok: true };
  });
}

export const addUseCaseProduct = (useCaseId: string, x: UseCaseProductInput) =>
  run(async () => {
    const [u, p] = await Promise.all([db.useCase.findUnique({ where: { id: useCaseId } }), db.product.findUnique({ where: { id: x.productId! } })]);
    if (!u) throw new NotFoundError("Use case not found");
    if (!p) throw new InputError(["product not found"]);
    if (p.categoryId !== u.categoryId) throw new InputError(["picks must belong to the use case's category"]);
    return db.useCaseProduct.create({ data: { useCaseId, productId: p.id, rationale: x.rationale!, caveat: x.caveat ?? null, position: x.position ?? 0, active: x.active ?? true } });
  });

export const updateUseCaseProduct = (id: string, x: UseCaseProductInput) =>
  run(async () => {
    const { productId: _p, ...rest } = x;
    void _p;
    return db.$transaction(async (tx) => {
      const row = await tx.useCaseProduct.update({ where: { id }, data: rest });
      const u = await tx.useCase.update({ where: { id: row.useCaseId }, data: { contentUpdatedAt: new Date() } });
      if (u.status === "PUBLISHED") await assertUseCasePublishable(tx, u.id);
      return row;
    });
  });

export const deleteUseCaseProduct = (id: string) =>
  run(() =>
    db.$transaction(async (tx) => {
      const row = await tx.useCaseProduct.delete({ where: { id } });
      const u = await tx.useCase.findUniqueOrThrow({ where: { id: row.useCaseId } });
      if (u.status === "PUBLISHED") await assertUseCasePublishable(tx, u.id);
      return { ok: true };
    }),
  );

// ---------------- Sponsors ----------------

export const createSponsor = (s: SponsorInput) =>
  run(() =>
    db.sponsorSlot.create({
      data: { title: s.title!, label: s.label ?? "Sponsored", description: s.description ?? null, pageType: s.pageType!, placement: s.placement!, priority: s.priority ?? 0, campaign: s.campaign ?? null, active: s.active === true, url: s.url ?? null, startsAt: s.startsAt ?? null, endsAt: s.endsAt ?? null },
    }),
  );

export const updateSponsor = (id: string, s: SponsorInput) =>
  run(async () => {
    const current = await db.sponsorSlot.findUnique({ where: { id } });
    if (!current) throw new NotFoundError("Sponsor not found");
    const startsAt = s.startsAt === undefined ? current.startsAt : s.startsAt;
    const endsAt = s.endsAt === undefined ? current.endsAt : s.endsAt;
    if (startsAt && endsAt && startsAt > endsAt) throw new InputError(["startsAt must be before endsAt"]);
    return db.sponsorSlot.update({ where: { id }, data: s });
  });

export const deleteSponsor = (id: string) => run(() => db.sponsorSlot.delete({ where: { id } }));

// ---------------- Analytics reporting ----------------

export const REPORTED_EVENTS = [...EVENT_NAMES, ...LEGACY_EVENT_NAMES] as string[];

export async function analyticsReport(from: Date, to: Date) {
  const where = { createdAt: { gte: from, lte: to } };
  const [total, byEvent, byProduct, byCta, bySponsor, byPage] = await Promise.all([
    db.analyticsEvent.count({ where }),
    db.analyticsEvent.groupBy({ by: ["event"], where: { ...where, event: { in: REPORTED_EVENTS } }, _count: { _all: true } }),
    db.analyticsEvent.groupBy({ by: ["productSlug", "event"], where: { ...where, productSlug: { not: null }, event: { in: ["cta_click", "outbound_click", "affiliate_click"] } }, _count: { _all: true } }),
    db.analyticsEvent.groupBy({ by: ["ctaType", "placement", "pageType"], where: { ...where, event: { in: ["cta_click", "outbound_click"] } }, _count: { _all: true } }),
    db.analyticsEvent.groupBy({ by: ["sponsorId", "pageType"], where: { ...where, event: "sponsor_click" }, _count: { _all: true } }),
    db.analyticsEvent.groupBy({ by: ["path"], where: { ...where, event: "page_view" }, _count: { _all: true }, orderBy: { _count: { path: "desc" } }, take: 25 }),
  ]);
  const byCount = <T extends { _count: { _all: number } }>(rows: T[]) => [...rows].sort((a, b) => b._count._all - a._count._all);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    total,
    byEvent: byCount(byEvent).map((r) => ({ event: r.event, count: r._count._all })),
    byProduct: byCount(byProduct).slice(0, 50).map((r) => ({ productSlug: r.productSlug, event: r.event, count: r._count._all })),
    ctaPerformance: byCount(byCta).slice(0, 50).map((r) => ({ ctaType: r.ctaType, placement: r.placement, pageType: r.pageType, count: r._count._all })),
    sponsorClicks: byCount(bySponsor).map((r) => ({ sponsorId: r.sponsorId, pageType: r.pageType, count: r._count._all })),
    topPages: byPage.map((r) => ({ path: r.path, count: r._count._all })),
  };
}

/** Parses an analytics window; defaults to the last 30 days, max 366 days. */
export function analyticsWindow(fromRaw: string | null, toRaw: string | null, now = new Date()) {
  // Default end has a small slack so events written in the same instant are never cut off.
  const to = toRaw && !Number.isNaN(new Date(toRaw).getTime()) ? new Date(toRaw) : new Date(now.getTime() + 60_000);
  if (toRaw && /^\d{4}-\d{2}-\d{2}$/.test(toRaw)) to.setUTCHours(23, 59, 59, 999);
  const fallback = new Date(to.getTime() - 30 * 86_400_000);
  let from = fromRaw && !Number.isNaN(new Date(fromRaw).getTime()) ? new Date(fromRaw) : fallback;
  if (from > to) from = fallback;
  if (to.getTime() - from.getTime() > 366 * 86_400_000) from = new Date(to.getTime() - 366 * 86_400_000);
  return { from, to };
}
