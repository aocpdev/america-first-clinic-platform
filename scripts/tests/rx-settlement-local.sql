-- Disposable LOCAL experiment only; deliberately not a production migration.
DO $$ BEGIN
  IF current_database() <> 'gvh_affiliate_test' OR inet_server_addr() <> '127.0.0.1'::inet OR inet_server_port() <> 55439 THEN
    RAISE EXCEPTION 'LOCAL_TEST_DATABASE_REQUIRED';
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS "RxCustomerOwner" (
  "customerId" uuid PRIMARY KEY REFERENCES "Customer"(id) ON DELETE RESTRICT,
  "companyId" uuid NOT NULL REFERENCES "Company"(id) ON DELETE RESTRICT,
  "sellerRole" text NOT NULL CHECK ("sellerRole" IN ('DIRECT','AFFILIATE','CONSULTANT','GROUP_LEADER','MANAGER','PARTNER')),
  "profileId" uuid NOT NULL,
  "sourceOrderId" uuid NOT NULL REFERENCES "Order"(id) ON DELETE RESTRICT,
  "capturedAt" timestamp(3) NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("sellerRole" <> 'DIRECT' OR "profileId" = "companyId")
);
CREATE TABLE IF NOT EXISTS "RxOrderCommission" (
  "orderId" uuid PRIMARY KEY REFERENCES "Order"(id) ON DELETE RESTRICT,
  "companyId" uuid NOT NULL REFERENCES "Company"(id) ON DELETE RESTRICT,
  "customerId" uuid NOT NULL REFERENCES "Customer"(id) ON DELETE RESTRICT,
  "sellerRole" text NOT NULL CHECK ("sellerRole" IN ('DIRECT','AFFILIATE','CONSULTANT','GROUP_LEADER','MANAGER','PARTNER')),
  "profileId" uuid NOT NULL,
  "rateBps" integer CHECK ("rateBps" BETWEEN 0 AND 10000),
  "basisCents" integer NOT NULL CHECK ("basisCents" >= 0),
  "amountCents" integer NOT NULL CHECK ("amountCents" >= 0),
  status text NOT NULL DEFAULT 'AWAITING_PAYMENT' CHECK (status IN ('AWAITING_PAYMENT','NOT_PAYABLE','PENDING','EXISTING_LEDGER','APPROVED','PAID','ON_HOLD','RECOVERY_REQUIRED')),
  "captureId" uuid UNIQUE REFERENCES "PaymentTransaction"(id) ON DELETE RESTRICT,
  "settledAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (("captureId" IS NULL) = ("settledAt" IS NULL)),
  CHECK (("sellerRole" = 'AFFILIATE') = ("rateBps" IS NOT NULL)),
  CHECK ("sellerRole" <> 'DIRECT' OR ("profileId" = "companyId" AND "amountCents" = 0 AND status IN ('AWAITING_PAYMENT','NOT_PAYABLE')))
);
CREATE INDEX IF NOT EXISTS "RxCustomerOwner_companyId_profileId_idx" ON "RxCustomerOwner" ("companyId", "profileId");
CREATE INDEX IF NOT EXISTS "RxOrderCommission_companyId_profileId_status_idx" ON "RxOrderCommission" ("companyId", "profileId", status);
CREATE INDEX IF NOT EXISTS "RxOrderCommission_customerId_status_idx" ON "RxOrderCommission" ("customerId", status);
CREATE INDEX IF NOT EXISTS "AuditLog_application_lookup_idx" ON "AuditLog" ("companyId", action, "createdAt");
ALTER TABLE "RxCustomerOwner" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RxOrderCommission" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "RxCustomerOwner", "RxOrderCommission" FROM PUBLIC;
DO $$ DECLARE role_name text; BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON "RxCustomerOwner", "RxOrderCommission" FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
CREATE OR REPLACE FUNCTION rx_local_owner_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'ORIGINAL_OWNER_IMMUTABLE'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "Order" o JOIN "Customer" c ON c.id=o."customerId"
    WHERE o.id=NEW."sourceOrderId" AND c.id=NEW."customerId" AND o."companyId"=NEW."companyId" AND c."companyId"=NEW."companyId") THEN
    RAISE EXCEPTION 'OWNER_SCOPE_MISMATCH';
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION rx_local_snapshot_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'COMMISSION_TERMS_IMMUTABLE'; END IF;
  IF TG_OP='UPDATE' AND (to_jsonb(NEW) - ARRAY['status','captureId','settledAt']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','captureId','settledAt']) THEN
    RAISE EXCEPTION 'COMMISSION_TERMS_IMMUTABLE';
  END IF;
  IF TG_OP='UPDATE' AND OLD."settledAt" IS NOT NULL AND (NEW."settledAt" IS DISTINCT FROM OLD."settledAt" OR NEW."captureId" IS DISTINCT FROM OLD."captureId") THEN
    RAISE EXCEPTION 'CAPTURE_IMMUTABLE';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "Order" o JOIN "Customer" c ON c.id=o."customerId"
    WHERE o.id=NEW."orderId" AND c.id=NEW."customerId" AND o."companyId"=NEW."companyId" AND c."companyId"=NEW."companyId") THEN
    RAISE EXCEPTION 'COMMISSION_SCOPE_MISMATCH';
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER rx_local_owner_guard BEFORE INSERT OR UPDATE OR DELETE ON "RxCustomerOwner" FOR EACH ROW EXECUTE FUNCTION rx_local_owner_guard();
CREATE OR REPLACE TRIGGER rx_local_snapshot_guard BEFORE INSERT OR UPDATE OR DELETE ON "RxOrderCommission" FOR EACH ROW EXECUTE FUNCTION rx_local_snapshot_guard();
REVOKE ALL ON FUNCTION rx_local_owner_guard(), rx_local_snapshot_guard() FROM PUBLIC;
