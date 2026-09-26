-- CreateEnum
CREATE TYPE "SyncTrigger" AS ENUM ('SCHEDULED', 'MANUAL_FULL', 'MANUAL_PRODUCT');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "SyncPageStatus" AS ENUM ('OK', 'UNAVAILABLE', 'BLOCKED', 'NOT_FOUND', 'MALFORMED');

-- CreateEnum
CREATE TYPE "DataChangeKind" AS ENUM ('PRICE_CHANGED', 'NEW_PLAN', 'PLAN_NOT_FOUND', 'FACT_NOT_FOUND', 'FACT_CHANGED', 'NEW_SOURCE', 'SOURCE_NOT_FOUND', 'SOURCE_UPDATED');

-- CreateEnum
CREATE TYPE "DataChangeStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'KEPT', 'REVERTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SourceKind" ADD VALUE 'PRIVACY';
ALTER TYPE "SourceKind" ADD VALUE 'TERMS';

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "trigger" "SyncTrigger" NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
    "weekKey" TEXT,
    "productId" TEXT,
    "phase" INTEGER NOT NULL DEFAULT 1,
    "apifyRunId" TEXT,
    "apifyDatasetId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "cursor" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "error" TEXT,
    "stats" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncPage" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "phase" INTEGER NOT NULL DEFAULT 1,
    "url" TEXT NOT NULL,
    "kind" "SourceKind",
    "status" "SyncPageStatus",
    "httpStatus" INTEGER,
    "contentHash" TEXT,
    "title" TEXT,
    "reason" TEXT,
    "fetchedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "outcome" JSONB,

    CONSTRAINT "SyncPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataChange" (
    "id" TEXT NOT NULL,
    "runId" TEXT,
    "productId" TEXT NOT NULL,
    "kind" "DataChangeKind" NOT NULL,
    "field" TEXT NOT NULL,
    "targetId" TEXT,
    "previousValue" TEXT,
    "newValue" TEXT,
    "sourceUrl" TEXT,
    "evidence" TEXT,
    "payload" JSONB,
    "dedupeKey" TEXT NOT NULL,
    "status" "DataChangeStatus" NOT NULL DEFAULT 'PENDING',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "note" TEXT,
    "applied" JSONB,

    CONSTRAINT "DataChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SyncRun_weekKey_key" ON "SyncRun"("weekKey");

-- CreateIndex
CREATE UNIQUE INDEX "SyncRun_apifyRunId_key" ON "SyncRun"("apifyRunId");

-- CreateIndex
CREATE INDEX "SyncRun_status_startedAt_idx" ON "SyncRun"("status", "startedAt");

-- CreateIndex
CREATE INDEX "SyncPage_productId_fetchedAt_idx" ON "SyncPage"("productId", "fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncPage_runId_phase_productId_url_key" ON "SyncPage"("runId", "phase", "productId", "url");

-- CreateIndex
CREATE INDEX "DataChange_status_detectedAt_idx" ON "DataChange"("status", "detectedAt");

-- CreateIndex
CREATE INDEX "DataChange_productId_detectedAt_idx" ON "DataChange"("productId", "detectedAt");

-- CreateIndex
CREATE INDEX "DataChange_productId_dedupeKey_idx" ON "DataChange"("productId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "SyncPage" ADD CONSTRAINT "SyncPage_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SyncRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncPage" ADD CONSTRAINT "SyncPage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataChange" ADD CONSTRAINT "DataChange_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SyncRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataChange" ADD CONSTRAINT "DataChange_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

