ALTER TABLE "Reward" ALTER COLUMN "isActive" SET DEFAULT false;
ALTER TABLE "RewardCampaign" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

UPDATE "Reward"
SET "isActive" = false
WHERE "isActive" = true;

UPDATE "RewardCampaign"
SET "status" = 'DRAFT'
WHERE "status" = 'ACTIVE';
