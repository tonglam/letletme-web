import { executeAgentGraphQL } from '@/lib/agent-tools/graphql-executor'
import { handleAgentCapabilitiesRequest } from '@/lib/agent-tools/route-handler'
import { getAuthorizationSession } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request): Promise<Response> {
	return handleAgentCapabilitiesRequest(request, {
		getSession: getAuthorizationSession,
		execute: executeAgentGraphQL
	})
}
