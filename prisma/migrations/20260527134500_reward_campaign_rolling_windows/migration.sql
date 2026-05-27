CREATE TYPE "RewardCampaignWindowMode" AS ENUM ('CAMPAIGN_RANGE', 'ROLLING_DAYS');

ALTER TABLE "RewardCampaign"
ADD COLUMN "windowMode" "RewardCampaignWindowMode" NOT NULL DEFAULT 'CAMPAIGN_RANGE',
ADD COLUMN "rollingWindowDays" INTEGER;
