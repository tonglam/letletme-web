export type AuthRequestDurations = {
	handlerMs: number
	sessionMs: number
	databaseMs: number
	totalMs: number
}

function boundedDuration(value: number): number {
	return Number.isFinite(value) && value >= 0 ? Number(value.toFixed(2)) : 0
}

export function formatAuthServerTiming(
	durations: AuthRequestDurations
): string {
	return [
		`auth_handler;dur=${boundedDuration(durations.handlerMs)}`,
		`auth_session;dur=${boundedDuration(durations.sessionMs)}`,
		`auth_database;dur=${boundedDuration(durations.databaseMs)}`,
		`auth_total;dur=${boundedDuration(durations.totalMs)}`
	].join(', ')
}

export function isGetSessionRequest(url: string): boolean {
	try {
		return new URL(url).pathname.endsWith('/api/auth/get-session')
	} catch {
		return false
	}
}
