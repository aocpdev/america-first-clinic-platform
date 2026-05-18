ALTER TABLE "Customer" ADD COLUMN "pipelineStage" TEXT NOT NULL DEFAULT 'NEW_LEAD';
ALTER TABLE "Customer" ADD COLUMN "pipelineUpdatedAt" TIMESTAMP(3);

UPDATE "Customer"
SET "pipelineStage" = 'PAID',
    "pipelineUpdatedAt" = COALESCE("lastPurchaseAt", "updatedAt")
WHERE "lastPurchaseAt" IS NOT NULL;
