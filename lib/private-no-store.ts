export const PRIVATE_NO_STORE_CACHE_CONTROL = 'private, no-store, no-transform'

export function markPrivateNoStore<T extends Response>(response: T): T {
	response.headers.set('Cache-Control', PRIVATE_NO_STORE_CACHE_CONTROL)
	return response
}
