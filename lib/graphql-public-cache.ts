export type PublicGraphQLCacheOptions = {
	cache?: RequestCache
	next?: { revalidate?: number | false }
}

export function publicGraphQLCacheResult(
	options?: PublicGraphQLCacheOptions
): 'eligible' | 'bypass' {
	if (options?.cache === 'no-store') return 'bypass'
	if (options?.cache === 'force-cache') return 'eligible'
	if (options?.next?.revalidate === false) return 'eligible'
	return typeof options?.next?.revalidate === 'number' &&
		options.next.revalidate > 0
		? 'eligible'
		: 'bypass'
}
