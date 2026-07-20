import 'server-only'

import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

export {
	buildIngressContextHeaders,
	buildOpaqueRateLimitSubject,
	PayloadTooLargeError,
	readBoundedJson,
	readBoundedText,
	resolveProviderClientIp,
} from '@/lib/http-security-core'

export type DatabaseRateLimit = { allowed: boolean; retryAfterSeconds: number }

export async function checkDatabaseRateLimit({
	scope,
	subject,
	limit,
	windowSeconds,
	cost = 1,
	now = new Date(),
}: {
	scope: string
	subject: string
	limit: number
	windowSeconds: number
	cost?: number
	now?: Date
}): Promise<DatabaseRateLimit> {
	if (!Number.isInteger(cost) || cost < 1) throw new Error('Rate-limit cost must be positive')
	const epochSeconds = Math.floor(now.getTime() / 1000)
	const bucketSeconds = Math.floor(epochSeconds / windowSeconds) * windowSeconds
	const bucketStart = new Date(bucketSeconds * 1000)
	const expiresAt = new Date((bucketSeconds + windowSeconds) * 1000)
	const rows = await db.execute(sql`
		WITH pruned AS (
			DELETE FROM bauth.request_rate_limits
			WHERE ctid IN (
				SELECT ctid FROM bauth.request_rate_limits
				WHERE expires_at < ${now}
				ORDER BY expires_at
				LIMIT 1000
			)
		), incremented AS (
		INSERT INTO bauth.request_rate_limits
			(scope, subject, bucket_start, window_seconds, count, expires_at)
		VALUES
			(${scope}, ${subject}, ${bucketStart}, ${windowSeconds}, ${cost}, ${expiresAt})
		ON CONFLICT (scope, subject, bucket_start)
		DO UPDATE SET count = bauth.request_rate_limits.count + ${cost}
		RETURNING count
		)
		SELECT count FROM incremented
	`)
	const count = Number((rows as unknown as Array<{ count: number }>)[0]?.count)
	if (!Number.isFinite(count)) throw new Error('Rate-limit counter returned no count')
	return {
		allowed: count <= limit,
		retryAfterSeconds: Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000)),
	}
}
