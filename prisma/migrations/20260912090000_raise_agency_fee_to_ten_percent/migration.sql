ALTER TABLE "AgencyFeeSetting"
  ALTER COLUMN "feeBps" SET DEFAULT 1000;

UPDATE "AgencyFeeSetting"
SET
  "feeBps" = 1000,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "feeBps" = 800;
