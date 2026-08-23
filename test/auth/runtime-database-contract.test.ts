import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test, { describe, it } from 'node:test'
import postgres from 'postgres'

import {
	GRAPHQL_AUTH_CAPABILITY_ROLE,
	GRAPHQL_AUTH_RUNTIME_TABLES,
	normalizeWebDatabaseContractAuditFailure,
	validateWebDatabaseContract,
	WEB_AUTH_RUNTIME_TABLES,
	WebDatabaseContractAuditTimeoutError,
	WebDatabaseContractError
} from '../../lib/db/runtime-contract'

describe('Web runtime database boundary', () => {
	it('installs an auth-only capability role and startup contract', async () => {
		const [
			baseline,
			standaloneAccountMigration,
			journal,
			instrumentation,
			environment,
			runtimeContract
		] = await Promise.all([
			readFile('drizzle/0000_auth_baseline.sql', 'utf8'),
			readFile('drizzle/0003_graceful_husk.sql', 'utf8'),
			readFile('drizzle/meta/_journal.json', 'utf8'),
			readFile('instrumentation.ts', 'utf8'),
			readFile('.env.example', 'utf8'),
			readFile('lib/db/runtime-contract.ts', 'utf8')
		])

		assert.match(baseline, /CREATE ROLE letletme_web_auth/)
		for (const attribute of [
			'NOLOGIN',
			'NOSUPERUSER',
			'NOCREATEDB',
			'NOCREATEROLE',
			'NOINHERIT',
			'NOREPLICATION',
			'NOBYPASSRLS'
		]) {
			assert.match(baseline, new RegExp(`\\b${attribute}\\b`))
		}
		assert.match(
			baseline,
			/GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE bauth\.account TO letletme_web_auth/
		)
		assert.match(baseline, /CREATE POLICY web_auth_runtime_all/)
		assert.match(
			baseline,
			/TO letletme_web_auth USING \(true\) WITH CHECK \(true\)/
		)
		assert.match(
			baseline,
			/REVOKE ALL ON TABLE bauth\.__drizzle_migrations FROM letletme_web_auth/
		)
		for (const schemaName of [
			'fpl',
			'competition',
			'understat',
			'bridge',
			'reporting',
			'ops'
		]) {
			assert.match(baseline, new RegExp(`'${schemaName}'`))
		}
		assert.match(journal, /"tag": "0000_auth_baseline"/)
		assert.match(
			baseline,
			/GRANT USAGE ON SCHEMA bauth TO letletme_graphql_reader/
		)
		for (const column of ['id', 'fpl_entry_id', 'fpl_entry_verified_at']) {
			assert.match(
				baseline,
				new RegExp(
					`GRANT SELECT\\(${column}\\) ON TABLE bauth\\."user" TO letletme_graphql_reader`
				)
			)
		}
		for (const column of [
			'user_id',
			'token_hash',
			'revoked_at',
			'expires_at'
		]) {
			assert.match(
				baseline,
				new RegExp(
					`GRANT SELECT\\(${column}\\) ON TABLE bauth\\.mini_program_session TO letletme_graphql_reader`
				)
			)
		}
		assert.match(baseline, /CREATE POLICY graphql_auth_reader_select/g)
		assert.match(
			standaloneAccountMigration,
			/GRANT SELECT\(id, linked_web_user_id, follow_entry_id, entry_choice, entry_choice_mini_entry_id, entry_choice_web_entry_id\)/
		)
		assert.match(
			standaloneAccountMigration,
			/GRANT SELECT\(account_id\)[\s\S]*bauth\.mini_program_session/
		)
		assert.match(
			standaloneAccountMigration,
			/DROP CONSTRAINT "mini_program_session_user_id_user_id_fk"/
		)
		assert.match(
			standaloneAccountMigration,
			/FOREIGN KEY \("user_id"\) REFERENCES "bauth"\."user"\("id"\) ON DELETE set null/
		)
		assert.match(
			standaloneAccountMigration,
			/INSERT INTO bauth\.mini_program_account[\s\S]*UPDATE bauth\.mini_program_session session[\s\S]*SET account_id = account\.id/
		)
		assert.match(
			standaloneAccountMigration,
			/CONSTRAINT "mini_program_session_principal_present" CHECK/
		)
		assert.match(instrumentation, /validateWebRuntimeDatabaseConfiguration/)
		assert.match(instrumentation, /DATABASE_URL must use/)
		assert.match(
			instrumentation,
			/DATABASE_URL must include runtime credentials/
		)
		assert.doesNotMatch(instrumentation, /validateWebDatabaseContract/)
		assert.doesNotMatch(instrumentation, /postgres\(/)
		assert.match(
			runtimeContract,
			/has_database_privilege\([^\n]+current_database\(\), 'CONNECT'\)/
		)
		assert.match(environment, /inherits only `letletme_web_auth`/)
		assert.deepEqual([...WEB_AUTH_RUNTIME_TABLES].sort(), [
			'account',
			'bug_report_storage_nonces',
			'fpl_entry_binding_challenges',
			'fpl_entry_name_history',
			'mini_program_account',
			'mini_program_email_code',
			'mini_program_session',
			'request_rate_limits',
			'session',
			'user',
			'verification'
		])
		assert.equal(GRAPHQL_AUTH_CAPABILITY_ROLE, 'letletme_graphql_reader')
		assert.deepEqual([...GRAPHQL_AUTH_RUNTIME_TABLES].sort(), [
			'mini_program_account',
			'mini_program_session',
			'user'
		])
	})
})

test('known contract findings win over a later audit timeout', () => {
	const cause = new Error('query was interrupted by audit deadline')
	const normalized = normalizeWebDatabaseContractAuditFailure(
		cause,
		['runtime role can write fpl.events'],
		true,
		2_000
	)

	assert.ok(normalized instanceof WebDatabaseContractError)
	assert.deepEqual(normalized.findings, ['runtime role can write fpl.events'])
})

test('audit timeout is retained when no contract finding completed first', () => {
	const normalized = normalizeWebDatabaseContractAuditFailure(
		new Error('query was interrupted by audit deadline'),
		[],
		true,
		2_000
	)

	assert.ok(normalized instanceof WebDatabaseContractAuditTimeoutError)
})

const runtimeDatabaseUrl = process.env.WEB_RUNTIME_DATABASE_URL
const integrationEnabled =
	process.env.RUN_DB_INTEGRATION === 'true' && Boolean(runtimeDatabaseUrl)

test(
	'dedicated Web login passes the runtime contract and is confined to bauth',
	{
		skip: !integrationEnabled
	},
	async () => {
		assert.ok(runtimeDatabaseUrl)
		const result = await validateWebDatabaseContract(runtimeDatabaseUrl)
		assert.equal(result.capabilityRole, 'letletme_web_auth')
		assert.deepEqual(result.authTables, [...WEB_AUTH_RUNTIME_TABLES])

		const runtime = postgres(runtimeDatabaseUrl, { max: 1, prepare: false })
		const marker = randomUUID()
		const userId = `runtime-contract-${marker}`
		try {
			await runtime`
			INSERT INTO bauth."user" (id, email)
			VALUES (${userId}, ${`${marker}@runtime.example.test`})
		`
			await runtime`
			UPDATE bauth."user"
			SET name = 'Runtime contract'
			WHERE id = ${userId}
		`
			const [stored] = await runtime<Array<{ name: string | null }>>`
			SELECT name FROM bauth."user" WHERE id = ${userId}
		`
			assert.equal(stored?.name, 'Runtime contract')

			await assert.rejects(runtime`SELECT count(*) FROM fpl.seasons`)
			await assert.rejects(runtime`SELECT count(*) FROM bauth.apikey`)
			await assert.rejects(
				runtime`SELECT count(*) FROM bauth.__drizzle_migrations`
			)
			await assert.rejects(
				runtime`CREATE TABLE bauth.runtime_contract_escape (id integer)`
			)
		} finally {
			await runtime`DELETE FROM bauth."user" WHERE id = ${userId}`
			await runtime.end()
		}
	}
)

test(
	'GraphQL auth reader is confined to current Mini Program validation tables',
	{
		skip: !integrationEnabled || !process.env.DIRECT_DATABASE_URL
	},
	async () => {
		const administrator = postgres(process.env.DIRECT_DATABASE_URL!, {
			max: 1,
			prepare: false
		})
		try {
			await administrator.begin(async transaction => {
				await transaction.unsafe('SET LOCAL ROLE letletme_graphql_reader')
				await transaction`
					SELECT id, linked_web_user_id, follow_entry_id,
					       entry_choice, entry_choice_mini_entry_id,
					       entry_choice_web_entry_id
					FROM bauth.mini_program_account
					LIMIT 0
				`
				await transaction`
					SELECT id, fpl_entry_id, fpl_entry_verified_at
				FROM bauth."user"
				LIMIT 0
			`
				await transaction`
					SELECT user_id, account_id, token_hash, revoked_at, expires_at
				FROM bauth.mini_program_session
				LIMIT 0
			`
			})

			await assert.rejects(
				administrator.begin(async transaction => {
					await transaction.unsafe('SET LOCAL ROLE letletme_graphql_reader')
					await transaction`SELECT openid FROM bauth.mini_program_account LIMIT 0`
				})
			)
			await assert.rejects(
				administrator.begin(async transaction => {
					await transaction.unsafe('SET LOCAL ROLE letletme_graphql_reader')
					await transaction`SELECT id FROM bauth.session LIMIT 0`
				})
			)
			await assert.rejects(
				administrator.begin(async transaction => {
					await transaction.unsafe('SET LOCAL ROLE letletme_graphql_reader')
					await transaction`SELECT email FROM bauth."user" LIMIT 0`
				})
			)
			await assert.rejects(
				administrator.begin(async transaction => {
					await transaction.unsafe('SET LOCAL ROLE letletme_graphql_reader')
					await transaction`SELECT device_id FROM bauth.mini_program_session LIMIT 0`
				})
			)
			await assert.rejects(
				administrator.begin(async transaction => {
					await transaction.unsafe('SET LOCAL ROLE letletme_graphql_reader')
					await transaction`UPDATE bauth."user" SET name = name WHERE false`
				})
			)
			await assert.rejects(
				administrator.begin(async transaction => {
					await transaction.unsafe('SET LOCAL ROLE letletme_graphql_reader')
					await transaction`SELECT id FROM bauth.__drizzle_migrations LIMIT 0`
				})
			)
		} finally {
			await administrator.end()
		}
	}
)

test(
	'migration administrator is rejected as a Web runtime login',
	{
		skip: !integrationEnabled || !process.env.DIRECT_DATABASE_URL
	},
	async () => {
		await assert.rejects(
			validateWebDatabaseContract(process.env.DIRECT_DATABASE_URL),
			(error: unknown) =>
				error instanceof WebDatabaseContractError &&
				error.findings.some(finding =>
					finding.includes('elevated PostgreSQL attributes')
				)
		)
	}
)
