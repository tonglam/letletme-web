'use client'

import {
	PlayerDirectoryPicker,
	type PlayerDirectoryOption,
} from '@/components/player/PlayerDirectoryPicker'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { X } from 'lucide-react'

interface PlayerSlotProps {
	label: string
	optional?: boolean
	selectedPlayer: PlayerDirectoryOption | null
	recentPlayers: PlayerDirectoryOption[]
	excludedPlayerId?: string
	onSelect: (player: PlayerDirectoryOption) => void
	onClearRecent: () => void
	onClearSelection?: () => void
}

function RecentPlayers({
	players,
	selectedPlayerId,
	onSelect,
	onClear,
}: {
	players: PlayerDirectoryOption[]
	selectedPlayerId?: string
	onSelect: (player: PlayerDirectoryOption) => void
	onClear: () => void
}) {
	if (players.length === 0) return null

	return (
		<div className="mt-2 flex flex-wrap items-center gap-2">
			<span className="shrink-0 text-xs text-muted-foreground">Recent:</span>
			{players.map((player) => (
				<Button
					key={player.id}
					type="button"
					variant={selectedPlayerId === player.id ? 'default' : 'outline'}
					size="sm"
					onClick={() => onSelect(player)}
					className="h-7 rounded-full px-2 text-xs"
				>
					{player.name}
					<span className="text-[10px] opacity-70">{player.teamShortName}</span>
				</Button>
			))}
			<Button type="button" variant="ghost" size="sm" onClick={onClear} className="h-7 px-2 text-xs">
				Clear recent
			</Button>
		</div>
	)
}

function PlayerSlot({
	label,
	optional = false,
	selectedPlayer,
	recentPlayers,
	excludedPlayerId,
	onSelect,
	onClearRecent,
	onClearSelection,
}: PlayerSlotProps) {
	return (
		<section aria-label={label}>
			<div className="mb-2 flex items-center justify-between">
				<p className="text-sm text-muted-foreground">
					{label}{optional ? ' (optional)' : ''}
				</p>
				{selectedPlayer && onClearSelection ? (
					<Button type="button" variant="ghost" size="sm" onClick={onClearSelection}>
						<X data-icon="inline-start" />
						Remove
					</Button>
				) : null}
			</div>
			<PlayerDirectoryPicker
				onSelect={onSelect}
				excludedPlayerIds={excludedPlayerId ? [excludedPlayerId] : []}
			/>
			<RecentPlayers
				players={recentPlayers}
				selectedPlayerId={selectedPlayer?.id}
				onSelect={onSelect}
				onClear={onClearRecent}
			/>
		</section>
	)
}

export function PlayerSelectionPanel({
	first,
	second,
}: {
	first: Omit<PlayerSlotProps, 'label' | 'optional'>
	second: Omit<PlayerSlotProps, 'label' | 'optional'>
}) {
	return (
		<div className="mb-6 flex flex-col gap-4">
			<PlayerSlot label="Player 1" {...first} />
			<div className="flex items-center gap-3" aria-hidden="true">
				<Separator className="flex-1" />
				<span className="text-xs font-medium text-muted-foreground">vs</span>
				<Separator className="flex-1" />
			</div>
			<PlayerSlot label="Player 2" optional {...second} />
		</div>
	)
}
