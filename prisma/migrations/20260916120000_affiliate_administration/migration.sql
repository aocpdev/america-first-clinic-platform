-- Additive administration only; does not activate checkout or change seller commissions.
CREATE TABLE "AffiliateProfile" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "displayName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "referralCode" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'OTHER',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "commissionBps" INTEGER,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AffiliateProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AffiliateProfile_rate_check" CHECK ("commissionBps" BETWEEN 0 AND 10000),
  CONSTRAINT "AffiliateProfile_revision_check" CHECK ("revision" >= 1),
  CONSTRAINT "AffiliateProfile_email_check" CHECK ("email" = lower(trim("email"))),
  CONSTRAINT "AffiliateProfile_status_check" CHECK ("status" IN ('PENDING', 'APPROVED', 'SUSPENDED', 'ARCHIVED')),
  CONSTRAINT "AffiliateProfile_category_check" CHECK ("category" IN ('INFLUENCER', 'GYM', 'TRAINER', 'ARTIST', 'OTHER'))
);
CREATE TABLE "AffiliateProgramSetting" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "commissionBps" INTEGER NOT NULL DEFAULT 2500,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AffiliateProgramSetting_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AffiliateProgramSetting_rate_check" CHECK ("commissionBps" BETWEEN 0 AND 10000),
  CONSTRAINT "AffiliateProgramSetting_revision_check" CHECK ("revision" >= 1)
);
CREATE UNIQUE INDEX "AffiliateProfile_referralCode_key" ON "AffiliateProfile"("referralCode");
CREATE UNIQUE INDEX "AffiliateProfile_companyId_email_key" ON "AffiliateProfile"("companyId", "email");
CREATE INDEX "AffiliateProfile_companyId_status_createdAt_idx" ON "AffiliateProfile"("companyId", "status", "createdAt");
CREATE UNIQUE INDEX "AffiliateProgramSetting_companyId_key" ON "AffiliateProgramSetting"("companyId");
ALTER TABLE "AffiliateProfile" ADD CONSTRAINT "AffiliateProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AffiliateProgramSetting" ADD CONSTRAINT "AffiliateProgramSetting_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backend-only access. The privileged Prisma connection performs explicit
-- active-admin/tenant authorization; browser API roles receive no privileges.
ALTER TABLE "AffiliateProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AffiliateProgramSetting" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "AffiliateProfile", "AffiliateProgramSetting" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "AffiliateProfile", "AffiliateProgramSetting" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "AffiliateProfile", "AffiliateProgramSetting" FROM authenticated;
  END IF;
END $$;
