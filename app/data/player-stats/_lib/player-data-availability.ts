import type {
	PlayerDataSectionAvailability,
	PlayerDataState,
	PlayerDetailDataAvailability
} from '@/lib/graphql/operations/players'

export type PlayerDataSection =
	| 'seasonStats'
	| 'market'
	| 'historicalTeam'
	| 'fixtures'
	| 'recentGameweeks'
	| 'player'

export type PlayerDataAvailabilityIssue = Readonly<{
	section: PlayerDataSection
	state: Extract<PlayerDataState, 'STALE' | 'FALLBACK' | 'UNAVAILABLE'>
	reasonCode: string | null
	sourceCheckedAt: string | null
}>

export type PlayerDataAvailabilityIssueWithPlayer =
	PlayerDataAvailabilityIssue &
		Readonly<{
			playerId: number
			playerName: string
		}>

const AUTHORITATIVE_STATES = new Set<PlayerDataState>([
	'READY',
	'EMPTY',
	'NOT_APPLICABLE'
])

const isNonAuthoritative = (
	section: PlayerDataSectionAvailability | null | undefined
): section is PlayerDataSectionAvailability & {
	state: PlayerDataAvailabilityIssue['state']
} => Boolean(section && !AUTHORITATIVE_STATES.has(section.state))

export function playerDataAvailabilityIssues(
	availability: PlayerDetailDataAvailability | null | undefined
): PlayerDataAvailabilityIssue[] {
	if (!availability) return []
	const sections = [
		['seasonStats', availability.seasonStats],
		['market', availability.market],
		['historicalTeam', availability.historicalTeam],
		['fixtures', availability.fixtures],
		['recentGameweeks', availability.recentGameweeks]
	] as const
	const issues: PlayerDataAvailabilityIssue[] = sections
		.filter(
			(
				entry
			): entry is readonly [
				Exclude<PlayerDataSection, 'player'>,
				PlayerDataSectionAvailability & {
					state: PlayerDataAvailabilityIssue['state']
				}
			] => isNonAuthoritative(entry[1])
		)
		.map(([section, status]) => ({
			section,
			state: status.state,
			reasonCode: status.reasonCode ?? null,
			sourceCheckedAt: status.sourceCheckedAt ?? null
		}))

	if (!availability.isFullyAuthoritative && issues.length === 0) {
		issues.push({
			section: 'player',
			state: 'UNAVAILABLE',
			reasonCode: 'INCONSISTENT_AVAILABILITY',
			sourceCheckedAt: null
		})
	}
	return issues
}

export function playerDataAvailabilityIssuesForPlayers(
	players: ReadonlyArray<{
		id: number
		webName: string
		dataAvailability: PlayerDetailDataAvailability | null | undefined
	}>
): PlayerDataAvailabilityIssueWithPlayer[] {
	return players.flatMap(player =>
		playerDataAvailabilityIssues(player.dataAvailability).map(issue => ({
			...issue,
			playerId: player.id,
			playerName: player.webName
		}))
	)
}
