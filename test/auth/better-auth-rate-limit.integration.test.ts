import assert from 'node:assert/strict'
import { randomInt, randomUUID } from 'node:crypto'
import test from 'node:test'

import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { betterAuth } from 'better-auth'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import { createBetterAuthRateLimitStorage } from '../../lib/better-auth-rate-limit-storage'
import * as authSchema from '../../lib/db/schema/auth'

const enabled = process.env.RUN_DB_INTEGRATION === 'true'

test(
	'Better Auth consumes the Web-owned durable rate limiter',
	{ skip: !enabled },
	async () => {
		const databaseUrl =
			process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL
		assert.ok(databaseUrl, 'integration database URL is required')
		const sql = postgres(databaseUrl, { max: 1, prepare: false })
		const database = drizzle(sql)
		const scope = `integration-better-auth-${randomUUID()}`
		const clientIp = `203.0.113.${randomInt(1, 255)}`

		try {
			const [{ count: legacyRowsBefore }] = await sql<{ count: number }[]>`
			SELECT count(*)::int AS count FROM bauth.rate_limit
		`
			const customStorage = createBetterAuthRateLimitStorage({
				resolveSecret: () => 'integration-rate-limit-hash-secret',
				scope,
				consumeDatabaseRateLimit: async ({
					scope: rateScope,
					subject,
					limit,
					windowSeconds
				}) => {
					const now = new Date()
					const epochSeconds = Math.floor(now.getTime() / 1000)
					const bucketSeconds =
						Math.floor(epochSeconds / windowSeconds) * windowSeconds
					const bucketStart = new Date(bucketSeconds * 1000)
					const expiresAt = new Date((bucketSeconds + windowSeconds) * 1000)
					const bucketStartIso = bucketStart.toISOString()
					const expiresAtIso = expiresAt.toISOString()
					const [row] = await sql<{ count: number }[]>`
					INSERT INTO bauth.request_rate_limits
						(scope, subject, bucket_start, window_seconds, count, expires_at)
					VALUES
						(${rateScope}, ${subject}, ${bucketStartIso}, ${windowSeconds}, 1, ${expiresAtIso})
					ON CONFLICT (scope, subject, bucket_start)
					DO UPDATE SET count = bauth.request_rate_limits.count + 1
					RETURNING count
				`
					return {
						allowed: Number(row?.count) <= limit,
						retryAfterSeconds: Math.max(
							1,
							Math.ceil((expiresAt.getTime() - now.getTime()) / 1000)
						)
					}
				}
			})
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
						rateLimit: authSchema.betterAuthRateLimit
					}
				}),
				rateLimit: { enabled: true, window: 60, max: 100, customStorage },
				advanced: { ipAddress: { ipAddressHeaders: ['x-test-client-ip'] } }
			})

			const response = await auth.handler(
				new Request('http://localhost:3000/api/auth/get-session', {
					headers: { 'x-test-client-ip': clientIp }
				})
			)
			assert.equal(response.status, 200)

			const rows = await sql<{ subject: string; count: number }[]>`
			SELECT subject, count FROM bauth.request_rate_limits WHERE scope = ${scope}
		`
			assert.equal(rows.length, 1)
			assert.equal(rows[0]?.count, 1)
			assert.match(rows[0]?.subject ?? '', /^[a-f0-9]{64}$/)
			assert.equal(rows[0]?.subject.includes(clientIp), false)

			const [{ count: legacyRowsAfter }] = await sql<{ count: number }[]>`
			SELECT count(*)::int AS count FROM bauth.rate_limit
		`
			assert.equal(legacyRowsAfter, legacyRowsBefore)
		} finally {
			await sql`DELETE FROM bauth.request_rate_limits WHERE scope = ${scope}`
			await sql.end()
		}
	}
)
