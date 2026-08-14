export interface TimeLeft {
	days: number
	hours: number
	minutes: number
	seconds: number
}

const DEADLINE_REFRESH_BASE_MS = 30_000
const DEADLINE_REFRESH_MAX_MS = 300_000

/** Exponential post-deadline retry with a five-minute ceiling. */
export function homeDeadlineRefreshDelayMs(completedAttempts: number): number {
	const safeAttempts = Number.isFinite(completedAttempts)
		? Math.max(1, Math.trunc(completedAttempts))
		: 1
	const exponent = Math.min(Math.floor((safeAttempts - 1) / 2), 4)
	return Math.min(
		DEADLINE_REFRESH_BASE_MS * 2 ** exponent,
		DEADLINE_REFRESH_MAX_MS
	)
}

export function computeTimeLeft(
	deadlineMs: number | null,
	nowMs: number = Date.now()
): TimeLeft {
	if (deadlineMs === null) {
		return { days: 0, hours: 0, minutes: 0, seconds: 0 }
	}
	const diff = deadlineMs - nowMs
	if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 }
	return {
		days: Math.floor(diff / (1000 * 60 * 60 * 24)),
		hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
		minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
		seconds: Math.floor((diff % (1000 * 60)) / 1000)
	}
}
