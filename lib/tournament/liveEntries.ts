import { type TournamentLiveCalcData } from '@/lib/graphql/queries'
import { type TournamentEntry } from '@/types/tournament'

export type LiveTournamentStats = {
	averagePoints: number
	highestPoints: number
	totalEntries: number
}

const mapEventChipToFlags = (eventChip: string | null) => ({
	bench: eventChip === 'BENCH_BOOST',
	triple: eventChip === 'TRIPLE_CAPTAIN',
	wildcard: eventChip === 'WILDCARD',
})

export const buildRankMap = (rows: TournamentLiveCalcData[]): Map<number, number> => {
	const sorted = [...rows].sort((a, b) => {
		if (b.liveNetPoints !== a.liveNetPoints) {
			return b.liveNetPoints - a.liveNetPoints
		}
		if (b.liveTotalPoints !== a.liveTotalPoints) {
			return b.liveTotalPoints - a.liveTotalPoints
		}
		return a.entry - b.entry
	})

	return new Map(sorted.map((row, index) => [row.entry, index + 1]))
}

export const buildTournamentEntries = (
	currentRows: TournamentLiveCalcData[],
	previousRows: TournamentLiveCalcData[] = [],
): TournamentEntry[] => {
	const currentRankByEntryId = buildRankMap(currentRows)
	const previousRankByEntryId =
		previousRows.length > 0 ? buildRankMap(previousRows) : currentRankByEntryId

	return currentRows.map(row => ({
		id: String(row.entry),
		rank: currentRankByEntryId.get(row.entry) ?? 0,
		previousRank: previousRankByEntryId.get(row.entry) ?? currentRankByEntryId.get(row.entry) ?? 0,
		teamName: row.entryName ?? `Entry ${row.entry}`,
		managerName: row.playerName ?? '-',
		captainName:
			row.pickList.find(player => player.isCaptain)?.webName ?? row.captainName ?? 'N/A',
		captainTeam: row.pickList.find(player => player.isCaptain)?.teamShortName ?? 'N/A',
		captainPoints: 0,
		gwPoints: row.livePoints ?? 0,
		gwNetPoints: row.liveNetPoints ?? row.livePoints ?? 0,
		eventCost: row.transferCost ?? 0,
		overallRank: row.overallRank ?? 0,
		livePoints: row.liveNetPoints ?? row.livePoints ?? 0,
		totalPoints: row.liveTotalPoints ?? 0,
		playersPlayed: row.played ?? 0,
		playersToPlay: row.toPlay ?? 0,
		picks: row.pickList.map(player => ({
			element: player.element,
			webName: player.webName,
			teamShortName: player.teamShortName,
			teamName: player.teamName,
			elementTypeName: player.elementTypeName,
			position: player.position,
			isCaptain: player.isCaptain,
			isViceCaptain: player.isViceCaptain,
		})),
		chips: mapEventChipToFlags(row.chip),
	}))
}

export const buildTournamentStats = (entries: TournamentEntry[]): LiveTournamentStats => {
	if (entries.length === 0) {
		return {
			averagePoints: 0,
			highestPoints: 0,
			totalEntries: 0,
		}
	}

	const totalPoints = entries.reduce((sum, entry) => sum + entry.livePoints, 0)
	const highestPoints = entries.reduce(
		(max, entry) => Math.max(max, entry.livePoints),
		entries[0]?.livePoints ?? 0,
	)

	return {
		averagePoints: Math.round(totalPoints / entries.length),
		highestPoints,
		totalEntries: entries.length,
	}
}
