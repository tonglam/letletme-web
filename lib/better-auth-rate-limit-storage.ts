import { createHmac } from 'node:crypto'

type BetterAuthRateLimitValue = {
	key: string
	count: number
	lastRequest: number
}

type DatabaseRateLimitResult = {
	allowed: boolean
	retryAfterSeconds: number
}

type ConsumeDatabaseRateLimit = (options: {
	scope: string
	subject: string
	limit: number
	windowSeconds: number
}) => Promise<DatabaseRateLimitResult>

export function buildBetterAuthRateLimitSubject(
	key: string,
	windowSeconds: number,
	secret: string
): string {
	return createHmac('sha256', secret)
		.update(`better-auth-rate-limit:${windowSeconds}:${key}`)
		.digest('hex')
}

/**
 * Adapts Better Auth's atomic rate-limit contract to the Web-owned durable
 * request limiter. Better Auth always uses consume when it is present; the
 * legacy get/set path fails closed so a future package regression cannot
 * silently downgrade concurrency protection.
 */
export function createBetterAuthRateLimitStorage({
	resolveSecret,
	consumeDatabaseRateLimit,
	scope = 'better-auth'
}: {
	resolveSecret: () => string
	consumeDatabaseRateLimit: ConsumeDatabaseRateLimit
	scope?: string
}) {
	return {
		get: async (_key: string): Promise<BetterAuthRateLimitValue | null> => {
			throw new Error('Better Auth legacy rate-limit reads are not supported')
		},
		set: async (
			_key: string,
			_value: BetterAuthRateLimitValue,
			_update?: boolean
		): Promise<void> => {
			throw new Error('Better Auth legacy rate-limit writes are not supported')
		},
		consume: async (key: string, rule: { window: number; max: number }) => {
			const rate = await consumeDatabaseRateLimit({
				scope,
				subject: buildBetterAuthRateLimitSubject(
					key,
					rule.window,
					resolveSecret()
				),
				limit: rule.max,
				windowSeconds: rule.window
			})
			return {
				allowed: rate.allowed,
				retryAfter: rate.allowed ? null : rate.retryAfterSeconds
			}
		}
	}
}
