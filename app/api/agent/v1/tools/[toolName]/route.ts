import { executeAgentGraphQL, withAgentSession } from '@/lib/agent-tools/graphql-executor'
import { handleAgentToolRequest } from '@/lib/agent-tools/route-handler'
import { getAuthorizationSession } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

type RouteContext = { params: Promise<{ toolName: string }> }

export async function POST(request: Request, context: RouteContext): Promise<Response> {
	const { toolName } = await context.params
	let sessionForExecution: Awaited<ReturnType<typeof getAuthorizationSession>> = null
	return handleAgentToolRequest(request, toolName, {
		getSession: async headers => {
			sessionForExecution = await getAuthorizationSession(headers)
			return sessionForExecution
		},
		execute: (document, variables, requestId, signal) => {
			if (!sessionForExecution) throw new Error('Agent session context is unavailable')
			return withAgentSession(sessionForExecution, () =>
				executeAgentGraphQL(document, variables, requestId, signal)
			)
		}
	})
}
