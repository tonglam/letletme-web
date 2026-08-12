import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { validateWebRuntimeDatabaseConfiguration } from '../instrumentation'

describe('static Web runtime database startup contract', () => {
	it('accepts a complete dedicated pooler URL without opening a connection', () => {
		assert.deepEqual(
			validateWebRuntimeDatabaseConfiguration(
				'postgresql://letletme_web_runtime.project-ref:secret@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require',
				'2'
			),
			{
				roleName: 'letletme_web_runtime',
				host: 'aws-0-ap-southeast-2.pooler.supabase.com',
				port: 6543,
				database: 'postgres',
				pooler: true,
				poolMax: 2
			}
		)
	})

	it('rejects admin identities, missing credentials, and role overrides', () => {
		for (const url of [
			'postgresql://postgres:secret@db.example/postgres',
			'postgresql://letletme_web_runtime@db.example/postgres',
			'postgresql://letletme_web_runtime:secret@db.example/postgres?role=postgres',
			'postgresql://letletme_web_runtime:secret@db.example/postgres?pgbouncer=false'
		]) {
			assert.throws(() => validateWebRuntimeDatabaseConfiguration(url, '1'))
		}
	})

	it('keeps the existing one-to-two connection ceiling', () => {
		assert.throws(() =>
			validateWebRuntimeDatabaseConfiguration(
				'postgresql://letletme_web_runtime:secret@db.example/postgres',
				'3'
			)
		)
	})
})
