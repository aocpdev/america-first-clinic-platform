-- CreateEnum
CREATE TYPE "CommissionParticipantRole" AS ENUM ('PARTNER', 'CONSULTANT');

-- CreateEnum
CREATE TYPE "PayoutResponsibility" AS ENUM ('COMPANY', 'PARTNER');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'PARTNER';

-- AlterTable
ALTER TABLE "Commission" ADD COLUMN     "commissionPoolCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "consultantAmountCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "grossMarginCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "partnerAmountCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ConsultantProfile" ADD COLUMN     "partnerProfileId" UUID;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "commissionPoolCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "grossMarginCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PartnerProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "commissionBps" INTEGER NOT NULL DEFAULT 1250,
    "payoutResponsibility" "PayoutResponsibility" NOT NULL DEFAULT 'PARTNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionSplit" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "consultantProfileId" UUID,
    "partnerProfileId" UUID,
    "participantRole" "CommissionParticipantRole" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "grossMarginCents" INTEGER NOT NULL,
    "commissionPoolCents" INTEGER NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "payoutResponsibility" "PayoutResponsibility" NOT NULL DEFAULT 'PARTNER',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionSplit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerProfile_userId_key" ON "PartnerProfile"("userId");

-- CreateIndex
CREATE INDEX "PartnerProfile_companyId_idx" ON "PartnerProfile"("companyId");

-- CreateIndex
CREATE INDEX "CommissionSplit_companyId_participantRole_status_idx" ON "CommissionSplit"("companyId", "participantRole", "status");

-- CreateIndex
CREATE INDEX "CommissionSplit_partnerProfileId_status_idx" ON "CommissionSplit"("partnerProfileId", "status");

-- CreateIndex
CREATE INDEX "CommissionSplit_consultantProfileId_status_idx" ON "CommissionSplit"("consultantProfileId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionSplit_orderId_participantRole_key" ON "CommissionSplit"("orderId", "participantRole");

-- CreateIndex
CREATE INDEX "ConsultantProfile_partnerProfileId_idx" ON "ConsultantProfile"("partnerProfileId");

-- AddForeignKey
ALTER TABLE "ConsultantProfile" ADD CONSTRAINT "ConsultantProfile_partnerProfileId_fkey" FOREIGN KEY ("partnerProfileId") REFERENCES "PartnerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerProfile" ADD CONSTRAINT "PartnerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerProfile" ADD CONSTRAINT "PartnerProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionSplit" ADD CONSTRAINT "CommissionSplit_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionSplit" ADD CONSTRAINT "CommissionSplit_consultantProfileId_fkey" FOREIGN KEY ("consultantProfileId") REFERENCES "ConsultantProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionSplit" ADD CONSTRAINT "CommissionSplit_partnerProfileId_fkey" FOREIGN KEY ("partnerProfileId") REFERENCES "PartnerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
