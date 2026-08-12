import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import {
	assertWebRuntimeDatabaseTarget,
	assertWebRuntimeDatabaseUrl,
	isRetryableWebRuntimeConnectionFailure,
	parseWebRuntimeBootstrapArgs,
	verifyWebRuntimeConnectionWithRetry,
	WEB_RUNTIME_CAPABILITY,
	WEB_RUNTIME_LOGIN
} from '../../scripts/runtime-login-contract'

describe('Web runtime LOGIN bootstrap boundary', () => {
	it('accepts only a complete URL for the dedicated Web login', () => {
		const initialSecret = 'w'.repeat(64)
		assert.deepEqual(
			assertWebRuntimeDatabaseUrl(
				`postgresql://letletme_web_runtime.project-ref:${initialSecret}@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true`
			),
			{ password: initialSecret }
		)
		for (const url of [
			'postgresql://migration_admin:secret@pooler.example:6543/postgres',
			'postgresql://letletme_web_runtime@pooler.example:6543/postgres',
			'postgresql://letletme_web_runtime:initial-secret@pooler.example:6543/postgres',
			`postgresql://letletme_web_runtime.project-ref:${initialSecret}@attacker.example:6543/postgres`,
			'postgresql://letletme_web_runtime:secret@pooler.example:6543/%ZZ',
			'https://letletme_web_runtime:secret@pooler.example/postgres'
		]) {
			assert.throws(() => assertWebRuntimeDatabaseUrl(url))
		}
	})

	it('retries new-role authentication propagation but not stale existing credentials', async () => {
		let attempts = 0
		const waits: number[] = []
		const result = await verifyWebRuntimeConnectionWithRetry(
			async () => {
				attempts += 1
				if (attempts < 3) {
					throw Object.assign(new Error('password authentication failed'), {
						code: '28P01'
					})
				}
				return 'verified'
			},
			{
				retryAuthentication: true,
				retryDelaysMs: [0, 1, 2],
				wait: async milliseconds => {
					waits.push(milliseconds)
				}
			}
		)
		assert.equal(result, 'verified')
		assert.equal(attempts, 3)
		assert.deepEqual(waits, [1, 2])

		const authenticationError = Object.assign(
			new Error('password authentication failed'),
			{ code: '28P01' }
		)
		assert.equal(
			isRetryableWebRuntimeConnectionFailure(authenticationError, true),
			true
		)
		assert.equal(
			isRetryableWebRuntimeConnectionFailure(authenticationError, false),
			false
		)
	})

	it('requires the runtime and migration URLs to target one database project', () => {
		assert.doesNotThrow(() =>
			assertWebRuntimeDatabaseTarget(
				'postgresql://postgres:admin@db.project-ref.supabase.co:5432/postgres',
				'postgresql://letletme_web_runtime.project-ref:secret@aws-0-region.pooler.supabase.com:6543/postgres'
			)
		)
		assert.throws(() =>
			assertWebRuntimeDatabaseTarget(
				'postgresql://postgres:admin@db.first.supabase.co:5432/postgres',
				'postgresql://letletme_web_runtime.second:secret@aws-0-region.pooler.supabase.com:6543/postgres'
			)
		)
		assert.throws(() =>
			assertWebRuntimeDatabaseTarget(
				'postgresql://postgres:admin@db.project-ref.supabase.co:5432/postgres',
				'postgresql://letletme_web_runtime.project-ref:secret@attacker.example:6543/postgres'
			)
		)
		assert.throws(() =>
			assertWebRuntimeDatabaseTarget(
				'postgresql://postgres:admin@127.0.0.1:5432/one',
				'postgresql://letletme_web_runtime:secret@127.0.0.1:5432/two'
			)
		)
	})

	it('has no password-rotation argument or SQL path', () => {
		assert.doesNotThrow(() => parseWebRuntimeBootstrapArgs([]))
		for (const args of [
			['--rotate-existing-password'],
			['--target=web'],
			['unexpected']
		]) {
			assert.throws(() => parseWebRuntimeBootstrapArgs(args))
		}

		const implementation = [
			readFileSync('scripts/runtime-login-contract.ts', 'utf8'),
			readFileSync('scripts/bootstrap-runtime-login.ts', 'utf8'),
			readFileSync('scripts/verify-runtime-login.ts', 'utf8')
		].join('\n')
		assert.doesNotMatch(implementation, /ALTER\s+ROLE[\s\S]*PASSWORD/i)
		assert.doesNotMatch(implementation, /RUNTIME_LOGIN_ROTATION_ACK/)
		assert.doesNotMatch(implementation, /WEB_RUNTIME_DB_PASSWORD/)
	})

	it('uses the expected login and capability identities', () => {
		assert.equal(WEB_RUNTIME_LOGIN, 'letletme_web_runtime')
		assert.equal(WEB_RUNTIME_CAPABILITY, 'letletme_web_auth')
	})
})
