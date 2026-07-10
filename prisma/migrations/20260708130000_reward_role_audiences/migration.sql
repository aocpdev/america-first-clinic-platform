CREATE TYPE "RewardScopeMode" AS ENUM ('PERSONAL', 'DIRECT_TEAM', 'FULL_DOWNLINE');

ALTER TABLE "RewardLevel"
ADD COLUMN "participantRole" "RewardParticipantRole" NOT NULL DEFAULT 'CONSULTANT',
ADD COLUMN "scopeMode" "RewardScopeMode" NOT NULL DEFAULT 'PERSONAL',
ADD COLUMN "metricMode" "RewardCampaignMetricMode" NOT NULL DEFAULT 'UNITS',
ADD COLUMN "qualificationEvent" "RewardCampaignQualificationEvent" NOT NULL DEFAULT 'CAPTURED_PAYMENT',
ADD COLUMN "minQualifiedMarginCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "pointValueCents" INTEGER NOT NULL DEFAULT 10000;

ALTER TABLE "RewardCampaign"
ADD COLUMN "participantRole" "RewardParticipantRole" NOT NULL DEFAULT 'CONSULTANT',
ADD COLUMN "scopeMode" "RewardScopeMode" NOT NULL DEFAULT 'PERSONAL';

DROP INDEX IF EXISTS "RewardLevel_companyId_level_key";
DROP INDEX IF EXISTS "RewardLevel_companyId_salesThreshold_idx";

CREATE UNIQUE INDEX "RewardLevel_companyId_participantRole_level_key" ON "RewardLevel"("companyId", "participantRole", "level");
CREATE INDEX "RewardLevel_companyId_participantRole_salesThreshold_idx" ON "RewardLevel"("companyId", "participantRole", "salesThreshold");

CREATE INDEX "RewardCampaign_companyId_participantRole_status_idx" ON "RewardCampaign"("companyId", "participantRole", "status");
