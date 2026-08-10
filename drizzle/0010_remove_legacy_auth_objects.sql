SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

LOCK TABLE
	bauth.apikey,
	bauth.jwks,
	bauth.rate_limit,
	bauth.__drizzle_migrations,
	drizzle.__drizzle_migrations
IN ACCESS EXCLUSIVE MODE;
--> statement-breakpoint

DO $retired_api_key_contract$
DECLARE
	api_key_count bigint;
BEGIN
	SELECT count(*) INTO api_key_count FROM bauth.apikey;
	IF api_key_count <> 0 THEN
		RAISE EXCEPTION
			'expected the retired API-key table to be empty before cleanup, found % rows',
			api_key_count;
	END IF;
END
$retired_api_key_contract$;
--> statement-breakpoint

DROP TABLE bauth.apikey RESTRICT;
DROP TABLE bauth.jwks RESTRICT;
DROP TABLE bauth.rate_limit RESTRICT;
--> statement-breakpoint

DROP TABLE drizzle.__drizzle_migrations RESTRICT;
DROP SCHEMA drizzle RESTRICT;
--> statement-breakpoint

DO $canonical_auth_contract$
DECLARE
	auth_table_count integer;
BEGIN
	IF to_regnamespace('drizzle') IS NOT NULL THEN
		RAISE EXCEPTION 'shared Drizzle schema still exists';
	END IF;

	IF to_regclass('bauth.apikey') IS NOT NULL
		OR to_regclass('bauth.jwks') IS NOT NULL
		OR to_regclass('bauth.rate_limit') IS NOT NULL THEN
		RAISE EXCEPTION 'retired auth tables still exist';
	END IF;

	SELECT count(*)
	INTO auth_table_count
	FROM pg_class relation
	JOIN pg_namespace namespace_row ON namespace_row.oid = relation.relnamespace
	WHERE namespace_row.nspname = 'bauth'
		AND relation.relkind IN ('r', 'p')
		AND relation.relname IN (
			'__drizzle_migrations',
			'account',
			'fpl_entry_binding_challenges',
			'mini_program_email_code',
			'mini_program_session',
			'request_rate_limits',
			'session',
			'user',
			'verification'
		);

	IF auth_table_count <> 9 OR EXISTS (
		SELECT 1
		FROM pg_class relation
		JOIN pg_namespace namespace_row ON namespace_row.oid = relation.relnamespace
		WHERE namespace_row.nspname = 'bauth'
			AND relation.relkind IN ('r', 'p')
			AND relation.relname NOT IN (
				'__drizzle_migrations',
				'account',
				'fpl_entry_binding_challenges',
				'mini_program_email_code',
				'mini_program_session',
				'request_rate_limits',
				'session',
				'user',
				'verification'
			)
	) THEN
		RAISE EXCEPTION 'bauth does not contain the exact canonical table set';
	END IF;
END
$canonical_auth_contract$;
