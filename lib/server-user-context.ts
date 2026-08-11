import 'server-only'

import { headers } from 'next/headers'
import type { Session } from '@/lib/auth'
import { buildGraphQLUserContextHeaders } from '@/lib/graphql-envelope'
import { buildIngressContextHeaders, buildOpaqueRateLimitSubject } from '@/lib/http-security-core'

function requireProxySecret(): string | null {
	const secret = process.env.BACKEND_PROXY_SECRET
	if (!secret && process.env.NODE_ENV === 'production') {
		throw new Error('BACKEND_PROXY_SECRET is required in production for GraphQL requests')
	}
	return secret ?? null
}

/** Build GraphQL ingress + user headers without a second session round-trip. */
export async function buildServerUserContextHeaders(
	session: Session | null,
): Promise<Record<string, string>> {
	const secret = requireProxySecret()
	if (!secret) {
		return {}
	}

	const requestHeaders = await headers()
	const subject = buildOpaqueRateLimitSubject(requestHeaders, secret)
	const result = buildIngressContextHeaders(subject, secret)
	if (session?.user) {
		Object.assign(result, buildGraphQLUserContextHeaders(session.user, secret))
	}
	return result
}

export async function getServerUserContextHeaders(): Promise<Record<string, string>> {
	// Prefer request-scoped verified context so list/live pages that already loaded
	// session do not pay for another disableCookieCache getSession.
	const { getVerifiedEntryContext } = await import('@/lib/session')
	const { session } = await getVerifiedEntryContext()
	return buildServerUserContextHeaders(session)
}
