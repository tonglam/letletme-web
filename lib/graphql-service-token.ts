export const GRAPHQL_SERVICE_TOKEN_HEADER = 'X-GraphQL-Service-Token'

export function getGraphQLServiceTokenHeaders(
	runtimeEnv: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
	const token = runtimeEnv.GRAPHQL_SERVICE_TOKEN?.trim() ?? ''
	if (!token) {
		if (runtimeEnv.NODE_ENV === 'production') {
			throw new Error('GRAPHQL_SERVICE_TOKEN is required for public server GraphQL requests')
		}
		return {}
	}
	if (Buffer.byteLength(token, 'utf8') < 32) {
		throw new Error('GRAPHQL_SERVICE_TOKEN must contain at least 32 bytes')
	}
	return { [GRAPHQL_SERVICE_TOKEN_HEADER]: token }
}
