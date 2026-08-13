'use client'

import type { Player } from '@/types/player'
import { useTranslations } from 'next-intl'
import { memo } from 'react'
import { PlayerRow } from './PlayerRow'

interface PlayerListProps {
	players?: Player[]
	startingPlayers?: Player[]
	benchPlayers?: Player[]
}

function PlayerListComponent({ players, startingPlayers, benchPlayers }: PlayerListProps) {
	const t = useTranslations('LivePoints')
	const benchBoostActive = !!benchPlayers?.some(player => player.isBenchBoostActive)

	if (players) {
		return (
			<div className="space-y-2 p-3 sm:p-4">
				{players.map(player => (
					<PlayerRow key={player.id} player={player} />
				))}
			</div>
		)
	}

	return (
		<div className="space-y-5 p-3 sm:p-4">
			<section aria-labelledby="live-xi-heading">
				<h3
					id="live-xi-heading"
					className="mb-2.5 px-0.5 font-display text-sm font-bold uppercase tracking-caps text-muted-foreground"
				>
					{t('startingEleven')}
				</h3>
				<div className="space-y-2">
					{startingPlayers?.map(player => (
						<PlayerRow key={player.id} player={player} />
					))}
				</div>
			</section>

			{benchPlayers && benchPlayers.length > 0 ? (
				<section aria-labelledby="live-bench-heading">
					<h3
						id="live-bench-heading"
						className="mb-2.5 mt-1 border-t border-border/70 px-0.5 pt-4 font-display text-sm font-bold uppercase tracking-caps text-muted-foreground"
					>
						{benchBoostActive ? t('substitutesBenchBoost') : t('substitutes')}
					</h3>
					<div className="space-y-2">
						{benchPlayers.map(player => (
							<PlayerRow key={player.id} player={player} />
						))}
					</div>
				</section>
			) : null}
		</div>
	)
}

export const PlayerList = memo(PlayerListComponent)
