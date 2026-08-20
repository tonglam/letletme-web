import { CacheTag, publicFetchOptions, RevalidateSeconds } from '@/lib/cache-policy'

/** Five-second public seed cache; private/session data remains no-store. */
export const CORE_AUTHORITY_FETCH_OPTIONS = Object.freeze(
	publicFetchOptions({
		revalidate: RevalidateSeconds.events,
		tags: [CacheTag.events]
	})
)
