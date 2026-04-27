import 'server-only'

import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

import { db } from '@/lib/db'
import * as authSchema from '@/lib/db/schema/auth'
import { sendPasswordResetEmail, sendVerificationEmail } from '@/lib/mailer'

const baseURL = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'
const secret = process.env.BETTER_AUTH_SECRET

if (!secret) {
	throw new Error('BETTER_AUTH_SECRET is not set')
}

export const auth = betterAuth({
	baseURL,
	secret,
	database: drizzleAdapter(db, {
		provider: 'pg',
		// Supabase owns the `auth` schema; our tables live in `bauth`
		schema: {
			user: authSchema.user,
			session: authSchema.session,
			account: authSchema.account,
			verification: authSchema.verification,
			},
	}),
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,
		minPasswordLength: 10,
		autoSignIn: false,
		sendResetPassword: async ({ user, url }) => {
			await sendPasswordResetEmail({ to: user.email, resetUrl: url })
		},
	},
	emailVerification: {
		sendVerificationEmail: async ({ user, url }) => {
			await sendVerificationEmail({ to: user.email, verifyUrl: url })
		},
		autoSignInAfterVerification: true,
	},
	socialProviders: {
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID ?? '',
			clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
		},
	},
	account: {
		accountLinking: {
			enabled: true,
			trustedProviders: ['google'],
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
	},
	rateLimit: { enabled: true, window: 60, max: 100 },
	trustedOrigins: [baseURL],
	user: {
		additionalFields: {
			fplEntryId: { type: 'number', required: false, input: false },
			fplEntryBoundAt: { type: 'date', required: false, input: false },
		},
	},
	plugins: [],
})

export type Session = typeof auth.$Infer.Session
