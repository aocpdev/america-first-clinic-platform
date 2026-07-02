ALTER TABLE "Discount"
ADD COLUMN IF NOT EXISTS "fundingStrategy" TEXT NOT NULL DEFAULT 'ORIGINATOR_FUNDED';

ALTER TABLE "DiscountRedemption"
ADD COLUMN IF NOT EXISTS "fundingStrategy" TEXT NOT NULL DEFAULT 'ORIGINATOR_FUNDED';

UPDATE "Discount"
SET "fundingStrategy" = CASE
  WHEN "affectsCommissions" = false THEN 'COMPANY_FUNDED'
  ELSE 'ORIGINATOR_FUNDED'
END
WHERE "fundingStrategy" IS NULL OR "fundingStrategy" = '';

UPDATE "DiscountRedemption"
SET "fundingStrategy" = 'ORIGINATOR_FUNDED'
WHERE "fundingStrategy" IS NULL OR "fundingStrategy" = '';
