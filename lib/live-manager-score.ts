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

/**
 * Older GraphQL deployments predate calculationMode. Its value is already
 * encoded by the authoritative source enum, so infer only that presentation
 * detail while leaving revision, timestamps, and state untouched.
 */
function effectiveCalculationMode(
	score: Pick<LiveManagerScore, 'calculationMode' | 'source'>
): LiveManagerScore['calculationMode'] {
	if (score.calculationMode !== undefined) return score.calculationMode
	if (score.source === 'FPL_EVENT_LIVE') return 'PROJECTED_AUTOSUBS'
	if (score.source === 'FPL_FINAL_RESULT') return 'FINAL_RESULT'
	return null
}

export function liveManagerScoreAuthorityLabel(
	score?: Pick<LiveManagerScore, 'calculationMode' | 'source'> | null,
	labels: LiveManagerScoreAuthorityLabels = DEFAULT_AUTHORITY_LABELS
): LiveManagerScoreAuthorityLabel | null {
	if (!score) return null
	const calculationMode = effectiveCalculationMode(score)
	if (calculationMode === 'PROJECTED_AUTOSUBS') return labels.projected
	if (calculationMode === 'FINAL_RESULT') {
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
	const calculationMode = effectiveCalculationMode(score)
	if (
		score.source === 'FPL_EVENT_LIVE' &&
		calculationMode === 'PROJECTED_AUTOSUBS' &&
		(score.state === 'FRESH' ||
			score.state === 'STALE' ||
			score.state === 'SETTLING')
	) {
		return score
	}
	if (
		score.source === 'FPL_FINAL_RESULT' &&
		calculationMode === 'FINAL_RESULT' &&
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
