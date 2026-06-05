ALTER TABLE "ConsultantProfile" ALTER COLUMN "commissionBps" SET DEFAULT 5000;
ALTER TABLE "PartnerProfile" ALTER COLUMN "commissionBps" SET DEFAULT 2500;
ALTER TABLE "ManagerProfile" ALTER COLUMN "commissionBps" SET DEFAULT 5000;
ALTER TABLE "ManagerProfile" ALTER COLUMN "leaderOverrideBps" SET DEFAULT 0;
ALTER TABLE "GroupLeaderProfile" ALTER COLUMN "commissionBps" SET DEFAULT 5000;
ALTER TABLE "GroupLeaderProfile" ALTER COLUMN "consultantOverrideBps" SET DEFAULT 0;

UPDATE "PartnerProfile"
SET "commissionBps" = 2500;

UPDATE "ManagerProfile"
SET "commissionBps" = 5000,
    "leaderOverrideBps" = 0;

UPDATE "GroupLeaderProfile"
SET "commissionBps" = 5000,
    "consultantOverrideBps" = 0;

UPDATE "ConsultantProfile"
SET "commissionBps" = 5000;
