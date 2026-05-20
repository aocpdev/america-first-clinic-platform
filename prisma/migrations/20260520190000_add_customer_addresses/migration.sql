CREATE TABLE "CustomerAddress" (
  "id" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "label" TEXT,
  "line1" TEXT NOT NULL,
  "line2" TEXT,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "postalCode" TEXT NOT NULL,
  "country" TEXT NOT NULL DEFAULT 'US',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerAddress_customerId_idx" ON "CustomerAddress"("customerId");
CREATE INDEX "CustomerAddress_customerId_isDefault_idx" ON "CustomerAddress"("customerId", "isDefault");

ALTER TABLE "CustomerAddress"
ADD CONSTRAINT "CustomerAddress_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
