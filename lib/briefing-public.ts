type BriefingPublicEnv = {
	BRIEFING_PUBLIC_ENABLED?: string
	NODE_ENV?: string
}

export function isBriefingPublicEnabled(
	env: BriefingPublicEnv = process.env
): boolean {
	const configured = env.BRIEFING_PUBLIC_ENABLED?.trim().toLowerCase()
	if (configured === 'true') return true
	if (configured === 'false') return false
	return env.NODE_ENV !== 'production'
}
