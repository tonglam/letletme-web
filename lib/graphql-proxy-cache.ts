import {
	extractGraphQLOperationName,
	isPublicCacheableGraphQLRequest,
	publicGraphQLProxyCacheControl
} from '@/lib/cache-policy'

export function resolveGraphQLProxyCacheControl(input: {
	body: unknown
	hasSessionUser: boolean
	hasAuthorization: boolean
	responseOk: boolean
	responseBodyOk: boolean
}): string {
	if (!input.responseOk || !input.responseBodyOk) return 'no-store'
	if (
		isPublicCacheableGraphQLRequest({
			body: input.body,
			hasSessionUser: input.hasSessionUser,
			hasAuthorization: input.hasAuthorization
		})
	) {
		return publicGraphQLProxyCacheControl(
			extractGraphQLOperationName(input.body)
		)
	}
	return 'no-store'
}

export function isSuccessfulGraphQLResponseBody(body: string): boolean {
	try {
		const parsed: unknown = JSON.parse(body)
		if (
			typeof parsed !== 'object' ||
			parsed === null ||
			Array.isArray(parsed)
		) {
			return false
		}
		const envelope = parsed as Record<string, unknown>
		if (Array.isArray(envelope.errors) && envelope.errors.length > 0) {
			return false
		}
		return Object.prototype.hasOwnProperty.call(envelope, 'data')
	} catch {
		return false
	}
}
