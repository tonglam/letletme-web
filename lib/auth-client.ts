import { createAuthClient } from 'better-auth/react'
import { inferAdditionalFields } from 'better-auth/client/plugins'

import { clearPendingClientQueries } from '@/lib/graphql-client'

/**
 * Client-side field mirror of lib/auth.ts user.additionalFields.
 * Kept as a local object (not imported from auth.ts) so the server-only
 * auth module never enters the client bundle.
 */
const additionalUserFields = {
	user: {
		fplEntryId: {
			type: 'number' as const,
			required: false as const,
			input: false as const
		},
		fplEntryBoundAt: {
			type: 'date' as const,
			required: false as const,
			input: false as const
		},
		fplEntryVerifiedAt: {
			type: 'date' as const,
			required: false as const,
			input: false as const
		}
	}
}

export const authClient = createAuthClient({
	baseURL:
		process.env.NEXT_PUBLIC_APP_URL ??
		process.env.NEXT_PUBLIC_BETTER_AUTH_URL ??
		undefined,
	plugins: [inferAdditionalFields(additionalUserFields)]
})

const {
	signIn,
	signUp,
	signOut: rawSignOut,
	useSession,
	getSession
} = authClient

export async function signOut(...args: Parameters<typeof rawSignOut>) {
	clearPendingClientQueries()
	return rawSignOut(...args)
}

export { signIn, signUp, useSession, getSession }
