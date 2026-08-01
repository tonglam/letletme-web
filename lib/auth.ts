import 'server-only'

import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

import { createBetterAuthRateLimitStorage } from '@/lib/better-auth-rate-limit-storage'
import { db } from '@/lib/db'
import * as authSchema from '@/lib/db/schema/auth'
import { checkDatabaseRateLimit } from '@/lib/http-security'
import { sendPasswordResetEmail, sendVerificationEmail } from '@/lib/mailer'

const baseURL = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'

function trustedAuthOrigins(url: string): string[] {
	const origins = new Set([url])
	try {
		const parsed = new URL(url)
		if (parsed.hostname === 'letletme.top' || parsed.hostname === 'www.letletme.top') {
			origins.add(`${parsed.protocol}//letletme.top`)
			origins.add(`${parsed.protocol}//www.letletme.top`)
		}
	} catch {}
	return Array.from(origins)
}

const betterAuthRateLimitStorage = createBetterAuthRateLimitStorage({
	resolveSecret: () => {
		const secret = process.env.BACKEND_PROXY_SECRET
		if (!secret) throw new Error('BACKEND_PROXY_SECRET is not set')
		return secret
	},
	consumeDatabaseRateLimit: checkDatabaseRateLimit,
})

export const authConfig = {
	baseURL,
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema: {
			user: authSchema.user,
			session: authSchema.session,
			account: authSchema.account,
			verification: authSchema.verification,
			rateLimit: authSchema.betterAuthRateLimit,
		},
	}),
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,
		minPasswordLength: 10,
		autoSignIn: false,
		sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => {
			await sendPasswordResetEmail({ to: user.email, resetUrl: url })
		},
	},
	emailVerification: {
		sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) => {
			await sendVerificationEmail({ to: user.email, verifyUrl: url })
		},
		autoSignInAfterVerification: true,
	},
	socialProviders: {
		...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
			? {
					google: {
						clientId: process.env.GOOGLE_CLIENT_ID,
						clientSecret: process.env.GOOGLE_CLIENT_SECRET,
					},
				}
			: {}),
	},
	account: {
		accountLinking: {
			enabled: true,
			trustedProviders: ['google'] as const,
		},
	},
	session: {
		expiresIn: 60 * 60 * 24 * 7,
		updateAge: 60 * 60 * 24,
		cookieCache: { enabled: true, maxAge: 5 * 60 },
	},
	advanced: {
		cookiePrefix: 'letletme',
		useSecureCookies: process.env.NODE_ENV === 'production',
		crossSubDomainCookies: { enabled: false },
		ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
	},
	rateLimit: {
		enabled: true,
		window: 60,
		max: 100,
		customStorage: betterAuthRateLimitStorage,
	},
	trustedOrigins: trustedAuthOrigins(baseURL),
	user: {
		additionalFields: {
			fplEntryId: { type: 'number' as const, required: false, input: false },
			fplEntryBoundAt: { type: 'date' as const, required: false, input: false },
			fplEntryVerifiedAt: { type: 'date' as const, required: false, input: false },
		},
	},
	plugins: [] as const,
} satisfies Parameters<typeof betterAuth>[0]

type AuthInstance = ReturnType<typeof betterAuth<typeof authConfig>>

let _auth: AuthInstance | undefined

export function getAuth(): AuthInstance {
	if (!_auth) {
		const secret = process.env.BETTER_AUTH_SECRET
		if (!secret) throw new Error('BETTER_AUTH_SECRET is not set')
		_auth = betterAuth({ ...authConfig, secret } as Parameters<typeof betterAuth>[0]) as unknown as AuthInstance
	}
	return _auth
}

export type Session = AuthInstance['$Infer']['Session']

/** Authorization checks must bypass Better Auth's five-minute cookie cache. */
export async function getAuthorizationSession(headers: Headers): Promise<Session | null> {
	return getAuth().api.getSession({
		headers,
		query: { disableCookieCache: true },
	})
}
