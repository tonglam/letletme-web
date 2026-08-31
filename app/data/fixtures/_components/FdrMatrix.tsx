'use client'

import { Input } from '@/components/ui/input'
import {
	formatAvgFdrOutOfFive,
	orderFdrTeamsForDisplay,
	type TeamFdrRow
} from '@/lib/fixtures-fdr'
import {
	formatSquadTeamExposure,
	type SquadTeamExposure
} from '@/lib/squad-picks'
import { cn } from '@/lib/utils'
import { Search, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { TeamFdrDetailDialog } from './TeamFdrDetailDialog'

const FDR_CELL: Record<number, string> = {
	1: 'border-success/40 bg-success/15 text-foreground',
	2: 'border-success/30 bg-success/10 text-foreground',
	3: 'border-border/70 bg-muted/40 text-foreground',
	4: 'border-warning/45 bg-warning/15 text-foreground',
	5: 'border-destructive/40 bg-destructive/15 text-foreground'
}

const FDR_TEAM_CELL: Record<number, string> = {
	1: 'border-l-4 border-success bg-success/40',
	2: 'border-l-4 border-success/80 bg-success/25',
	3: 'border-l-4 border-muted-foreground/50 bg-muted/70',
	4: 'border-l-4 border-warning bg-warning/35',
	5: 'border-l-4 border-destructive bg-destructive/35'
}

function fdrTier(value: number | null): number | null {
	if (value == null || !Number.isFinite(value)) return null
	return Math.min(5, Math.max(1, Math.round(value)))
}

function fixtureScore(
	cell: TeamFdrRow['gameweeks'][number]['fixtures'][number]
): string | null {
	if (
		typeof cell.homeScore !== 'number' ||
		typeof cell.awayScore !== 'number'
	) {
		return null
	}

	const ownScore = cell.wasHome ? cell.homeScore : cell.awayScore
	const opponentScore = cell.wasHome ? cell.awayScore : cell.homeScore
	return `${ownScore}–${opponentScore}`
}

function HighlightedTeamName({
	name,
	query,
	highlightWholeName = false
}: {
	name: string
	query: string
	highlightWholeName?: boolean
}) {
	if (!query) return <>{name}</>

	const matchIndex = name.toLowerCase().indexOf(query)
	if (matchIndex < 0) {
		return highlightWholeName ? (
			<mark className="rounded-sm bg-success/25 px-0.5 text-primary-ink">
				{name}
			</mark>
		) : (
			<>{name}</>
		)
	}

	return (
		<>
			{name.slice(0, matchIndex)}
			<mark className="rounded-sm bg-success/25 px-0.5 text-primary-ink">
				{name.slice(matchIndex, matchIndex + query.length)}
			</mark>
			{name.slice(matchIndex + query.length)}
		</>
	)
}

function FdrAverageCell({
	value,
	label
}: {
	value: number | null
	label: string
}) {
	if (value == null) {
		return (
			<span
				className="font-mono text-caption tabular-nums text-muted-foreground"
				aria-label={`${label} —`}
			>
				—
			</span>
		)
	}

	const bounded = Math.min(5, Math.max(1, value))
	// Keep the marker inside the track while preserving the exact decimal value.
	const markerPosition = (2 + ((bounded - 1) / 4) * 96).toFixed(2)
	const formatted = formatAvgFdrOutOfFive(value)

	return (
		<div
			className="mx-auto flex min-w-[4.75rem] flex-col items-center gap-1"
			aria-label={`${label} ${formatted}`}
			title={`${label}: ${formatted}`}
			data-fdr-average={formatted}
		>
			<span className="font-mono text-caption font-semibold tabular-nums text-primary-ink">
				{formatted}
			</span>
			<span
				className="relative block h-1.5 w-[4.5rem] overflow-hidden rounded-full bg-muted/70"
				aria-hidden="true"
			>
				<span className="absolute inset-0 bg-gradient-to-r from-success/80 via-warning/80 to-destructive/80" />
				<span
					className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-foreground shadow-sm"
					style={{ left: `${markerPosition}%` }}
				/>
			</span>
		</div>
	)
}

export function FdrMatrix({
	teams,
	sort,
	fromGw,
	horizon,
	mySquadExposure,
	focusedTeamId
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
	const [selectedTeam, setSelectedTeam] = useState<TeamFdrRow | null>(null)
	const [searchTerm, setSearchTerm] = useState('')
	const normalizedSearch = searchTerm.trim().toLowerCase()

	const eventIds = Array.from({ length: horizon }, (_, i) => fromGw + i).filter(
		id => id >= 1 && id <= 38
	)
	const rankByTeamId = new Map(
		ordered.map((row, index) => [row.teamId, index + 1])
	)
	const matchingTeams = normalizedSearch
		? ordered.filter(row => {
			const teamName = (row.teamName.trim() || row.teamShortName).toLowerCase()
			const teamShortName = row.teamShortName.trim().toLowerCase()
			return (
				teamName.includes(normalizedSearch) ||
				teamShortName.includes(normalizedSearch)
			)
		})
		: ordered

	if (ordered.length === 0) {
		return (
			<p className="rounded-md border border-dashed border-border/70 px-3 py-6 text-center text-xs text-muted-foreground">
				{t('emptyTeams')}
			</p>
		)
	}

	return (
		<>
			<div
				data-share-exclude="true"
				className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
			>
				<div className="relative w-full sm:max-w-xs">
					<Search
						aria-hidden="true"
						className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
					/>
					<Input
						type="search"
						value={searchTerm}
						maxLength={80}
						aria-label={t('teamSearchLabel')}
						aria-describedby={
							normalizedSearch ? 'fdr-team-search-status' : undefined
						}
						placeholder={t('teamSearchPlaceholder')}
						onChange={event => setSearchTerm(event.target.value)}
						className="h-9 pl-9 pr-9 text-sm"
					/>
					{searchTerm ? (
						<button
							type="button"
							aria-label={t('clearTeamSearch')}
							onClick={() => setSearchTerm('')}
							className="absolute right-2 top-1/2 flex min-h-6 min-w-6 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							<X aria-hidden="true" className="size-4" />
						</button>
					) : null}
				</div>
				{normalizedSearch ? (
					<p
						id="fdr-team-search-status"
						role="status"
						className="text-caption text-muted-foreground sm:text-right"
					>
						{t('teamSearchResults', { count: matchingTeams.length })}
					</p>
				) : null}
			</div>

			{matchingTeams.length === 0 ? (
				<p className="rounded-md border border-dashed border-border/70 px-3 py-6 text-center text-xs text-muted-foreground">
					{t('teamSearchNoResults')}
				</p>
			) : (
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
						{matchingTeams.map(row => {
							const exposure = mySquadExposure.get(
								row.teamShortName.trim().toLowerCase()
							)
							const inSquad = exposure != null && exposure.count > 0
								const focused = focusedTeamId === row.teamId
								const averageFdrTier = fdrTier(row.avgFdr)
								const teamName = row.teamName.trim() || row.teamShortName
								const shortNameMatches = row.teamShortName
									.trim()
									.toLowerCase()
									.includes(normalizedSearch)
								const byEvent = new Map(
								row.gameweeks.map(gameweek => [gameweek.eventId, gameweek])
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
										focused && 'bg-primary/10 ring-2 ring-inset ring-primary/40',
									normalizedSearch && 'bg-success/10'
								)}
								data-team-search-match={normalizedSearch ? 'true' : undefined}
							>
									<td className="px-2 py-1.5 text-center font-mono text-caption tabular-nums text-muted-foreground">
										{rankByTeamId.get(row.teamId)}
									</td>
									<th
										scope="row"
										className={cn(
											'sticky left-0 z-10 cursor-pointer px-3 py-1.5 text-left font-display text-xs font-bold tracking-wide backdrop-blur-sm',
											averageFdrTier == null
												? 'border-l-4 border-border/70 bg-card/95'
												: FDR_TEAM_CELL[averageFdrTier],
											focused && 'ring-2 ring-inset ring-primary/50'
										)}
										title={
											row.avgFdr == null
												? teamName
												: `${teamName} · FDR ${formatAvgFdrOutOfFive(row.avgFdr)}`
										}
									>
										<button
											type="button"
											onClick={() => setSelectedTeam(row)}
											aria-label={t('openTeamFixtureDetail', {
												team: row.teamName
											})}
											className="flex w-full min-w-0 flex-col items-start gap-0.5 rounded-md text-left transition-colors hover:text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
										>
											<span className="whitespace-nowrap font-display text-xs font-bold leading-tight tracking-wide">
												<HighlightedTeamName
													name={teamName}
													query={normalizedSearch}
													highlightWholeName={shortNameMatches}
												/>
											</span>
											{exposureLabel ? (
												<span
													className="mt-0.5 inline-flex rounded border border-primary/35 bg-primary/15 px-1 py-px font-mono text-[0.625rem] font-medium leading-3 tabular-nums tracking-wide text-primary-ink"
													title={t('matrixMyTeamDetail', {
														count: exposure!.count,
														detail: exposureLabel
													})}
												>
													{exposureLabel}
												</span>
											) : null}
										</button>
									</th>
									<td className="px-2 py-1.5 text-center">
										<FdrAverageCell
											value={row.avgFdr}
											label={t('colAvg')}
										/>
									</td>
									{eventIds.map(gw => {
										const gameweek = byEvent.get(gw)
										if (
											gameweek?.unknown &&
											gameweek.fixtures.length === 0
										) {
											return (
												<td
													key={gw}
													className="px-1.5 py-1.5 text-center"
												>
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
											<td
												key={gw}
												className="px-1.5 py-1.5"
											>
												<div className="flex flex-col gap-1">
													{gameweek.unknown ? (
														<span
															title={t('fixtureUnavailable')}
															aria-label={t('fixtureUnavailable')}
															className="mx-auto inline-flex rounded border border-warning/40 bg-warning/10 px-1 py-px font-mono text-[0.55rem] font-semibold leading-none text-muted-foreground"
														>
															?
														</span>
													) : null}
													{gameweek.dgw ? (
														<span className="text-center font-mono text-micro font-semibold uppercase tracking-wide text-muted-foreground">
															{t('dgw')}
														</span>
													) : null}
													{gameweek.fixtures.map(cell => {
														const ha = cell.wasHome ? 'H' : 'A'
														const score = fixtureScore(cell)
														const value = cell.finished
															? (score ?? t('fixtureScorePending'))
															: cell.started && score
																? score
																: `FDR ${cell.difficulty}`
														return (
															<div
																key={cell.fixtureId}
																className={cn(
																	'flex flex-col items-center justify-center gap-0.5 rounded-md border px-1 py-1',
																	FDR_CELL[cell.difficulty] ??
																		'border-border/60 bg-muted/30'
																)}
																title={`GW${gw} · ${cell.opponentShortName} (${ha}) · ${value}`}
															>
																<span className="font-display text-caption font-semibold leading-none tracking-wide">
																	{cell.opponentShortName}
																</span>
																<span className="font-mono text-micro tabular-nums text-muted-foreground">
																	{ha} · {value}
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
			)}
			<TeamFdrDetailDialog
				team={selectedTeam}
				open={selectedTeam !== null}
				onOpenChange={open => {
					if (!open) setSelectedTeam(null)
				}}
			/>
		</>
	)
}
