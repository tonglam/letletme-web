export function isBriefingPublicEnabled(): boolean {
	const configured = process.env.BRIEFING_PUBLIC_ENABLED?.trim().toLowerCase()
	if (configured === 'true') return true
	if (configured === 'false') return false
	return process.env.NODE_ENV !== 'production'
}
