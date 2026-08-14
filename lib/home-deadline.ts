export interface TimeLeft {
	days: number
	hours: number
	minutes: number
	seconds: number
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
