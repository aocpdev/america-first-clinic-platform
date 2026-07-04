-- Partner bank accounts and payout reconciliation ledger.

CREATE TABLE "PartnerBankAccount" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "partnerProfileId" UUID NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "accountHolderType" TEXT NOT NULL DEFAULT 'company',
    "bankName" TEXT,
    "routingNumberEncrypted" TEXT NOT NULL,
    "accountNumberEncrypted" TEXT NOT NULL,
    "routingLast4" TEXT NOT NULL,
    "accountLast4" TEXT NOT NULL,
    "stripeConnectedAccountId" TEXT,
    "stripeExternalAccountId" TEXT,
    "stripeBankFingerprint" TEXT,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "verifiedAt" TIMESTAMP(3),
    "lastValidatedAt" TIMESTAMP(3),
    "createdByUserId" UUID,
    "updatedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerBankAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartnerPayout" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "partnerProfileId" UUID NOT NULL,
    "bankAccountLast4" TEXT,
    "bankRoutingLast4" TEXT,
    "stripeConnectedAccountId" TEXT,
    "stripeTransferId" TEXT,
    "totalCents" INTEGER NOT NULL,
    "partnerRetainedCents" INTEGER NOT NULL,
    "downlineObligationCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "providerCode" TEXT,
    "providerRef" TEXT,
    "paidAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "rawEvent" JSONB,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerPayout_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartnerPayoutLine" (
    "id" UUID NOT NULL,
    "partnerPayoutId" UUID NOT NULL,
    "commissionSplitId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "participantRole" TEXT NOT NULL,
    "participantName" TEXT NOT NULL,
    "participantEmail" TEXT,
    "amountCents" INTEGER NOT NULL,
    "payoutResponsibility" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerPayoutLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartnerBankAccount_partnerProfileId_key" ON "PartnerBankAccount"("partnerProfileId");
CREATE INDEX "PartnerBankAccount_companyId_idx" ON "PartnerBankAccount"("companyId");
CREATE INDEX "PartnerBankAccount_stripeConnectedAccountId_idx" ON "PartnerBankAccount"("stripeConnectedAccountId");

CREATE INDEX "PartnerPayout_companyId_status_idx" ON "PartnerPayout"("companyId", "status");
CREATE INDEX "PartnerPayout_partnerProfileId_status_idx" ON "PartnerPayout"("partnerProfileId", "status");
CREATE INDEX "PartnerPayout_stripeTransferId_idx" ON "PartnerPayout"("stripeTransferId");

CREATE UNIQUE INDEX "PartnerPayoutLine_partnerPayoutId_commissionSplitId_key" ON "PartnerPayoutLine"("partnerPayoutId", "commissionSplitId");
CREATE INDEX "PartnerPayoutLine_commissionSplitId_idx" ON "PartnerPayoutLine"("commissionSplitId");
CREATE INDEX "PartnerPayoutLine_orderId_idx" ON "PartnerPayoutLine"("orderId");

ALTER TABLE "PartnerBankAccount" ADD CONSTRAINT "PartnerBankAccount_partnerProfileId_fkey" FOREIGN KEY ("partnerProfileId") REFERENCES "PartnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerPayout" ADD CONSTRAINT "PartnerPayout_partnerProfileId_fkey" FOREIGN KEY ("partnerProfileId") REFERENCES "PartnerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerPayoutLine" ADD CONSTRAINT "PartnerPayoutLine_partnerPayoutId_fkey" FOREIGN KEY ("partnerPayoutId") REFERENCES "PartnerPayout"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerPayoutLine" ADD CONSTRAINT "PartnerPayoutLine_commissionSplitId_fkey" FOREIGN KEY ("commissionSplitId") REFERENCES "CommissionSplit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
