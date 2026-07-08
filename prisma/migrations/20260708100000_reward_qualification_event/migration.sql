CREATE TYPE "RewardCampaignQualificationEvent" AS ENUM ('CAPTURED_PAYMENT', 'SHIPPED_ORDER');

ALTER TABLE "RewardCampaign"
ADD COLUMN "qualificationEvent" "RewardCampaignQualificationEvent" NOT NULL DEFAULT 'CAPTURED_PAYMENT';
