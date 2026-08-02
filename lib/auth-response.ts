/** Auth and session responses must never be stored by browsers or shared caches. */
export function withPrivateNoStore(response: Response): Response {
	// Fetch redirect responses have immutable headers. Copy the response before
	// applying policy so OAuth, verification, and reset redirects remain usable.
	const headers = new Headers(response.headers)
	const retryAfter = headers.get('X-Retry-After')
	if (retryAfter && !headers.has('Retry-After')) {
		headers.set('Retry-After', retryAfter)
	}
	headers.set('Cache-Control', 'private, no-store, max-age=0')
	headers.set('Pragma', 'no-cache')
	headers.set('Expires', '0')
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	})
}
