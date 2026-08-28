import type {
	PlayerDetailData,
	PlayerDetailDataAvailability
} from '@/lib/graphql/operations/players'

export type PlayerEvidenceSection = 'fixtures' | 'recent' | 'season' | 'process'

type AvailabilitySection = Exclude<
	keyof PlayerDetailDataAvailability,
	'isFullyAuthoritative'
>

const availabilitySectionForEvidence: Partial<
	Record<PlayerEvidenceSection, AvailabilitySection>
> = {
	recent: 'recentGameweeks',
	season: 'seasonStats',
	process: 'seasonStats'
}

const AUTHORITATIVE_STATES = new Set(['READY', 'EMPTY', 'NOT_APPLICABLE'])

function recomputeAuthority(
	availability: PlayerDetailDataAvailability
): boolean {
	return [
		availability.seasonStats,
		availability.market,
		availability.historicalTeam,
		availability.fixtures,
		availability.recentGameweeks
	].every(section => AUTHORITATIVE_STATES.has(section.state))
}

/**
 * Evidence requests select one data subset. Preserve the authority snapshot
 * for unrelated subsets so a healthy response for recent or production data
 * cannot erase a stale fixture/market warning from the overview request.
 */
export function mergePlayerDetailEvidence(
	previous: PlayerDetailData | null,
	evidence: Partial<PlayerDetailData>,
	section: PlayerEvidenceSection
): PlayerDetailData {
	if (!previous) return evidence as PlayerDetailData
	const previousAvailability = previous.dataAvailability
	const evidenceAvailability = evidence.dataAvailability
	if (!previousAvailability || !evidenceAvailability) {
		return { ...previous, ...evidence }
	}
	const availabilitySection = availabilitySectionForEvidence[section]
	const dataAvailability = { ...previousAvailability }
	if (availabilitySection) {
		const nextSection = evidenceAvailability[availabilitySection]
		if (nextSection !== undefined)
			dataAvailability[availabilitySection] = nextSection
	}
	dataAvailability.isFullyAuthoritative = recomputeAuthority(dataAvailability)
	return { ...previous, ...evidence, dataAvailability }
}
