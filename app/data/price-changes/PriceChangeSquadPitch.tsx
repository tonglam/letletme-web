'use client'

import {
	SquadPitch,
	type SquadPitchPlayer,
	type SquadPosition
} from '@/components/squad-pitch/SquadPitch'
import { playerStatsHref } from '@/app/data/player-stats/_lib/player-stats-url'
import { Link } from '@/i18n/navigation'
import type { PriceChangePlayer } from '@/lib/graphql/operations/price-changes'
import {
	isSquadStarter,
	positionCodeFromElementTypeName,
	type SquadLoadState,
	type SquadPickSeed
} from '@/lib/squad-picks'
import { resolveSquadTeamCode } from '@/lib/squad-pitch-team-codes'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'

function formatProgress(value: number): string {
	if (Math.abs(value) < 0.05) return '0.0%'
	return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

function pitchPosition(value: string): SquadPosition {
	const code = positionCodeFromElementTypeName(value)
	return code === 'GKP' || code === 'DEF' || code === 'MID' || code === 'FWD'
		? code
		: 'MID'
}

function trendTone(
	player: PriceChangePlayer | undefined
): SquadPitchPlayer['scoreTone'] {
	if (player?.status.includes('RISE')) return 'positive'
	if (player?.status.includes('FALL')) return 'negative'
	return 'neutral'
}

function squadMatchKey(webName: string, teamShortName: string): string {
	return `${webName.trim().toLowerCase()}::${teamShortName.trim().toLowerCase()}`
}

export function PriceChangeSquadPitch({
	picks,
	players,
	squadState
}: {
	picks: readonly SquadPickSeed[]
	players: readonly PriceChangePlayer[]
	squadState: SquadLoadState
}) {
	const t = useTranslations('PriceChanges')
	const pitchData = useMemo(() => {
		const playerById = new Map(players.map(player => [player.playerId, player]))
		const playerByKey = new Map(
			players.map(player => [
				squadMatchKey(player.webName, player.teamShortName),
				player
			])
		)
		const toPitchPlayer = (
			pick: SquadPickSeed,
			index: number
		): SquadPitchPlayer => {
			const player =
				(pick.elementId != null ? playerById.get(pick.elementId) : undefined) ??
				playerByKey.get(squadMatchKey(pick.webName, pick.teamShortName))
			const progress = player?.progressPercent ?? 0
			const teamCode = resolveSquadTeamCode(
				player?.teamShortName ?? pick.teamShortName,
				player?.teamName
			)

			return {
				id: `${pick.elementId ?? squadMatchKey(pick.webName, pick.teamShortName)}-${index}`,
				webName: player?.webName ?? pick.webName,
				score: Math.round(Math.abs(progress)),
				scoreLabel: player ? formatProgress(progress) : '—',
				scoreTone: trendTone(player),
				...(player
					? { href: playerStatsHref({ p1: String(player.playerId) }) }
					: {}),
				position: pitchPosition(
					player?.position ??
						positionCodeFromElementTypeName(pick.elementTypeName)
				),
				...(teamCode
					? { teamCode }
					: { teamBadgeLabel: pick.teamShortName.trim().toUpperCase() }),
				isCaptain: pick.isCaptain,
				isViceCaptain: pick.isViceCaptain
			}
		}

		const starters: SquadPitchPlayer[] = []
		const bench: SquadPitchPlayer[] = []
		picks.forEach((pick, index) => {
			const player = toPitchPlayer(pick, index)
			if (isSquadStarter(pick)) starters.push(player)
			else bench.push(player)
		})
		return { starters, bench }
	}, [picks, players])

	if (picks.length === 0) {
		return (
			<div
				className="rounded-xl border border-dashed border-border/70 bg-card px-4 py-8 text-center text-sm text-muted-foreground"
				role={squadState === 'unavailable' ? 'alert' : 'status'}
			>
				{squadState === 'unavailable' ? (
					t('mySquadUnavailable')
				) : squadState === 'not-published' ? (
					t('mySquadNotPublished')
				) : (
					<>
						{t('mySquadEmpty')}{' '}
						<Link
							href="/onboarding/bind-entry"
							className="font-medium text-primary-ink underline-offset-2 hover:underline"
						>
							{t('mySquadBind')}
						</Link>
					</>
				)}
			</div>
		)
	}

	return (
		<div className="mx-auto w-full max-w-3xl">
			<SquadPitch
				players={pitchData.starters}
				benchPlayers={pitchData.bench}
				benchTitle={t('mySquadPitchBench')}
				benchPointsLabel={t('progress')}
				labels={{
					formation: t('mySquadPitchTitle'),
					positions: {
						GKP: t('goalkeeper'),
						DEF: t('defender'),
						MID: t('midfielder'),
						FWD: t('forward')
					},
					captain: t('captain'),
					viceCaptain: t('viceCaptain'),
					total: t('progress'),
					playerDetails: player =>
						t('mySquadPitchPlayerDetails', {
							player: player.webName,
							trend: player.scoreLabel ?? '—'
						})
				}}
				headerStats={{
					eyebrow: t('mySquadPitchEyebrow'),
					details: [
						{
							label: t('mySquadPitchPlayers'),
							value: String(picks.length),
							accent: true
						}
					]
				}}
				title={t('mySquadTab')}
				showHeader
				className="rounded-lg"
			/>
		</div>
	)
}
