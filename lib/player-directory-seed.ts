import type {
	PlayerDirectoryItem,
	TeamForPickerItem
} from '@/lib/graphql/operations/players'
import type {
	OwnBand,
	PlayerDirectorySort
} from '@/lib/player-directory-filters'

export type PlayerDirectorySeasonState = 'active' | 'preseason' | 'unavailable'

export type PlayerDirectoryQueryKeyInput = {
	search: string | null
	teamId: number | null
	position: PlayerDirectoryItem['position'] | null
	maxPrice: number | null
	sortBy: PlayerDirectorySort
	ownBand: OwnBand
}

export function buildPlayerDirectoryQueryKey(
	input: PlayerDirectoryQueryKeyInput
): string {
	return JSON.stringify(input)
}

export type PlayerDirectorySeed = {
	teams: TeamForPickerItem[]
	teamsState: 'ready' | 'unavailable'
	players: PlayerDirectoryItem[]
	playersState: 'ready' | 'unavailable'
	totalCount: number
	nextCursor: number | null
	queryKey: string
	seasonState: PlayerDirectorySeasonState
	anchorGw: number
	seasonStatsAvailable: boolean
}
