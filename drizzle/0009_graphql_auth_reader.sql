-- Web owns bauth and grants GraphQL only the two read models required to
-- validate current Mini Program sessions. Data owns the capability role;
-- this migration fails closed if the Data platform has not created it first.

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
		RAISE EXCEPTION 'letletme_graphql_reader must be created by the Data platform first';
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

-- Table-level revokes do not remove column ACL entries. Clear every possible
-- pre-existing column grant before installing the reviewed seven-column set.
DO $graphql_auth_reader_columns$
DECLARE
	column_row record;
BEGIN
	FOR column_row IN
		SELECT table_name, column_name
		FROM information_schema.columns
		WHERE table_schema = 'bauth'
		ORDER BY table_name, ordinal_position
	LOOP
		EXECUTE format(
			'REVOKE SELECT (%I), INSERT (%I), UPDATE (%I), REFERENCES (%I) ON TABLE bauth.%I FROM letletme_graphql_reader',
			column_row.column_name,
			column_row.column_name,
			column_row.column_name,
			column_row.column_name,
			column_row.table_name
		);
	END LOOP;
END
$graphql_auth_reader_columns$;
--> statement-breakpoint

GRANT SELECT (id, fpl_entry_id, fpl_entry_verified_at)
	ON TABLE bauth."user"
	TO letletme_graphql_reader;
GRANT SELECT (user_id, token_hash, revoked_at, expires_at)
	ON TABLE bauth.mini_program_session
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
