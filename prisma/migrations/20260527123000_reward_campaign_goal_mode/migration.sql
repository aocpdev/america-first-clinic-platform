CREATE TYPE "RewardCampaignGoalMode" AS ENUM ('TOTAL_UNITS', 'PRODUCT_BUNDLE');

ALTER TABLE "RewardCampaign"
ADD COLUMN "goalMode" "RewardCampaignGoalMode" NOT NULL DEFAULT 'TOTAL_UNITS';
