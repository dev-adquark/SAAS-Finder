-- CreateEnum
CREATE TYPE "SnapshotStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "PriceSourceType" AS ENUM ('OFFICIAL_PRICING_PAGE', 'VENDOR_CONFIRMATION', 'MANUAL_CHECK', 'AUTOMATED_DETECTION');

-- CreateEnum
CREATE TYPE "BillingPeriod" AS ENUM ('FREE', 'MONTHLY', 'ANNUAL', 'ONE_TIME', 'USAGE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'NEEDS_UPDATE', 'REVIEWED');

-- AlterTable
ALTER TABLE "AffiliateLink" ADD COLUMN     "verifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Alternative" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "keyDifference" TEXT,
ADD COLUMN     "rationale" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "useCaseId" TEXT;
ALTER TABLE "Alternative" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AnalyticsEvent" ADD COLUMN     "ctaType" TEXT,
ADD COLUMN     "pageSlug" TEXT,
ADD COLUMN     "pageType" TEXT,
ADD COLUMN     "sponsorId" TEXT;

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "intro" TEXT,
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoTitle" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ContentRefresh" ADD COLUMN     "resolution" TEXT;

-- AlterTable
ALTER TABLE "Faq" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "useCaseId" TEXT,
ALTER COLUMN "productId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PricingSnapshot" ADD COLUMN     "billingPeriod" "BillingPeriod",
ADD COLUMN     "currency" VARCHAR(3),
ADD COLUMN     "plan" TEXT,
ADD COLUMN     "price" DECIMAL(12,2),
ADD COLUMN     "sourceType" "PriceSourceType" NOT NULL DEFAULT 'MANUAL_CHECK',
ADD COLUMN     "status" "SnapshotStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedBy" TEXT;


-- AlterTable
ALTER TABLE "SponsorSlot" RENAME COLUMN "name" TO "title";
ALTER TABLE "SponsorSlot" ADD COLUMN     "campaign" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "pageType" TEXT NOT NULL DEFAULT 'product',
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "placement" SET DEFAULT 'sidebar';

-- AlterTable (Product: additive columns)
ALTER TABLE "Product" ADD COLUMN     "alternativesIntro" TEXT,
ADD COLUMN     "contentUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "pricingCheckedAt" TIMESTAMP(3),
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "refreshIntervalDays" INTEGER,
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoTitle" TEXT,
ADD COLUMN     "vendor" TEXT,
ALTER COLUMN "comparison" DROP DEFAULT;

-- CreateTable
CREATE TABLE "ReviewMetadata" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "rating" DOUBLE PRECISION,
    "editorialSummary" TEXT NOT NULL,
    "verdict" TEXT,
    "pros" JSONB NOT NULL,
    "cons" JSONB NOT NULL,
    "bestFor" JSONB NOT NULL,
    "limitations" JSONB NOT NULL,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "reviewedBy" TEXT,
    "lastReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductTag" (
    "productId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "ProductTag_pkey" PRIMARY KEY ("productId","tagId")
);

-- CreateTable
CREATE TABLE "CompetitorPair" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "productAId" TEXT NOT NULL,
    "productBId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "summary" TEXT NOT NULL,
    "chooseA" TEXT NOT NULL,
    "chooseB" TEXT NOT NULL,
    "highlights" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitorPair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UseCase" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "intro" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "categoryId" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "contentUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UseCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UseCaseProduct" (
    "id" TEXT NOT NULL,
    "useCaseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "rationale" TEXT NOT NULL,
    "caveat" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UseCaseProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReviewMetadata_productId_key" ON "ReviewMetadata"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "ProductTag_tagId_idx" ON "ProductTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitorPair_slug_key" ON "CompetitorPair"("slug");

-- CreateIndex
CREATE INDEX "CompetitorPair_productBId_idx" ON "CompetitorPair"("productBId");

-- CreateIndex
CREATE INDEX "CompetitorPair_categoryId_idx" ON "CompetitorPair"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitorPair_productAId_productBId_key" ON "CompetitorPair"("productAId", "productBId");

-- CreateIndex
CREATE UNIQUE INDEX "UseCase_slug_key" ON "UseCase"("slug");

-- CreateIndex
CREATE INDEX "UseCase_categoryId_status_idx" ON "UseCase"("categoryId", "status");

-- CreateIndex
CREATE INDEX "UseCaseProduct_productId_idx" ON "UseCaseProduct"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "UseCaseProduct_useCaseId_productId_key" ON "UseCaseProduct"("useCaseId", "productId");

-- CreateIndex
CREATE INDEX "AffiliateLink_productId_active_idx" ON "AffiliateLink"("productId", "active");

-- CreateIndex
CREATE INDEX "Alternative_alternativeId_idx" ON "Alternative"("alternativeId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ContentRefresh_productId_completedAt_idx" ON "ContentRefresh"("productId", "completedAt");

-- CreateIndex
CREATE INDEX "Faq_productId_idx" ON "Faq"("productId");

-- CreateIndex
CREATE INDEX "Faq_categoryId_idx" ON "Faq"("categoryId");

-- CreateIndex
CREATE INDEX "Faq_useCaseId_idx" ON "Faq"("useCaseId");

-- CreateIndex
CREATE INDEX "PricingSnapshot_status_productId_idx" ON "PricingSnapshot"("status", "productId");

-- CreateIndex
CREATE INDEX "Product_categoryId_status_idx" ON "Product"("categoryId", "status");

-- CreateIndex
CREATE INDEX "Product_status_idx" ON "Product"("status");

-- CreateIndex
CREATE INDEX "SponsorSlot_pageType_placement_active_idx" ON "SponsorSlot"("pageType", "placement", "active");

-- AddForeignKey
ALTER TABLE "ReviewMetadata" ADD CONSTRAINT "ReviewMetadata_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTag" ADD CONSTRAINT "ProductTag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTag" ADD CONSTRAINT "ProductTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alternative" ADD CONSTRAINT "Alternative_useCaseId_fkey" FOREIGN KEY ("useCaseId") REFERENCES "UseCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorPair" ADD CONSTRAINT "CompetitorPair_productAId_fkey" FOREIGN KEY ("productAId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorPair" ADD CONSTRAINT "CompetitorPair_productBId_fkey" FOREIGN KEY ("productBId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorPair" ADD CONSTRAINT "CompetitorPair_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UseCase" ADD CONSTRAINT "UseCase_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UseCaseProduct" ADD CONSTRAINT "UseCaseProduct_useCaseId_fkey" FOREIGN KEY ("useCaseId") REFERENCES "UseCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UseCaseProduct" ADD CONSTRAINT "UseCaseProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Faq" ADD CONSTRAINT "Faq_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Faq" ADD CONSTRAINT "Faq_useCaseId_fkey" FOREIGN KEY ("useCaseId") REFERENCES "UseCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Data migration: preserve existing editorial data before dropping legacy Product columns.
UPDATE "Product" SET "contentUpdatedAt" = "updatedAt";
UPDATE "Product" SET "publishedAt" = "updatedAt" WHERE "status" = 'PUBLISHED';

INSERT INTO "ReviewMetadata" ("id","productId","rating","editorialSummary","pros","cons","bestFor","limitations","reviewStatus","createdAt","updatedAt")
SELECT 'rm' || substr(md5(random()::text || p."id"), 1, 23), p."id", p."rating", p."description",
       COALESCE(p."pros", '[]'::jsonb), COALESCE(p."cons", '[]'::jsonb), COALESCE(p."bestFor", '[]'::jsonb), '[]'::jsonb,
       'NOT_STARTED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Product" p;

INSERT INTO "Tag" ("id","name","slug")
SELECT DISTINCT ON (slug) 'tg' || substr(md5(random()::text || slug), 1, 23), name, slug
FROM (
  SELECT trim(t) AS name, trim(both '-' from lower(regexp_replace(trim(t), '[^a-zA-Z0-9]+', '-', 'g'))) AS slug
  FROM "Product" p, jsonb_array_elements_text(CASE WHEN jsonb_typeof(p."tags") = 'array' THEN p."tags" ELSE '[]'::jsonb END) AS t
) s
WHERE slug <> ''
ORDER BY slug, name;

INSERT INTO "ProductTag" ("productId","tagId")
SELECT DISTINCT p."id", tg."id"
FROM "Product" p, jsonb_array_elements_text(CASE WHEN jsonb_typeof(p."tags") = 'array' THEN p."tags" ELSE '[]'::jsonb END) AS t
JOIN "Tag" tg ON tg."slug" = trim(both '-' from lower(regexp_replace(trim(t), '[^a-zA-Z0-9]+', '-', 'g')));

-- Legacy seed snapshots were never editorially verified.
UPDATE "PricingSnapshot" SET "status" = 'PENDING', "sourceType" = 'MANUAL_CHECK';

-- AlterTable (Product: drop legacy columns now copied into ReviewMetadata / ProductTag)
ALTER TABLE "Product" DROP COLUMN "bestFor",
DROP COLUMN "cons",
DROP COLUMN "pros",
DROP COLUMN "rating",
DROP COLUMN "tags";

-- Integrity constraints Prisma cannot express.
ALTER TABLE "Faq" ADD CONSTRAINT "Faq_exactly_one_owner" CHECK (num_nonnulls("productId", "categoryId", "useCaseId") = 1);
ALTER TABLE "CompetitorPair" ADD CONSTRAINT "CompetitorPair_distinct_products" CHECK ("productAId" <> "productBId");
CREATE UNIQUE INDEX "CompetitorPair_unordered_pair_key" ON "CompetitorPair" (LEAST("productAId", "productBId"), GREATEST("productAId", "productBId"));
ALTER TABLE "Alternative" ADD CONSTRAINT "Alternative_not_self" CHECK ("productId" <> "alternativeId");
ALTER TABLE "UseCaseProduct" ADD CONSTRAINT "UseCaseProduct_position_nonnegative" CHECK ("position" >= 0);
ALTER TABLE "PricingSnapshot" ADD CONSTRAINT "PricingSnapshot_price_nonnegative" CHECK ("price" IS NULL OR "price" >= 0);
ALTER TABLE "PricingSnapshot" ADD CONSTRAINT "PricingSnapshot_price_has_currency" CHECK ("price" IS NULL OR "currency" IS NOT NULL);
ALTER TABLE "Product" ADD CONSTRAINT "Product_refreshIntervalDays_range" CHECK ("refreshIntervalDays" IS NULL OR ("refreshIntervalDays" >= 1 AND "refreshIntervalDays" <= 3650));
ALTER TABLE "ReviewMetadata" ADD CONSTRAINT "ReviewMetadata_rating_range" CHECK ("rating" IS NULL OR ("rating" >= 0 AND "rating" <= 5));

