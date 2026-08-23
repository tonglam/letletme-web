import { createAuthClient } from 'better-auth/react'
import { inferAdditionalFields } from 'better-auth/client/plugins'

import { clearPendingClientQueries } from '@/lib/graphql-client'
import { clearAllLiveBoardLastGood } from '@/lib/tournament/live-board'

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
		},
		fplTeamName: {
			type: 'string' as const,
			required: false as const,
			input: false as const
		},
		fplManagerName: {
			type: 'string' as const,
			required: false as const,
			input: false as const
		}
	}
}

export const authClient = createAuthClient({
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
	const result = await rawSignOut(...args)
	if (!result.error) {
		clearPendingClientQueries()
		clearAllLiveBoardLastGood()
	}
	return result
}

export function clearAuthClientState() {
	clearPendingClientQueries()
	clearAllLiveBoardLastGood()
}

export { signIn, signUp, useSession, getSession }
