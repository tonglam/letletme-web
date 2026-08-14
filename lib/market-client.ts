type MarketRevisionResponse = { revision?: string }

const valueCache = new Map<string, unknown>()
const pending = new Map<string, Promise<unknown>>()

export const marketRevisionParam = (
	revision: string | null | undefined
): string => revision?.match(/(?:^|[-.])(\d+)$/)?.[1] ?? '0'

export async function fetchMarketJson<T>(
	path: string,
	params: Record<string, string>,
	signal?: AbortSignal
): Promise<T> {
	let revision = params.revision ?? '0'
	let attempt = 0
	while (attempt < 2) {
		const query = new URLSearchParams({ ...params, revision })
		const key = `${path}?${query.toString()}`
		const cached = valueCache.get(key)
		if (cached !== undefined) return cached as T
		const existing = pending.get(key)
		if (existing) return (await existing) as T

		const request = fetch(`/api/market/${path}?${query.toString()}`, {
			credentials: 'omit',
			signal
		}).then(async response => {
			const body = (await response
				.json()
				.catch(() => null)) as MarketRevisionResponse & T
			if (
				response.status === 409 &&
				typeof body?.revision === 'string' &&
				attempt === 0
			) {
				revision = marketRevisionParam(body.revision)
				throw new Error('__MARKET_REVISION_RETRY__')
			}
			if (!response.ok) throw new Error(`market ${path} ${response.status}`)
			valueCache.set(key, body)
			return body
		})
		pending.set(key, request)
		try {
			return await request
		} catch (error) {
			if (
				error instanceof Error &&
				error.message === '__MARKET_REVISION_RETRY__'
			) {
				attempt += 1
				continue
			}
			throw error
		} finally {
			pending.delete(key)
		}
	}
	throw new Error('market revision retry exhausted')
}

export function clearMarketClientCache(): void {
	valueCache.clear()
	pending.clear()
}
