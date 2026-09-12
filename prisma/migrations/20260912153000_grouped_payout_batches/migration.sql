CREATE TABLE "PayoutBatch" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "recipientUserId" UUID NOT NULL,
  "paymentMethod" TEXT NOT NULL,
  "totalCents" INTEGER NOT NULL,
  "itemCount" INTEGER NOT NULL,
  "stripeConnectedAccountId" TEXT,
  "stripeTransferId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PAID',
  "rawEvent" JSONB,
  "createdByUserId" UUID,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayoutBatch_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PayoutTransfer" ADD COLUMN "payoutBatchId" UUID;

CREATE UNIQUE INDEX "PayoutBatch_stripeTransferId_key" ON "PayoutBatch"("stripeTransferId");
CREATE INDEX "PayoutBatch_companyId_status_idx" ON "PayoutBatch"("companyId", "status");
CREATE INDEX "PayoutBatch_recipientUserId_paidAt_idx" ON "PayoutBatch"("recipientUserId", "paidAt");
CREATE INDEX "PayoutTransfer_payoutBatchId_idx" ON "PayoutTransfer"("payoutBatchId");

ALTER TABLE "PayoutBatch" ADD CONSTRAINT "PayoutBatch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayoutBatch" ADD CONSTRAINT "PayoutBatch_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayoutBatch" ADD CONSTRAINT "PayoutBatch_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PayoutTransfer" ADD CONSTRAINT "PayoutTransfer_payoutBatchId_fkey" FOREIGN KEY ("payoutBatchId") REFERENCES "PayoutBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PayoutAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PayoutTransfer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PayoutBatch" ENABLE ROW LEVEL SECURITY;
