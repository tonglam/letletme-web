import {
	isPublicCacheableGraphQLRequest,
	PUBLIC_PROXY_CACHE_CONTROL,
} from '@/lib/cache-policy'

export function resolveGraphQLProxyCacheControl(input: {
	body: unknown
	hasSessionUser: boolean
	hasAuthorization: boolean
	responseOk: boolean
}): string {
	if (!input.responseOk) return 'no-store'
	if (
		isPublicCacheableGraphQLRequest({
			body: input.body,
			hasSessionUser: input.hasSessionUser,
			hasAuthorization: input.hasAuthorization,
		})
	) {
		return PUBLIC_PROXY_CACHE_CONTROL
	}
	return 'no-store'
}
