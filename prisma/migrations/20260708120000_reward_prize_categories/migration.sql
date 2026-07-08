CREATE TYPE "RewardPrizeCategory" AS ENUM ('MONEY', 'TRAVEL', 'ELECTRONICS', 'EXPERIENCE', 'PRODUCT', 'GIFT_CARD', 'RECOGNITION', 'CUSTOM');

ALTER TABLE "Reward"
ADD COLUMN "prizeCategory" "RewardPrizeCategory" NOT NULL DEFAULT 'CUSTOM';

ALTER TABLE "RewardCampaign"
ADD COLUMN "prizeCategory" "RewardPrizeCategory" NOT NULL DEFAULT 'CUSTOM';

UPDATE "RewardCampaign"
SET "prizeCategory" = 'MONEY'
WHERE "rewardValueType" = 'CASH';
