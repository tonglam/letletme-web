const LOCAL_ORIGIN = 'https://letletme.local'

type VerifiedFplBinding = {
	fplEntryId?: number | null
	fplEntryVerifiedAt?: Date | string | null
}

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

/** Skip onboarding for returning users whose FPL binding is already verified. */
export function verifiedUserDestination(
	next: string | null | undefined,
	binding: VerifiedFplBinding
): string | null {
	const entryId = binding.fplEntryId
	const verifiedAt = binding.fplEntryVerifiedAt
	if (
		typeof entryId !== 'number' ||
		!Number.isSafeInteger(entryId) ||
		entryId <= 0 ||
		!verifiedAt ||
		!Number.isFinite(new Date(verifiedAt).getTime())
	) {
		return null
	}

	const destination = safeRedirectPath(next)
	return destination.startsWith('/onboarding/bind-entry') ? '/' : destination
}

/** Public landing page that can render verification errors before onboarding. */
export function verificationCallbackPath(
	next: string | null | undefined
): string {
	const destination = safeRedirectPath(next)
	return `/auth/verify-email?next=${encodeURIComponent(destination)}`
}

/** Better Auth may replace the error value supplied to an OAuth callback. */
export function hasOAuthCallbackError(searchParams: URLSearchParams): boolean {
	return searchParams.has('oauthError') || searchParams.has('error')
}

export function absoluteAuthUrl(path: string, origin: string): string {
	return new URL(safeRedirectPath(path), origin).toString()
}
