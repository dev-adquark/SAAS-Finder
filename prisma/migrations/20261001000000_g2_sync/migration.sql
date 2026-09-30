-- G2 source data for the automated sync, and provenance for sync-created products.
CREATE TYPE "G2ListingStatus" AS ENUM ('ACTIVE', 'NOT_FOUND');

ALTER TABLE "Product" ADD COLUMN "autoCreatedAt" TIMESTAMP(3);

CREATE TABLE "G2Listing" (
    "id" TEXT NOT NULL,
    "g2Slug" TEXT NOT NULL,
    "productId" TEXT,
    "status" "G2ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "name" TEXT NOT NULL,
    "vendorName" TEXT,
    "g2Url" TEXT NOT NULL,
    "companyDomain" TEXT,
    "companyWebsite" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "rating" DOUBLE PRECISION,
    "reviewCount" INTEGER,
    "pricingType" TEXT,
    "categories" JSONB NOT NULL DEFAULT '[]',
    "pricing" JSONB,
    "competitors" JSONB,
    "reviewSummary" JSONB,
    "recentReviews" JSONB,
    "dataAsOf" TIMESTAMP(3),
    "mentions" INTEGER NOT NULL DEFAULT 0,
    "candidateCategoryId" TEXT,
    "domainConflict" BOOLEAN NOT NULL DEFAULT false,
    "contentHash" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRunId" TEXT,
    CONSTRAINT "G2Listing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "G2Listing_g2Slug_key" ON "G2Listing"("g2Slug");
CREATE UNIQUE INDEX "G2Listing_productId_key" ON "G2Listing"("productId");
CREATE INDEX "G2Listing_productId_idx" ON "G2Listing"("productId");
CREATE INDEX "G2Listing_status_idx" ON "G2Listing"("status");

ALTER TABLE "G2Listing" ADD CONSTRAINT "G2Listing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
