'use client'

import {
	SquadPitch,
	type SquadPitchFixture,
	type SquadPitchPlayer
} from '@/components/squad-pitch/SquadPitch'
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
	buildSquadFdrRows,
	formatAvgFdrOutOfFive,
	sortSquadForPlanning,
	type SquadFdrRow,
	type TeamFdrRow
} from '@/lib/fixtures-fdr'
import { cn } from '@/lib/utils'
import { CalendarDays } from 'lucide-react'
import { useCallback, useMemo, useState, type RefObject } from 'react'
import { useTranslations } from 'next-intl'

const FDR_CELL: Record<number, string> = {
	1: 'border-success/40 bg-success/15 text-foreground',
	2: 'border-success/30 bg-success/10 text-foreground',
	3: 'border-border/70 bg-muted/40 text-foreground',
	4: 'border-warning/45 bg-warning/15 text-foreground',
	5: 'border-destructive/40 bg-destructive/15 text-foreground'
}

const FDR_DOT: Record<number, string> = {
	1: 'bg-success',
	2: 'bg-success/70',
	3: 'bg-muted-foreground/50',
	4: 'bg-warning',
	5: 'bg-destructive'
}

type PitchPosition = SquadPitchPlayer['position']

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
				gameweek.fixtures.reduce((sum, fixture) => sum + fixture.difficulty, 0) /
					gameweek.fixtures.length
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

function FixtureDetailRow({
	eventId,
	gameweek,
	t
}: {
	eventId: number
	gameweek: SquadFdrRow['gameweeks'][number] | undefined
	t: ReturnType<typeof useTranslations<'Fixtures'>>
}) {
	const status = gameweek?.unknown
		? t('fixtureUnavailable')
		: !gameweek || gameweek.bgw || gameweek.fixtures.length === 0
			? t('bgw')
			: null

	return (
		<div className="rounded-lg border border-border/60 bg-muted/10 p-3">
			<div className="mb-2 flex items-center justify-between gap-3">
				<span className="font-display text-sm font-bold tracking-wide">
					GW{eventId}
				</span>
				{gameweek?.averageFdr != null ? (
					<span className="font-mono text-caption font-semibold tabular-nums text-muted-foreground">
						{t('fixtureAverage', {
							value: formatAvgFdrOutOfFive(gameweek.averageFdr)
						})}
					</span>
				) : null}
			</div>

			{status ? (
				<p className="rounded-md border border-dashed border-border/70 px-3 py-2 text-sm text-muted-foreground">
					{status}
				</p>
			) : (
				<div className="flex flex-wrap gap-2">
					{gameweek?.fixtures.map(fixture => (
						<div
							key={fixture.fixtureId}
							className={cn(
								'flex min-w-[7.25rem] flex-col rounded-md border px-3 py-2',
								FDR_CELL[fixture.difficulty]
							)}
						>
							<span className="font-display text-sm font-bold tracking-wide">
								{fixture.opponentShortName}
							</span>
							<span className="mt-0.5 font-mono text-caption tabular-nums text-muted-foreground">
								{fixture.wasHome ? 'H' : 'A'} ·{' '}
								{t('fixtureDifficulty', {
									difficulty: fixture.difficulty
								})}
							</span>
						</div>
					))}
				</div>
			)}
		</div>
	)
}

function FdrLegend({ label }: { label: string }) {
	return (
		<div className="flex flex-wrap items-center gap-1.5 text-caption text-muted-foreground">
			<span className="mr-1 font-display font-semibold uppercase tracking-caps">
				{label}
			</span>
			{[1, 2, 3, 4, 5].map(difficulty => (
				<span
					key={difficulty}
					className={cn(
						'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-label font-semibold tabular-nums',
						FDR_CELL[difficulty]
					)}
				>
					<span
						className={cn('size-1.5 rounded-full', FDR_DOT[difficulty])}
						aria-hidden="true"
					/>
					{difficulty}
				</span>
			))}
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

	const handlePitchPlayerClick = useCallback(
		(playerId: string) => {
			const row = pitchData.rowById.get(playerId)
			if (row) setSelectedRow(row)
		},
		[pitchData.rowById]
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

	const selectedPosition = selectedRow
		? pitchPosition(selectedRow.positionCode)
		: null

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
						{t('mySquadPitchHint', {
							from: fromGw,
							to: eventIds.at(-1) ?? fromGw
						})}
					</p>
					<FdrLegend label={t('fdrLegend')} />
				</div>

				<div className="overflow-hidden rounded-xl border border-border/60 bg-[#210025] shadow-[0_20px_45px_-28px_rgba(21,0,25,0.75)]">
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
								},
								{
									label: t('mySquadPitchDifficulty'),
									value: '1–5'
								}
							]
						}}
						className="rounded-none border-0 shadow-none"
					/>
				</div>
			</div>

			<Dialog
				open={selectedRow !== null}
				onOpenChange={open => {
					if (!open) setSelectedRow(null)
				}}
			>
				<DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-xl overflow-y-auto overscroll-contain sm:max-w-xl">
					{selectedRow ? (
						<>
							<DialogHeader className="pr-8">
								<DialogTitle className="flex flex-wrap items-center gap-2 font-display tracking-wide">
									<Badge
										className={cn(
											positionBadgeClass(selectedRow.positionCode),
											'px-2 py-0.5 text-label font-bold'
										)}
									>
										{selectedPosition}
									</Badge>
									<span>{selectedRow.webName}</span>
								</DialogTitle>
								<DialogDescription>
										{selectedRow.teamShortName} ·{' '}
									{t('mySquadDetailDescription', {
										from: fromGw,
										to: eventIds.at(-1) ?? fromGw
									})}
								</DialogDescription>
							</DialogHeader>

							<div className="grid gap-2.5">
								{eventIds.map(eventId => (
									<FixtureDetailRow
										key={eventId}
										eventId={eventId}
										gameweek={selectedRow.gameweeks.find(
											item => item.eventId === eventId
										)}
										t={t}
									/>
								))}
							</div>
						</>
					) : null}
				</DialogContent>
			</Dialog>
		</>
	)
}
