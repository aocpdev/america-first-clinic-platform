-- LOCAL EXPERIMENT ONLY. Not a release migration or production schema.
-- Run only in the disposable local gvh_affiliate_test database.
DO $$ BEGIN
  IF current_database() <> 'gvh_affiliate_test' THEN
    RAISE EXCEPTION 'Local acquisition prototype requires gvh_affiliate_test';
  END IF;
END $$;
BEGIN;
CREATE SCHEMA IF NOT EXISTS rx_acquisition_prototype;
REVOKE ALL ON SCHEMA rx_acquisition_prototype FROM PUBLIC;
CREATE TABLE IF NOT EXISTS rx_acquisition_prototype.owner (
  "customerId" uuid PRIMARY KEY REFERENCES public."Customer"(id) ON DELETE RESTRICT,
  "companyId" uuid NOT NULL REFERENCES public."Company"(id) ON DELETE RESTRICT,
  "sourceOrderId" uuid NOT NULL REFERENCES public."Order"(id) ON DELETE RESTRICT,
  "captureTransactionId" uuid NOT NULL REFERENCES public."PaymentTransaction"(id) ON DELETE RESTRICT,
  "sellerRole" text NOT NULL CHECK ("sellerRole" IN ('CONSULTANT','GROUP_LEADER','MANAGER','PARTNER','AFFILIATE')),
  "profileId" uuid NOT NULL,
  "capturedAt" timestamp(3) NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE rx_acquisition_prototype.owner DROP CONSTRAINT IF EXISTS "owner_sellerRole_check";
ALTER TABLE rx_acquisition_prototype.owner ADD CONSTRAINT "owner_sellerRole_check"
  CHECK ("sellerRole" IN ('CONSULTANT','GROUP_LEADER','MANAGER','PARTNER','AFFILIATE'));
CREATE TABLE IF NOT EXISTS rx_acquisition_prototype.affiliate_order (
  "orderId" uuid PRIMARY KEY REFERENCES public."Order"(id) ON DELETE RESTRICT,
  "companyId" uuid NOT NULL REFERENCES public."Company"(id) ON DELETE RESTRICT,
  "affiliateId" uuid NOT NULL REFERENCES public."AffiliateProfile"(id) ON DELETE RESTRICT,
  terms jsonb NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE rx_acquisition_prototype.affiliate_order ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON rx_acquisition_prototype.affiliate_order FROM PUBLIC;
CREATE OR REPLACE FUNCTION rx_acquisition_prototype.validate_affiliate_order()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE o public."Order"; a public."AffiliateProfile"; existing_owner rx_acquisition_prototype.owner; expected_rate integer;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'AFFILIATE_ORDER_IMMUTABLE'; END IF;
  SELECT * INTO o FROM public."Order" WHERE id = NEW."orderId";
  SELECT * INTO a FROM public."AffiliateProfile" WHERE id = NEW."affiliateId";
  SELECT * INTO existing_owner FROM rx_acquisition_prototype.owner WHERE "customerId" = o."customerId";
  IF o.id IS NULL OR a.id IS NULL OR o."companyId" <> NEW."companyId" OR a."companyId" <> NEW."companyId" OR
    o."paymentStatus"::text <> 'PENDING' OR a.status <> 'APPROVED' OR
    o."consultantProfileId" IS NOT NULL OR o."groupLeaderProfileId" IS NOT NULL OR
    o."managerProfileId" IS NOT NULL OR o."partnerProfileId" IS NOT NULL THEN
    RAISE EXCEPTION 'INVALID_AFFILIATE_ORDER';
  END IF;
  IF existing_owner."customerId" IS NOT NULL AND
    (existing_owner."sellerRole" <> 'AFFILIATE' OR existing_owner."profileId" <> NEW."affiliateId") THEN
    RAISE EXCEPTION 'ORIGINAL_OWNER_MUST_BE_RETAINED';
  END IF;
  SELECT COALESCE(a."commissionBps", (SELECT "commissionBps" FROM public."AffiliateProgramSetting"
    WHERE "companyId" = NEW."companyId"), 2500) INTO expected_rate;
  IF (NEW.terms->>'companyId' = NEW."companyId"::text AND
      NEW.terms->>'affiliateId' = NEW."affiliateId"::text AND NEW.terms->>'version' = '1' AND
      NEW.terms->>'basis' = 'COMMISSIONABLE_MARGIN' AND NEW.terms->>'deductAgencyFeeFromBasis' = 'false' AND
      NEW.terms->>'discountPolicy' = 'EXISTING_SELLER_FUNDING_RULES' AND
      NEW.terms->>'rateSource' = CASE WHEN a."commissionBps" IS NULL THEN 'COMPANY_DEFAULT' ELSE 'AFFILIATE_OVERRIDE' END AND
      (NEW.terms->>'rateBps')::integer = expected_rate AND
      (NEW.terms->>'rateBps')::integer BETWEEN 0 AND 10000) IS NOT TRUE THEN
    RAISE EXCEPTION 'INVALID_AFFILIATE_TERMS';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION rx_acquisition_prototype.validate_affiliate_order() FROM PUBLIC;
DROP TRIGGER IF EXISTS immutable_affiliate_order ON rx_acquisition_prototype.affiliate_order;
CREATE TRIGGER immutable_affiliate_order BEFORE INSERT OR UPDATE OR DELETE ON rx_acquisition_prototype.affiliate_order
FOR EACH ROW EXECUTE FUNCTION rx_acquisition_prototype.validate_affiliate_order();
ALTER TABLE rx_acquisition_prototype.owner ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON rx_acquisition_prototype.owner FROM PUBLIC;
CREATE OR REPLACE FUNCTION rx_acquisition_prototype.validate_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE o public."Order"; p public."PaymentTransaction"; c public."Customer";
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'ACQUISITION_IMMUTABLE'; END IF;
  SELECT * INTO o FROM public."Order" WHERE id = NEW."sourceOrderId";
  SELECT * INTO p FROM public."PaymentTransaction" WHERE id = NEW."captureTransactionId";
  SELECT * INTO c FROM public."Customer" WHERE id = NEW."customerId";
  IF o.id IS NULL OR p.id IS NULL OR c.id IS NULL OR
    o."companyId" <> NEW."companyId" OR c."companyId" <> NEW."companyId" OR
    o."customerId" <> NEW."customerId" OR p."orderId" <> o.id OR
    p."companyId" <> NEW."companyId" OR p.status::text <> 'CAPTURED' OR
    o."paymentStatus"::text <> 'CAPTURED' OR p."createdAt" <> NEW."capturedAt" THEN
    RAISE EXCEPTION 'INVALID_ACQUISITION_CAPTURE';
  END IF;
  IF (
    (NEW."sellerRole" = 'CONSULTANT' AND o."consultantProfileId" = NEW."profileId") OR
    (NEW."sellerRole" = 'GROUP_LEADER' AND o."consultantProfileId" IS NULL AND o."groupLeaderProfileId" = NEW."profileId") OR
    (NEW."sellerRole" = 'MANAGER' AND o."consultantProfileId" IS NULL AND o."groupLeaderProfileId" IS NULL AND o."managerProfileId" = NEW."profileId") OR
    (NEW."sellerRole" = 'PARTNER' AND o."consultantProfileId" IS NULL AND o."groupLeaderProfileId" IS NULL AND o."managerProfileId" IS NULL AND o."partnerProfileId" = NEW."profileId") OR
    (NEW."sellerRole" = 'AFFILIATE' AND o."consultantProfileId" IS NULL AND o."groupLeaderProfileId" IS NULL AND
      o."managerProfileId" IS NULL AND o."partnerProfileId" IS NULL AND EXISTS (
        SELECT 1 FROM rx_acquisition_prototype.affiliate_order s
        WHERE s."orderId" = o.id AND s."companyId" = NEW."companyId" AND s."affiliateId" = NEW."profileId"))
  ) IS NOT TRUE THEN RAISE EXCEPTION 'INVALID_ACQUISITION_SELLER'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION rx_acquisition_prototype.validate_owner() FROM PUBLIC;
DROP TRIGGER IF EXISTS immutable_owner ON rx_acquisition_prototype.owner;
CREATE TRIGGER immutable_owner BEFORE INSERT OR UPDATE OR DELETE ON rx_acquisition_prototype.owner
FOR EACH ROW EXECUTE FUNCTION rx_acquisition_prototype.validate_owner();
COMMIT;
