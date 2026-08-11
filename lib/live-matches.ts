import {
	GET_LIVE_MATCHES,
	type LiveMatchesResponse,
	type LiveSnapshotStatus,
	type MatchPlayerData
} from '@/lib/graphql/operations/live'
import {
	GET_EVENT_FIXTURES,
	type EventFixturesResponse,
	type Fixture
} from '@/lib/graphql/operations/events'
import { executeQuery } from '@/lib/graphql-client'
import { teamFullNames } from '@/types/common'
import type { Match } from '@/types/match'

type QueryExecutor = <T>(
	query: string,
	variables?: Record<string, unknown>,
	options?: {
		cache?: RequestCache
		next?: { revalidate?: number | false; tags?: string[] }
	}
) => Promise<T>

function getTeamShortName(fullName: string): string {
	const normalized = fullName
		.replace(/Man City/gi, 'Manchester City')
		.replace(/Man Utd/gi, 'Manchester United')
		.replace(/Nott'm Forest/gi, 'Nottingham Forest')
		.replace(/Spurs/gi, 'Tottenham')
		.trim()

	const entry = Object.entries(teamFullNames).find(
		([, name]) => name.toLowerCase() === normalized.toLowerCase()
	)

	if (!entry) {
		const partialMatch = Object.entries(teamFullNames).find(
			([, name]) =>
				name.toLowerCase().includes(normalized.toLowerCase()) ||
				normalized.toLowerCase().includes(name.toLowerCase())
		)
		if (partialMatch) return partialMatch[0]
	}

	return entry ? entry[0] : fullName.substring(0, 3).toUpperCase()
}

export function transformLiveMatches(
	data: LiveMatchesResponse['liveMatches']
): Match[] {
	const matches: Match[] = []

	type LiveMatchesBucket = 'notStarted' | 'playing' | 'finished'

	const toMatchStatus = (
		playStatus: string | undefined,
		bucket: LiveMatchesBucket
	): Match['status'] => {
		const status = (playStatus ?? '').toUpperCase()

		if (bucket === 'notStarted') return 'NOT_STARTED'
		if (bucket === 'finished') return 'FT'
		return status.includes('HALF') ? 'HT' : 'LIVE'
	}

	const mapPlayers = (players: MatchPlayerData[] | undefined) =>
		(players ?? []).map(player => ({
			player: player.webName,
			element: player.element,
			elementType: player.elementType,
			minutes: player.minutes,
			goals: player.goalsScored ?? 0,
			assists: player.assists ?? 0,
			cleanSheets: player.cleanSheets ?? 0,
			goalsConceded: player.goalsConceded ?? 0,
			ownGoals: player.ownGoals ?? 0,
			penalties_saved: player.penaltiesSaved ?? 0,
			penalties_missed: player.penaltiesMissed ?? 0,
			yellow_cards: player.yellowCards ?? 0,
			red_cards: player.redCards ?? 0,
			bonus_points: player.bonus ?? 0,
			bps: player.bps ?? 0,
			defensiveContribution: player.defensiveContribution ?? 0,
			saves: player.saves ?? 0,
			totalPoints: player.totalPoints ?? 0
		}))

	const makeMatch = (
		id: string,
		homeTeamName: string,
		homeTeamShortName: string,
		homeScore: number,
		awayTeamName: string,
		awayTeamShortName: string,
		awayScore: number,
		status: Match['status'],
		kickoffTime: string,
		minute: number,
		homePlayers: Match['homeTeam']['players'],
		awayPlayers: Match['awayTeam']['players']
	): Match => ({
		id,
		homeTeam: {
			name: homeTeamName,
			shortName: homeTeamShortName || getTeamShortName(homeTeamName),
			score: homeScore,
			possession: 0,
			shots: 0,
			shotsOnTarget: 0,
			corners: 0,
			players: homePlayers
		},
		awayTeam: {
			name: awayTeamName,
			shortName: awayTeamShortName || getTeamShortName(awayTeamName),
			score: awayScore,
			possession: 0,
			shots: 0,
			shotsOnTarget: 0,
			corners: 0,
			players: awayPlayers
		},
		status,
		minute,
		kickoff: kickoffTime,
		viewers: 0
	})

	data.notStarted.forEach(m =>
		matches.push(
			makeMatch(
				`ns-${m.matchId}`,
				m.homeTeamName,
				m.homeTeamShortName,
				m.homeScore,
				m.awayTeamName,
				m.awayTeamShortName,
				m.awayScore,
				toMatchStatus(m.playStatus, 'notStarted'),
				m.kickoffTime,
				m.minutes ?? 0,
				[],
				[]
			)
		)
	)

	data.playing.forEach(m =>
		matches.push(
			makeMatch(
				`live-${m.matchId}`,
				m.homeTeamName,
				m.homeTeamShortName,
				m.homeScore,
				m.awayTeamName,
				m.awayTeamShortName,
				m.awayScore,
				toMatchStatus(m.playStatus, 'playing'),
				m.kickoffTime,
				m.minutes ?? 0,
				mapPlayers(m.homeTeamDataList),
				mapPlayers(m.awayTeamDataList)
			)
		)
	)

	data.finished.forEach(m =>
		matches.push(
			makeMatch(
				`ft-${m.matchId}`,
				m.homeTeamName,
				m.homeTeamShortName,
				m.homeScore,
				m.awayTeamName,
				m.awayTeamShortName,
				m.awayScore,
				toMatchStatus(m.playStatus, 'finished'),
				m.kickoffTime,
				m.minutes ?? 0,
				mapPlayers(m.homeTeamDataList),
				mapPlayers(m.awayTeamDataList)
			)
		)
	)

	return sortMatches(matches)
}

function sortMatches(matches: Match[]): Match[] {
	const statusPriority: Record<Match['status'], number> = {
		LIVE: 0,
		HT: 1,
		NOT_STARTED: 2,
		UPCOMING: 3,
		FT: 4
	}

	matches.sort((a, b) => {
		const statusDiff = statusPriority[a.status] - statusPriority[b.status]
		if (statusDiff !== 0) return statusDiff

		if (a.status === 'LIVE' || a.status === 'HT') {
			return b.minute - a.minute
		}

		const tA = new Date(a.kickoff || '').getTime()
		const tB = new Date(b.kickoff || '').getTime()
		return (Number.isNaN(tA) ? 1 : 0) - (Number.isNaN(tB) ? 1 : 0) || tA - tB
	})

	return matches
}

export function transformUpcomingFixtures(
	fixtures: readonly Fixture[]
): Match[] {
	return fixtures.map(fixture => ({
		id: `next-${fixture.id}`,
		homeTeam: {
			name: fixture.homeTeam.name,
			shortName:
				fixture.homeTeam.shortName || getTeamShortName(fixture.homeTeam.name),
			score: fixture.homeScore ?? 0,
			possession: 0,
			shots: 0,
			shotsOnTarget: 0,
			corners: 0,
			players: []
		},
		awayTeam: {
			name: fixture.awayTeam.name,
			shortName:
				fixture.awayTeam.shortName || getTeamShortName(fixture.awayTeam.name),
			score: fixture.awayScore ?? 0,
			possession: 0,
			shots: 0,
			shotsOnTarget: 0,
			corners: 0,
			players: []
		},
		status: 'UPCOMING',
		minute: 0,
		kickoff: fixture.kickoffTime,
		viewers: 0
	}))
}

export interface LiveMatchesSnapshot {
	matches: Match[]
	snapshot: LiveSnapshotStatus | null
}

export async function getLiveMatchesSnapshot(
	nextEventId: number | null,
	executor: QueryExecutor = executeQuery
): Promise<LiveMatchesSnapshot> {
	const upcomingRequest = nextEventId
		? executor<EventFixturesResponse>(
				GET_EVENT_FIXTURES,
				{ eventId: nextEventId },
				{ cache: 'no-store' }
			).catch(error => {
				console.warn('[live/matches] upcoming fixtures unavailable', error)
				return { eventFixtures: [] } satisfies EventFixturesResponse
			})
		: Promise.resolve<EventFixturesResponse>({ eventFixtures: [] })
	const [data, upcoming] = await Promise.all([
		executor<LiveMatchesResponse>(GET_LIVE_MATCHES, undefined, {
			cache: 'no-store'
		}),
		upcomingRequest
	])
	return {
		matches: sortMatches([
			...transformLiveMatches(data.liveMatches),
			...transformUpcomingFixtures(upcoming.eventFixtures)
		]),
		snapshot: data.liveSnapshot
	}
}
