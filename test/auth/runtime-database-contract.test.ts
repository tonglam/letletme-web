import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test, { describe, it } from 'node:test'
import postgres from 'postgres'

import {
	validateWebDatabaseContract,
	WEB_AUTH_RUNTIME_TABLES,
	WebDatabaseContractError,
} from '../../lib/db/runtime-contract'

describe('Web runtime database boundary', () => {
	it('installs an auth-only capability role and startup contract', async () => {
		const [migration, journal, instrumentation, environment] = await Promise.all([
			readFile('drizzle/0008_web_auth_runtime_role.sql', 'utf8'),
			readFile('drizzle/meta/_journal.json', 'utf8'),
			readFile('instrumentation.ts', 'utf8'),
			readFile('.env.example', 'utf8'),
		])

		assert.match(migration, /CREATE ROLE letletme_web_auth/)
		for (const attribute of [
			'NOLOGIN',
			'NOSUPERUSER',
			'NOCREATEDB',
			'NOCREATEROLE',
			'NOINHERIT',
			'NOREPLICATION',
			'NOBYPASSRLS',
		]) {
			assert.match(migration, new RegExp(`\\b${attribute}\\b`))
		}
		assert.match(
			migration,
			/GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE bauth\.%I TO letletme_web_auth/,
		)
		assert.match(migration, /CREATE POLICY web_auth_runtime_all/)
		assert.match(migration, /TO letletme_web_auth USING \(true\) WITH CHECK \(true\)/)
		assert.match(migration, /three historical @better-auth\/api-key rows/)
		assert.match(migration, /REVOKE ALL ON TABLE bauth\.%I FROM letletme_web_auth/)
		assert.match(
			migration,
			/REVOKE ALL ON TABLE bauth\.__drizzle_migrations FROM letletme_web_auth/,
		)
		for (const schemaName of ['fpl', 'competition', 'understat', 'bridge', 'reporting', 'ops']) {
			assert.match(migration, new RegExp(`'${schemaName}'`))
		}
		assert.match(journal, /"tag": "0008_web_auth_runtime_role"/)
		assert.match(instrumentation, /await validateWebDatabaseContract\(\)/)
		assert.match(instrumentation, /process\.exit\(1\)/)
		assert.match(environment, /inherits only `letletme_web_auth`/)
		assert.deepEqual([...WEB_AUTH_RUNTIME_TABLES].sort(), [
			'account',
			'fpl_entry_binding_challenges',
			'jwks',
			'mini_program_email_code',
			'mini_program_session',
			'rate_limit',
			'request_rate_limits',
			'session',
			'user',
			'verification',
		])
	})
})

const runtimeDatabaseUrl = process.env.WEB_RUNTIME_DATABASE_URL
const integrationEnabled = process.env.RUN_DB_INTEGRATION === 'true' && Boolean(runtimeDatabaseUrl)

test('dedicated Web login passes the runtime contract and is confined to bauth', {
	skip: !integrationEnabled,
}, async () => {
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
		await assert.rejects(runtime`SELECT count(*) FROM bauth.__drizzle_migrations`)
		await assert.rejects(runtime`CREATE TABLE bauth.runtime_contract_escape (id integer)`)
	} finally {
		await runtime`DELETE FROM bauth."user" WHERE id = ${userId}`
		await runtime.end()
	}
})

test('migration administrator is rejected as a Web runtime login', {
	skip: !integrationEnabled || !process.env.DIRECT_DATABASE_URL,
}, async () => {
	await assert.rejects(
		validateWebDatabaseContract(process.env.DIRECT_DATABASE_URL),
		(error: unknown) =>
			error instanceof WebDatabaseContractError
			&& error.findings.some((finding) => finding.includes('elevated PostgreSQL attributes')),
	)
})
