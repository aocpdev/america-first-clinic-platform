-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'SUSPENDED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedByUserId" UUID,
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "requestedRole" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "User_companyId_status_requestedRole_idx" ON "User"("companyId", "status", "requestedRole");
