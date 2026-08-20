import 'server-only'

import { AsyncLocalStorage } from 'node:async_hooks'
import { createHmac } from 'node:crypto'

import type { AgentSession } from '@/lib/agent-tools/contracts'
import type { AgentGraphQLExecutor } from '@/lib/agent-tools/runtime'
import { executeQuery } from '@/lib/graphql-client'
import { buildGraphQLUserContextHeaders } from '@/lib/graphql-envelope'
import { buildIngressContextHeaders } from '@/lib/http-security-core'

export const executeAgentGraphQL: AgentGraphQLExecutor = async (
	document,
	variables,
	requestId,
	signal
) => {
	const secret = process.env.BACKEND_PROXY_SECRET?.trim()
	if (!secret) throw new Error('Agent GraphQL signing is unavailable')
	const session = currentAgentSession.getStore()
	if (!session) throw new Error('Agent session context is unavailable')
	const subject = createHmac('sha256', secret)
		.update(`rate-limit:agent:${session.user.id}`)
		.digest('hex')
	const headers = {
		...buildIngressContextHeaders(subject, secret),
		...buildGraphQLUserContextHeaders(session.user, secret),
		'X-Request-Id': requestId
	}
	return executeQuery(document, variables, {
		cache: 'no-store',
		headers,
		timeoutMs: 15_000,
		signal
	})
}

const currentAgentSession = new AsyncLocalStorage<AgentSession>()

export function withAgentSession<T>(
	session: AgentSession,
	task: () => Promise<T>
): Promise<T> {
	return currentAgentSession.run(session, task)
}
