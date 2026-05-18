ALTER TABLE "Customer" ADD COLUMN "partnerProfileId" UUID;

ALTER TABLE "Order" ADD COLUMN "partnerProfileId" UUID;

CREATE INDEX "Customer_partnerProfileId_idx" ON "Customer"("partnerProfileId");

CREATE INDEX "Order_partnerProfileId_idx" ON "Order"("partnerProfileId");

ALTER TABLE "Customer" ADD CONSTRAINT "Customer_partnerProfileId_fkey" FOREIGN KEY ("partnerProfileId") REFERENCES "PartnerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Order" ADD CONSTRAINT "Order_partnerProfileId_fkey" FOREIGN KEY ("partnerProfileId") REFERENCES "PartnerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
