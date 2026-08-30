'use client'

import type { MarketPlayer } from '@/lib/graphql/operations/market'
import type { PlayerDirectoryItem } from '@/lib/graphql/operations/players'
import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useState,
	type ReactNode
} from 'react'

export function marketPlayerToDirectory(
	player: MarketPlayer
): PlayerDirectoryItem {
	return {
		id: player.playerId,
		webName: player.webName,
		position: player.position,
		price: player.price,
		selectedByPercent: player.selectedByPercent,
		team: {
			id: player.teamId,
			name: player.teamName,
			shortName: player.teamShortName
		}
	}
}

type MarketPlayerSelectionContextValue = {
	selectedPlayer: PlayerDirectoryItem | null
	selectPlayer: (player: MarketPlayer) => void
	selectDirectoryPlayer: (player: PlayerDirectoryItem) => void
	clearSelectedPlayer: () => void
}

const MarketPlayerSelectionContext = createContext<
	MarketPlayerSelectionContextValue | undefined
>(undefined)

export function MarketPlayerSelectionProvider({
	children
}: {
	children: ReactNode
}) {
	const [selectedPlayer, setSelectedPlayer] =
		useState<PlayerDirectoryItem | null>(null)
	const selectPlayer = useCallback((player: MarketPlayer) => {
		setSelectedPlayer(marketPlayerToDirectory(player))
	}, [])
	const selectDirectoryPlayer = useCallback((player: PlayerDirectoryItem) => {
		setSelectedPlayer(player)
	}, [])
	const clearSelectedPlayer = useCallback(() => {
		setSelectedPlayer(null)
	}, [])
	const value = useMemo(
		() => ({
			selectedPlayer,
			selectPlayer,
			selectDirectoryPlayer,
			clearSelectedPlayer
		}),
		[clearSelectedPlayer, selectDirectoryPlayer, selectPlayer, selectedPlayer]
	)

	return (
		<MarketPlayerSelectionContext.Provider value={value}>
			{children}
		</MarketPlayerSelectionContext.Provider>
	)
}

export function useMarketPlayerSelection(): MarketPlayerSelectionContextValue {
	const context = useContext(MarketPlayerSelectionContext)
	if (!context) {
		throw new Error(
			'useMarketPlayerSelection must be used inside MarketPlayerSelectionProvider'
		)
	}
	return context
}
