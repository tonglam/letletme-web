import { createAuthClient } from 'better-auth/react'
import { inferAdditionalFields } from 'better-auth/client/plugins'

import { authConfig } from '@/lib/auth'

type AuthInstance = ReturnType<typeof betterAuth<typeof authConfig>>

import { betterAuth } from 'better-auth'

export const authClient = createAuthClient({
	baseURL:
		process.env.NEXT_PUBLIC_APP_URL ??
		process.env.NEXT_PUBLIC_BETTER_AUTH_URL ??
		undefined,
	plugins: [inferAdditionalFields<AuthInstance>()],
})

export const { signIn, signUp, signOut, useSession, getSession } = authClient
