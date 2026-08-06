'use client'

import {
	PlayerDirectoryPicker,
	type PlayerDirectoryOption,
} from '@/components/player/PlayerDirectoryPicker'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'

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
	const t = useTranslations('PlayerStats')

	if (players.length === 0) return null

	return (
		<div className="mt-2 flex flex-wrap items-center gap-2">
			<span className="shrink-0 text-xs text-muted-foreground">{t('recent')}</span>
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
				{t('clearRecent')}
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
	const t = useTranslations('PlayerStats')

	return (
		<section aria-label={label}>
			<div className="mb-2 flex items-center justify-between">
				<p className="text-sm text-muted-foreground">
					{label}{optional ? t('optionalSuffix') : ''}
				</p>
				{selectedPlayer && onClearSelection ? (
					<Button type="button" variant="ghost" size="sm" onClick={onClearSelection}>
						<X data-icon="inline-start" />
						{t('remove')}
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
	const t = useTranslations('PlayerStats')

	return (
		<div className="mb-6 rounded-lg border border-border/80 bg-card p-4 shadow-sm sm:p-5">
			<div className="flex flex-col gap-4">
				<PlayerSlot label={t('playerOne')} {...first} />
				<div className="flex items-center gap-3" aria-hidden="true">
					<Separator className="flex-1" />
					<span className="font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
						{t('versus')}
					</span>
					<Separator className="flex-1" />
				</div>
				<PlayerSlot label={t('playerTwo')} optional {...second} />
			</div>
		</div>
	)
}
