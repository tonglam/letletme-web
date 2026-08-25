const SERVER_TIMING_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,31}$/

export function appendServerTiming(
	headers: Headers,
	name: string,
	durationMs: number
): void {
	if (
		!SERVER_TIMING_NAME_PATTERN.test(name) ||
		!Number.isFinite(durationMs) ||
		durationMs < 0
	)
		return
	const entry = `${name};dur=${Number(durationMs.toFixed(2))}`
	const existing = headers.get('Server-Timing')
	headers.set('Server-Timing', existing ? `${existing}, ${entry}` : entry)
}
