ALTER TABLE "Order"
  ADD COLUMN "agencyFeeCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "agencyFeeBps" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "agencyFeeStatus" TEXT NOT NULL DEFAULT 'NOT_APPLICABLE',
  ADD COLUMN "agencyFeeTransferId" TEXT,
  ADD COLUMN "agencyFeeReversalId" TEXT;

CREATE TABLE "AgencyFeeSetting" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT false,
  "agencyName" TEXT NOT NULL DEFAULT 'Agency',
  "stripeConnectedAccountId" TEXT,
  "feeBps" INTEGER NOT NULL DEFAULT 800,
  "basis" TEXT NOT NULL DEFAULT 'GROSS_MARGIN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AgencyFeeSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgencyFeeTransaction" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "feeBps" INTEGER NOT NULL,
  "basis" TEXT NOT NULL DEFAULT 'GROSS_MARGIN',
  "sourceAmountCents" INTEGER NOT NULL,
  "stripeTransferId" TEXT,
  "stripeReversalId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "rawEvent" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AgencyFeeTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgencyFeeSetting_companyId_key" ON "AgencyFeeSetting"("companyId");
CREATE INDEX "AgencyFeeTransaction_companyId_type_status_idx" ON "AgencyFeeTransaction"("companyId", "type", "status");
CREATE INDEX "AgencyFeeTransaction_orderId_type_idx" ON "AgencyFeeTransaction"("orderId", "type");
CREATE INDEX "AgencyFeeTransaction_stripeTransferId_idx" ON "AgencyFeeTransaction"("stripeTransferId");

ALTER TABLE "AgencyFeeSetting"
  ADD CONSTRAINT "AgencyFeeSetting_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgencyFeeTransaction"
  ADD CONSTRAINT "AgencyFeeTransaction_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgencyFeeTransaction"
  ADD CONSTRAINT "AgencyFeeTransaction_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "Order"
SET
  "agencyFeeCents" = GREATEST(0, ROUND("grossMarginCents" * 800.0 / 10000.0)::INTEGER),
  "agencyFeeBps" = 800,
  "agencyFeeStatus" = 'PAID_MANUAL'
WHERE
  "paymentStatus" = 'CAPTURED'
  AND "grossMarginCents" > 0
  AND "agencyFeeCents" = 0;

INSERT INTO "AgencyFeeTransaction" (
  "companyId",
  "orderId",
  "type",
  "amountCents",
  "feeBps",
  "basis",
  "sourceAmountCents",
  "status",
  "rawEvent",
  "updatedAt"
)
SELECT
  "companyId",
  "id",
  'TRANSFER',
  GREATEST(0, ROUND("grossMarginCents" * 800.0 / 10000.0)::INTEGER),
  800,
  'GROSS_MARGIN',
  "grossMarginCents",
  'PAID_MANUAL',
  jsonb_build_object('source', 'agency_fee_backfill', 'note', 'Historical captured order marked paid before automatic Stripe transfer rollout.'),
  CURRENT_TIMESTAMP
FROM "Order"
WHERE
  "paymentStatus" = 'CAPTURED'
  AND "grossMarginCents" > 0
  AND NOT EXISTS (
    SELECT 1
    FROM "AgencyFeeTransaction"
    WHERE "AgencyFeeTransaction"."orderId" = "Order"."id"
      AND "AgencyFeeTransaction"."type" = 'TRANSFER'
  );
