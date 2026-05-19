ALTER TABLE "PaymentMethod"
ADD COLUMN "providerCustomerId" TEXT,
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "PaymentMethod_companyId_providerCode_providerPaymentMethodId_key"
ON "PaymentMethod"("companyId", "providerCode", "providerPaymentMethodId");

CREATE INDEX "PaymentMethod_companyId_customerId_providerCode_idx"
ON "PaymentMethod"("companyId", "customerId", "providerCode");

ALTER TABLE "PaymentProvider"
ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'test',
ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "PaymentProvider_companyId_active_idx"
ON "PaymentProvider"("companyId", "active");

CREATE TABLE "WebhookEndpoint" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "partnerProfileId" UUID,
  "name" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "secret" TEXT NOT NULL,
  "events" TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebhookDelivery" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "endpointId" UUID NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastResponse" TEXT,
  "nextRetryAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebhookEndpoint_companyId_partnerProfileId_isActive_idx"
ON "WebhookEndpoint"("companyId", "partnerProfileId", "isActive");

CREATE INDEX "WebhookDelivery_companyId_eventType_status_idx"
ON "WebhookDelivery"("companyId", "eventType", "status");

CREATE INDEX "WebhookDelivery_endpointId_status_idx"
ON "WebhookDelivery"("endpointId", "status");

ALTER TABLE "WebhookEndpoint"
ADD CONSTRAINT "WebhookEndpoint_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WebhookEndpoint"
ADD CONSTRAINT "WebhookEndpoint_partnerProfileId_fkey"
FOREIGN KEY ("partnerProfileId") REFERENCES "PartnerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WebhookDelivery"
ADD CONSTRAINT "WebhookDelivery_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WebhookDelivery"
ADD CONSTRAINT "WebhookDelivery_endpointId_fkey"
FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
