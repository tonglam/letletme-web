'use client'

import {
	formatAvgFdr,
	orderFdrTeamsForDisplay,
	type TeamFdrRow,
} from '@/lib/fixtures-fdr'
import {
	formatSquadTeamExposure,
	type SquadTeamExposure,
} from '@/lib/squad-picks'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

const FDR_CELL: Record<number, string> = {
	1: 'border-success/40 bg-success/15 text-foreground',
	2: 'border-success/30 bg-success/10 text-foreground',
	3: 'border-border/70 bg-muted/40 text-foreground',
	4: 'border-warning/45 bg-warning/15 text-foreground',
	5: 'border-destructive/40 bg-destructive/15 text-foreground',
}

export function FdrMatrix({
	teams,
	sort,
	fromGw,
	horizon,
	mySquadExposure,
	focusedTeamId,
}: {
	teams: TeamFdrRow[]
	sort: 'easiest' | 'hardest'
	fromGw: number
	horizon: number
	mySquadExposure: Map<string, SquadTeamExposure>
	focusedTeamId: number | null
}) {
	const t = useTranslations('Fixtures')
	const ordered = orderFdrTeamsForDisplay(teams, sort)

	const eventIds = Array.from({ length: horizon }, (_, i) => fromGw + i).filter(
		id => id >= 1 && id <= 38,
	)

	if (ordered.length === 0) {
		return (
			<p className="rounded-md border border-dashed border-border/70 px-3 py-6 text-center text-xs text-muted-foreground">
				{t('emptyTeams')}
			</p>
		)
	}

	return (
		<div
			className="overflow-x-auto overscroll-x-contain rounded-lg border border-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			role="group"
			aria-label={t('teamsTitle')}
			tabIndex={0}
		>
			<table className="w-max min-w-full border-collapse text-left text-xs">
				<thead>
					<tr className="border-b border-border/60 bg-muted/20">
						<th
							scope="col"
							className="px-2 py-2 text-center font-mono text-label font-semibold tabular-nums text-muted-foreground"
						>
							{t('colRank')}
						</th>
						<th
							scope="col"
							className="sticky left-0 z-10 bg-muted/30 px-3 py-2 font-display text-label font-semibold uppercase tracking-caps text-muted-foreground backdrop-blur-sm"
						>
							{t('colTeam')}
						</th>
						<th
							scope="col"
							className="px-2 py-2 text-center font-mono text-label font-semibold tabular-nums text-muted-foreground"
						>
							{t('colAvg')}
						</th>
						{eventIds.map(gw => (
							<th
								key={gw}
								scope="col"
								className="min-w-[5.25rem] px-1.5 py-2 text-center font-mono text-label font-semibold tabular-nums text-muted-foreground"
							>
								GW{gw}
							</th>
						))}
						<th
							scope="col"
							className="px-2 py-2 text-center font-mono text-label font-semibold tabular-nums text-muted-foreground"
						>
							{t('colEasyHard')}
						</th>
					</tr>
				</thead>
				<tbody>
					{ordered.map((row, i) => {
						const exposure = mySquadExposure.get(
							row.teamShortName.trim().toLowerCase(),
						)
						const inSquad = exposure != null && exposure.count > 0
						const focused = focusedTeamId === row.teamId
						const byEvent = new Map(
							row.gameweeks.map(gameweek => [gameweek.eventId, gameweek]),
						)
						const exposureLabel = exposure
							? formatSquadTeamExposure(exposure)
							: null
						return (
							<tr
								key={row.teamId}
								id={`fdr-team-${row.teamId}`}
								className={cn(
									'border-b border-border/40 scroll-mt-24 last:border-b-0',
									inSquad && 'bg-primary/5',
									focused &&
										'bg-primary/10 ring-2 ring-inset ring-primary/40',
								)}
							>
								<td className="px-2 py-1.5 text-center font-mono text-caption tabular-nums text-muted-foreground">
									{i + 1}
								</td>
								<th
									scope="row"
									className={cn(
										'sticky left-0 z-10 bg-card/95 px-3 py-1.5 text-left font-display text-xs font-bold tracking-wide backdrop-blur-sm',
										inSquad && 'bg-primary/10',
										focused && 'bg-primary/10',
									)}
								>
									<span className="inline-flex flex-col items-start gap-0.5">
										<span className="inline-flex items-center gap-1.5">
											{row.teamShortName}
											{exposureLabel ? (
												<span
													className="rounded border border-primary/35 bg-primary/15 px-1 py-px font-mono text-micro font-semibold tabular-nums tracking-wide text-primary-ink"
													title={t('matrixMyTeamDetail', {
														count: exposure!.count,
														detail: exposureLabel,
													})}
												>
													{exposureLabel}
												</span>
											) : null}
										</span>
									</span>
								</th>
								<td className="px-2 py-1.5 text-center font-mono text-caption font-semibold tabular-nums text-primary-ink">
									{formatAvgFdr(row.avgFdr)}
								</td>
								{eventIds.map(gw => {
									const gameweek = byEvent.get(gw)
					if (gameweek?.unknown) {
						return (
							<td key={gw} className="px-1.5 py-1.5 text-center">
								<span className="inline-flex rounded border border-warning/40 bg-warning/10 px-1.5 py-1 font-mono text-micro font-semibold text-muted-foreground">
									{t('fixtureUnavailable')}
								</span>
							</td>
						)
					}
					if (!gameweek || gameweek.bgw) {
										return (
											<td
												key={gw}
												className="px-1.5 py-1.5 text-center"
											>
												<span className="inline-flex rounded border border-border/60 bg-muted/25 px-1.5 py-1 font-mono text-micro font-semibold text-muted-foreground">
													{t('bgw')}
												</span>
											</td>
										)
									}
									return (
										<td key={gw} className="px-1.5 py-1.5">
											<div className="flex flex-col gap-1">
												{gameweek.dgw ? (
													<span className="text-center font-mono text-micro font-semibold uppercase tracking-wide text-muted-foreground">
														{t('dgw')}
													</span>
												) : null}
												{gameweek.fixtures.map(cell => {
													const ha = cell.wasHome ? 'H' : 'A'
													return (
														<div
															key={cell.fixtureId}
															className={cn(
																'flex flex-col items-center justify-center gap-0.5 rounded-md border px-1 py-1',
																FDR_CELL[cell.difficulty] ??
																	'border-border/60 bg-muted/30',
															)}
															title={`GW${gw} · ${cell.opponentShortName} (${ha}) · FDR ${cell.difficulty}`}
														>
															<span className="font-display text-caption font-semibold leading-none tracking-wide">
																{cell.opponentShortName}
															</span>
															<span className="font-mono text-micro tabular-nums text-muted-foreground">
																{ha} · {cell.difficulty}
															</span>
														</div>
													)
												})}
											</div>
										</td>
									)
								})}
								<td className="px-2 py-1.5 text-center text-caption tabular-nums text-muted-foreground">
									<span className="font-medium text-success">
										{row.easyCount}
									</span>
									<span className="mx-0.5 text-border">/</span>
									<span className="font-medium text-destructive">
										{row.hardCount}
									</span>
								</td>
							</tr>
						)
					})}
				</tbody>
			</table>
		</div>
	)
}
