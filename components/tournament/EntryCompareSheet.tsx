'use client'

import { Badge } from '@/components/ui/badge'
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_LIVE_POINTS,
	type LiveCalcData,
	type LiveCalcDataResponse
} from '@/lib/graphql/operations/live'
import type {
	TournamentEntrySquadsResponse,
	TournamentLiveCalcData
} from '@/lib/graphql/operations/tournaments'
import {
	comparisonPositionLabel,
	mapComparisonPick
} from '@/lib/tournament/entry-comparison'
import { getPlayedPlayerLimit } from '@/lib/tournament/played-total'
import type { TournamentEntry } from '@/types/tournament'
import { useEffect, useRef, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'

interface EntryCompareSheetProps {
	entries: [TournamentEntry, TournamentEntry]
	gameweek: number
	open: boolean
	onOpenChange: (open: boolean) => void
	tournamentId?: number
	playerRevision?: string
	onRevisionGone?: () => Promise<void>
}

type CompareLiveData = LiveCalcData | TournamentLiveCalcData

function getPlayedStatus(pick: {
	minutes?: number | null
	starts?: boolean | null
	isGwFinished?: boolean | null
	isGwStarted?: boolean | null
	isPlayed?: boolean | null
}): 'FINISHED' | 'PLAYING' | 'NOT_STARTED' {
	if (pick.isGwFinished) return 'FINISHED'
	const minutes = pick.minutes ?? 0
	if (
		pick.isGwStarted &&
		(pick.isPlayed || minutes > 0 || pick.starts === true)
	) {
		return 'PLAYING'
	}
	if (minutes > 0 || pick.starts) return 'PLAYING'
	return 'NOT_STARTED'
}

function PlayedDot({
	status
}: {
	status: 'FINISHED' | 'PLAYING' | 'NOT_STARTED'
}) {
	const color =
		status === 'FINISHED'
			? 'bg-success'
			: status === 'PLAYING'
				? 'bg-warning'
				: 'bg-muted-foreground/30'
	return (
		<span className={`inline-block size-2 shrink-0 rounded-full ${color}`} />
	)
}

function elementTypeLabel(elementType: number, position: number): string {
	if (position >= 12) return 'SUB'
	switch (elementType) {
		case 1:
			return 'GKP'
		case 2:
			return 'DEF'
		case 3:
			return 'MID'
		case 4:
			return 'FWD'
		default:
			return '—'
	}
}

type ComparePickSource = {
	element?: number
	webName: string
	elementType?: number
	elementTypeName?: string
	position: number
	totalPoints?: number | null
	minutes?: number | null
	starts?: boolean | null
	isCaptain?: boolean
	isViceCaptain?: boolean
	isGwFinished?: boolean | null
	isGwStarted?: boolean | null
	isPlayed?: boolean | null
}

type ComparePick = {
	element?: number
	webName: string
	totalPoints: number
	minutes: number
	starts: boolean
	isCaptain: boolean
	isViceCaptain: boolean
	isGwFinished?: boolean | null
	isGwStarted?: boolean | null
	isPlayed?: boolean | null
	position: number
	positionLabel: string
}

const STARTING_POSITION_LABELS = ['GKP', 'DEF', 'MID', 'FWD'] as const

function elementTypeNameLabel(
	elementTypeName: string | undefined,
	position: number
): string {
	if (position >= 12) return 'SUB'
	const normalized = elementTypeName?.trim().toUpperCase()
	if (
		normalized === 'GKP' ||
		normalized === 'DEF' ||
		normalized === 'MID' ||
		normalized === 'FWD'
	) {
		return normalized
	}
	if (normalized?.includes('GOALKEEP')) return 'GKP'
	if (normalized?.includes('DEF')) return 'DEF'
	if (normalized?.includes('MID')) return 'MID'
	if (normalized?.includes('FWD') || normalized?.includes('FORWARD'))
		return 'FWD'
	return '—'
}

function toComparePick(
	pick: ComparePickSource,
	captainName?: string
): ComparePick {
	const positionLabel =
		typeof pick.elementType === 'number'
			? elementTypeLabel(pick.elementType, pick.position)
			: elementTypeNameLabel(pick.elementTypeName, pick.position)
	return {
		element: pick.element,
		webName: pick.webName,
		totalPoints: pick.totalPoints ?? 0,
		minutes: pick.minutes ?? 0,
		starts: pick.starts ?? false,
		isCaptain: pick.isCaptain ?? captainName === pick.webName,
		isViceCaptain: pick.isViceCaptain ?? false,
		isGwFinished: pick.isGwFinished,
		isGwStarted: pick.isGwStarted,
		isPlayed: pick.isPlayed,
		position: pick.position,
		positionLabel
	}
}

function comparePickKey(pick: ComparePick): string {
	return pick.element != null
		? `element:${pick.element}`
		: `name:${pick.webName.trim().toLowerCase()}`
}

type AlignedCompareRow = {
	leftPick: ComparePick | null
	rightPick: ComparePick | null
	posLabel: string
	isBench: boolean
}

function positionRank(positionLabel: string): number {
	return (
		STARTING_POSITION_LABELS.indexOf(
			positionLabel as (typeof STARTING_POSITION_LABELS)[number]
		) + 1 || 99
	)
}

function alignedPositionLabel(
	leftPick: ComparePick | null,
	rightPick: ComparePick | null
): string {
	const leftLabel = leftPick?.positionLabel
	const rightLabel = rightPick?.positionLabel
	if (!leftLabel) return rightLabel ?? '—'
	if (!rightLabel || leftLabel === rightLabel) return leftLabel
	return `${leftLabel} · ${rightLabel}`
}

function compareAlignedRows(
	left: AlignedCompareRow,
	right: AlignedCompareRow
): number {
	const leftPrimary = Math.min(
		positionRank(left.leftPick?.positionLabel ?? '—'),
		positionRank(left.rightPick?.positionLabel ?? '—')
	)
	const rightPrimary = Math.min(
		positionRank(right.leftPick?.positionLabel ?? '—'),
		positionRank(right.rightPick?.positionLabel ?? '—')
	)
	if (leftPrimary !== rightPrimary) return leftPrimary - rightPrimary

	const leftSecondary = Math.max(
		positionRank(left.leftPick?.positionLabel ?? '—'),
		positionRank(left.rightPick?.positionLabel ?? '—')
	)
	const rightSecondary = Math.max(
		positionRank(right.leftPick?.positionLabel ?? '—'),
		positionRank(right.rightPick?.positionLabel ?? '—')
	)
	return leftSecondary - rightSecondary
}

/**
 * Align shared players globally first. Pairing by position is only a
 * preference for the remaining rows; enforcing it independently per position
 * would turn two valid 11-player XIs into 12 comparison rows when formations
 * differ.
 */
function alignPickRows(
	leftPicks: ComparePick[],
	rightPicks: ComparePick[],
	isBench: boolean
): AlignedCompareRow[] {
	const rightRemaining = [...rightPicks]
	const rows: AlignedCompareRow[] = []
	const unmatchedLeft: ComparePick[] = []

	for (const leftPick of leftPicks) {
		const rightIndex = rightRemaining.findIndex(
			rightPick => comparePickKey(rightPick) === comparePickKey(leftPick)
		)
		if (rightIndex === -1) {
			unmatchedLeft.push(leftPick)
			continue
		}
		const [rightPick] = rightRemaining.splice(rightIndex, 1)
		rows.push({
			leftPick,
			rightPick,
			posLabel: alignedPositionLabel(leftPick, rightPick),
			isBench
		})
	}

	for (const leftPick of unmatchedLeft) {
		const samePositionIndex = rightRemaining.findIndex(
			rightPick => rightPick.positionLabel === leftPick.positionLabel
		)
		const rightIndex = samePositionIndex >= 0 ? samePositionIndex : 0
		const rightPick = rightRemaining.splice(rightIndex, 1)[0] ?? null
		rows.push({
			leftPick,
			rightPick,
			posLabel: alignedPositionLabel(leftPick, rightPick),
			isBench
		})
	}

	for (const rightPick of rightRemaining) {
		rows.push({
			leftPick: null,
			rightPick,
			posLabel: alignedPositionLabel(null, rightPick),
			isBench
		})
	}

	return rows.sort(compareAlignedRows)
}

function alignComparePicks(
	leftPicks: ComparePick[],
	rightPicks: ComparePick[]
): { starting: AlignedCompareRow[]; bench: AlignedCompareRow[] } {
	return {
		starting: alignPickRows(
			leftPicks.filter(pick => pick.positionLabel !== 'SUB'),
			rightPicks.filter(pick => pick.positionLabel !== 'SUB'),
			false
		),
		bench: alignPickRows(
			leftPicks.filter(pick => pick.positionLabel === 'SUB'),
			rightPicks.filter(pick => pick.positionLabel === 'SUB'),
			true
		)
	}
}

function ChipBadges({
	chips
}: {
	chips: {
		bench: boolean
		triple: boolean
		wildcard: boolean
		freeHit?: boolean
	}
}) {
	if (!chips.bench && !chips.triple && !chips.wildcard && !chips.freeHit) {
		return <span className="text-muted-foreground">—</span>
	}
	return (
		<span className="inline-flex min-h-5 items-center justify-center gap-1 align-middle leading-none">
			{chips.bench && (
				<Badge
					variant="outline"
					className="inline-flex h-5 items-center border-info/30 bg-info/10 px-1 text-label leading-none text-info"
				>
					BB
				</Badge>
			)}
			{chips.triple && (
				<Badge
					variant="outline"
					className="inline-flex h-5 items-center border-success/30 bg-success/10 px-1 text-label leading-none text-success"
				>
					TC
				</Badge>
			)}
			{chips.wildcard && (
				<Badge
					variant="outline"
					className="inline-flex h-5 items-center border-primary/30 bg-primary/10 px-1 text-label leading-none text-primary-ink"
				>
					WC
				</Badge>
			)}
			{chips.freeHit && (
				<Badge
					variant="outline"
					className="inline-flex h-5 items-center border-warning/30 bg-warning/10 px-1 text-label leading-none text-warning"
				>
					FH
				</Badge>
			)}
		</span>
	)
}

interface OverviewRowProps {
	label: string
	leftValue: React.ReactNode
	rightValue: React.ReactNode
	leftWins?: boolean
	rightWins?: boolean
}

function OverviewRow({
	label,
	leftValue,
	rightValue,
	leftWins,
	rightWins
}: OverviewRowProps) {
	return (
		<div className="grid grid-cols-[1fr_auto_1fr] items-center border-b py-1.5 last:border-0">
			<div
				className={`text-right pr-3 text-sm ${leftWins ? 'text-primary-ink font-bold' : 'text-muted-foreground'}`}
			>
				{leftValue}
			</div>
			<div className="min-w-[80px] px-1 text-center text-xs text-muted-foreground">
				{label}
			</div>
			<div
				className={`text-left pl-3 text-sm ${rightWins ? 'text-primary-ink font-bold' : 'text-muted-foreground'}`}
			>
				{rightValue}
			</div>
		</div>
	)
}

interface PlayerCompareRowProps {
	leftPick: ComparePick | null
	rightPick: ComparePick | null
	posLabel: string
	isBench: boolean
}

function PlayerCompareRow({
	leftPick,
	rightPick,
	posLabel,
	isBench
}: PlayerCompareRowProps) {
	const bg = isBench ? 'bg-accent/20' : ''
	const leftStatus = leftPick ? getPlayedStatus(leftPick) : 'NOT_STARTED'
	const rightStatus = rightPick ? getPlayedStatus(rightPick) : 'NOT_STARTED'
	const leftPts = leftPick?.totalPoints ?? 0
	const rightPts = rightPick?.totalPoints ?? 0
	const leftWins = leftPts > rightPts
	const rightWins = rightPts > leftPts

	return (
		<div
			className={`grid grid-cols-[1fr_auto_1fr] items-center border-b px-3 py-1.5 last:border-0 ${bg}`}
		>
			{/* Left entry player */}
			<div className="flex items-center gap-1.5 justify-end">
				{leftPick ? (
					<>
						<span
							className={`max-w-[90px] truncate text-right text-xs ${leftPick.isCaptain || leftPick.isViceCaptain ? 'font-bold' : ''}`}
						>
							{leftPick.webName}
							{leftPick.isCaptain
								? ' (C)'
								: leftPick.isViceCaptain
									? ' (V)'
									: ''}
						</span>
						<PlayedDot status={leftStatus} />
						<span
							className={`text-xs font-mono w-6 text-right flex-shrink-0 ${leftWins ? 'text-primary-ink font-bold' : 'text-muted-foreground'}`}
						>
							{leftPts}
						</span>
					</>
				) : (
					<span className="text-xs text-muted-foreground">—</span>
				)}
			</div>

			{/* Center position label */}
			<div className="min-w-[48px] whitespace-nowrap px-1 text-center font-mono text-label text-muted-foreground">
				{posLabel}
			</div>

			{/* Right entry player */}
			<div className="flex items-center gap-1.5 justify-start">
				{rightPick ? (
					<>
						<span
							className={`text-xs font-mono w-6 text-left flex-shrink-0 ${rightWins ? 'text-primary-ink font-bold' : 'text-muted-foreground'}`}
						>
							{rightPts}
						</span>
						<PlayedDot status={rightStatus} />
						<span
							className={`max-w-[90px] truncate text-xs ${rightPick.isCaptain || rightPick.isViceCaptain ? 'font-bold' : ''}`}
						>
							{rightPick.isCaptain
								? '(C) '
								: rightPick.isViceCaptain
									? '(V) '
									: ''}
							{rightPick.webName}
						</span>
					</>
				) : (
					<span className="text-xs text-muted-foreground">—</span>
				)}
			</div>
		</div>
	)
}

export function EntryCompareSheet({
	entries,
	gameweek,
	open,
	onOpenChange
}: EntryCompareSheetProps) {
	const t = useTranslations('LiveTournament')
	const format = useFormatter()
	const [liveData, setLiveData] = useState<
		[LiveCalcData | null, LiveCalcData | null]
	>([null, null])
	const [isLoading, setIsLoading] = useState(false)
	const [loadError, setLoadError] = useState(false)
	const [retryVersion, setRetryVersion] = useState(0)
	const revisionRetryRef = useRef(false)
	const comparisonIdentityRef = useRef<string | null>(null)

	const entryIdA = entries[0]?.id
	const entryIdB = entries[1]?.id

	// Depend on stable entry ids — parent often passes a new `entries` array each render.
	useEffect(() => {
		if (!open || !entryIdA || !entryIdB) {
			comparisonIdentityRef.current = null
			revisionRetryRef.current = false
			return
		}
		const comparisonIdentity = [
			open,
			entryIdA,
			entryIdB,
			gameweek,
			tournamentId ?? '',
			playerRevision ?? ''
		].join(':')
		if (comparisonIdentityRef.current !== comparisonIdentity) {
			comparisonIdentityRef.current = comparisonIdentity
			revisionRetryRef.current = false
		}

		let cancelled = false
		const controller = new AbortController()
		void Promise.resolve()
			.then(async () => {
				if (cancelled) return
				setIsLoading(true)
				setLoadError(false)
				setLiveData([null, null])

			const [resA, resB] = await Promise.allSettled([
				executeQuery<LiveCalcDataResponse>(GET_LIVE_POINTS, {
					entryId: Number(entryIdA),
					eventId: gameweek
				}),
				executeQuery<LiveCalcDataResponse>(GET_LIVE_POINTS, {
					entryId: Number(entryIdB),
					eventId: gameweek
				})
			])

			if (cancelled) return

			const a =
				resA.status === 'fulfilled' ? resA.value.calcLivePointsByEntry : null
			const b =
				resB.status === 'fulfilled' ? resB.value.calcLivePointsByEntry : null
			setLiveData([a, b])
			setIsLoading(false)
		})

		return () => {
			cancelled = true
			controller.abort()
		}
	}, [
		open,
		entryIdA,
		entryIdB,
		gameweek,
		playerRevision,
		retryVersion,
		tournamentId,
		onRevisionGone
	])

	const [entryA, entryB] = entries
	const [liveA, liveB] = liveData

	const gwPtsA = entryA.gwPoints ?? entryA.livePoints
	const gwPtsB = entryB.gwPoints ?? entryB.livePoints
	const gwNetA = entryA.gwNetPoints
	const gwNetB = entryB.gwNetPoints
	const costA = entryA.eventCost ?? 0
	const costB = entryB.eventCost ?? 0
	const totalA = entryA.totalPoints ?? entryA.livePoints
	const totalB = entryB.totalPoints ?? entryB.livePoints
	const playedLimitA = getPlayedPlayerLimit(entryA.chips)
	const playedLimitB = getPlayedPlayerLimit(entryB.chips)

	const picksA = (liveA ? liveA.pickList : entryA.picks)
		.map(pick => toComparePick(pick, liveA?.captainName ?? entryA.captainName))
		.sort((a, b) => a.position - b.position)
	const picksB = (liveB ? liveB.pickList : entryB.picks)
		.map(pick => toComparePick(pick, liveB?.captainName ?? entryB.captainName))
		.sort((a, b) => a.position - b.position)
	const alignedPicks = alignComparePicks(picksA, picksB)
	const formatOR = (rank?: number) =>
		!rank || rank <= 0 ? '—' : format.number(rank, { notation: 'compact' })

	return (
		<Sheet
			open={open}
			onOpenChange={onOpenChange}
		>
			<SheetContent
				side="right"
				className="w-full gap-0 overflow-y-auto p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:max-w-[680px]"
			>
				<SheetHeader className="border-b p-4 pb-2">
					<SheetTitle className="text-sm">
						<span className="text-primary-ink">{entryA.teamName}</span>
						<span className="text-muted-foreground mx-2">{t('versus')}</span>
						<span className="text-primary-ink">{entryB.teamName}</span>
					</SheetTitle>
					<p className="text-xs text-muted-foreground">
						{t('comparison', { gameweek })}
					</p>
				</SheetHeader>

				<div>
					{/* Overview section */}
					<div className="px-3 pt-2 pb-1">
						<div className="border rounded-lg overflow-hidden">
							<div className="px-3">
								<OverviewRow
									label={t('gameweekPointsShort')}
									leftValue={
										gwPtsA == null
											? '—'
											: costA > 0
												? `${gwPtsA} (-${costA})`
												: gwPtsA
									}
									rightValue={
										gwPtsB == null
											? '—'
											: costB > 0
												? `${gwPtsB} (-${costB})`
												: gwPtsB
									}
									leftWins={gwPtsA != null && gwPtsB != null && gwPtsA > gwPtsB}
									rightWins={
										gwPtsA != null && gwPtsB != null && gwPtsB > gwPtsA
									}
								/>
								<OverviewRow
									label={t('gameweekNetShort')}
									leftValue={gwNetA ?? '—'}
									rightValue={gwNetB ?? '—'}
									leftWins={gwNetA != null && gwNetB != null && gwNetA > gwNetB}
									rightWins={
										gwNetA != null && gwNetB != null && gwNetB > gwNetA
									}
								/>
								<OverviewRow
									label={t('totalPointsShort')}
									leftValue={totalA ?? '—'}
									rightValue={totalB ?? '—'}
									leftWins={totalA != null && totalB != null && totalA > totalB}
									rightWins={
										totalA != null && totalB != null && totalB > totalA
									}
								/>
								<OverviewRow
									label={t('overallRank')}
									leftValue={formatOR(entryA.overallRank)}
									rightValue={formatOR(entryB.overallRank)}
									leftWins={
										!!entryA.overallRank &&
										!!entryB.overallRank &&
										entryA.overallRank < entryB.overallRank
									}
									rightWins={
										!!entryA.overallRank &&
										!!entryB.overallRank &&
										entryB.overallRank < entryA.overallRank
									}
								/>
								<OverviewRow
									label={t('chip')}
									leftValue={<ChipBadges chips={entryA.chips} />}
									rightValue={<ChipBadges chips={entryB.chips} />}
								/>
								<OverviewRow
									label={t('played')}
									leftValue={`${entryA.playersPlayed}/${playedLimitA}`}
									rightValue={`${entryB.playersPlayed}/${playedLimitB}`}
									leftWins={entryA.playersPlayed > entryB.playersPlayed}
									rightWins={entryB.playersPlayed > entryA.playersPlayed}
								/>
							</div>
						</div>
					</div>

					{/* Squad comparison section */}
					<div className="px-3 pt-2 pb-3">
						{isLoading ? (
							<div className="border rounded-lg overflow-hidden">
								{Array.from({ length: 15 }).map((_, i) => (
									<div
										key={i}
										className="grid grid-cols-[1fr_auto_1fr] items-center py-2 px-3 border-b last:border-0"
									>
										<Skeleton className="h-3 w-24 ml-auto" />
										<div className="min-w-[36px]" />
										<Skeleton className="h-3 w-24" />
									</div>
								))}
							</div>
						) : loadError ? (
							<div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-8 text-center">
								<p className="text-sm text-destructive">
									{t('comparisonUnavailable')}
								</p>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => setRetryVersion(version => version + 1)}
								>
									{t('errorCtaRetry')}
								</Button>
							</div>
						) : (
							<div className="border rounded-lg overflow-hidden">
								{/* Starting XI label */}
								<div className="px-3 py-1 bg-muted/10 border-b">
									<span className="text-label text-muted-foreground font-medium">
										{t('startingEleven')}
									</span>
								</div>

								{alignedPicks.starting.map((row, index) => (
									<PlayerCompareRow
										key={`starting-${index}`}
										leftPick={row.leftPick}
										rightPick={row.rightPick}
										posLabel={row.posLabel}
										isBench={row.isBench}
									/>
								))}

								{/* Bench label */}
								{alignedPicks.bench.length > 0 && (
									<div className="px-3 py-1 bg-accent/30 border-b border-t">
										<span className="text-label text-muted-foreground font-medium">
											{t('substitutes')}
										</span>
									</div>
								)}

								{alignedPicks.bench.map((row, index) => (
									<PlayerCompareRow
										key={`bench-${index}`}
										leftPick={row.leftPick}
										rightPick={row.rightPick}
										posLabel={row.posLabel}
										isBench={row.isBench}
									/>
								))}
							</div>
						)}
					</div>
				</div>
			</SheetContent>
		</Sheet>
	)
}
