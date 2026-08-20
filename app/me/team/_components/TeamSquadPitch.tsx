'use client'

import {
	SquadPitch,
	type SquadPitchPlayer
} from '@/components/squad-pitch/SquadPitch'
import { PlayerDetailModal } from '@/components/live/PlayerDetailModal'
import { ShareActions } from '@/components/share/ShareActions'
import { localizePathname, type AppLocale } from '@/i18n/routing'
import { isSquadStarter } from '@/lib/squad-picks'
import { resolveSquadTeamCode } from '@/lib/squad-pitch-team-codes'
import { teamStatsGameweekHref } from '../_lib/team-stats-url'
import type {
	EventPickViewModel,
	TeamStatsViewModel
} from '../_lib/team-stats-model'
import type { PlayerDetail } from '@/types/player-detail'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import { useCallback, useMemo, useRef, useState } from 'react'

const POSITION_ORDER: Record<SquadPitchPlayer['position'], number> = {
	GKP: 0,
	DEF: 1,
	MID: 2,
	FWD: 3
}

function positionCode(value: string): SquadPitchPlayer['position'] | null {
	const normalized = value.trim().toUpperCase()
	if (normalized === 'GKP' || normalized === 'GOALKEEPER') return 'GKP'
	if (normalized === 'DEF' || normalized === 'DEFENDER') return 'DEF'
	if (normalized === 'MID' || normalized === 'MIDFIELDER') return 'MID'
	if (normalized === 'FWD' || normalized === 'FORWARD') return 'FWD'
	return null
}

function formatChip(
	chip: string | null | undefined,
	t: ReturnType<typeof useTranslations<'TeamStats'>>
) {
	const normalized = chip?.toUpperCase().replace(/[\s-]+/g, '_') ?? ''
	if (!normalized || normalized === 'NONE') return t('noActiveChips')
	if (
		normalized === 'BB' ||
		normalized === 'BBOOST' ||
		normalized === 'BENCH_BOOST'
	) {
		return t('pitchBenchBoost')
	}
	if (
		normalized === 'TC' ||
		normalized === '3XC' ||
		normalized === 'TRIPLE_CAPTAIN'
	) {
		return t('pitchTripleCaptain')
	}
	if (normalized === 'WC' || normalized === 'WILDCARD')
		return t('pitchWildcard')
	if (
		normalized === 'FH' ||
		normalized === 'FREE_HIT' ||
		normalized === 'FREEHIT'
	) {
		return t('pitchFreeHit')
	}
	return chip ?? t('noActiveChips')
}

function isBenchBoostChip(chip: string | null | undefined): boolean {
	const normalized = chip?.toUpperCase().replace(/[\s-]+/g, '_') ?? ''
	return (
		normalized === 'BB' ||
		normalized === 'BBOOST' ||
		normalized === 'BENCH_BOOST'
	)
}

function benchFixtureLine(
	pick: TeamStatsViewModel['eventPicks'][number]
): string {
	const opponent = pick.againstShortName?.trim()
	if (!opponent) return ''
	const home = String(pick.wasHome).toUpperCase()
	const venue =
		home === 'TRUE' || home === '1' || home === 'H' || home === 'HOME'
			? 'H'
			: home === 'FALSE' || home === '0' || home === 'A' || home === 'AWAY'
				? 'A'
				: ''
	return venue ? `${opponent} (${venue})` : opponent
}

function pickElementId(pick: EventPickViewModel): string {
	return String(pick.element ?? pick.position)
}

function buildPitchPlayer(
	pick: EventPickViewModel,
	options?: { bench?: boolean; fixture?: string }
): SquadPitchPlayer | null {
	const position = positionCode(pick.elementTypeName)
	if (!position) return null

	const teamCode = resolveSquadTeamCode(pick.teamShortName, pick.teamName)
	const teamBadgeLabel = pick.teamShortName.trim().toUpperCase()

	return {
		id: options?.bench ? `bench-${pickElementId(pick)}` : pickElementId(pick),
		webName: pick.webName,
		score: pick.totalPoints,
		...(teamCode ? { teamCode } : { teamBadgeLabel }),
		position,
		fixture: options?.fixture,
		isCaptain: pick.isCaptain,
		isViceCaptain: pick.isViceCaptain,
	}
}

function buildPlayerDetail(pick: EventPickViewModel): PlayerDetail {
	return {
		id: pickElementId(pick),
		name: pick.webName,
		team: pick.teamName,
		teamShort: pick.teamShortName,
		position: positionCode(pick.elementTypeName) ?? 'MID',
		points: pick.totalPoints,
		ownershipPercentage: null,
		bps: pick.bps,
		bonusPoints: pick.bonus,
		playingStatus: pick.isPlayed ? 'FINISHED' : 'NOT_STARTED',
		breakdownSource: 'provisional',
		stats: {
			minutes: pick.minutes,
			goals: pick.goalsScored,
			assists: pick.assists,
			cleanSheets: pick.cleanSheets,
			saves: pick.saves,
			goalsConceded: pick.goalsConceded,
			yellowCards: pick.yellowCards,
			redCards: pick.redCards
		},
		pointsBreakdown: [
			{
				category: 'Total Points',
				points: pick.totalPoints
			}
		]
	}
}

export function TeamSquadPitch({ stats }: { stats: TeamStatsViewModel }) {
	const format = useFormatter()
	const locale = useLocale() as AppLocale
	const t = useTranslations('TeamStats')
	const shareRef = useRef<HTMLDivElement | null>(null)
	const [selectedPlayer, setSelectedPlayer] = useState<PlayerDetail | null>(null)
	const formatOverallRank = useCallback(
		(value: number) =>
			value <= 0 ? '—' : format.number(value, { notation: 'compact' }),
		[format]
	)

	const players = useMemo(
		() =>
			stats.eventPicks.flatMap(pick => {
				if (!isSquadStarter(pick)) return []
				const player = buildPitchPlayer(pick)
				return player ? [player] : []
			}),
		[stats.eventPicks]
	)
	const benchPicks = useMemo(
		() =>
			stats.eventPicks
				.filter(pick => !isSquadStarter(pick))
				.sort((a, b) => {
					const positionA = positionCode(a.elementTypeName)
					const positionB = positionCode(b.elementTypeName)
					return (
						POSITION_ORDER[positionA ?? 'FWD'] -
							POSITION_ORDER[positionB ?? 'FWD'] || a.position - b.position
					)
				}),
		[stats.eventPicks]
	)
	const benchPlayers = useMemo(
		() =>
			benchPicks.flatMap(pick => {
				const player = buildPitchPlayer(pick, {
					bench: true,
					fixture: benchFixtureLine(pick),
				})
				return player ? [player] : []
			}),
		[benchPicks]
	)
	const handlePitchPlayerClick = (playerId: string) => {
		const elementId = playerId.replace(/^bench-/, '')
		const pick = stats.eventPicks.find(
			item => pickElementId(item) === elementId
		)
		if (pick) setSelectedPlayer(buildPlayerDetail(pick))
	}
	const squadPitchLabels = {
		formation: t('squadFormation', { title: stats.teamName }),
		positions: {
			GKP: t('squadGoalkeeper'),
			DEF: t('squadDefenders'),
			MID: t('squadMidfielders'),
			FWD: t('squadForwards')
		},
		captain: t('captain'),
		viceCaptain: t('viceCaptain'),
		total: t('pitchTotalPoints'),
		playerDetails: (player: { webName: string }) =>
			t('viewPlayer', { player: player.webName })
	}
	const shareText = useMemo(() => {
		const origin =
			typeof window !== 'undefined'
				? window.location.origin
				: 'https://letletme.top'
		const shareUrl = new URL(
			localizePathname(teamStatsGameweekHref(stats.eventId), locale),
			origin
		).toString()
		const starters = players.map(player => {
			const role = player.isCaptain
				? ' (C)'
				: player.isViceCaptain
					? ' (V)'
					: ''
			return `- ${player.position} ${player.webName}${role} · ${player.score} pts`
		})
		const bench = benchPlayers.map(
			player =>
				`- ${player.position} ${player.webName} · ${player.score} pts${player.fixture ? ` · ${player.fixture}` : ''}`
		)
		return [
			`# ${stats.teamName} · GW${stats.eventId}`,
			stats.playerName,
			`${t('pitchTotalPoints')}: ${format.number(stats.overallPoints)} · ${t('pitchOverallRank')}: ${formatOverallRank(stats.overallRank)}`,
			`${t('pitchGameweekPoints')}: ${format.number(stats.eventPoints)} · ${t('pitchChip')}: ${formatChip(stats.eventChip, t)}`,
			'',
			t('startingEleven'),
			...starters,
			'',
			t('substitutes'),
			...bench,
			'',
			shareUrl
		]
			.filter(line => line != null)
			.join('\n')
	}, [benchPlayers, format, formatOverallRank, locale, players, stats, t])

	if (players.length === 0) return null

	return (
		<section
			aria-labelledby="team-formation-title"
			className="mb-5 sm:mb-6"
		>
			<div className="mb-3 flex items-baseline justify-between gap-3 px-0.5">
				<h2
					id="team-formation-title"
					className="font-display text-sm font-bold uppercase tracking-caps text-muted-foreground"
				>
					{t('startingEleven')}
				</h2>
				<span className="inline-flex items-center rounded-full border border-[#f8f6ef]/20 bg-[#38003c] px-2 py-1 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.12em] tabular-nums text-[#f8f6ef] shadow-sm">
					GW{stats.eventId}
				</span>
			</div>
			<div className="mb-3 flex justify-end">
				<ShareActions
					text={shareText}
					imageRef={shareRef}
					title={stats.teamName}
				/>
			</div>
			<div ref={shareRef}>
				<SquadPitch
					onPlayerClick={handlePitchPlayerClick}
					players={players}
					labels={squadPitchLabels}
					benchPlayers={benchPlayers}
					benchTitle={t('substitutes')}
					benchBoost={isBenchBoostChip(stats.eventChip)}
					benchBoostLabel={t('benchBoostShort')}
					benchPointsLabel={t('pointsShort')}
					title={stats.teamName}
					managerName={stats.playerName}
					headerStats={{
						eyebrow: `${t('pitchTotalPoints')} ${format.number(stats.overallPoints)} · ${t('pitchOverallRank')} ${formatOverallRank(stats.overallRank)}`,
						details: [
							{
								label: t('pitchGameweekPoints'),
								value: format.number(stats.eventPoints),
								accent: true
							},
							{
								label: t('pitchChip'),
								value: formatChip(stats.eventChip, t)
							}
						]
					}}
				/>
			</div>
			<PlayerDetailModal
				player={selectedPlayer}
				isOpen={selectedPlayer !== null}
				onClose={() => setSelectedPlayer(null)}
			/>
		</section>
	)
}
