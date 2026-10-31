-- Read-only invariants plus temporary grants inside a rollback-only LOCAL test.
BEGIN;
DO $$ BEGIN
  IF current_database() <> 'gvh_affiliate_test' OR inet_server_addr() <> '127.0.0.1'::inet OR inet_server_port() <> 55439 THEN
    RAISE EXCEPTION 'LOCAL_TEST_DATABASE_REQUIRED';
  END IF;
END $$;
DO $$ DECLARE r text; t text; BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    FOREACH t IN ARRAY ARRAY['RxCustomerOwner','RxOrderCommission'] LOOP
      IF has_table_privilege(r, format('public.%I', t), 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
        RAISE EXCEPTION 'UNEXPECTED_PUBLIC_TABLE_ACCESS: % %', r, t;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relname=t AND c.relrowsecurity) THEN
        RAISE EXCEPTION 'RLS_REQUIRED: %', t;
      END IF;
    END LOOP;
    IF has_function_privilege(r, 'rx_checkout_owner_guard()', 'EXECUTE') OR
       has_function_privilege(r, 'rx_checkout_snapshot_guard()', 'EXECUTE') THEN
      RAISE EXCEPTION 'UNEXPECTED_PUBLIC_FUNCTION_ACCESS: %', r;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname IN ('rx_checkout_owner_guard','rx_checkout_snapshot_guard') AND prosecdef) THEN
    RAISE EXCEPTION 'GUARDS_MUST_NOT_BE_SECURITY_DEFINER';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "RxCustomerOwner") OR NOT EXISTS (SELECT 1 FROM "RxOrderCommission") THEN
    RAISE EXCEPTION 'RUN_CHECKOUT_FIXTURES_FIRST';
  END IF;
END $$;
-- Even accidental SELECT grants must not expose rows through the Data API.
GRANT SELECT ON "RxCustomerOwner", "RxOrderCommission" TO anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
SET LOCAL ROLE anon;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "RxCustomerOwner") OR EXISTS (SELECT 1 FROM "RxOrderCommission") THEN
    RAISE EXCEPTION 'ANONYMOUS_ROWS_EXPOSED';
  END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "RxCustomerOwner") OR EXISTS (SELECT 1 FROM "RxOrderCommission") THEN
    RAISE EXCEPTION 'AUTHENTICATED_ROWS_EXPOSED';
  END IF;
END $$;
RESET ROLE;
ROLLBACK;
