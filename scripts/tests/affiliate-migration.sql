-- Run only in an isolated local migration-test database, after the migration.
BEGIN;
INSERT INTO "Company" ("id") VALUES ('00000000-0000-0000-0000-000000000001');
INSERT INTO "AffiliateProfile" ("id", "companyId", "displayName", "email", "referralCode", "updatedAt")
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Test', 'test@example.com', 'AF-TEST', now());
DO $$ BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = '"AffiliateProfile"'::regclass) OR
     NOT (SELECT relrowsecurity FROM pg_class WHERE oid = '"AffiliateProgramSetting"'::regclass) THEN
    RAISE EXCEPTION 'RLS missing';
  END IF;
  IF has_table_privilege('anon', '"AffiliateProfile"', 'SELECT,INSERT,UPDATE,DELETE') OR
     has_table_privilege('authenticated', '"AffiliateProfile"', 'SELECT,INSERT,UPDATE,DELETE') OR
     has_table_privilege('anon', '"AffiliateProgramSetting"', 'SELECT,INSERT,UPDATE,DELETE') OR
     has_table_privilege('authenticated', '"AffiliateProgramSetting"', 'SELECT,INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'Client privileges were not revoked';
  END IF;
  BEGIN
    UPDATE "AffiliateProfile" SET "commissionBps" = 10001;
    RAISE EXCEPTION 'Invalid rate accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE "AffiliateProfile" SET "status" = 'ADMIN';
    RAISE EXCEPTION 'Invalid status accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE "AffiliateProfile" SET "email" = 'TEST@example.com';
    RAISE EXCEPTION 'Unnormalized email accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE "AffiliateProfile" SET "companyId" = '00000000-0000-0000-0000-000000000099';
    RAISE EXCEPTION 'Missing tenant accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
END $$;
ROLLBACK;
