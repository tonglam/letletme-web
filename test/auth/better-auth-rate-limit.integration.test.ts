import assert from 'node:assert/strict'
import { randomInt } from 'node:crypto'
import test from 'node:test'

import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { betterAuth } from 'better-auth'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as authSchema from '../../lib/db/schema/auth'

const enabled = process.env.RUN_DB_INTEGRATION === 'true'

test('Better Auth consumes its durable database rate-limit model', { skip: !enabled }, async () => {
	const databaseUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL
	assert.ok(databaseUrl, 'integration database URL is required')
	const sql = postgres(databaseUrl, { max: 1, prepare: false })
	const database = drizzle(sql)
	let createdKeys: string[] = []

	try {
		const before = new Set(
			(await sql<{ key: string }[]>`SELECT key FROM bauth.rate_limit`).map(row => row.key),
		)
		const auth = betterAuth({
			baseURL: 'http://localhost:3000',
			secret: 'integration-better-auth-secret-at-least-thirty-two-characters',
			database: drizzleAdapter(database, {
				provider: 'pg',
				schema: {
					user: authSchema.user,
					session: authSchema.session,
					account: authSchema.account,
					verification: authSchema.verification,
					rateLimit: authSchema.betterAuthRateLimit,
				},
			}),
			rateLimit: { enabled: true, storage: 'database', window: 60, max: 100 },
			advanced: { ipAddress: { ipAddressHeaders: ['x-test-client-ip'] } },
		})

		const response = await auth.handler(
			new Request('http://localhost:3000/api/auth/get-session', {
				headers: { 'x-test-client-ip': `203.0.113.${randomInt(1, 255)}` },
			}),
		)
		assert.equal(response.status, 200)

		const after = await sql<{ key: string; count: number }[]>`
			SELECT key, count FROM bauth.rate_limit
		`
		createdKeys = after.filter(row => !before.has(row.key)).map(row => row.key)
		assert.ok(createdKeys.length > 0, 'Better Auth should persist a rate-limit counter')
		assert.ok(after.find(row => createdKeys.includes(row.key))?.count === 1)
	} finally {
		if (createdKeys.length) {
			await sql`DELETE FROM bauth.rate_limit WHERE key IN ${sql(createdKeys)}`
		}
		await sql.end()
	}
})
