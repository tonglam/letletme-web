import 'server-only'

import { headers } from 'next/headers'
import { getAuthorizationSession } from '@/lib/auth'
import { buildGraphQLUserContextHeaders } from '@/lib/graphql-envelope'
import { buildIngressContextHeaders, buildOpaqueRateLimitSubject } from '@/lib/http-security'

function requireProxySecret(): string | null {
	const secret = process.env.BACKEND_PROXY_SECRET
	if (!secret && process.env.NODE_ENV === 'production') {
		throw new Error('BACKEND_PROXY_SECRET is required in production for GraphQL requests')
	}
	return secret ?? null
}

export async function getServerUserContextHeaders(): Promise<Record<string, string>> {
	const secret = requireProxySecret()
	if (!secret) {
		return {}
	}

	const requestHeaders = await headers()
	const subject = buildOpaqueRateLimitSubject(requestHeaders, secret)
	const result = buildIngressContextHeaders(subject, secret)
	const session = await getAuthorizationSession(requestHeaders)
	if (session?.user) {
		Object.assign(result, buildGraphQLUserContextHeaders(session.user, secret))
	}
	return result
}
