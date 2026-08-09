import type {
	GameweekBoardEvent,
	LiveScore,
	LiveSnapshotState,
} from '@/lib/graphql/operations/live'
import { normalizePosition, type PositionCode } from '@/lib/utils'

export type GameweekBoardPlayer = {
	id: number
	name: string
	position: string
	team: string | null
	points: number
	price: number | null
	minutes: number | null
	stats: {
		goals: number | null
		assists: number | null
		cleanSheets: number | null
		bonusPoints: number | null
	}
}

export type GameweekDisplayState =
	| 'provisional'
	| 'settled'
	| 'scheduled'
	| null

const POSITION_ORDER: Record<PositionCode, number> = {
	GKP: 0,
	DEF: 1,
	MID: 2,
	FWD: 3,
	UNK: 99,
}

export function mapGameweekBoardPlayers(
	entries: readonly LiveScore[],
	order: 'position' | 'points',
): GameweekBoardPlayer[] {
	return entries
		.map(entry => ({
			id: entry.player.id,
			name: entry.player.webName,
			position: normalizePosition(entry.player.position),
			team:
				entry.player.team?.shortName ?? entry.player.team?.name ?? null,
			points: entry.totalPoints,
			price: entry.player.price ?? null,
			minutes: entry.minutes ?? null,
			stats: {
				goals: entry.goalsScored ?? null,
				assists: entry.assists ?? null,
				cleanSheets: entry.cleanSheets ?? null,
				bonusPoints: entry.bonus ?? null,
			},
		}))
		.sort((a, b) => {
			if (order === 'points') {
				return b.points - a.points || a.name.localeCompare(b.name)
			}
			const positionDiff =
				POSITION_ORDER[a.position as PositionCode] -
				POSITION_ORDER[b.position as PositionCode]
			return positionDiff !== 0
				? positionDiff
				: b.points - a.points || a.name.localeCompare(b.name)
		})
}

export function resolveGameweekDisplayState(
	snapshotState: LiveSnapshotState | null | undefined,
	event: GameweekBoardEvent | null | undefined,
): GameweekDisplayState {
	if (snapshotState === 'LIVE') return 'provisional'
	if (snapshotState === 'SETTLED') return 'settled'
	if (snapshotState === 'SCHEDULED') return 'scheduled'
	if (event?.finished) return 'settled'
	if (event?.isNext) return 'scheduled'
	return null
}
