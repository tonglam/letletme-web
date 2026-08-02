export const AUTH_COOKIE_PREFIX = 'letletme'

export const AUTH_SESSION_POLICY = {
	expiresIn: 60 * 60 * 24 * 7,
	updateAge: 60 * 60 * 24,
	cookieCacheMaxAge: 5 * 60
} as const

export const AUTH_PASSWORD_POLICY = {
	minPasswordLength: 10,
	revokeSessionsOnPasswordReset: true
} as const

export const AUTH_RATE_LIMIT_POLICY = {
	window: 60,
	max: 100
} as const

export const AUTH_TRUSTED_PROVIDERS = ['google'] as const
