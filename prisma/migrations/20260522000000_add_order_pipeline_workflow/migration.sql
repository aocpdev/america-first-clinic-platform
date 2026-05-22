ALTER TABLE "Customer" ALTER COLUMN "pipelineStage" SET DEFAULT 'NEW_SALE';

ALTER TABLE "Order"
ADD COLUMN "orderPipelineStage" TEXT NOT NULL DEFAULT 'NEW_SALE',
ADD COLUMN "orderPipelineUpdatedAt" TIMESTAMP(3),
ADD COLUMN "prescriptionDocumentUrl" TEXT,
ADD COLUMN "prescriptionNotes" TEXT,
ADD COLUMN "prescriptionStoredAt" TIMESTAMP(3),
ADD COLUMN "prescriptionStoredByUserId" UUID;

CREATE INDEX "Order_companyId_orderPipelineStage_idx" ON "Order"("companyId", "orderPipelineStage");
