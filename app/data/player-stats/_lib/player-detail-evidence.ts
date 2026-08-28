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
const DEGRADED_STATES = new Set(['STALE', 'FALLBACK', 'UNAVAILABLE'])

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
	for (const key of Object.keys(
		previousAvailability
	) as AvailabilitySection[]) {
		const nextSection = evidenceAvailability[key]
		if (nextSection === undefined) continue
		// The selected evidence request owns its section and may improve or
		// degrade it. For unrelated sections, only carry forward a fresh
		// degradation; an authoritative partial response cannot erase the prior
		// warning or replace its values without refreshing that section.
		if (
			key === availabilitySection ||
			DEGRADED_STATES.has(nextSection.state) ||
			!dataAvailability[key]
		) {
			dataAvailability[key] = nextSection
		}
	}
	dataAvailability.isFullyAuthoritative = recomputeAuthority(dataAvailability)
	return { ...previous, ...evidence, dataAvailability }
}
