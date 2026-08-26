import type { LiveManagerScore } from '@/lib/graphql/operations/live'

export type LiveManagerScoreAuthorityLabel = string

export type LiveManagerScoreAuthorityLabels = {
	projected: string
	final: string
}

const DEFAULT_AUTHORITY_LABELS: LiveManagerScoreAuthorityLabels = {
	projected: '预计',
	final: '官方最终'
}

export function liveManagerScoreAuthorityLabel(
	score?: Pick<LiveManagerScore, 'calculationMode' | 'source'> | null,
	labels: LiveManagerScoreAuthorityLabels = DEFAULT_AUTHORITY_LABELS
): LiveManagerScoreAuthorityLabel | null {
	if (!score) return null
	if (score.calculationMode === 'PROJECTED_AUTOSUBS') return labels.projected
	if (score.calculationMode === 'FINAL_RESULT') {
		return labels.final
	}
	return null
}

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
		!hasCheckedAt(score.checkedAt) ||
		score.reconciliation === 'SOURCE_SKEW'
	) {
		return undefined
	}
	if (
		score.source === 'FPL_EVENT_LIVE' &&
		score.calculationMode === 'PROJECTED_AUTOSUBS' &&
		(score.state === 'FRESH' ||
			score.state === 'STALE' ||
			score.state === 'SETTLING')
	) {
		return score
	}
	if (
		score.source === 'FPL_FINAL_RESULT' &&
		score.calculationMode === 'FINAL_RESULT' &&
		score.state === 'FINAL'
	) {
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
