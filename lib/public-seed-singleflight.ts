import { AsyncLocalStorage } from 'node:async_hooks'

const inFlightPublicSeeds = new Map<string, Promise<unknown>>()
const publicSeedFillContext = new AsyncLocalStorage<boolean>()

/** True only while the first caller is executing a shared cold-fill loader. */
export function isPublicSeedFill(): boolean {
	return publicSeedFillContext.getStore() === true
}

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
	const promise = publicSeedFillContext.run(true, load).finally(() => {
		if (inFlightPublicSeeds.get(key) === promise) {
			inFlightPublicSeeds.delete(key)
		}
	})
	inFlightPublicSeeds.set(key, promise)
	return promise
}
