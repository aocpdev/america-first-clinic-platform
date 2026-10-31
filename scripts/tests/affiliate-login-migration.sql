BEGIN;
INSERT INTO "Company" ("id") VALUES ('00000000-0000-0000-0000-000000000001');
INSERT INTO "AffiliateProfile" ("id", "companyId", "displayName", "email", "referralCode", "updatedAt", "authUserId")
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Test', 'test@example.com', 'AF-TEST', now(), 'auth-a');
DO $$ BEGIN
  BEGIN
    INSERT INTO "AffiliateProfile" ("id", "companyId", "displayName", "email", "referralCode", "updatedAt", "authUserId")
    VALUES ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Other', 'other@example.com', 'AF-OTHER', now(), 'auth-a');
    RAISE EXCEPTION 'Duplicate login identity accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;
ROLLBACK;
