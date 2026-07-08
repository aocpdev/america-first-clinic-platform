CREATE TYPE "RewardCampaignMetricMode" AS ENUM ('UNITS', 'QUALIFIED_POINTS');

CREATE TYPE "RewardCampaignPeriodMode" AS ENUM ('CUSTOM', 'MONTHLY', 'QUARTERLY', 'ACCUMULATIVE');

ALTER TABLE "RewardCampaign"
ADD COLUMN "metricMode" "RewardCampaignMetricMode" NOT NULL DEFAULT 'UNITS',
ADD COLUMN "periodMode" "RewardCampaignPeriodMode" NOT NULL DEFAULT 'CUSTOM',
ADD COLUMN "minQualifiedMarginCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "pointValueCents" INTEGER NOT NULL DEFAULT 10000;
