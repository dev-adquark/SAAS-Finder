CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "LinkType" AS ENUM ('OFFICIAL', 'AFFILIATE', 'PRICING');
CREATE TYPE "SnapshotType" AS ENUM ('PRICING', 'FEATURE', 'GENERAL');

CREATE TABLE "Category" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

CREATE TABLE "Product" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "tagline" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "subcategory" TEXT,
  "rating" DOUBLE PRECISION,
  "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
  "categoryId" TEXT NOT NULL,
  "officialUrl" TEXT NOT NULL,
  "pricingUrl" TEXT,
  "bestFor" JSONB NOT NULL,
  "features" JSONB NOT NULL,
  "pros" JSONB NOT NULL,
  "cons" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

CREATE TABLE "Alternative" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "alternativeId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "Alternative_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Alternative_productId_alternativeId_key" ON "Alternative"("productId","alternativeId");

CREATE TABLE "Faq" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "Faq_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PricingSnapshot" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "snapshotType" "SnapshotType" NOT NULL DEFAULT 'PRICING',
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sourceUrl" TEXT,
  "summary" TEXT NOT NULL,
  CONSTRAINT "PricingSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PricingSnapshot_productId_capturedAt_idx" ON "PricingSnapshot"("productId","capturedAt");

CREATE TABLE "AffiliateLink" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "provider" TEXT,
  "label" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AffiliateLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChangeLog" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChangeLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ChangeLog_productId_changedAt_idx" ON "ChangeLog"("productId","changedAt");

CREATE TABLE "ContentRefresh" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "reason" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ContentRefresh_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ContentRefresh_dueAt_completedAt_idx" ON "ContentRefresh"("dueAt","completedAt");

CREATE TABLE "SponsorSlot" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "label" TEXT NOT NULL DEFAULT 'Sponsored',
  "active" BOOLEAN NOT NULL DEFAULT false,
  "url" TEXT,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SponsorSlot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalyticsEvent" (
  "id" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "path" TEXT,
  "productSlug" TEXT,
  "placement" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AnalyticsEvent_event_createdAt_idx" ON "AnalyticsEvent"("event","createdAt");
CREATE INDEX "AnalyticsEvent_productSlug_createdAt_idx" ON "AnalyticsEvent"("productSlug","createdAt");

ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Alternative" ADD CONSTRAINT "Alternative_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Alternative" ADD CONSTRAINT "Alternative_alternativeId_fkey" FOREIGN KEY ("alternativeId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Faq" ADD CONSTRAINT "Faq_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PricingSnapshot" ADD CONSTRAINT "PricingSnapshot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AffiliateLink" ADD CONSTRAINT "AffiliateLink_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChangeLog" ADD CONSTRAINT "ChangeLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentRefresh" ADD CONSTRAINT "ContentRefresh_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
