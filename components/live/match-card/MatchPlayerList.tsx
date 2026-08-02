'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Match, PlayerStat } from '@/types/match'
import { ChevronDown, ChevronUp } from 'lucide-react'
import Image from 'next/image'
import { useId, useState } from 'react'
import { useTranslations } from 'next-intl'
import { getPlayerMetrics, getPlayersWithPoints, type PlayerMetric } from './match-card-model'

type MatchTeam = Match['homeTeam']

const METRIC_TONES: Record<PlayerMetric['tone'], string> = {
	neutral: 'bg-muted text-muted-foreground',
	success: 'bg-success/10 text-success',
	info: 'bg-info/10 text-info',
	warning: 'bg-warning/10 text-warning',
	destructive: 'bg-destructive/10 text-destructive',
}

function PlayerRow({ player, onSelect }: { player: PlayerStat; onSelect: (player: PlayerStat) => void }) {
	const t = useTranslations('LiveMatches')
	const metrics = getPlayerMetrics(player)
	const metricLabels: Record<string, string> = {
		MIN: t('minutesShort'),
		Goals: t('goals'),
		Assists: t('assists'),
		CS: t('cleanSheetShort'),
		Def: t('defensiveShort'),
		Saves: t('saves'),
		YC: t('yellowCardShort'),
		RC: t('redCardShort'),
		PS: t('penaltySavedShort'),
		PM: t('penaltyMissedShort'),
		OG: t('ownGoalShort'),
		GC: t('goalsConcededShort'),
	}
	return (
		<Button
			type="button"
			variant="ghost"
			className="h-auto w-full flex-col items-stretch rounded-lg bg-accent/30 p-3 text-left whitespace-normal hover:bg-accent/50"
			onClick={() => onSelect(player)}
		>
			<span className="flex items-start justify-between gap-3">
				<span className="font-medium">{player.player}</span>
				<span className="flex shrink-0 items-center gap-2">
					{(player.bonus_points ?? 0) > 0 ? <Badge variant="outline" className="border-warning/30 text-warning">+{player.bonus_points}</Badge> : null}
					<Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary-ink">{t('pointsBadge', { points: player.totalPoints ?? 0 })}</Badge>
				</span>
			</span>
			{metrics.length > 0 ? (
				<span className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
					{metrics.map((metric) => (
						<span key={metric.label} className={`flex items-center justify-between gap-2 rounded px-2 py-1 text-xs ${METRIC_TONES[metric.tone]}`}>
							<span className="font-semibold">{metricLabels[metric.label] ?? metric.label}</span><span className="font-bold">{metric.value}</span>
						</span>
					))}
				</span>
			) : null}
		</Button>
	)
}

function TeamPlayers({ team, onSelect }: { team: MatchTeam; onSelect: (player: PlayerStat, team: MatchTeam) => void }) {
	const t = useTranslations('LiveMatches')
	const players = getPlayersWithPoints(team.players)
	if (players.length === 0) return <p className="py-4 text-center text-sm text-muted-foreground">{t('noPlayerPoints')}</p>
	return (
		<div className="flex flex-col gap-2">
			{players.map((player) => (
				<PlayerRow key={player.element ?? player.player} player={player} onSelect={(selected) => onSelect(selected, team)} />
			))}
		</div>
	)
}

interface MatchPlayerListProps {
	match: Match
	onSelectPlayer: (player: PlayerStat, team: string, teamShort: string) => void
}

export function MatchPlayerList({ match, onSelectPlayer }: MatchPlayerListProps) {
	const t = useTranslations('LiveMatches')
	const [expanded, setExpanded] = useState(false)
	const contentId = useId()
	const selectPlayer = (player: PlayerStat, team: MatchTeam) => onSelectPlayer(player, team.name, team.shortName)

	return (
		<section aria-label={t('playerPoints')} className="flex flex-col gap-3">
			<Button type="button" variant="outline" className="w-full justify-between bg-accent/20" onClick={() => setExpanded((current) => !current)} aria-expanded={expanded} aria-controls={contentId}>
				{t('playerList')}
				{expanded ? <ChevronUp data-icon="inline-end" aria-hidden="true" /> : <ChevronDown data-icon="inline-end" aria-hidden="true" />}
			</Button>

			{expanded ? (
				<div id={contentId}>
					<Tabs defaultValue={match.homeTeam.shortName} className="w-full">
						<TabsList className="mb-2 grid h-auto w-full grid-cols-2">
							<TabsTrigger value={match.homeTeam.shortName} className="gap-2">
								<Image src={`/images/team-logos/${match.homeTeam.shortName.toUpperCase()}.png`} alt="" width={16} height={16} className="size-4 object-contain" />
								<span className="truncate">{match.homeTeam.name}</span>
							</TabsTrigger>
							<TabsTrigger value={match.awayTeam.shortName} className="gap-2">
								<Image src={`/images/team-logos/${match.awayTeam.shortName.toUpperCase()}.png`} alt="" width={16} height={16} className="size-4 object-contain" />
								<span className="truncate">{match.awayTeam.name}</span>
							</TabsTrigger>
						</TabsList>
						<TabsContent value={match.homeTeam.shortName} className="mt-0"><TeamPlayers team={match.homeTeam} onSelect={selectPlayer} /></TabsContent>
						<TabsContent value={match.awayTeam.shortName} className="mt-0"><TeamPlayers team={match.awayTeam} onSelect={selectPlayer} /></TabsContent>
					</Tabs>
				</div>
			) : null}
		</section>
	)
}
