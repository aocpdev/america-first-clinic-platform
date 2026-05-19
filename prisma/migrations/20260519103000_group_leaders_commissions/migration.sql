ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'GROUP_LEADER';
ALTER TYPE "CommissionParticipantRole" ADD VALUE IF NOT EXISTS 'GROUP_LEADER';

ALTER TABLE "ConsultantProfile"
ADD COLUMN IF NOT EXISTS "groupLeaderProfileId" UUID,
ADD COLUMN IF NOT EXISTS "commissionBps" INTEGER NOT NULL DEFAULT 1250;

ALTER TABLE "Customer"
ADD COLUMN IF NOT EXISTS "groupLeaderProfileId" UUID;

ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "groupLeaderProfileId" UUID;

ALTER TABLE "CommissionSplit"
ADD COLUMN IF NOT EXISTS "groupLeaderProfileId" UUID;

CREATE TABLE IF NOT EXISTS "GroupLeaderProfile" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "partnerProfileId" UUID NOT NULL,
  "displayName" TEXT NOT NULL,
  "commissionBps" INTEGER NOT NULL DEFAULT 625,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GroupLeaderProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GroupLeaderProfile_userId_key" ON "GroupLeaderProfile"("userId");
CREATE INDEX IF NOT EXISTS "GroupLeaderProfile_companyId_idx" ON "GroupLeaderProfile"("companyId");
CREATE INDEX IF NOT EXISTS "GroupLeaderProfile_partnerProfileId_idx" ON "GroupLeaderProfile"("partnerProfileId");

CREATE INDEX IF NOT EXISTS "ConsultantProfile_groupLeaderProfileId_idx" ON "ConsultantProfile"("groupLeaderProfileId");
CREATE INDEX IF NOT EXISTS "Customer_groupLeaderProfileId_idx" ON "Customer"("groupLeaderProfileId");
CREATE INDEX IF NOT EXISTS "Order_groupLeaderProfileId_idx" ON "Order"("groupLeaderProfileId");
CREATE INDEX IF NOT EXISTS "CommissionSplit_groupLeaderProfileId_status_idx" ON "CommissionSplit"("groupLeaderProfileId", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GroupLeaderProfile_userId_fkey'
  ) THEN
    ALTER TABLE "GroupLeaderProfile"
    ADD CONSTRAINT "GroupLeaderProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GroupLeaderProfile_companyId_fkey'
  ) THEN
    ALTER TABLE "GroupLeaderProfile"
    ADD CONSTRAINT "GroupLeaderProfile_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GroupLeaderProfile_partnerProfileId_fkey'
  ) THEN
    ALTER TABLE "GroupLeaderProfile"
    ADD CONSTRAINT "GroupLeaderProfile_partnerProfileId_fkey"
    FOREIGN KEY ("partnerProfileId") REFERENCES "PartnerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ConsultantProfile_groupLeaderProfileId_fkey'
  ) THEN
    ALTER TABLE "ConsultantProfile"
    ADD CONSTRAINT "ConsultantProfile_groupLeaderProfileId_fkey"
    FOREIGN KEY ("groupLeaderProfileId") REFERENCES "GroupLeaderProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Customer_groupLeaderProfileId_fkey'
  ) THEN
    ALTER TABLE "Customer"
    ADD CONSTRAINT "Customer_groupLeaderProfileId_fkey"
    FOREIGN KEY ("groupLeaderProfileId") REFERENCES "GroupLeaderProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Order_groupLeaderProfileId_fkey'
  ) THEN
    ALTER TABLE "Order"
    ADD CONSTRAINT "Order_groupLeaderProfileId_fkey"
    FOREIGN KEY ("groupLeaderProfileId") REFERENCES "GroupLeaderProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CommissionSplit_groupLeaderProfileId_fkey'
  ) THEN
    ALTER TABLE "CommissionSplit"
    ADD CONSTRAINT "CommissionSplit_groupLeaderProfileId_fkey"
    FOREIGN KEY ("groupLeaderProfileId") REFERENCES "GroupLeaderProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
