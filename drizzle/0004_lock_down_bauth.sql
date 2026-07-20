-- Better Auth is server-only. Supabase browser roles must never read password
-- hashes, OAuth tokens, sessions, verification values, Mini Program tokens, or
-- rate-limit subjects from the bauth schema.

DO $$
DECLARE
  relation record;
  policy record;
  client_role text;
BEGIN
  FOR relation IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'bauth' AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('ALTER TABLE bauth.%I ENABLE ROW LEVEL SECURITY', relation.relname);
    FOR policy IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'bauth' AND tablename = relation.relname
    LOOP
      EXECUTE format('DROP POLICY %I ON bauth.%I', policy.policyname, relation.relname);
    END LOOP;
    EXECUTE format('REVOKE ALL ON TABLE bauth.%I FROM PUBLIC', relation.relname);

    FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated']
    LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
        EXECUTE format('REVOKE ALL ON TABLE bauth.%I FROM %I', relation.relname, client_role);
      END IF;
    END LOOP;
  END LOOP;
END $$;
--> statement-breakpoint

REVOKE ALL ON SCHEMA bauth FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA bauth FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA bauth FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA bauth REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA bauth REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA bauth REVOKE ALL ON FUNCTIONS FROM PUBLIC;
--> statement-breakpoint

DO $$
DECLARE
  client_role text;
BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA bauth FROM %I', client_role);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA bauth FROM %I', client_role);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA bauth FROM %I', client_role);
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA bauth REVOKE ALL ON TABLES FROM %I',
        client_role
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA bauth REVOKE ALL ON SEQUENCES FROM %I',
        client_role
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA bauth REVOKE ALL ON FUNCTIONS FROM %I',
        client_role
      );
    END IF;
  END LOOP;
END $$;
