export type ComparisonPickSource = {
	webName: string
	totalPoints?: number | null
	minutes?: number | null
	starts?: boolean | null
	isCaptain?: boolean
	isViceCaptain?: boolean
	isGwFinished?: boolean | null
	isGwStarted?: boolean | null
	isPlayed?: boolean | null
}

export type ComparisonPick = {
	webName: string
	totalPoints: number
	minutes: number
	starts: boolean
	isCaptain: boolean
	isViceCaptain: boolean
	isGwFinished?: boolean | null
	isGwStarted?: boolean | null
	isPlayed?: boolean | null
}

export const mapComparisonPick = (
	pick: ComparisonPickSource | null | undefined,
	scoresAvailable: boolean
): ComparisonPick | null =>
	pick
		? {
				webName: pick.webName,
				totalPoints: scoresAvailable ? (pick.totalPoints ?? 0) : 0,
				minutes: scoresAvailable ? (pick.minutes ?? 0) : 0,
				starts: scoresAvailable ? (pick.starts ?? false) : false,
				isCaptain: pick.isCaptain ?? false,
				isViceCaptain: pick.isViceCaptain ?? false,
				isGwFinished: pick.isGwFinished,
				isGwStarted: pick.isGwStarted,
				isPlayed: pick.isPlayed
			}
		: null
