import type { LiveManagerScore } from '@/lib/graphql/operations/live'

function hasRevision(value: string | null | undefined): value is string {
	return typeof value === 'string' && value.trim().length > 0
}

function hasCheckedAt(value: string | null | undefined): value is string {
	return (
		typeof value === 'string' &&
		value.trim().length > 0 &&
		Number.isFinite(Date.parse(value))
	)
}

/** Only revisioned event/live or finalized official results may reach live-score UI. */
export function traceableOfficialManagerScore(
	score?: LiveManagerScore | null
): LiveManagerScore | undefined {
	if (
		!score ||
		!hasRevision(score.revision) ||
		!hasCheckedAt(score.checkedAt)
	) {
		return undefined
	}
	if (
		score.source === 'FPL_EVENT_LIVE' &&
		(score.state === 'FRESH' ||
			score.state === 'STALE' ||
			score.state === 'SETTLING')
	) {
		return score
	}
	if (score.source === 'FPL_FINAL_RESULT' && score.state === 'FINAL') {
		return score
	}
	return undefined
}

export function hasTraceableOfficialEventPoints(
	score?: LiveManagerScore | null
): boolean {
	const traceable = traceableOfficialManagerScore(score)
	return (
		typeof traceable?.eventPoints === 'number' &&
		Number.isFinite(traceable.eventPoints)
	)
}

export function traceableOfficialH2HScore(
	provenance?: {
		scoreSource?: 'FPL_EVENT_LIVE' | 'FPL_H2H_FINAL' | 'UNAVAILABLE'
		scoreRevision?: string | null
		scoreCheckedAt?: string | null
	} | null
): boolean {
	return Boolean(
		provenance &&
		(provenance.scoreSource === 'FPL_EVENT_LIVE' ||
			provenance.scoreSource === 'FPL_H2H_FINAL') &&
		hasRevision(provenance.scoreRevision) &&
		hasCheckedAt(provenance.scoreCheckedAt)
	)
}
