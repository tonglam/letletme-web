export function shouldResolveGraphQLProxySession(headers: Headers): boolean {
	return Boolean(headers.get('cookie')?.trim())
}
