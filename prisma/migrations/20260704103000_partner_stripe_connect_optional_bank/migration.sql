-- Allow Stripe Connect onboarding before a partner stores manual bank details.
ALTER TABLE "PartnerBankAccount" ALTER COLUMN "routingNumberEncrypted" DROP NOT NULL;
ALTER TABLE "PartnerBankAccount" ALTER COLUMN "accountNumberEncrypted" DROP NOT NULL;
ALTER TABLE "PartnerBankAccount" ALTER COLUMN "routingLast4" DROP NOT NULL;
ALTER TABLE "PartnerBankAccount" ALTER COLUMN "accountLast4" DROP NOT NULL;
