import 'server-only'

import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { after } from 'next/server'

import { instrumentAuthDatabaseAdapter } from '@/lib/auth-database-timing'
import { recordAuthEvent } from '@/lib/auth-observability'
import { logSafeAuthDiagnostic } from '@/lib/auth-safe-log'
import { db } from '@/lib/db'
import * as authSchema from '@/lib/db/schema/auth'
import { sendPasswordResetEmail, sendVerificationEmail } from '@/lib/mailer'
import { getRequestLocale } from '@/i18n/request-locale'
import {
	AUTH_COOKIE_PREFIX,
	AUTH_EMAIL_VERIFICATION_POLICY,
	AUTH_PASSWORD_POLICY,
	AUTH_SESSION_POLICY,
	AUTH_TRUSTED_PROVIDERS
} from '@/lib/auth-policy'

const baseURL = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'

function trustedAuthOrigins(url: string): string[] {
	const origins = new Set([url])
	try {
		const parsed = new URL(url)
		if (
			parsed.hostname === 'letletme.top' ||
			parsed.hostname === 'www.letletme.top'
		) {
			origins.add(`${parsed.protocol}//letletme.top`)
			origins.add(`${parsed.protocol}//www.letletme.top`)
		}
	} catch {}
	return Array.from(origins)
}

export const authConfig = {
	baseURL,
	database: instrumentAuthDatabaseAdapter(
		drizzleAdapter(db, {
			provider: 'pg',
			schema: {
				user: authSchema.user,
				session: authSchema.session,
				account: authSchema.account,
				verification: authSchema.verification
			}
		})
	),
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,
		minPasswordLength: AUTH_PASSWORD_POLICY.minPasswordLength,
		revokeSessionsOnPasswordReset:
			AUTH_PASSWORD_POLICY.revokeSessionsOnPasswordReset,
		autoSignIn: false,
		sendResetPassword: async (
			{
				user,
				url
			}: {
				user: { email: string }
				url: string
			},
			request?: Request
		) => {
			await sendPasswordResetEmail({
				to: user.email,
				resetUrl: url,
				locale: getRequestLocale(request)
			})
		}
	},
	emailVerification: {
		sendVerificationEmail: async (
			{
				user,
				url
			}: {
				user: { email: string }
				url: string
			},
			request?: Request
		) => {
			await sendVerificationEmail({
				to: user.email,
				verifyUrl: url,
				locale: getRequestLocale(request)
			})
		},
		expiresIn: AUTH_EMAIL_VERIFICATION_POLICY.expiresIn,
		autoSignInAfterVerification: true,
		sendOnSignIn: true,
		sendOnSignUp: true
	},
	socialProviders: {
		...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
			? {
					google: {
						clientId: process.env.GOOGLE_CLIENT_ID,
						clientSecret: process.env.GOOGLE_CLIENT_SECRET
					}
				}
			: {})
	},
	account: {
		// Keep the OAuth start path independent of the verification-table write.
		// Better Auth still validates the signed state cookie on the callback.
		storeStateStrategy: 'cookie',
		accountLinking: {
			enabled: true,
			trustedProviders: [...AUTH_TRUSTED_PROVIDERS]
		}
	},
	databaseHooks: {
		session: {
			create: {
				after: async session => {
					recordAuthEvent({
						eventType: 'session_issued',
						channel: 'web',
						operation: 'session-issue',
						outcome: 'succeeded',
						webUserId: session.userId,
						sessionId: session.id
					})
				}
			},
			update: {
				after: async session => {
					recordAuthEvent({
						eventType: 'session_renewed',
						channel: 'web',
						operation: 'session-renew',
						outcome: 'succeeded',
						webUserId: session.userId,
						sessionId: session.id
					})
				}
			},
			delete: {
				after: async session => {
					recordAuthEvent({
						eventType: 'session_revoked',
						channel: 'web',
						operation: 'session-revoke',
						outcome: 'succeeded',
						webUserId: session.userId,
						sessionId: session.id
					})
				}
			}
		}
	},
	session: {
		expiresIn: AUTH_SESSION_POLICY.expiresIn,
		updateAge: AUTH_SESSION_POLICY.updateAge,
		freshAge: AUTH_SESSION_POLICY.freshAge,
		cookieCache: {
			enabled: true,
			maxAge: AUTH_SESSION_POLICY.cookieCacheMaxAge
		}
	},
	advanced: {
		cookiePrefix: AUTH_COOKIE_PREFIX,
		useSecureCookies: process.env.NODE_ENV === 'production',
		crossSubDomainCookies: { enabled: false },
		ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
		backgroundTasks: { handler: promise => after(promise) }
	},
	rateLimit: {
		enabled: false
	},
	logger: {
		level: 'warn' as const,
		disableColors: true,
		log: (
			level: 'debug' | 'info' | 'warn' | 'error',
			message: string,
			...args: unknown[]
		) => {
			logSafeAuthDiagnostic(level, 'better-auth diagnostic', message, ...args)
		}
	},
	trustedOrigins: trustedAuthOrigins(baseURL),
	user: {
		additionalFields: {
			fplEntryId: { type: 'number' as const, required: false, input: false },
			fplEntryBoundAt: { type: 'date' as const, required: false, input: false },
			fplEntryVerifiedAt: {
				type: 'date' as const,
				required: false,
				input: false
			},
			fplTeamName: { type: 'string' as const, required: false, input: false },
			fplManagerName: { type: 'string' as const, required: false, input: false }
		}
	},
	plugins: [] as const
} satisfies Parameters<typeof betterAuth>[0]

type AuthInstance = ReturnType<typeof betterAuth<typeof authConfig>>

let _auth: AuthInstance | undefined

export function getAuth(): AuthInstance {
	if (!_auth) {
		const secret = process.env.BETTER_AUTH_SECRET
		if (!secret) throw new Error('BETTER_AUTH_SECRET is not set')
		_auth = betterAuth({ ...authConfig, secret } as Parameters<
			typeof betterAuth
		>[0]) as unknown as AuthInstance
	}
	return _auth
}

export type Session = AuthInstance['$Infer']['Session']

/** Authorization checks must bypass Better Auth's five-minute cookie cache. */
export async function getAuthorizationSession(
	headers: Headers
): Promise<Session | null> {
	return getAuth().api.getSession({
		headers,
		query: { disableCookieCache: true }
	})
}
