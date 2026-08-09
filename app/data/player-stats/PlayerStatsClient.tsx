'use client'

import PageShell from '@/components/layout/PageShell'
import { useTranslations } from 'next-intl'
import { PlayerSelectionPanel } from './_components/PlayerSelectionPanel'
import { PlayerStatsView } from './_components/PlayerStatsView'
import { usePlayerDetailSlot } from './_hooks/usePlayerDetailSlot'

const RECENT_PLAYERS_KEY_1 = 'player-stats-recent-1'
const RECENT_PLAYERS_KEY_2 = 'player-stats-recent-2'

export default function PlayerStatsClient({
	currentGameweek,
	eventId
}: {
	currentGameweek?: number
	eventId?: number
}) {
	const t = useTranslations('PlayerStats')
	const firstPlayer = usePlayerDetailSlot({
		storageKey: RECENT_PLAYERS_KEY_1,
		eventId
	})
	const secondPlayer = usePlayerDetailSlot({
		storageKey: RECENT_PLAYERS_KEY_2,
		eventId
	})

	return (
		<PageShell>
			<div className="container mx-auto max-w-4xl px-4 py-8">
				<h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>
				<PlayerSelectionPanel
					first={{
						selectedPlayer: firstPlayer.selectedPlayer,
						recentPlayers: firstPlayer.recentPlayers,
						excludedPlayerId: secondPlayer.selectedPlayer?.id,
						onSelect: firstPlayer.selectPlayer,
						onClearRecent: firstPlayer.clearRecent
					}}
					second={{
						selectedPlayer: secondPlayer.selectedPlayer,
						recentPlayers: secondPlayer.recentPlayers,
						excludedPlayerId: firstPlayer.selectedPlayer?.id,
						onSelect: secondPlayer.selectPlayer,
						onClearRecent: secondPlayer.clearRecent,
						onClearSelection: secondPlayer.clearSelection
					}}
				/>
				<PlayerStatsView
					selectedPlayer={firstPlayer.selectedPlayer}
					selectedComparison={secondPlayer.selectedPlayer}
					player={firstPlayer.playerDetail}
					comparison={secondPlayer.playerDetail}
					playerState={firstPlayer.playerStateProfile}
					comparisonState={secondPlayer.playerStateProfile}
					isLoading={firstPlayer.isLoading}
					isComparisonLoading={secondPlayer.isLoading}
					isStateLoading={firstPlayer.isStateLoading}
					isComparisonStateLoading={secondPlayer.isStateLoading}
					error={firstPlayer.error}
					comparisonError={secondPlayer.error}
					stateError={firstPlayer.stateError}
					comparisonStateError={secondPlayer.stateError}
					onRequestState={firstPlayer.requestPlayerState}
					onRequestComparisonState={secondPlayer.requestPlayerState}
					currentGameweek={currentGameweek}
				/>
			</div>
		</PageShell>
	)
}
