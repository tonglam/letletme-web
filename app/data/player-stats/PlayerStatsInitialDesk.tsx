'use client'

import { cloneElement, use, useEffect, type ReactElement } from 'react'
import { useTranslations } from 'next-intl'
import type { PlayerStatsDeskResponse } from '@/lib/player-stats-desk'
import type { PlayerStatsViewProps } from './_components/PlayerStatsView'
import { playerDetailToDirectoryOption } from './_lib/player-detail-option'
import { isCoreState, withEmptyStateContext } from './_hooks/usePlayerDetailSlot'

/** Render real detail HTML on the server; then admit the same seed into the slots. */
export function PlayerStatsInitialDesk({ promise, playerIds, eventId, onSeed, children }: {
	promise: Promise<PlayerStatsDeskResponse | null>
	playerIds: { p1: number | null; p2: number | null }
	eventId: number
	onSeed: (seed: PlayerStatsDeskResponse | null) => void
	children: ReactElement<PlayerStatsViewProps> | null
}) {
	const result = use(promise)
	const seed = result?.eventId === eventId ? result : null
	const t = useTranslations('PlayerStats')
	useEffect(() => { onSeed(seed) }, [onSeed, seed])
	if (!children) return null
	const first = seed?.entries.find(entry => entry.playerId === playerIds.p1)
	const second = seed?.entries.find(entry => entry.playerId === playerIds.p2)
	const player = first?.overview ?? null
	const comparison = second?.overview ?? null
	return (
		<div data-ssr-stream-content="player-stats" data-player-stats-ssr-container="true">
			{cloneElement(children, {
				ssrStreamed: true,
				player, comparison,
				selectedPlayer: player ? playerDetailToDirectoryOption(player) : children.props.selectedPlayer,
				selectedComparison: comparison ? playerDetailToDirectoryOption(comparison) : children.props.selectedComparison,
				comparisonRequested: playerIds.p2 != null,
				playerState: player && isCoreState(first?.state) ? withEmptyStateContext(first.state, player.elementType) : null,
				comparisonState: comparison && isCoreState(second?.state) ? withEmptyStateContext(second.state, comparison.elementType) : null,
				error: player ? null : t('loadFailed'),
				comparisonError: playerIds.p2 != null && !comparison ? t('loadFailed') : null
			})}
		</div>
	)
}
