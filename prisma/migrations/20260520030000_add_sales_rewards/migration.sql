CREATE TABLE "RewardLevel" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "level" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "salesThreshold" INTEGER NOT NULL,
    "accentColor" TEXT NOT NULL DEFAULT '#073763',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardLevel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Reward" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "levelId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "valueCents" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RewardLevel_companyId_level_key" ON "RewardLevel"("companyId", "level");
CREATE INDEX "RewardLevel_companyId_salesThreshold_idx" ON "RewardLevel"("companyId", "salesThreshold");
CREATE INDEX "Reward_companyId_levelId_isActive_idx" ON "Reward"("companyId", "levelId", "isActive");

ALTER TABLE "RewardLevel" ADD CONSTRAINT "RewardLevel_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "RewardLevel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
