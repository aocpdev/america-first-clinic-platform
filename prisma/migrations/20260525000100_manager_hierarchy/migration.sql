ALTER TYPE "UserRole" ADD VALUE 'MANAGER';
ALTER TYPE "CommissionParticipantRole" ADD VALUE 'MANAGER';

ALTER TABLE "User" ADD COLUMN "requestedManagerProfileId" UUID;

CREATE TABLE "ManagerProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "partnerProfileId" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "commissionBps" INTEGER NOT NULL DEFAULT 2500,
    "leaderOverrideBps" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagerProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ManagerProfile_userId_key" ON "ManagerProfile"("userId");
CREATE INDEX "ManagerProfile_companyId_idx" ON "ManagerProfile"("companyId");
CREATE INDEX "ManagerProfile_partnerProfileId_idx" ON "ManagerProfile"("partnerProfileId");

ALTER TABLE "ManagerProfile" ADD CONSTRAINT "ManagerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManagerProfile" ADD CONSTRAINT "ManagerProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManagerProfile" ADD CONSTRAINT "ManagerProfile_partnerProfileId_fkey" FOREIGN KEY ("partnerProfileId") REFERENCES "PartnerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ConsultantProfile" ADD COLUMN "managerProfileId" UUID;
CREATE INDEX "ConsultantProfile_managerProfileId_idx" ON "ConsultantProfile"("managerProfileId");
ALTER TABLE "ConsultantProfile" ADD CONSTRAINT "ConsultantProfile_managerProfileId_fkey" FOREIGN KEY ("managerProfileId") REFERENCES "ManagerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GroupLeaderProfile" ADD COLUMN "managerProfileId" UUID;
CREATE INDEX "GroupLeaderProfile_managerProfileId_idx" ON "GroupLeaderProfile"("managerProfileId");
ALTER TABLE "GroupLeaderProfile" ADD CONSTRAINT "GroupLeaderProfile_managerProfileId_fkey" FOREIGN KEY ("managerProfileId") REFERENCES "ManagerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Customer" ADD COLUMN "managerProfileId" UUID;
CREATE INDEX "Customer_managerProfileId_idx" ON "Customer"("managerProfileId");
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_managerProfileId_fkey" FOREIGN KEY ("managerProfileId") REFERENCES "ManagerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Order" ADD COLUMN "managerProfileId" UUID;
CREATE INDEX "Order_managerProfileId_idx" ON "Order"("managerProfileId");
ALTER TABLE "Order" ADD CONSTRAINT "Order_managerProfileId_fkey" FOREIGN KEY ("managerProfileId") REFERENCES "ManagerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CommissionSplit" ADD COLUMN "managerProfileId" UUID;
CREATE INDEX "CommissionSplit_managerProfileId_status_idx" ON "CommissionSplit"("managerProfileId", "status");
ALTER TABLE "CommissionSplit" ADD CONSTRAINT "CommissionSplit_managerProfileId_fkey" FOREIGN KEY ("managerProfileId") REFERENCES "ManagerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
