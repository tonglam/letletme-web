-- Web owns Better Auth data only. The deploy/migration connection remains an
-- administrator, while DATABASE_URL must authenticate as a separate LOGIN
-- role that inherits this NOLOGIN capability role.

DO $web_auth_runtime_role$
DECLARE
	role_row record;
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'letletme_web_auth') THEN
		CREATE ROLE letletme_web_auth
			NOLOGIN
			NOSUPERUSER
			NOCREATEDB
			NOCREATEROLE
			NOINHERIT
			NOREPLICATION
			NOBYPASSRLS;
	END IF;

	SELECT
		rolcanlogin,
		rolsuper,
		rolcreatedb,
		rolcreaterole,
		rolinherit,
		rolreplication,
		rolbypassrls
	INTO STRICT role_row
	FROM pg_roles
	WHERE rolname = 'letletme_web_auth';

	IF role_row.rolcanlogin
		OR role_row.rolsuper
		OR role_row.rolcreatedb
		OR role_row.rolcreaterole
		OR role_row.rolinherit
		OR role_row.rolreplication
		OR role_row.rolbypassrls THEN
		RAISE EXCEPTION 'letletme_web_auth exists with unsafe role attributes';
	END IF;
END
$web_auth_runtime_role$;
--> statement-breakpoint

GRANT USAGE ON SCHEMA bauth TO letletme_web_auth;
REVOKE CREATE ON SCHEMA bauth FROM letletme_web_auth;
REVOKE ALL ON TABLE bauth.__drizzle_migrations FROM letletme_web_auth;
REVOKE ALL ON SEQUENCE bauth.__drizzle_migrations_id_seq FROM letletme_web_auth;
--> statement-breakpoint

DO $web_auth_runtime_tables$
DECLARE
	table_name text;
BEGIN
	FOREACH table_name IN ARRAY ARRAY[
		'account',
		'fpl_entry_binding_challenges',
		'jwks',
		'mini_program_email_code',
		'mini_program_session',
		'rate_limit',
		'request_rate_limits',
		'session',
		'user',
		'verification'
	]
	LOOP
		IF to_regclass(format('bauth.%I', table_name)) IS NULL THEN
			RAISE EXCEPTION 'required Web runtime table bauth.% is missing', table_name;
		END IF;

		EXECUTE format(
			'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE bauth.%I TO letletme_web_auth',
			table_name
		);
		EXECUTE format(
			'REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE bauth.%I FROM letletme_web_auth',
			table_name
		);
		EXECUTE format(
			'ALTER TABLE bauth.%I ENABLE ROW LEVEL SECURITY',
			table_name
		);
		EXECUTE format(
			'DROP POLICY IF EXISTS web_auth_runtime_all ON bauth.%I',
			table_name
		);
		EXECUTE format(
			'CREATE POLICY web_auth_runtime_all ON bauth.%I AS PERMISSIVE FOR ALL TO letletme_web_auth USING (true) WITH CHECK (true)',
			table_name
		);
	END LOOP;
END
$web_auth_runtime_tables$;
--> statement-breakpoint

-- Preserve but deny every non-runtime auth table. In particular, B0 contains
-- three historical @better-auth/api-key rows in bauth.apikey, while the
-- current Web application has no API-key plugin or schema declaration.
DO $web_auth_non_runtime_tables$
DECLARE
	relation_row record;
BEGIN
	FOR relation_row IN
		SELECT relation.relname
		FROM pg_class relation
		JOIN pg_namespace namespace_row ON namespace_row.oid = relation.relnamespace
		WHERE namespace_row.nspname = 'bauth'
			AND relation.relkind IN ('r', 'p')
			AND relation.relname NOT IN (
				'account',
				'fpl_entry_binding_challenges',
				'jwks',
				'mini_program_email_code',
				'mini_program_session',
				'rate_limit',
				'request_rate_limits',
				'session',
				'user',
				'verification'
			)
		ORDER BY relation.relname
	LOOP
		EXECUTE format(
			'REVOKE ALL ON TABLE bauth.%I FROM letletme_web_auth',
			relation_row.relname
		);
		EXECUTE format(
			'ALTER TABLE bauth.%I ENABLE ROW LEVEL SECURITY',
			relation_row.relname
		);
		EXECUTE format(
			'DROP POLICY IF EXISTS web_auth_runtime_all ON bauth.%I',
			relation_row.relname
		);
	END LOOP;
END
$web_auth_non_runtime_tables$;
--> statement-breakpoint

-- Future auth tables receive no implicit capability-role privileges. Every
-- future migration must explicitly add both its narrow ACL and RLS policy;
-- the startup contract rejects a partial addition.
ALTER DEFAULT PRIVILEGES IN SCHEMA bauth
	REVOKE ALL ON TABLES FROM letletme_web_auth;
ALTER DEFAULT PRIVILEGES IN SCHEMA bauth
	REVOKE ALL ON SEQUENCES FROM letletme_web_auth;
--> statement-breakpoint

-- A Web runtime must never inherit access to Data Platform schemas. These
-- revokes are repeated defensively if the schemas already exist; the Data
-- Platform security validator independently checks effective privileges.
DO $web_auth_data_boundary$
DECLARE
	schema_name text;
BEGIN
	FOREACH schema_name IN ARRAY ARRAY[
		'fpl',
		'competition',
		'understat',
		'bridge',
		'reporting',
		'ops'
	]
	LOOP
		IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = schema_name) THEN
			EXECUTE format('REVOKE ALL ON SCHEMA %I FROM letletme_web_auth', schema_name);
			EXECUTE format(
				'REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM letletme_web_auth',
				schema_name
			);
			EXECUTE format(
				'REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM letletme_web_auth',
				schema_name
			);
			EXECUTE format(
				'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA %I FROM letletme_web_auth',
				schema_name
			);
		END IF;
	END LOOP;
END
$web_auth_data_boundary$;
