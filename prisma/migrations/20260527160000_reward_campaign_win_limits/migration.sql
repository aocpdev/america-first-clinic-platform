ALTER TABLE "RewardCampaign" ADD COLUMN "targetQuantity" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "RewardCampaign" ADD COLUMN "maxWinsPerParticipant" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "RewardCampaign" ADD COLUMN "maxTotalClaims" INTEGER;

ALTER TABLE "RewardCampaignClaim" ADD COLUMN "sequence" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "RewardCampaignClaim" ADD COLUMN "progressWindowStartsAt" TIMESTAMP(3);
ALTER TABLE "RewardCampaignClaim" ADD COLUMN "progressWindowEndsAt" TIMESTAMP(3);

DROP INDEX IF EXISTS "RewardCampaignClaim_campaignId_userId_key";
CREATE UNIQUE INDEX "RewardCampaignClaim_campaignId_userId_sequence_key" ON "RewardCampaignClaim"("campaignId", "userId", "sequence");
CREATE INDEX "RewardCampaignClaim_campaignId_userId_idx" ON "RewardCampaignClaim"("campaignId", "userId");
