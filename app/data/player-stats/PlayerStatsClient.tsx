'use client'

import PageShell from '@/components/layout/PageShell'
import { StatsPageHeader } from '@/components/stats/StatsSurfaces'
import {
	PLAYER_STATS_MOCK_PLAYERS,
	PLAYER_STATS_UI_MOCK_ENABLED,
} from '@/lib/dev/player-stats-ui-mock'
import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import { PlayerSelectionPanel } from './_components/PlayerSelectionPanel'
import { PlayerStatsView } from './_components/PlayerStatsView'
import { usePlayerDetailSlot } from './_hooks/usePlayerDetailSlot'

const RECENT_PLAYERS_KEY_1 = 'player-stats-recent-1'
const RECENT_PLAYERS_KEY_2 = 'player-stats-recent-2'

export default function PlayerStatsClient({ currentGameweek }: { currentGameweek?: number }) {
	const t = useTranslations('PlayerStats')
	const firstPlayer = usePlayerDetailSlot({
		storageKey: RECENT_PLAYERS_KEY_1,
		eventId: currentGameweek,
	})
	const secondPlayer = usePlayerDetailSlot({
		storageKey: RECENT_PLAYERS_KEY_2,
		eventId: currentGameweek,
	})
	const mockSeededRef = useRef(false)
	const selectFirstPlayer = firstPlayer.selectPlayer
	const selectedFirstPlayer = firstPlayer.selectedPlayer

	// TEMP UI mock — auto-select first mock player for non-empty first paint
	useEffect(() => {
		if (!PLAYER_STATS_UI_MOCK_ENABLED || mockSeededRef.current) return
		if (selectedFirstPlayer) {
			mockSeededRef.current = true
			return
		}
		const seed = PLAYER_STATS_MOCK_PLAYERS[0]
		if (!seed) return
		mockSeededRef.current = true
		selectFirstPlayer(seed)
	}, [selectFirstPlayer, selectedFirstPlayer])

	return (
		<PageShell>
			<div className="container mx-auto max-w-4xl px-4 py-8">
				<StatsPageHeader
					eyebrow={t('overview')}
					title={t('title')}
					badge={
						currentGameweek ? (
							<span className="inline-flex w-fit items-center rounded-md bg-plum px-2.5 py-1 font-mono text-xs font-semibold tracking-[0.14em] text-electric">
								GW{currentGameweek}
							</span>
						) : null
					}
				/>
				<PlayerSelectionPanel
					first={{
						selectedPlayer: firstPlayer.selectedPlayer,
						recentPlayers: firstPlayer.recentPlayers,
						excludedPlayerId: secondPlayer.selectedPlayer?.id,
						onSelect: firstPlayer.selectPlayer,
						onClearRecent: firstPlayer.clearRecent,
					}}
					second={{
						selectedPlayer: secondPlayer.selectedPlayer,
						recentPlayers: secondPlayer.recentPlayers,
						excludedPlayerId: firstPlayer.selectedPlayer?.id,
						onSelect: secondPlayer.selectPlayer,
						onClearRecent: secondPlayer.clearRecent,
						onClearSelection: secondPlayer.clearSelection,
					}}
				/>
				<PlayerStatsView
					selectedPlayer={firstPlayer.selectedPlayer}
					selectedComparison={secondPlayer.selectedPlayer}
					player={firstPlayer.playerDetail}
					comparison={secondPlayer.playerDetail}
					isLoading={firstPlayer.isLoading}
					isComparisonLoading={secondPlayer.isLoading}
					error={firstPlayer.error}
					comparisonError={secondPlayer.error}
					currentGameweek={currentGameweek}
				/>
			</div>
		</PageShell>
	)
}
