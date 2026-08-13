'use client'

import {
	buildSquadFdrRows,
	formatAvgFdrOutOfFive,
	sortSquadForPlanning,
	type TeamFdrRow,
} from '@/lib/fixtures-fdr'
import { Link } from '@/i18n/navigation'
import { playerStatsHref } from '@/app/data/player-stats/_lib/player-stats-url'
import { positionBadgeClass } from '@/lib/position-style'
import type { SquadLoadState, SquadPickSeed } from '@/lib/squad-picks'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { useMemo } from 'react'
import { useTranslations } from 'next-intl'

const FDR_CELL: Record<number, string> = {
	1: 'border-success/40 bg-success/15 text-foreground',
	2: 'border-success/30 bg-success/10 text-foreground',
	3: 'border-border/70 bg-muted/40 text-foreground',
	4: 'border-warning/45 bg-warning/15 text-foreground',
	5: 'border-destructive/40 bg-destructive/15 text-foreground',
}

function PlayerNameLink({
	elementId,
	name,
	deskLabel,
}: {
	elementId: number | null
	name: string
	deskLabel: string
}) {
	const nameClass = 'text-sm font-semibold leading-snug tracking-tight'

	if (elementId == null) {
		return <span className={nameClass}>{name}</span>
	}

	return (
		<Link
			href={playerStatsHref({ p1: String(elementId) })}
			title={deskLabel}
			aria-label={`${name} — ${deskLabel}`}
			className={cn(
				nameClass,
				'text-primary-ink underline decoration-primary/35 underline-offset-2 transition-colors hover:decoration-primary hover:text-primary',
			)}
		>
			{name}
		</Link>
	)
}

export function MySquadFdrDesk({
	picks,
	teams,
	fromGw,
	horizon,
	hasLinkedEntry = false,
	squadState = hasLinkedEntry ? 'not-published' : 'unbound',
}: {
	picks: SquadPickSeed[]
	teams: TeamFdrRow[]
	fromGw: number
	horizon: number
	hasLinkedEntry?: boolean
	squadState?: SquadLoadState
}) {
	const t = useTranslations('Fixtures')

	const rows = useMemo(
		() => sortSquadForPlanning(buildSquadFdrRows(picks, teams)),
		[picks, teams],
	)
	const groups = useMemo(() => {
		const byTeam = new Map<
			number,
			{ team: (typeof rows)[number]; players: typeof rows }
		>()
		for (const row of rows) {
			const existing = byTeam.get(row.teamId)
			if (existing) existing.players.push(row)
			else byTeam.set(row.teamId, { team: row, players: [row] })
		}
		return Array.from(byTeam.values())
	}, [rows])

	const eventIds = useMemo(
		() =>
			Array.from({ length: horizon }, (_, i) => fromGw + i).filter(
				id => id >= 1 && id <= 38,
			),
		[fromGw, horizon],
	)

	if (picks.length === 0) {
		return (
			<p
				className="rounded-lg border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground"
				role={squadState === 'unavailable' ? 'alert' : 'status'}
			>
				{squadState === 'unavailable' ? (
					t('mySquadLoadFailed')
				) : squadState === 'not-published' ? (
					t('mySquadNotPublished')
				) : (
					<>
						{t('actionsMySquadEmpty')}{' '}
						<Link
							href="/onboarding/bind-entry"
							className="font-medium text-primary-ink underline-offset-2 hover:underline"
						>
							{t('actionsBindCta')}
						</Link>
					</>
				)}
			</p>
		)
	}

	if (rows.length === 0) {
		return (
			<p className="rounded-lg border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
				{t('mySquadNoTeams')}
			</p>
		)
	}

	return (
		<div
			className="overflow-x-auto overscroll-x-contain rounded-lg border border-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			role="group"
			aria-label={t('mySquadTitle')}
			tabIndex={0}
		>
			<table className="w-full border-collapse text-left text-xs">
				<thead>
					<tr className="border-b border-border/60 bg-muted/20">
						<th
							scope="col"
							className="sticky left-0 z-10 w-0 whitespace-nowrap bg-muted/30 px-3 py-2 font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground backdrop-blur-sm"
						>
							{t('mySquadColTeamPlayers')}
						</th>
						<th
							scope="col"
							className="w-0 whitespace-nowrap px-3 py-2 text-center font-mono text-[10px] font-semibold tabular-nums text-muted-foreground"
						>
							{t('colAvg')}
						</th>
						{eventIds.map(gw => (
							<th
								key={gw}
								scope="col"
								className="px-1.5 py-2 text-center font-mono text-[10px] font-semibold tabular-nums text-muted-foreground"
							>
								GW{gw}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{groups.map(({ team, players }) => (
						<tr
							key={team.teamId}
							className="border-b border-border/40 last:border-b-0"
						>
							<td className="sticky left-0 z-[1] w-0 min-w-[13rem] bg-background px-3 py-2.5 backdrop-blur-sm">
								<div className="mb-2 flex items-center gap-2">
									<span className="font-display text-sm font-bold tracking-wide">
										{team.teamShortName}
									</span>
									<span className="rounded border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
										{t(`fixtureBand.${team.fixtureBand}`)}
									</span>
								</div>
								<div className="space-y-1.5">
									{players.map(player => (
										<div
											key={`${player.elementId ?? player.webName}-${player.position}`}
											className="flex items-center gap-2"
										>
											<Badge
												className={cn(
													positionBadgeClass(player.positionCode),
													'shrink-0 px-1.5 py-0 text-[10px] font-bold',
												)}
											>
												{player.positionCode}
											</Badge>
											<PlayerNameLink
												elementId={player.elementId}
												name={player.webName}
												deskLabel={t('openPlayerDesk')}
											/>
										</div>
									))}
								</div>
							</td>
							<td className="w-0 whitespace-nowrap px-3 py-2.5 text-center font-mono text-xs font-semibold tabular-nums">
								{formatAvgFdrOutOfFive(team.avgFdr)}
							</td>
							{eventIds.map(gw => {
								const gameweek = team.gameweeks.find(item => item.eventId === gw)
								if (!gameweek || gameweek.bgw) {
									return (
										<td
											key={gw}
											className="px-1.5 py-2.5 text-center text-muted-foreground"
										>
											<span className="inline-flex rounded border border-border/60 bg-muted/25 px-1.5 py-1 font-mono text-[9px] font-semibold text-muted-foreground">
												{t('bgw')}
											</span>
										</td>
									)
								}
								return (
									<td key={gw} className="px-1.5 py-2.5 text-center">
										<div className="flex flex-col items-center gap-1">
											{gameweek.dgw ? (
												<span className="font-mono text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">
													{t('dgw')}
												</span>
											) : null}
											{gameweek.fixtures.map(cell => (
												<span
													key={cell.fixtureId}
													className={cn(
														'inline-flex min-w-[2.75rem] flex-col items-center rounded border px-1.5 py-1 font-mono text-[10px] font-semibold leading-tight',
														FDR_CELL[cell.difficulty],
													)}
												>
													<span>{cell.opponentShortName}</span>
													<span className="text-[9px] opacity-80">
														{cell.wasHome ? 'H' : 'A'}
													</span>
												</span>
											))}
										</div>
									</td>
								)
							})}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}
