-- Go Virtual Health pays every eligible recipient directly. Sensitive tax and
-- banking details remain with Stripe; the CRM stores readiness and audit data.
CREATE TABLE "PayoutAccount" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "stripeConnectedAccountId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
  "detailsSubmitted" BOOLEAN NOT NULL DEFAULT false,
  "transfersEnabled" BOOLEAN NOT NULL DEFAULT false,
  "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "bankName" TEXT,
  "bankAccountLast4" TEXT,
  "requirementsCurrentlyDue" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "requirementsPastDue" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "onboardingStartedAt" TIMESTAMP(3),
  "onboardingCompletedAt" TIMESTAMP(3),
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayoutAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayoutTransfer" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "commissionSplitId" UUID NOT NULL,
  "recipientUserId" UUID NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "stripeConnectedAccountId" TEXT NOT NULL,
  "stripeTransferId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'TRANSFERRED',
  "failureReason" TEXT,
  "rawEvent" JSONB,
  "createdByUserId" UUID,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayoutTransfer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PayoutAccount_userId_key" ON "PayoutAccount"("userId");
CREATE UNIQUE INDEX "PayoutAccount_stripeConnectedAccountId_key" ON "PayoutAccount"("stripeConnectedAccountId");
CREATE INDEX "PayoutAccount_companyId_status_idx" ON "PayoutAccount"("companyId", "status");
CREATE UNIQUE INDEX "PayoutTransfer_commissionSplitId_key" ON "PayoutTransfer"("commissionSplitId");
CREATE UNIQUE INDEX "PayoutTransfer_stripeTransferId_key" ON "PayoutTransfer"("stripeTransferId");
CREATE INDEX "PayoutTransfer_companyId_status_idx" ON "PayoutTransfer"("companyId", "status");
CREATE INDEX "PayoutTransfer_recipientUserId_paidAt_idx" ON "PayoutTransfer"("recipientUserId", "paidAt");

ALTER TABLE "PayoutAccount" ADD CONSTRAINT "PayoutAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayoutAccount" ADD CONSTRAINT "PayoutAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayoutTransfer" ADD CONSTRAINT "PayoutTransfer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayoutTransfer" ADD CONSTRAINT "PayoutTransfer_commissionSplitId_fkey" FOREIGN KEY ("commissionSplitId") REFERENCES "CommissionSplit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayoutTransfer" ADD CONSTRAINT "PayoutTransfer_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayoutTransfer" ADD CONSTRAINT "PayoutTransfer_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve partner Connect accounts already collected by the previous flow.
INSERT INTO "PayoutAccount" (
  "id", "companyId", "userId", "stripeConnectedAccountId", "status",
  "onboardingStartedAt", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), pba."companyId", pp."userId", pba."stripeConnectedAccountId",
  'ACTION_REQUIRED', pba."createdAt", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "PartnerBankAccount" pba
JOIN "PartnerProfile" pp ON pp."id" = pba."partnerProfileId"
WHERE pba."stripeConnectedAccountId" IS NOT NULL
ON CONFLICT ("userId") DO NOTHING;

UPDATE "CommissionSplit"
SET "payoutResponsibility" = 'COMPANY'
WHERE "status" IN ('PENDING', 'APPROVED');

ALTER TABLE "CommissionSplit" ALTER COLUMN "payoutResponsibility" SET DEFAULT 'COMPANY';
