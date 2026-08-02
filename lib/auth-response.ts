/** Auth and session responses must never be stored by browsers or shared caches. */
export function withPrivateNoStore(response: Response): Response {
	const retryAfter = response.headers.get('X-Retry-After')
	if (retryAfter && !response.headers.has('Retry-After')) {
		response.headers.set('Retry-After', retryAfter)
	}
	response.headers.set('Cache-Control', 'private, no-store, max-age=0')
	response.headers.set('Pragma', 'no-cache')
	response.headers.set('Expires', '0')
	return response
}
