-- Web owns bauth and grants GraphQL only the two read models required to
-- validate current Mini Program sessions. Data owns the capability role;
-- this migration fails closed if Data Platform v3 has not created it first.

DO $graphql_auth_reader_role$
DECLARE
	role_row record;
BEGIN
	SELECT
		rolcanlogin,
		rolsuper,
		rolcreatedb,
		rolcreaterole,
		rolinherit,
		rolreplication,
		rolbypassrls
	INTO role_row
	FROM pg_roles
	WHERE rolname = 'letletme_graphql_reader';

	IF NOT FOUND THEN
		RAISE EXCEPTION 'letletme_graphql_reader must be created by Data Platform v3 first';
	END IF;

	IF role_row.rolcanlogin
		OR role_row.rolsuper
		OR role_row.rolcreatedb
		OR role_row.rolcreaterole
		OR role_row.rolinherit
		OR role_row.rolreplication
		OR role_row.rolbypassrls THEN
		RAISE EXCEPTION 'letletme_graphql_reader exists with unsafe role attributes';
	END IF;
END
$graphql_auth_reader_role$;
--> statement-breakpoint

GRANT USAGE ON SCHEMA bauth TO letletme_graphql_reader;
REVOKE CREATE ON SCHEMA bauth FROM letletme_graphql_reader;

-- Reset the complete Web-owned schema before applying the two-table allowlist.
REVOKE ALL ON ALL TABLES IN SCHEMA bauth FROM letletme_graphql_reader;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA bauth FROM letletme_graphql_reader;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA bauth FROM letletme_graphql_reader;

GRANT SELECT ON TABLE
	bauth."user",
	bauth.mini_program_session
TO letletme_graphql_reader;
--> statement-breakpoint

ALTER TABLE bauth."user" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS graphql_auth_reader_select ON bauth."user";
CREATE POLICY graphql_auth_reader_select
	ON bauth."user"
	AS PERMISSIVE
	FOR SELECT
	TO letletme_graphql_reader
	USING (true);

ALTER TABLE bauth.mini_program_session ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS graphql_auth_reader_select ON bauth.mini_program_session;
CREATE POLICY graphql_auth_reader_select
	ON bauth.mini_program_session
	AS PERMISSIVE
	FOR SELECT
	TO letletme_graphql_reader
	USING (true);
--> statement-breakpoint

-- Future Web migrations must opt new GraphQL auth reads in explicitly.
ALTER DEFAULT PRIVILEGES IN SCHEMA bauth
	REVOKE ALL ON TABLES FROM letletme_graphql_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA bauth
	REVOKE ALL ON SEQUENCES FROM letletme_graphql_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA bauth
	REVOKE ALL ON FUNCTIONS FROM letletme_graphql_reader;
