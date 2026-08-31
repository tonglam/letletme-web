'use client'

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle
} from '@/components/ui/dialog'
import { ShareActions } from '@/components/share/ShareActions'
import {
	buildTeamFdrRows,
	formatAvgFdrOutOfFive,
	type FdrPlanningFixture,
	type TeamFdrRow,
	type TeamFixtureCell
} from '@/lib/fixtures-fdr'
import {
	isFixtureWindowResponse,
	type FixturePlanningFixture,
	type FixtureWindowResponse
} from '@/lib/fixture-window'
import { mergeFixtureWindowSchedules } from '@/lib/fixture-window-schedule'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const FULL_SEASON_EVENT_IDS = Array.from(
	{ length: 38 },
	(_, index) => index + 1
)
const FULL_SEASON_WINDOWS = Array.from({ length: 8 }, (_, index) => {
	const fromGw = index * 5 + 1
	return {
		fromGw,
		count: Math.min(5, 39 - fromGw)
	}
})

type FullSeasonSchedule = {
	fixturesByEvent: Map<number, FdrPlanningFixture[]>
	unavailableEventIds: ReadonlySet<number>
	failedWindowCount: number
}

function toPlanningFixture(
	fixture: FixturePlanningFixture
): FdrPlanningFixture {
	return {
		id: fixture.id,
		finished: fixture.finished,
		started: fixture.started,
		homeTeam: fixture.homeTeam,
		awayTeam: fixture.awayTeam,
		homeScore: fixture.homeScore,
		awayScore: fixture.awayScore,
		homeTeamDifficulty: fixture.homeTeamDifficulty,
		awayTeamDifficulty: fixture.awayTeamDifficulty
	}
}

async function requestFixtureWindow(
	window: { fromGw: number; count: number },
	signal: AbortSignal
): Promise<FixtureWindowResponse> {
	const response = await fetch(
		'/api/fixtures/window?fromGw=' +
			String(window.fromGw) +
			'&count=' +
			String(window.count),
		{
			signal,
			headers: { accept: 'application/json' }
		}
	)
	const payload: unknown = await response.json().catch(() => null)
	if (!response.ok || !isFixtureWindowResponse(payload)) {
		throw new Error('fixture window unavailable')
	}
	return payload
}

function mergeFullSeasonSchedule(
	results: PromiseSettledResult<FixtureWindowResponse>[],
	previous: FullSeasonSchedule | null = null
): FullSeasonSchedule {
	return mergeFixtureWindowSchedules(
		results,
		FULL_SEASON_WINDOWS,
		fixtures => fixtures.map(toPlanningFixture),
		previous
	)
}

function teamFixtureScore(cell: TeamFixtureCell): string | null {
	if (
		typeof cell.homeScore !== 'number' ||
		typeof cell.awayScore !== 'number'
	) {
		return null
	}
	const ownScore = cell.wasHome ? cell.homeScore : cell.awayScore
	const opponentScore = cell.wasHome ? cell.awayScore : cell.homeScore
	return String(ownScore) + '–' + String(opponentScore)
}

function TeamFixtureDetailRow({
	eventId,
	gameweek,
	t
}: {
	eventId: number
	gameweek: TeamFdrRow['gameweeks'][number]
	t: ReturnType<typeof useTranslations<'Fixtures'>>
}) {
	const averageFdr =
		gameweek.fixtures.length > 0
			? gameweek.fixtures.reduce((sum, cell) => sum + cell.difficulty, 0) /
				gameweek.fixtures.length
			: null

	return (
		<article className="rounded-xl border border-border/70 bg-muted/10 p-2.5 sm:p-3">
			<div className="flex items-center justify-between gap-2">
				<div className="flex min-w-0 items-center gap-1.5">
					<span className="font-display text-sm font-bold tracking-wide">
						GW{eventId}
					</span>
					{gameweek.dgw ? (
						<span className="rounded-md border border-primary/25 bg-primary/10 px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold uppercase text-primary-ink">
							{t('dgw')}
						</span>
					) : null}
				</div>
				{averageFdr != null ? (
					<span className="shrink-0 font-mono text-caption font-semibold tabular-nums text-muted-foreground">
						{t('fixtureAverage', {
							value: formatAvgFdrOutOfFive(averageFdr)
						})}
					</span>
				) : null}
			</div>

			{gameweek.unknown ? (
				<p className="mt-2 rounded-lg border border-dashed border-warning/45 bg-warning/5 px-2.5 py-2 text-caption text-muted-foreground">
					{t('fixtureUnavailable')}
				</p>
			) : gameweek.fixtures.length === 0 ? (
				<p className="mt-2 rounded-lg border border-dashed border-border/70 px-2.5 py-2 text-caption text-muted-foreground">
					{t('bgw')}
				</p>
			) : (
				<div className="mt-2 grid gap-1.5">
					{gameweek.fixtures.map(cell => {
						const score = teamFixtureScore(cell)
						const status = cell.finished
							? t('fixtureFinished')
							: cell.started
								? t('fixtureLive')
								: t('fixtureUpcoming')

						return (
							<div
								key={cell.fixtureId}
								className={cn(
									'rounded-lg border px-2.5 py-2',
									cell.difficulty <= 2
										? 'border-success/40 bg-success/15'
										: cell.difficulty >= 4
											? 'border-destructive/40 bg-destructive/15'
											: 'border-border/70 bg-muted/40'
								)}
							>
								<div className="flex items-center justify-between gap-2">
									<span className="min-w-0 truncate font-display text-sm font-bold tracking-wide">
										{cell.opponentShortName}
									</span>
									<span className="shrink-0 rounded-md border border-current/20 px-1.5 py-0.5 font-mono text-[0.65rem] font-bold uppercase tabular-nums">
										{cell.wasHome ? 'H' : 'A'}
									</span>
								</div>
								<div className="mt-1 flex items-baseline justify-between gap-2">
									<span className="font-display text-sm font-bold tabular-nums">
										{cell.finished
											? (score ?? t('fixtureScorePending'))
											: cell.started && score
												? score
												: t('fixtureDifficulty', {
														difficulty: cell.difficulty
													})}
									</span>
									<span className="shrink-0 font-mono text-[0.65rem] font-semibold text-muted-foreground">
										{status}
									</span>
								</div>
							</div>
						)
					})}
				</div>
			)}
		</article>
	)
}

function FullSeasonSchedule({
	row,
	schedule,
	state,
	t,
	onRetry
}: {
	row: TeamFdrRow | null
	schedule: FullSeasonSchedule | null
	state: 'idle' | 'loading' | 'ready' | 'error'
	t: ReturnType<typeof useTranslations<'Fixtures'>>
	onRetry: () => void
}) {
	if (state === 'error') {
		return (
			<div
				className="rounded-xl border border-dashed border-destructive/40 bg-destructive/5 px-4 py-5 text-center"
				role="alert"
			>
				<p className="text-sm text-muted-foreground">
					{t('teamScheduleLoadFailed')}
				</p>
				<button
					type="button"
					className="mt-3 rounded-md border border-border/70 bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					onClick={onRetry}
				>
					{t('retrySchedule')}
				</button>
			</div>
		)
	}

	if (state !== 'ready' || !schedule || !row) {
		return (
			<div
				className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-5"
				role="status"
				aria-live="polite"
			>
				<p className="text-sm text-muted-foreground">
					{t('teamScheduleLoading')}
				</p>
				<div
					className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-8"
					aria-hidden="true"
				>
					{Array.from({ length: 8 }, (_, index) => (
						<span
							key={index}
							className="h-1.5 animate-pulse rounded-full bg-border/70"
						/>
					))}
				</div>
			</div>
		)
	}

	return (
		<div className="space-y-3">
			{schedule.failedWindowCount > 0 ? (
				<div
					className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/35 bg-warning/10 px-3 py-2 text-xs text-foreground"
					role="status"
				>
					<span>
						{t('teamSchedulePartial', {
							failed: schedule.failedWindowCount,
							total: FULL_SEASON_WINDOWS.length
						})}
					</span>
					<button
						type="button"
						className="rounded-md border border-border/70 bg-background px-2.5 py-1 font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						onClick={onRetry}
					>
						{t('retrySchedule')}
					</button>
				</div>
			) : null}
			<div
				className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 lg:grid-cols-4"
				aria-label={t('teamDetailDescription')}
			>
				{FULL_SEASON_EVENT_IDS.map(eventId => (
					<TeamFixtureDetailRow
						key={eventId}
						eventId={eventId}
						gameweek={row.gameweeks[eventId - 1]!}
						t={t}
					/>
				))}
			</div>
		</div>
	)
}

export function TeamFdrDetailDialog({
	team,
	open,
	onOpenChange
}: {
	team: TeamFdrRow | null
	open: boolean
	onOpenChange: (open: boolean) => void
}) {
	const t = useTranslations('Fixtures')
	const [schedule, setSchedule] = useState<FullSeasonSchedule | null>(null)
	const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>(
		'idle'
	)
	const promiseRef = useRef<Promise<FullSeasonSchedule | null> | null>(null)
	const abortRef = useRef<AbortController | null>(null)
	const shareRef = useRef<HTMLDivElement | null>(null)

	const loadFullSeasonSchedule = useCallback(
		(force = false) => {
			if (!force && schedule && schedule.failedWindowCount === 0) {
				return Promise.resolve(schedule)
			}
			if (promiseRef.current) return promiseRef.current

			const controller = new AbortController()
			const previousSchedule = schedule
			abortRef.current = controller
			setState('loading')

			const promise = Promise.allSettled(
				FULL_SEASON_WINDOWS.map(window =>
					requestFixtureWindow(window, controller.signal)
				)
			)
				.then(results => {
					if (controller.signal.aborted) return null
					if (!results.some(result => result.status === 'fulfilled')) {
						if (!previousSchedule) {
							throw new Error('full season fixture schedule unavailable')
						}
						const retainedSchedule = {
							...previousSchedule,
							failedWindowCount: FULL_SEASON_WINDOWS.length
						}
						setSchedule(retainedSchedule)
						setState('ready')
						return retainedSchedule
					}

					const nextSchedule = mergeFullSeasonSchedule(
						results,
						previousSchedule
					)
					setSchedule(nextSchedule)
					setState('ready')
					return nextSchedule
				})
				.catch(() => {
					if (!controller.signal.aborted) setState('error')
					return null
				})
				.finally(() => {
					if (promiseRef.current === promise) {
						promiseRef.current = null
						abortRef.current = null
					}
				})

			promiseRef.current = promise
			return promise
		},
		[schedule]
	)

	useEffect(() => {
		if (open && team) void loadFullSeasonSchedule()
	}, [loadFullSeasonSchedule, open, team])

	useEffect(() => {
		return () => {
			abortRef.current?.abort()
		}
	}, [])

	const detailRow = useMemo(() => {
		if (!team || !schedule) return null
		const rows = buildTeamFdrRows(
			schedule.fixturesByEvent,
			1,
			38,
			[
				{
					id: team.teamId,
					name: team.teamName,
					shortName: team.teamShortName
				}
			],
			schedule.unavailableEventIds
		)
		return rows.find(row => row.teamId === team.teamId) ?? null
	}, [schedule, team])

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
		>
			<DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-5xl overflow-y-auto overscroll-contain p-4 sm:p-6">
				{team ? (
					<div
						ref={shareRef}
						data-share-fit-content="true"
						data-share-preserve-width="true"
						className="space-y-4 bg-background"
					>
						<DialogHeader className="pr-8">
							<div className="flex items-start justify-between gap-3">
								<DialogTitle className="flex min-w-0 flex-wrap items-center gap-2 font-display tracking-wide">
									<span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-label font-bold tracking-wide text-primary-ink">
										{team.teamShortName}
									</span>
									<span>{team.teamName}</span>
								</DialogTitle>
								{state === 'ready' && detailRow ? (
									<ShareActions
										actions={['image']}
										imageRef={shareRef}
										title={`${team.teamName} · ${t('teamsTitle')}`}
										compact
									/>
								) : null}
							</div>
							<DialogDescription className="sr-only">
								{team.teamName} · GW1–GW38
							</DialogDescription>
						</DialogHeader>

						<FullSeasonSchedule
							row={detailRow}
							schedule={schedule}
							state={state}
							t={t}
							onRetry={() => void loadFullSeasonSchedule(true)}
						/>
					</div>
				) : null}
			</DialogContent>
		</Dialog>
	)
}
