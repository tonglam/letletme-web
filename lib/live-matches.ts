import {
	GET_LIVE_MATCHES,
	type LiveMatchesResponse,
	type MatchPlayerData,
} from '@/lib/graphql/queries'
import { executeQuery } from '@/lib/graphql-client'
import { teamFullNames } from '@/types/common'
import type { Match } from '@/types/match'

function getTeamShortName(fullName: string): string {
	const normalized = fullName
		.replace(/Man City/gi, 'Manchester City')
		.replace(/Man Utd/gi, 'Manchester United')
		.replace(/Nott'm Forest/gi, 'Nottingham Forest')
		.replace(/Spurs/gi, 'Tottenham')
		.trim()

	const entry = Object.entries(teamFullNames).find(
		([, name]) => name.toLowerCase() === normalized.toLowerCase(),
	)

	if (!entry) {
		const partialMatch = Object.entries(teamFullNames).find(
			([, name]) =>
				name.toLowerCase().includes(normalized.toLowerCase()) ||
				normalized.toLowerCase().includes(name.toLowerCase()),
		)
		if (partialMatch) return partialMatch[0]
	}

	return entry ? entry[0] : fullName.substring(0, 3).toUpperCase()
}

export function transformLiveMatches(
	data: LiveMatchesResponse['liveMatches'],
): Match[] {
	const matches: Match[] = []

	type LiveMatchesBucket = 'nextEvent' | 'notStarted' | 'playing' | 'finished'

	const toMatchStatus = (
		playStatus: string | undefined,
		bucket: LiveMatchesBucket,
	): Match['status'] => {
		const status = (playStatus ?? '').toUpperCase()

		if (bucket === 'nextEvent') return 'UPCOMING'
		if (bucket === 'notStarted') return 'NOT_STARTED'
		if (bucket === 'finished') return 'FT'
		return status.includes('HALF') ? 'HT' : 'LIVE'
	}

	const mapPlayers = (players: MatchPlayerData[] | undefined) =>
		(players ?? []).map((player) => ({
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
			totalPoints: player.totalPoints ?? 0,
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
		awayPlayers: Match['awayTeam']['players'],
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
			players: homePlayers,
		},
		awayTeam: {
			name: awayTeamName,
			shortName: awayTeamShortName || getTeamShortName(awayTeamName),
			score: awayScore,
			possession: 0,
			shots: 0,
			shotsOnTarget: 0,
			corners: 0,
			players: awayPlayers,
		},
		status,
		minute,
		kickoff: kickoffTime,
		viewers: 0,
	})

	data.nextEvent.forEach((m) =>
		matches.push(
			makeMatch(
				`next-${m.matchId}`,
				m.homeTeamName,
				m.homeTeamShortName,
				0,
				m.awayTeamName,
				m.awayTeamShortName,
				0,
				toMatchStatus(m.playStatus, 'nextEvent'),
				m.kickoffTime,
				m.minutes ?? 0,
				[],
				[],
			),
		),
	)

	data.notStarted.forEach((m) =>
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
				[],
			),
		),
	)

	data.playing.forEach((m) =>
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
				mapPlayers(m.awayTeamDataList),
			),
		),
	)

	data.finished.forEach((m) =>
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
				mapPlayers(m.awayTeamDataList),
			),
		),
	)

	const statusPriority: Record<Match['status'], number> = {
		LIVE: 0,
		HT: 1,
		NOT_STARTED: 2,
		UPCOMING: 3,
		FT: 4,
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

export async function getLiveMatches(): Promise<Match[]> {
	const data = await executeQuery<LiveMatchesResponse>(
		GET_LIVE_MATCHES,
		undefined,
		{ cache: 'force-cache', next: { revalidate: 30 } },
	)
	return transformLiveMatches(data.liveMatches)
}
