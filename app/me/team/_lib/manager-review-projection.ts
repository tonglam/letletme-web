import type {
	EntryEventResult,
	EntryEventPick,
	EntryGameweekTransfers,
	EntryHistoryItem,
	EntryHistoryResponse,
	EntrySeasonHistoryItem,
	EntryTransferMove
} from '@/lib/graphql/operations/entries'
import type {
	MyFplEntryIdentity,
	MyFplManagerGameweek,
	MyFplManagerPick,
	MyFplManagerReview
} from '@/lib/graphql/operations/my-fpl'
import type { SeasonIdentity } from './team-stats-model'

export function identityFromMyFplEntry(
	entry: MyFplEntryIdentity | null | undefined
): SeasonIdentity | null {
	if (!entry) return null
	return {
		teamName: entry.entryName,
		playerName: entry.playerName || '-',
		region: entry.region || '-',
		totalTransfers: entry.totalTransfers,
		// Kept for identity display only. Season score/rank is always taken from
		// finalized history by buildSeasonOverallSnapshot.
		overallPoints: entry.overallPoints ?? undefined,
		overallRank: entry.overallRank ?? undefined,
		teamValue: entry.teamValue,
		bank: entry.bank
	}
}

export function historyFromManagerReview(
	review: MyFplManagerReview
): EntryHistoryResponse['entryHistory'] {
	const results: EntryHistoryItem[] = review.timeline.map(row => ({
		eventId: row.eventId,
		eventChip: row.eventChip,
		eventPoints: row.eventPoints,
		eventRank: row.eventRank,
		overallPoints: row.overallPoints,
		overallRank: row.overallRank,
		eventTransfers: row.eventTransfers,
		eventTransfersCost: row.eventTransfersCost,
		eventNetPoints: row.eventNetPoints,
		eventBenchPoints: row.eventBenchPoints,
		eventCaptainPoints: row.eventCaptainPoints,
		eventPlayedCaptain: row.captainWebName
			? {
					webName: row.captainWebName,
					team: row.captainTeamShortName
						? { shortName: row.captainTeamShortName }
						: null
				}
			: null,
		teamValue: row.teamValue,
		bank: row.bank
	}))

	const history: EntrySeasonHistoryItem[] =
		review.pastSeasonsState === 'READY'
			? review.pastSeasons.map(row => ({
					season: row.season,
					totalPoints: row.totalPoints,
					overallRank: row.overallRank
				}))
			: []

	return { results, history }
}

function mapPick(pick: MyFplManagerPick): EntryEventPick {
	return {
		element: pick.element,
		webName: pick.webName,
		teamShortName: pick.teamShortName,
		teamName: pick.teamName,
		elementTypeName: pick.elementTypeName,
		isCaptain: pick.isCaptain,
		isViceCaptain: pick.isViceCaptain,
		multiplier: pick.multiplier,
		totalPoints: pick.totalPoints,
		minutes: pick.minutes,
		position: pick.position,
		goalsScored: pick.goalsScored,
		assists: pick.assists,
		cleanSheets: pick.cleanSheets,
		goalsConceded: pick.goalsConceded,
		yellowCards: pick.yellowCards,
		redCards: pick.redCards,
		saves: pick.saves,
		bonus: pick.bonus,
		bps: pick.bps,
		againstShortName: pick.againstShortName,
		wasHome: pick.wasHome,
		score: pick.score,
		fixtureCount: pick.fixtureCount,
		bgw: pick.bgw,
		dgw: pick.dgw,
		isPlayed: pick.isPlayed,
		autoSub: pick.autoSub,
		expectedGoals: pick.expectedGoals,
		expectedAssists: pick.expectedAssists,
		expectedGoalInvolvements: pick.expectedGoalInvolvements,
		expectedGoalsConceded: pick.expectedGoalsConceded
	}
}

export function eventResultFromManagerGameweek(
	gameweek: MyFplManagerGameweek | null | undefined
): EntryEventResult | null {
	if (!gameweek?.result || !gameweek.entry) return null
	const result = gameweek.result
	return {
		eventId: result.eventId,
		eventPoints: result.eventPoints,
		overallPoints: result.overallPoints,
		overallRank: result.overallRank,
		eventTransfers: result.eventTransfers,
		eventTransfersCost: result.eventTransfersCost,
		eventNetPoints: result.eventNetPoints,
		eventBenchPoints: result.eventBenchPoints,
		eventChip: result.eventChip,
		eventCaptainPoints: result.eventCaptainPoints,
		eventPlayedCaptain: result.playedCaptainWebName
			? { webName: result.playedCaptainWebName }
			: null,
		eventPicks: result.picks.map(mapPick),
		teamValue: result.teamValue,
		bank: result.bank,
		entry: {
			id: gameweek.entry.id,
			entryName: gameweek.entry.entryName,
			playerName: gameweek.entry.playerName,
			totalTransfers: gameweek.entry.totalTransfers,
			region: gameweek.entry.region
		}
	}
}

export function transfersFromManagerReview(
	review: MyFplManagerReview | null | undefined
): EntryGameweekTransfers[] {
	return (review?.transfers ?? []).map(gameweek => ({
		eventId: gameweek.eventId,
		eventTransfers: gameweek.eventTransfers,
		eventTransfersCost: gameweek.eventTransfersCost,
		transfers: gameweek.transfers.map((move): EntryTransferMove => ({
			event: move.eventId,
			elementInWebName: move.elementInWebName,
			elementInTypeName: move.elementInTypeName,
			elementInTeamShortName: move.elementInTeamShortName,
			elementInCost: move.elementInCost,
			elementOutWebName: move.elementOutWebName,
			elementOutTypeName: move.elementOutTypeName,
			elementOutTeamShortName: move.elementOutTeamShortName,
			elementOutCost: move.elementOutCost,
			time: move.time
		}))
	}))
}
