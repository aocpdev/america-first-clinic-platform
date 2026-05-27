CREATE TYPE "RewardClaimStatus" AS ENUM ('EARNED', 'PAYOUT_PENDING', 'PAYOUT_APPLIED', 'REDEEM_REQUESTED', 'FULFILLED');

CREATE TYPE "RewardParticipantRole" AS ENUM ('MANAGER', 'GROUP_LEADER', 'CONSULTANT');

CREATE TABLE "RewardCampaignClaim" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "consultantProfileId" UUID,
    "managerProfileId" UUID,
    "groupLeaderProfileId" UUID,
    "participantRole" "RewardParticipantRole" NOT NULL,
    "status" "RewardClaimStatus" NOT NULL DEFAULT 'EARNED',
    "rewardValueType" "RewardValueType" NOT NULL,
    "rewardValueCents" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redeemedAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "payoutAppliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardCampaignClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RewardCampaignClaim_campaignId_userId_key" ON "RewardCampaignClaim"("campaignId", "userId");
CREATE INDEX "RewardCampaignClaim_companyId_status_idx" ON "RewardCampaignClaim"("companyId", "status");
CREATE INDEX "RewardCampaignClaim_campaignId_status_idx" ON "RewardCampaignClaim"("campaignId", "status");
CREATE INDEX "RewardCampaignClaim_userId_status_idx" ON "RewardCampaignClaim"("userId", "status");
CREATE INDEX "RewardCampaignClaim_consultantProfileId_status_idx" ON "RewardCampaignClaim"("consultantProfileId", "status");
CREATE INDEX "RewardCampaignClaim_managerProfileId_status_idx" ON "RewardCampaignClaim"("managerProfileId", "status");
CREATE INDEX "RewardCampaignClaim_groupLeaderProfileId_status_idx" ON "RewardCampaignClaim"("groupLeaderProfileId", "status");

ALTER TABLE "RewardCampaignClaim" ADD CONSTRAINT "RewardCampaignClaim_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RewardCampaignClaim" ADD CONSTRAINT "RewardCampaignClaim_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "RewardCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RewardCampaignClaim" ADD CONSTRAINT "RewardCampaignClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RewardCampaignClaim" ADD CONSTRAINT "RewardCampaignClaim_consultantProfileId_fkey" FOREIGN KEY ("consultantProfileId") REFERENCES "ConsultantProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RewardCampaignClaim" ADD CONSTRAINT "RewardCampaignClaim_managerProfileId_fkey" FOREIGN KEY ("managerProfileId") REFERENCES "ManagerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RewardCampaignClaim" ADD CONSTRAINT "RewardCampaignClaim_groupLeaderProfileId_fkey" FOREIGN KEY ("groupLeaderProfileId") REFERENCES "GroupLeaderProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
