'use client'

import {
	SquadPitch,
	type SquadPitchFixture,
	type SquadPitchPlayer
} from '@/components/squad-pitch/SquadPitch'
import { ShareActions } from '@/components/share/ShareActions'
import { Badge } from '@/components/ui/badge'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle
} from '@/components/ui/dialog'
import { Link } from '@/i18n/navigation'
import { positionBadgeClass } from '@/lib/position-style'
import { resolveSquadTeamCode } from '@/lib/squad-pitch-team-codes'
import type { SquadLoadState, SquadPickSeed } from '@/lib/squad-picks'
import {
	isFixtureWindowResponse,
	type FixturePlanningFixture,
	type FixtureWindowResponse
} from '@/lib/fixture-window'
import {
	buildSquadFdrRows,
	sortSquadForPlanning,
	type SquadFdrRow,
	type TeamFdrRow
} from '@/lib/fixtures-fdr'
import { cn } from '@/lib/utils'
import { CalendarDays } from 'lucide-react'
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type RefObject
} from 'react'
import { useTranslations } from 'next-intl'

const FDR_CELL: Record<number, string> = {
	1: 'border-success/40 bg-success/15 text-foreground',
	2: 'border-success/30 bg-success/10 text-foreground',
	3: 'border-border/70 bg-muted/40 text-foreground',
	4: 'border-warning/45 bg-warning/15 text-foreground',
	5: 'border-destructive/40 bg-destructive/15 text-foreground'
}

type PitchPosition = SquadPitchPlayer['position']

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
	fixturesByEvent: Map<number, FixturePlanningFixture[]>
	unavailableEventIds: ReadonlySet<number>
}

function pitchPosition(value: string): PitchPosition {
	const normalized = value.trim().toUpperCase()
	if (normalized === 'GKP' || normalized === 'GOALKEEPER') return 'GKP'
	if (normalized === 'DEF' || normalized === 'DEFENDER') return 'DEF'
	if (normalized === 'MID' || normalized === 'MIDFIELDER') return 'MID'
	if (normalized === 'FWD' || normalized === 'FORWARD') return 'FWD'
	return 'MID'
}

function rowId(row: SquadFdrRow): string {
	return row.elementId != null
		? String(row.elementId)
		: `${row.position}-${row.webName}-${row.teamShortName}`
}

function clampFdr(value: number): number {
	return Math.min(5, Math.max(1, Math.round(value)))
}

function buildPitchSchedule(
	row: SquadFdrRow,
	eventIds: number[],
	labels: { blank: string; unavailable: string }
): SquadPitchFixture[] {
	return eventIds.map(eventId => {
		const gameweek = row.gameweeks.find(item => item.eventId === eventId)
		const idPrefix = `${rowId(row)}-${eventId}`

		if (gameweek?.unknown) {
			return {
				id: `${idPrefix}-unknown`,
				eventId,
				value: '?',
				label: `GW${eventId} · ${labels.unavailable}`,
				difficulty: null,
				status: 'unknown'
			}
		}

		if (!gameweek || gameweek.bgw || gameweek.fixtures.length === 0) {
			return {
				id: `${idPrefix}-blank`,
				eventId,
				value: '—',
				label: `GW${eventId} · ${labels.blank}`,
				difficulty: null,
				status: 'blank'
			}
		}

		const difficulty = clampFdr(
			gameweek.averageFdr ??
				gameweek.fixtures.reduce(
					(sum, fixture) => sum + fixture.difficulty,
					0
				) / gameweek.fixtures.length
		)
		const values = gameweek.fixtures.map(fixture => String(fixture.difficulty))
		const details = gameweek.fixtures.map(
			fixture =>
				`${fixture.opponentShortName} ${fixture.wasHome ? 'H' : 'A'} · FDR ${fixture.difficulty}`
		)

		return {
			id: `${idPrefix}-${gameweek.fixtures.map(fixture => fixture.fixtureId).join('-')}`,
			eventId,
			value: values.join('/'),
			label: `GW${eventId} · ${details.join(' · ')}`,
			difficulty,
			status: 'fixture'
		}
	})
}

function fixtureForTeam(fixture: FixturePlanningFixture, teamId: number) {
	const isHome = fixture.homeTeam.id === teamId
	const isAway = fixture.awayTeam.id === teamId
	if (!isHome && !isAway) return null

	return {
		fixture,
		isHome,
		opponent: isHome ? fixture.awayTeam : fixture.homeTeam,
		difficulty: clampFdr(
			isHome ? fixture.homeTeamDifficulty : fixture.awayTeamDifficulty
		)
	}
}

function fixtureScore(
	fixture: FixturePlanningFixture,
	isHome: boolean
): string | null {
	const ownScore = isHome ? fixture.homeScore : fixture.awayScore
	const opponentScore = isHome ? fixture.awayScore : fixture.homeScore
	if (typeof ownScore !== 'number' || typeof opponentScore !== 'number') {
		return null
	}
	return `${ownScore}–${opponentScore}`
}

function CompactFixtureRow({
	eventId,
	fixtures,
	unknown,
	teamId,
	t
}: {
	eventId: number
	fixtures: FixturePlanningFixture[]
	unknown: boolean
	teamId: number
	t: ReturnType<typeof useTranslations<'Fixtures'>>
}) {
	const teamFixtures = fixtures
		.map(fixture => fixtureForTeam(fixture, teamId))
		.filter(
			(fixture): fixture is NonNullable<typeof fixture> => fixture !== null
		)

	return (
		<li className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-2 border-b border-border/60 py-1.5 last:border-b-0 sm:grid-cols-[4rem_minmax(0,1fr)] sm:gap-3">
			<span className="font-mono text-caption font-bold tabular-nums text-muted-foreground">
				GW{eventId}
			</span>
			<div className="flex min-w-0 flex-wrap gap-1.5">
				{unknown ? (
					<span
						title={t('fixtureUnavailable')}
						className="inline-flex items-center rounded-md border border-warning/45 bg-warning/10 px-2 py-1 font-mono text-label font-bold tabular-nums text-foreground"
					>
						?
					</span>
				) : teamFixtures.length === 0 ? (
					<span className="inline-flex items-center rounded-md border border-dashed border-border/70 px-2 py-1 font-mono text-label font-semibold text-muted-foreground">
						{t('bgw')}
					</span>
				) : (
					teamFixtures.map(({ fixture, isHome, opponent, difficulty }) => {
						const score = fixtureScore(fixture, isHome)
						const value =
							fixture.finished || (fixture.started && score)
								? (score ?? '—')
								: `FDR ${difficulty}`
						const venue = isHome
							? t('fixtureHomeShort')
							: t('fixtureAwayShort')

						return (
							<span
								key={fixture.id}
								title={`${opponent.name} · ${venue} · ${value}`}
								aria-label={`${opponent.name} · ${venue} · ${value}`}
								className={cn(
									'inline-flex min-w-[7.25rem] items-center gap-1.5 rounded-md border px-2 py-1',
									FDR_CELL[difficulty]
								)}
							>
								<span className="min-w-0 truncate font-display text-label font-bold tracking-wide">
									{opponent.shortName}
								</span>
								<span className="shrink-0 font-mono text-[0.6rem] font-bold uppercase text-muted-foreground">
									{venue}
								</span>
								<strong className="ml-auto shrink-0 font-mono text-label font-bold tabular-nums">
									{value}
								</strong>
							</span>
						)
					})
				)}
			</div>
		</li>
	)
}

async function requestFixtureWindow(
	window: { fromGw: number; count: number },
	signal: AbortSignal
): Promise<FixtureWindowResponse> {
	const response = await fetch(
		`/api/fixtures/window?fromGw=${window.fromGw}&count=${window.count}`,
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
	results: PromiseSettledResult<FixtureWindowResponse>[]
): FullSeasonSchedule {
	const fixturesByEvent = new Map<number, FixturePlanningFixture[]>()
	const unavailableEventIds = new Set<number>()

	results.forEach((result, index) => {
		const window = FULL_SEASON_WINDOWS[index]
		if (!window) return
		const eventIds = Array.from(
			{ length: window.count },
			(_, eventIndex) => window.fromGw + eventIndex
		)

		if (result.status === 'rejected') {
			eventIds.forEach(eventId => unavailableEventIds.add(eventId))
			return
		}

		Object.entries(result.value.fixturesByEvent).forEach(
			([rawEventId, fixtures]) => {
				fixturesByEvent.set(Number(rawEventId), fixtures)
			}
		)
		result.value.unknownEventIds.forEach(eventId =>
			unavailableEventIds.add(eventId)
		)
	})

	return { fixturesByEvent, unavailableEventIds }
}

function clampEventId(value: number): number {
	return Math.min(38, Math.max(1, Math.round(value)))
}

function defaultScheduleRange(fromGw: number, horizon: number) {
	const start = clampEventId(fromGw)
	const count = Math.min(5, Math.max(1, Math.round(horizon)))
	return {
		from: start,
		to: Math.min(38, start + count - 1)
	}
}

function PlayerScheduleRangeControls({
	fromGw,
	toGw,
	onFromChange,
	onToChange,
	t
}: {
	fromGw: number
	toGw: number
	onFromChange: (value: number) => void
	onToChange: (value: number) => void
	t: ReturnType<typeof useTranslations<'Fixtures'>>
}) {
	return (
		<div
			data-share-exclude="true"
			className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-muted/20 px-2.5 py-2"
		>
			<span className="mr-1 font-display text-label font-bold uppercase tracking-caps text-muted-foreground">
				{t('mySquadRangeLabel')}
			</span>
			<label className="flex items-center gap-1.5 text-caption font-semibold text-muted-foreground">
				<span>{t('mySquadRangeFrom')}</span>
				<select
					id="my-squad-fixture-range-from"
					value={fromGw}
					onChange={event => onFromChange(Number(event.target.value))}
					className="h-8 rounded-md border border-border/70 bg-background px-2 font-mono text-caption font-bold tabular-nums text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
				>
					{FULL_SEASON_EVENT_IDS.filter(eventId => eventId <= toGw).map(
						eventId => (
							<option key={eventId} value={eventId}>
								GW{eventId}
							</option>
						)
					)}
				</select>
			</label>
			<span className="font-mono text-caption text-muted-foreground">–</span>
			<label className="flex items-center gap-1.5 text-caption font-semibold text-muted-foreground">
				<span>{t('mySquadRangeTo')}</span>
				<select
					id="my-squad-fixture-range-to"
					value={toGw}
					onChange={event => onToChange(Number(event.target.value))}
					className="h-8 rounded-md border border-border/70 bg-background px-2 font-mono text-caption font-bold tabular-nums text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
				>
					{FULL_SEASON_EVENT_IDS.filter(eventId => eventId >= fromGw).map(
						eventId => (
							<option key={eventId} value={eventId}>
								GW{eventId}
							</option>
						)
					)}
				</select>
			</label>
		</div>
	)
}

function FullSeasonSchedule({
	selectedRow,
	teamName,
	schedule,
	state,
	fromGw,
	horizon,
	t,
	onRetry
}: {
	selectedRow: SquadFdrRow
	teamName: string
	schedule: FullSeasonSchedule | null
	state: 'idle' | 'loading' | 'ready' | 'error'
	fromGw: number
	horizon: number
	t: ReturnType<typeof useTranslations<'Fixtures'>>
	onRetry: () => void
}) {
	const scheduleShareRef = useRef<HTMLDivElement | null>(null)
	const initialRange = useMemo(
		() => defaultScheduleRange(fromGw, horizon),
		[fromGw, horizon]
	)
	const [rangeFrom, setRangeFrom] = useState(initialRange.from)
	const [rangeTo, setRangeTo] = useState(initialRange.to)

	useEffect(() => {
		setRangeFrom(initialRange.from)
		setRangeTo(initialRange.to)
	}, [initialRange])

	const visibleEventIds = useMemo(
		() =>
			FULL_SEASON_EVENT_IDS.filter(
				eventId => eventId >= rangeFrom && eventId <= rangeTo
			),
		[rangeFrom, rangeTo]
	)
	const resolvedTeamName = teamName.trim() || selectedRow.teamShortName
	const position = pitchPosition(selectedRow.positionCode)

	return (
		<div
			ref={scheduleShareRef}
			data-share-fit-content="true"
			data-share-preserve-width="true"
			className="space-y-3 rounded-xl border border-border/70 bg-background p-3 sm:p-4"
		>
			<div className="relative pr-12">
				<DialogHeader className="min-w-0">
					<div className="flex min-w-0 items-center gap-2">
						<Badge
							className={cn(
								positionBadgeClass(selectedRow.positionCode),
								'px-2 py-0.5 text-label font-bold'
							)}
						>
							{position}
						</Badge>
						<DialogTitle className="min-w-0 truncate whitespace-nowrap font-display text-lg tracking-wide sm:text-xl">
							{selectedRow.webName}
						</DialogTitle>
					</div>
					<DialogDescription className="sr-only">
						{t('mySquadDialogDescription', { player: selectedRow.webName })}
					</DialogDescription>
					<div
						className="mt-1.5 inline-flex max-w-full items-center gap-2 self-start rounded-md border border-primary/35 bg-primary/10 px-2 py-1 text-caption text-primary-ink"
						title={resolvedTeamName}
						aria-label={`${t('mySquadCurrentTeam')}: ${resolvedTeamName}`}
					>
						<span className="font-mono font-black uppercase tracking-wide">
							{selectedRow.teamShortName}
						</span>
						<span className="truncate font-semibold">{resolvedTeamName}</span>
					</div>
				</DialogHeader>
				{state === 'ready' && schedule ? (
					<div
						data-share-exclude="true"
						className="absolute right-0 top-0"
					>
						<ShareActions
							imageRef={scheduleShareRef}
							title={t('mySquadShareTitle', {
								player: selectedRow.webName
							})}
							actions={['image']}
							compact
						/>
					</div>
				) : null}
			</div>

			{state === 'error' ? (
				<div
					className="rounded-lg border border-dashed border-destructive/40 bg-destructive/5 px-3 py-4 text-center"
					role="alert"
				>
					<p className="text-caption text-muted-foreground">
						{t('mySquadScheduleLoadFailed')}
					</p>
					<button
						type="button"
						className="mt-2 rounded-md border border-border/70 bg-background px-3 py-1.5 text-caption font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						data-retry-squad-schedule="true"
						onClick={onRetry}
					>
						{t('retrySchedule')}
					</button>
				</div>
			) : state === 'idle' || state === 'loading' || !schedule ? (
				<div
					className="rounded-lg border border-dashed border-border/70 bg-muted/10 px-3 py-4"
					role="status"
					aria-live="polite"
				>
					<p className="text-caption text-muted-foreground">
						{t('mySquadScheduleLoading')}
					</p>
					<div className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-8" aria-hidden="true">
						{Array.from({ length: 8 }, (_, index) => (
							<span
								key={index}
								className="h-1.5 animate-pulse rounded-full bg-border/70"
							/>
						))}
					</div>
				</div>
			) : (
				<>
					<PlayerScheduleRangeControls
						fromGw={rangeFrom}
						toGw={rangeTo}
						onFromChange={value => {
							setRangeFrom(value)
							setRangeTo(current => Math.max(current, value))
						}}
						onToChange={value => {
							setRangeTo(value)
							setRangeFrom(current => Math.min(current, value))
						}}
						t={t}
					/>
					<ol
						className="divide-y divide-border/60 rounded-lg border border-border/70 bg-muted/10 px-2 sm:px-3"
						aria-label={t('mySquadRangeSummary', {
							from: rangeFrom,
							to: rangeTo
						})}
					>
						{visibleEventIds.map(eventId => (
							<CompactFixtureRow
								key={eventId}
								eventId={eventId}
								fixtures={schedule.fixturesByEvent.get(eventId) ?? []}
								unknown={schedule.unavailableEventIds.has(eventId)}
								teamId={selectedRow.teamId}
								t={t}
							/>
						))}
					</ol>
				</>
			)}
		</div>
	)
}

export function MySquadFdrDesk({
	picks,
	teams,
	fromGw,
	horizon,
	hasLinkedEntry = false,
	squadState = hasLinkedEntry ? 'not-published' : 'unbound',
	shareRef
}: {
	picks: SquadPickSeed[]
	teams: TeamFdrRow[]
	fromGw: number
	horizon: number
	hasLinkedEntry?: boolean
	squadState?: SquadLoadState
	shareRef?: RefObject<HTMLElement | null>
}) {
	const t = useTranslations('Fixtures')
	const [selectedRow, setSelectedRow] = useState<SquadFdrRow | null>(null)
	const [fullSeasonSchedule, setFullSeasonSchedule] =
		useState<FullSeasonSchedule | null>(null)
	const [fullSeasonScheduleState, setFullSeasonScheduleState] = useState<
		'idle' | 'loading' | 'ready' | 'error'
	>('idle')
	const fullSchedulePromiseRef =
		useRef<Promise<FullSeasonSchedule | null> | null>(null)
	const fullScheduleAbortRef = useRef<AbortController | null>(null)

	const rows = useMemo(
		() => sortSquadForPlanning(buildSquadFdrRows(picks, teams)),
		[picks, teams]
	)
	const eventIds = useMemo(
		() =>
			Array.from({ length: horizon }, (_, index) => fromGw + index).filter(
				eventId => eventId >= 1 && eventId <= 38
			),
		[fromGw, horizon]
	)
	const pitchData = useMemo(() => {
		const rowById = new Map<string, SquadFdrRow>()
		const toPitchPlayer = (row: SquadFdrRow): SquadPitchPlayer => {
			const id = rowId(row)
			rowById.set(id, row)
			const teamCode = resolveSquadTeamCode(row.teamShortName)
			const fixtureSchedule = buildPitchSchedule(row, eventIds, {
				blank: t('bgw'),
				unavailable: t('fixtureUnavailable')
			})

			return {
				id,
				webName: row.webName,
				score: 0,
				position: pitchPosition(row.positionCode),
				...(teamCode
					? { teamCode }
					: { teamBadgeLabel: row.teamShortName.trim().toUpperCase() }),
				fixtureSchedule,
				fixtureScheduleLabel: fixtureSchedule
					.map(fixture => fixture.label)
					.join('; '),
				isCaptain: row.isCaptain,
				isViceCaptain: row.isViceCaptain
			}
		}

		const starters: SquadPitchPlayer[] = []
		const bench: SquadPitchPlayer[] = []
		for (const row of rows) {
			const player = toPitchPlayer(row)
			if (row.isStarter) starters.push(player)
			else bench.push(player)
		}
		return { starters, bench, rowById }
	}, [eventIds, rows, t])

	const loadFullSeasonSchedule = useCallback(() => {
		if (fullSeasonSchedule) return Promise.resolve(fullSeasonSchedule)
		if (fullSchedulePromiseRef.current) return fullSchedulePromiseRef.current

		const controller = new AbortController()
		fullScheduleAbortRef.current = controller
		setFullSeasonScheduleState('loading')

		const promise = Promise.allSettled(
			FULL_SEASON_WINDOWS.map(window =>
				requestFixtureWindow(window, controller.signal)
			)
		)
			.then(results => {
				if (controller.signal.aborted) return null
				if (!results.some(result => result.status === 'fulfilled')) {
					throw new Error('full season fixture schedule unavailable')
				}

				const schedule = mergeFullSeasonSchedule(results)
				setFullSeasonSchedule(schedule)
				setFullSeasonScheduleState('ready')
				return schedule
			})
			.catch(() => {
				if (!controller.signal.aborted) {
					setFullSeasonScheduleState('error')
				}
				return null
			})
			.finally(() => {
				if (fullSchedulePromiseRef.current === promise) {
					fullSchedulePromiseRef.current = null
					fullScheduleAbortRef.current = null
				}
			})

		fullSchedulePromiseRef.current = promise
		return promise
	}, [fullSeasonSchedule])

	useEffect(() => {
		return () => {
			fullScheduleAbortRef.current?.abort()
		}
	}, [])

	const handlePitchPlayerClick = useCallback(
		(playerId: string) => {
			const row = pitchData.rowById.get(playerId)
			if (!row) return
			setSelectedRow(row)
			void loadFullSeasonSchedule()
		},
		[loadFullSeasonSchedule, pitchData.rowById]
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

	const selectedTeamName = selectedRow
		? teams.find(team => team.teamId === selectedRow.teamId)?.teamName ??
			selectedRow.teamShortName
		: ''

	return (
		<>
			<div
				data-schedule-pitch="true"
				className="space-y-3"
				role="group"
				aria-label={t('mySquadTitle')}
			>
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<p className="flex items-center gap-1.5 text-caption text-muted-foreground">
						<CalendarDays
							className="size-4 text-success"
							aria-hidden="true"
						/>
						{t('mySquadPitchHint')}
					</p>
				</div>

				<div className="-mx-4 overflow-hidden rounded-xl border border-border/60 bg-[#210025] shadow-[0_20px_45px_-28px_rgba(21,0,25,0.75)] sm:-mx-5">
					<div className="mx-auto w-full max-w-3xl">
						<SquadPitch
							ref={shareRef}
							players={pitchData.starters}
							benchPlayers={pitchData.bench}
							benchTitle={t('squadSubstitutes')}
							benchPointsLabel={t('fdrLegend')}
							onPlayerClick={handlePitchPlayerClick}
							labels={{
								formation: t('mySquadTitle'),
								positions: {
									GKP: t('positionGoalkeeper'),
									DEF: t('positionDefenders'),
									MID: t('positionMidfielders'),
									FWD: t('positionForwards')
								},
								captain: t('squadCaptain'),
								viceCaptain: t('squadViceCaptain'),
								total: t('fdrLegend'),
								playerDetails: player =>
									t('openSquadFixtureDetail', { player: player.webName })
							}}
							title={t('mySquadTitle')}
							headerStats={{
								eyebrow: t('mySquadPitchWindow', {
									from: fromGw,
									to: eventIds.at(-1) ?? fromGw
								}),
								details: [
									{
										label: t('mySquadPitchPlayers'),
										value: String(rows.length),
										accent: true
									}
								]
							}}
							className="rounded-none border-0 shadow-none"
						/>
					</div>
				</div>
			</div>

			<Dialog
				open={selectedRow !== null}
				onOpenChange={open => {
					if (!open) setSelectedRow(null)
				}}
			>
					<DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto overscroll-contain p-3 sm:max-w-2xl sm:p-4">
						{selectedRow ? (
							<FullSeasonSchedule
								key={rowId(selectedRow)}
								selectedRow={selectedRow}
								teamName={selectedTeamName}
								schedule={fullSeasonSchedule}
								state={fullSeasonScheduleState}
								fromGw={fromGw}
								horizon={horizon}
								t={t}
								onRetry={() => void loadFullSeasonSchedule()}
							/>
						) : null}
				</DialogContent>
			</Dialog>
		</>
	)
}
