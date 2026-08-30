import type { LivePointsScore } from '@/lib/graphql/operations/live'

export type LiveScoreAuthorityLabel = string

export type LiveScoreAuthorityLabels = {
	projected: string
	final: string
}

const DEFAULT_AUTHORITY_LABELS: LiveScoreAuthorityLabels = {
	projected: '预计',
	final: '官方最终'
}

const hasRevision = (value: string | null | undefined): value is string =>
	typeof value === 'string' && value.trim().length > 0

const hasTimestamp = (value: string | null | undefined): value is string =>
	typeof value === 'string' &&
	value.trim().length > 0 &&
	Number.isFinite(Date.parse(value))

function effectiveCalculationMode(
	score: Pick<LivePointsScore, 'calculationMode'>
) {
	return score.calculationMode
}

export function liveScoreAuthorityLabel(
	score?: Pick<LivePointsScore, 'calculationMode' | 'source'> | null,
	labels: LiveScoreAuthorityLabels = DEFAULT_AUTHORITY_LABELS
): LiveScoreAuthorityLabel | null {
	if (!score) return null
	const calculationMode = effectiveCalculationMode(score)
	if (calculationMode === 'PROJECTED_AUTOSUBS') return labels.projected
	if (calculationMode === 'FINAL_RESULT') return labels.final
	return null
}

/** Only complete V2 revisions may reach live-score UI. */
export function traceableLiveScore(
	score?: LivePointsScore | null
): LivePointsScore | undefined {
	if (
		!score ||
		!score.revisions.input ||
		!hasTimestamp(score.times.contentUpdatedAt) ||
		!hasTimestamp(score.times.sourceCheckedAt)
	) {
		return undefined
	}
	const calculationMode = effectiveCalculationMode(score)
	if (
		score.source === 'FPL_EVENT_LIVE' &&
		calculationMode === 'PROJECTED_AUTOSUBS' &&
		(score.delivery.state === 'FRESH' ||
			score.delivery.state === 'STALE' ||
			score.delivery.state === 'DEGRADED')
	) {
		return score
	}
	if (
		score.source === 'FPL_FINAL_RESULT' &&
		calculationMode === 'FINAL_RESULT' &&
		score.delivery.state === 'FINAL'
	) {
		return score
	}
	return undefined
}

export function hasTraceableLiveEventPoints(
	score?: LivePointsScore | null
): boolean {
	const traceable = traceableLiveScore(score)
	return (
		typeof traceable?.eventPoints === 'number' &&
		Number.isFinite(traceable.eventPoints)
	)
}

export function traceableH2HScore(
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
		hasTimestamp(provenance.scoreCheckedAt)
	)
}
