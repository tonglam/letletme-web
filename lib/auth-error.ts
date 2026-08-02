export type AuthErrorKey =
	| 'invalidCredentials'
	| 'emailNotVerified'
	| 'accountExists'
	| 'tooManyRequests'
	| 'invalidResetLink'
	| 'loginFailed'
	| 'socialLoginFailed'
	| 'signupFailed'
	| 'resetFailed'
	| 'resetEmailFailed'

type AuthErrorLike = {
	code?: string
	message?: string
	status?: number
}

export function getAuthErrorKey(error: AuthErrorLike | null | undefined, fallback: AuthErrorKey): AuthErrorKey {
	const code = error?.code?.toUpperCase() ?? ''
	const message = error?.message?.toLowerCase() ?? ''

	if (
		code.includes('INVALID_EMAIL_OR_PASSWORD') ||
		code.includes('INVALID_PASSWORD') ||
		code.includes('USER_NOT_FOUND') ||
		message.includes('invalid email or password')
	) return 'invalidCredentials'

	if (code.includes('EMAIL_NOT_VERIFIED') || message.includes('email not verified')) {
		return 'emailNotVerified'
	}

	if (code.includes('USER_ALREADY_EXISTS') || code.includes('EMAIL_ALREADY')) {
		return 'accountExists'
	}

	if (error?.status === 429 || code.includes('TOO_MANY')) return 'tooManyRequests'

	if (code.includes('INVALID_TOKEN') || code.includes('TOKEN_EXPIRED')) {
		return 'invalidResetLink'
	}

	return fallback
}
