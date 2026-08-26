import { positionCodeFromElementTypeName } from '@/lib/squad-picks'

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

export const comparisonPositionLabel = (
	pick:
		| { elementType?: number | null; elementTypeName?: string | null }
		| null
		| undefined,
	position: number
): string => {
	if (position >= 12) return 'SUB'
	if (typeof pick?.elementType === 'number') {
		switch (pick.elementType) {
			case 1:
				return 'GKP'
			case 2:
				return 'DEF'
			case 3:
				return 'MID'
			case 4:
				return 'FWD'
		}
	}
	return pick?.elementTypeName
		? positionCodeFromElementTypeName(pick.elementTypeName)
		: '—'
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
