CREATE TYPE "CustomerDocumentType" AS ENUM ('RX', 'GFE');

CREATE TABLE "CustomerDocument" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "orderId" UUID,
    "uploadedByUserId" UUID,
    "type" "CustomerDocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "fileName" TEXT NOT NULL,
    "storageBucket" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerDocument_companyId_customerId_type_idx" ON "CustomerDocument"("companyId", "customerId", "type");
CREATE INDEX "CustomerDocument_orderId_type_idx" ON "CustomerDocument"("orderId", "type");

ALTER TABLE "CustomerDocument" ADD CONSTRAINT "CustomerDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerDocument" ADD CONSTRAINT "CustomerDocument_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerDocument" ADD CONSTRAINT "CustomerDocument_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
