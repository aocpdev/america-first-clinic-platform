CREATE TABLE "Discount" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" TEXT NOT NULL,
    "valueBps" INTEGER NOT NULL DEFAULT 0,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "minSubtotalCents" INTEGER NOT NULL DEFAULT 0,
    "ownerProtectedProfitCents" INTEGER NOT NULL DEFAULT 0,
    "affectsCommissions" BOOLEAN NOT NULL DEFAULT true,
    "productIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "categoryNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "maxRedemptions" INTEGER,
    "redemptionCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Discount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscountRedemption" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "discountId" UUID,
    "orderId" UUID NOT NULL,
    "codeSnapshot" TEXT NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "discountTypeSnapshot" TEXT NOT NULL,
    "discountCents" INTEGER NOT NULL,
    "subtotalCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "ownerProtectedProfitCents" INTEGER NOT NULL,
    "commissionableMarginCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscountRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Discount_companyId_code_key" ON "Discount"("companyId", "code");
CREATE INDEX "Discount_companyId_active_idx" ON "Discount"("companyId", "active");
CREATE UNIQUE INDEX "DiscountRedemption_orderId_key" ON "DiscountRedemption"("orderId");
CREATE INDEX "DiscountRedemption_companyId_codeSnapshot_idx" ON "DiscountRedemption"("companyId", "codeSnapshot");
CREATE INDEX "DiscountRedemption_discountId_idx" ON "DiscountRedemption"("discountId");

ALTER TABLE "Discount" ADD CONSTRAINT "Discount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiscountRedemption" ADD CONSTRAINT "DiscountRedemption_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiscountRedemption" ADD CONSTRAINT "DiscountRedemption_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "Discount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DiscountRedemption" ADD CONSTRAINT "DiscountRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
