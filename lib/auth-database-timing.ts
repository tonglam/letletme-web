import { AsyncLocalStorage } from 'node:async_hooks'

type DatabaseTimingStart = () => () => void

const databaseTiming = new AsyncLocalStorage<DatabaseTimingStart>()

/**
 * Associate Better Auth adapter work with one request-local timing recorder.
 * AsyncLocalStorage keeps concurrent requests isolated without changing the
 * adapter contract or logging query inputs.
 */
export function withAuthDatabaseTiming<T>(
	start: DatabaseTimingStart,
	task: () => T
): T {
	return databaseTiming.run(start, task)
}

type AdapterFactory = (...args: never[]) => Record<PropertyKey, unknown>

/** Time each async database-adapter operation while preserving its exact API. */
export function instrumentAuthDatabaseAdapter<T extends AdapterFactory>(
	factory: T
): T {
	return ((...factoryArgs: Parameters<T>) => {
		const adapter = factory(...factoryArgs)
		const wrappedMethods = new Map<
			PropertyKey,
			(...args: unknown[]) => unknown
		>()

		return new Proxy(adapter, {
			get(target, property, receiver) {
				const value = Reflect.get(target, property, receiver)
				if (typeof value !== 'function') return value

				const existing = wrappedMethods.get(property)
				if (existing) return existing

				const wrapped = (...args: unknown[]) => {
					const start = databaseTiming.getStore()
					if (!start) return Reflect.apply(value, target, args)

					const stop = start()
					let result: unknown
					try {
						result = Reflect.apply(value, target, args)
					} catch (error) {
						stop()
						throw error
					}

					if (result instanceof Promise) return result.finally(stop)
					stop()
					return result
				}
				wrappedMethods.set(property, wrapped)
				return wrapped
			}
		})
	}) as T
}
