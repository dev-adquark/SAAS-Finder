-- Logo.dev state verified by the automatic sync.
ALTER TABLE "Product" ADD COLUMN "logoDomain" TEXT;
ALTER TABLE "Product" ADD COLUMN "logoCheckedAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN "logoMisses" INTEGER NOT NULL DEFAULT 0;
