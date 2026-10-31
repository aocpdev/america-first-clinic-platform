-- Bind an explicitly verified existing login; no internal UserRole changes.
ALTER TABLE "AffiliateProfile" ADD COLUMN "authUserId" TEXT;
CREATE UNIQUE INDEX "AffiliateProfile_authUserId_key" ON "AffiliateProfile"("authUserId");
