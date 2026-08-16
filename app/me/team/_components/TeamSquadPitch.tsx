'use client'

import {
	SquadPitch,
	type SquadPitchPlayer,
	type SquadTeamCode
} from '@/components/squad-pitch/SquadPitch'
import { ShareActions } from '@/components/share/ShareActions'
import { localizePathname, type AppLocale } from '@/i18n/routing'
import { isSquadStarter } from '@/lib/squad-picks'
import type { TeamStatsViewModel } from '../_lib/team-stats-model'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import { useMemo, useRef } from 'react'

const TEAM_CODES: readonly SquadTeamCode[] = [
	'ARS',
	'AVL',
	'BOU',
	'BRE',
	'BHA',
	'CHE',
	'COV',
	'CRY',
	'EVE',
	'FUL',
	'HUL',
	'IPS',
	'LEE',
	'LIV',
	'MCI',
	'MUN',
	'NEW',
	'NFO',
	'SUN',
	'TOT'
]

const POSITION_ORDER: Record<SquadPitchPlayer['position'], number> = {
	GKP: 0,
	DEF: 1,
	MID: 2,
	FWD: 3
}

function teamCode(value: string): SquadTeamCode | null {
	const normalized = value.trim().toUpperCase()
	return TEAM_CODES.includes(normalized as SquadTeamCode)
		? (normalized as SquadTeamCode)
		: null
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

export function TeamSquadPitch({ stats }: { stats: TeamStatsViewModel }) {
	const format = useFormatter()
	const locale = useLocale() as AppLocale
	const t = useTranslations('TeamStats')
	const shareRef = useRef<HTMLDivElement | null>(null)

	const players = useMemo(
		() =>
			stats.eventPicks.flatMap(pick => {
				if (!isSquadStarter(pick)) return []
				const code = teamCode(pick.teamShortName)
				const position = positionCode(pick.elementTypeName)
				if (!code || !position) return []
				return [
					{
						id: String(pick.position),
						webName: pick.webName,
						score: pick.totalPoints,
						teamCode: code,
						position,
						isCaptain: pick.isCaptain,
						isViceCaptain: pick.isViceCaptain
					} satisfies SquadPitchPlayer
				]
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
				const code = teamCode(pick.teamShortName)
				const position = positionCode(pick.elementTypeName)
				if (!code || !position) return []
				return [
					{
						id: `bench-${pick.position}`,
						webName: pick.webName,
						score: pick.totalPoints,
						teamCode: code,
						position,
						fixture: benchFixtureLine(pick)
					} satisfies SquadPitchPlayer
				]
			}),
		[benchPicks]
	)
	const shareText = useMemo(() => {
		const origin =
			typeof window !== 'undefined'
				? window.location.origin
				: 'https://letletme.top'
		const shareUrl = new URL(
			localizePathname('/my-fpl/team', locale),
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
			`${t('pitchTotalPoints')}: ${format.number(stats.overallPoints)} · ${t('pitchOverallRank')}: ${format.number(stats.overallRank, { notation: 'compact' })}`,
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
	}, [benchPlayers, format, locale, players, stats, t])

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
				<span className="font-mono text-caption tabular-nums text-muted-foreground">
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
					players={players}
					benchPlayers={benchPlayers}
					benchTitle={t('substitutes')}
					benchBoost={isBenchBoostChip(stats.eventChip)}
					benchBoostLabel={t('benchBoostShort')}
					benchPointsLabel={t('pointsShort')}
					title={stats.teamName}
					managerName={stats.playerName}
					headerStats={{
						eyebrow: `${t('pitchTotalPoints')} ${format.number(stats.overallPoints)} · ${t('pitchOverallRank')} ${format.number(stats.overallRank, { notation: 'compact' })}`,
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
		</section>
	)
}
