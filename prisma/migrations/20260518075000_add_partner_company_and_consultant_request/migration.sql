ALTER TABLE "User" ADD COLUMN "requestedPartnerProfileId" UUID;
ALTER TABLE "PartnerProfile" ADD COLUMN "companyName" TEXT;

UPDATE "PartnerProfile"
SET "companyName" = 'American First Healthcare'
WHERE "userId" IN (
  SELECT "id" FROM "User" WHERE "email" = 'axelcastrodev@gmail.com'
);
