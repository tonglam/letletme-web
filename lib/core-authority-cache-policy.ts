import { CacheTag, RevalidateSeconds } from '@/lib/cache-policy'

/** Five-second public seed cache; private/session data remains no-store. */
export const CORE_AUTHORITY_DATA_CACHE = Object.freeze({
	revalidate: RevalidateSeconds.events,
	tags: [CacheTag.events]
})

/** Signed ingress headers vary per origin request, so fetch itself is never cached. */
export const CORE_AUTHORITY_ORIGIN_OPTIONS = Object.freeze({
	cache: 'no-store' as const,
	timeoutMs: 5_000
})
