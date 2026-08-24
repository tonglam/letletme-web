'use client'

import {
	PlayerDirectoryPicker,
	type PlayerDirectoryOption
} from '@/components/player/PlayerDirectoryPicker'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Pencil, Plus, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import type { PlayerDirectorySeed } from '@/lib/player-directory-seed'

interface PlayerSlotProps {
	label: string
	optional?: boolean
	defaultPosition?: PlayerDirectoryOption['position'] | null
	statsAvailable?: boolean
	directorySeed?: PlayerDirectorySeed
	selectedPlayer: PlayerDirectoryOption | null
	recentPlayers: PlayerDirectoryOption[]
	excludedPlayerId?: string
	onSelect: (player: PlayerDirectoryOption) => void
	onClearRecent: () => void
	onClearSelection?: () => void
	onCancel?: () => void
	onDirectoryReady?: () => void
}

function RecentPlayers({
	players,
	selectedPlayerId,
	onSelect,
	onClear
}: {
	players: PlayerDirectoryOption[]
	selectedPlayerId?: string
	onSelect: (player: PlayerDirectoryOption) => void
	onClear: () => void
}) {
	const t = useTranslations('PlayerStats')

	if (players.length === 0) return null

	return (
		<div className="mt-2 flex flex-wrap items-center gap-1.5">
			<span className="shrink-0 text-caption text-muted-foreground">
				{t('recent')}
			</span>
			{players.map(player => (
				<Button
					key={player.id}
					type="button"
					variant={selectedPlayerId === player.id ? 'default' : 'outline'}
					size="sm"
					onClick={() => onSelect(player)}
					data-player-stats-recent-player={player.id}
					className="h-7 gap-1 rounded-full px-2.5 text-xs"
				>
					{player.name}
					<span className="text-label opacity-70">{player.teamShortName}</span>
				</Button>
			))}
			<Button
				type="button"
				variant="ghost"
				size="sm"
				onClick={onClear}
				className="h-7 px-2 text-xs text-muted-foreground"
			>
				{t('clearRecent')}
			</Button>
		</div>
	)
}

function SuggestionChips({
	label,
	players,
	onSelect
}: {
	label: string
	players: Array<{
		id: string
		name: string
		teamShortName: string
		badge?: string
	}>
	onSelect: (playerId: string) => void
}) {
	if (players.length === 0) return null

	return (
		<div className="mt-2 flex flex-wrap items-center gap-1.5">
			<span className="shrink-0 text-caption text-muted-foreground">
				{label}
			</span>
			{players.map(player => (
				<Button
					key={player.id}
					type="button"
					variant="outline"
					size="sm"
					onClick={() => onSelect(player.id)}
					className="h-7 gap-1 rounded-full px-2.5 text-xs"
				>
					{player.name}
					<span className="text-label opacity-70">{player.teamShortName}</span>
					{player.badge ? (
						<span className="text-micro uppercase opacity-60">
							{player.badge}
						</span>
					) : null}
				</Button>
			))}
		</div>
	)
}

function PlayerSlot({
	label,
	optional = false,
	defaultPosition,
	statsAvailable,
	directorySeed,
	selectedPlayer,
	recentPlayers,
	excludedPlayerId,
	onSelect,
	onClearRecent,
	onClearSelection,
	onCancel,
	onDirectoryReady,
	suggestions,
	suggestionsLabel,
	onSelectSuggestion
}: PlayerSlotProps & {
	suggestions?: Array<{
		id: string
		name: string
		teamShortName: string
		badge?: string
	}>
	suggestionsLabel?: string
	onSelectSuggestion?: (playerId: string) => void
}) {
	const t = useTranslations('PlayerStats')

	return (
		<div className="min-w-0 rounded-lg border border-border/60 bg-muted/10 px-3 py-3">
			<div className="mb-2 flex items-center justify-between gap-2">
				<p className="eyebrow sm:text-caption">
					{label}
					{optional ? (
						<span className="ml-1 font-sans text-label font-normal normal-case tracking-normal text-muted-foreground">
							{t('optionalSuffix')}
						</span>
					) : null}
				</p>
				<div className="flex items-center gap-1">
					{onCancel ? (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-7 px-2 text-xs"
							onClick={onCancel}
						>
							{t('cancel')}
						</Button>
					) : null}
					{selectedPlayer && onClearSelection ? (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-7 px-2 text-xs"
							onClick={onClearSelection}
						>
							<X
								className="size-3.5"
								aria-hidden="true"
							/>
							{t('remove')}
						</Button>
					) : null}
				</div>
			</div>
			{selectedPlayer ? (
				<p className="mb-2 truncate text-sm font-medium">
					{selectedPlayer.name}{' '}
					<span className="text-muted-foreground">
						· {selectedPlayer.teamShortName}
					</span>
				</p>
			) : null}
			<PlayerDirectoryPicker
				key={`${defaultPosition ?? 'ALL'}:${statsAvailable ? 'season' : 'preseason'}`}
				onSelect={onSelect}
				excludedPlayerIds={excludedPlayerId ? [excludedPlayerId] : []}
				defaultPosition={defaultPosition}
				statsAvailable={statsAvailable}
				seed={directorySeed}
				onReady={onDirectoryReady}
			/>
			<RecentPlayers
				players={recentPlayers}
				selectedPlayerId={selectedPlayer?.id}
				onSelect={onSelect}
				onClear={onClearRecent}
			/>
			{suggestions && onSelectSuggestion && suggestionsLabel ? (
				<SuggestionChips
					label={suggestionsLabel}
					players={suggestions}
					onSelect={onSelectSuggestion}
				/>
			) : null}
		</div>
	)
}

function CompactPlayerSlot({
	label,
	player,
	slot,
	onEdit,
	onRemove
}: {
	label: string
	player: PlayerDirectoryOption
	slot: 'first' | 'second'
	onEdit: () => void
	onRemove?: () => void
}) {
	const t = useTranslations('PlayerStats')
	return (
		<div className="flex min-w-0 items-center gap-3 rounded-lg border border-border/60 bg-muted/10 px-3 py-3">
			<div className="min-w-0 flex-1">
				<p className="eyebrow">{label}</p>
				<p className="truncate text-sm font-medium">
					{player.name}{' '}
					<span className="text-muted-foreground">
						· {player.teamShortName}
					</span>
				</p>
			</div>
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="h-8 gap-1.5"
				onClick={onEdit}
				data-player-stats-edit-slot={slot}
			>
				<Pencil
					className="size-3.5"
					aria-hidden="true"
				/>
				{t('editPlayer')}
			</Button>
			{onRemove ? (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-8 px-2"
					onClick={onRemove}
				>
					<X
						className="size-3.5"
						aria-hidden="true"
					/>
					{t('remove')}
				</Button>
			) : null}
		</div>
	)
}

export function PlayerSelectionPanel({
	first,
	second,
	compareOpen,
	onAddCompare,
	marketSuggestions,
	onSelectMarketSuggestion,
	canCompare,
	statsAvailable,
	directorySeed,
	onDirectoryReady
}: {
	first: Omit<PlayerSlotProps, 'label' | 'optional'>
	compareOpen: boolean
	onAddCompare: () => void
	second: Omit<PlayerSlotProps, 'label' | 'optional'> | null
	canCompare: boolean
	statsAvailable?: boolean
	directorySeed: PlayerDirectorySeed
	onDirectoryReady?: () => void
	marketSuggestions?: Array<{
		id: string
		name: string
		teamShortName: string
		badge?: string
	}>
	onSelectMarketSuggestion?: (playerId: string) => void
}) {
	const t = useTranslations('PlayerStats')
	const [editingSlot, setEditingSlot] = useState<'first' | 'second' | null>(
		null
	)
	const firstExpanded = !first.selectedPlayer || editingSlot === 'first'
	const secondExpanded = Boolean(
		compareOpen &&
		second &&
		(!second.selectedPlayer || editingSlot === 'second')
	)
	const selectFirst = (player: PlayerDirectoryOption) => {
		first.onSelect(player)
		setEditingSlot(null)
	}
	const selectSecond = (player: PlayerDirectoryOption) => {
		second?.onSelect(player)
		setEditingSlot(null)
	}

	return (
		<Card
			role="region"
			aria-label={t('scopeLabel')}
			className="mb-8 p-4 sm:p-5"
		>
			<div className="mb-3 border-b border-border/50 pb-2">
				<p className="eyebrow sm:text-caption">{t('scopeLabel')}</p>
				<p className="mt-0.5 text-caption text-muted-foreground">
					{t('scopeHint')}
				</p>
			</div>
			<div className="grid gap-3 lg:grid-cols-2">
				{firstExpanded ? (
					<PlayerSlot
						label={t('playerOne')}
						statsAvailable={statsAvailable}
						{...first}
						directorySeed={directorySeed}
						onDirectoryReady={onDirectoryReady}
						onSelect={selectFirst}
						onCancel={
							first.selectedPlayer ? () => setEditingSlot(null) : undefined
						}
					/>
				) : first.selectedPlayer ? (
					<CompactPlayerSlot
						label={t('playerOne')}
						player={first.selectedPlayer}
						slot="first"
						onEdit={() => setEditingSlot('first')}
					/>
				) : null}
				{compareOpen && second ? (
					secondExpanded ? (
						<PlayerSlot
							label={t('playerTwo')}
							optional
							statsAvailable={statsAvailable}
							{...second}
							directorySeed={directorySeed}
							onSelect={selectSecond}
							onCancel={() => {
								if (second.selectedPlayer) {
									setEditingSlot(null)
									return
								}
								second.onClearSelection?.()
								setEditingSlot(null)
							}}
							suggestions={marketSuggestions}
							suggestionsLabel={t('marketSuggestionsLabel')}
							onSelectSuggestion={playerId => {
								onSelectMarketSuggestion?.(playerId)
								setEditingSlot(null)
							}}
						/>
					) : second.selectedPlayer ? (
						<CompactPlayerSlot
							label={t('playerTwo')}
							player={second.selectedPlayer}
							slot="second"
							onEdit={() => setEditingSlot('second')}
							onRemove={() => {
								second.onClearSelection?.()
								setEditingSlot(null)
							}}
						/>
					) : null
				) : (
					<div className="flex min-h-14 items-center justify-center rounded-lg border border-dashed border-border/60 px-3 py-3">
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="gap-1.5"
							data-player-stats-add-compare="true"
							onClick={onAddCompare}
							disabled={!canCompare}
						>
							<Plus
								className="size-3.5"
								aria-hidden="true"
							/>
							{t('addCompare')}
						</Button>
					</div>
				)}
			</div>
		</Card>
	)
}
