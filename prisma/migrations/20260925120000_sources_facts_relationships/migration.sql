-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('PRICING', 'PRODUCT', 'DOCUMENTATION', 'HELP_CENTER', 'SECURITY', 'CHANGELOG', 'NEWSROOM', 'ABOUT', 'CONTACT', 'INTEGRATIONS', 'STATUS', 'INDEPENDENT');

-- CreateEnum
CREATE TYPE "SourceStatus" AS ENUM ('VERIFIED', 'NEEDS_VERIFICATION', 'EXPIRED', 'BROKEN');

-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('AFFILIATE', 'SPONSORSHIP', 'PARTNERSHIP', 'COLLABORATION');

-- CreateEnum
CREATE TYPE "AgreementStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ENDED');

-- AlterTable
ALTER TABLE "AffiliateLink" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "partnerStatus" TEXT,
ADD COLUMN     "sourceUrl" TEXT,
ADD COLUMN     "trackingId" TEXT;

-- AlterTable
ALTER TABLE "PricingSnapshot" ADD COLUMN     "evidence" TEXT,
ADD COLUMN     "perSeat" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "promotional" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "regionDependent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "unit" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "featuresCheckedAt" TIMESTAMP(3),
ADD COLUMN     "pricingRegionNote" TEXT,
ADD COLUMN     "sourceCheckedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ProductSource" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "kind" "SourceKind" NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "section" TEXT,
    "checkedAt" TIMESTAMP(3),
    "status" "SourceStatus" NOT NULL DEFAULT 'NEEDS_VERIFICATION',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductFact" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "evidence" TEXT,
    "sourceId" TEXT,
    "checkedAt" TIMESTAMP(3),
    "status" "SourceStatus" NOT NULL DEFAULT 'NEEDS_VERIFICATION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandRelationship" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "brand" TEXT NOT NULL,
    "website" TEXT,
    "relationshipType" "RelationshipType" NOT NULL,
    "agreementStatus" "AgreementStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "sourceUrl" TEXT,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductSource_productId_kind_idx" ON "ProductSource"("productId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSource_productId_url_key" ON "ProductSource"("productId", "url");

-- CreateIndex
CREATE INDEX "ProductFact_sourceId_idx" ON "ProductFact"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductFact_productId_key_key" ON "ProductFact"("productId", "key");

-- CreateIndex
CREATE INDEX "BrandRelationship_agreementStatus_endDate_idx" ON "BrandRelationship"("agreementStatus", "endDate");

-- AddForeignKey
ALTER TABLE "ProductSource" ADD CONSTRAINT "ProductSource_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFact" ADD CONSTRAINT "ProductFact_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFact" ADD CONSTRAINT "ProductFact_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ProductSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandRelationship" ADD CONSTRAINT "BrandRelationship_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

