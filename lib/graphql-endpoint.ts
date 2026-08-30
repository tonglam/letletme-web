export const PRODUCTION_GRAPHQL_SELECTOR_ENDPOINT =
	'https://api.letletme.top/graphql'

type GraphQLEndpointEnvironment = {
	readonly GRAPHQL_ENDPOINT?: string
	readonly NODE_ENV?: string
}

export function isFixedGraphQLSlotEndpoint(value: string): boolean {
	try {
		const endpoint = new URL(value)
		return (
			(endpoint.protocol === 'http:' || endpoint.protocol === 'https:') &&
			(endpoint.port === '4000' || endpoint.port === '4002')
		)
	} catch {
		return false
	}
}

/**
 * Production requests must use the stable Nginx selector, never a blue/green
 * process port. This covers both RSC reads and the authenticated /api/graphql
 * proxy while preserving the direct localhost endpoint for development.
 */
export function resolveServerGraphQLEndpoint(
	environment: GraphQLEndpointEnvironment = process.env
): string {
	const configured = environment.GRAPHQL_ENDPOINT?.trim() ?? ''
	if (
		environment.NODE_ENV === 'production' &&
		(!configured || isFixedGraphQLSlotEndpoint(configured))
	) {
		return PRODUCTION_GRAPHQL_SELECTOR_ENDPOINT
	}
	return configured || 'http://localhost:4000/graphql'
}
