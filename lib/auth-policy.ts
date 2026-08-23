export const AUTH_COOKIE_PREFIX = 'letletme'

export const AUTH_SESSION_POLICY = {
	expiresIn: 60 * 60 * 24 * 7,
	updateAge: 60 * 60 * 24,
	freshAge: 60 * 60 * 24,
	cookieCacheMaxAge: 5 * 60
} as const

export const AUTH_PASSWORD_POLICY = {
	minPasswordLength: 10,
	revokeSessionsOnPasswordReset: true
} as const

const AUTH_EMAIL_VERIFICATION_EXPIRES_IN_HOURS = 24

export const AUTH_EMAIL_VERIFICATION_POLICY = {
	expiresIn: 60 * 60 * AUTH_EMAIL_VERIFICATION_EXPIRES_IN_HOURS,
	expiresInHours: AUTH_EMAIL_VERIFICATION_EXPIRES_IN_HOURS
} as const

export const AUTH_TRUSTED_PROVIDERS = ['google'] as const
