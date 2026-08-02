const LOCAL_ORIGIN = 'https://letletme.local'

/** Returns a same-origin path suitable for a post-auth redirect. */
export function safeRedirectPath(
	value: string | null | undefined,
	fallback = '/'
): string {
	if (!value || !value.startsWith('/') || /[\u0000-\u001f\u007f]/.test(value))
		return fallback

	try {
		const parsed = new URL(value, LOCAL_ORIGIN)
		if (parsed.origin !== LOCAL_ORIGIN) return fallback
		return `${parsed.pathname}${parsed.search}${parsed.hash}`
	} catch {
		return fallback
	}
}

export function onboardingRedirectPath(
	next: string | null | undefined
): string {
	const destination = safeRedirectPath(next)
	return `/onboarding/bind-entry?next=${encodeURIComponent(destination)}`
}

export function absoluteAuthUrl(path: string, origin: string): string {
	return new URL(safeRedirectPath(path), origin).toString()
}
