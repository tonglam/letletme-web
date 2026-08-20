const inFlightPublicSeeds = new Map<string, Promise<unknown>>()

/**
 * Coalesce concurrent cold fills inside one Web instance. Cross-instance reuse
 * is provided by the surrounding Next Data Cache entry.
 */
export function coalescePublicSeed<T>(
	key: string,
	load: () => Promise<T>
): Promise<T> {
	const existing = inFlightPublicSeeds.get(key) as Promise<T> | undefined
	if (existing) return existing
	const promise = load().finally(() => {
		if (inFlightPublicSeeds.get(key) === promise) {
			inFlightPublicSeeds.delete(key)
		}
	})
	inFlightPublicSeeds.set(key, promise)
	return promise
}
