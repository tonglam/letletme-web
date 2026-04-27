'use client'

import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_LIVE_POINTS,
	type LiveCalcData,
	type LiveCalcDataResponse
} from '@/lib/graphql/queries'
import { formatCompactNumber } from '@/lib/utils'
import type { TournamentEntry } from '@/types/tournament'
import { useEffect, useState } from 'react'

interface EntryCompareSheetProps {
	entries: [TournamentEntry, TournamentEntry]
	gameweek: number
	open: boolean
	onOpenChange: (open: boolean) => void
}

function getPlayedStatus(minutes: number, starts: boolean): 'FINISHED' | 'PLAYING' | 'NOT_STARTED' {
	if (minutes >= 90) return 'FINISHED'
	if (minutes > 0 || starts) return 'PLAYING'
	return 'NOT_STARTED'
}

function PlayedDot({ status }: { status: 'FINISHED' | 'PLAYING' | 'NOT_STARTED' }) {
	const color =
		status === 'FINISHED'
			? 'bg-green-500'
			: status === 'PLAYING'
				? 'bg-yellow-400'
				: 'bg-muted-foreground/30'
	return <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${color}`} />
}

function elementTypeLabel(elementType: number, position: number): string {
	if (position >= 12) return 'SUB'
	switch (elementType) {
		case 1: return 'GKP'
		case 2: return 'DEF'
		case 3: return 'MID'
		case 4: return 'FWD'
		default: return '—'
	}
}

function formatOR(rank?: number) {
	if (!rank || rank <= 0) return '—'
	return formatCompactNumber(rank).replace('K', 'k').replace('M', 'm').replace('B', 'b')
}

function ChipBadges({ chips }: { chips: { bench: boolean; triple: boolean; wildcard: boolean } }) {
	if (!chips.bench && !chips.triple && !chips.wildcard) return <span className="text-muted-foreground">—</span>
	return (
		<span className="flex gap-1 justify-center flex-wrap">
			{chips.bench && (
				<Badge variant="outline" className="text-[10px] h-4 px-1 bg-blue-500/10 text-blue-600 border-blue-200">BB</Badge>
			)}
			{chips.triple && (
				<Badge variant="outline" className="text-[10px] h-4 px-1 bg-emerald-500/10 text-emerald-600 border-emerald-200">TC</Badge>
			)}
			{chips.wildcard && (
				<Badge variant="outline" className="text-[10px] h-4 px-1 bg-purple-500/10 text-purple-600 border-purple-200">WC</Badge>
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

function OverviewRow({ label, leftValue, rightValue, leftWins, rightWins }: OverviewRowProps) {
	return (
		<div className="grid grid-cols-[1fr_auto_1fr] items-center py-2 border-b last:border-0">
			<div className={`text-right pr-3 text-sm ${leftWins ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
				{leftValue}
			</div>
			<div className="text-xs text-muted-foreground text-center min-w-[80px] px-1">{label}</div>
			<div className={`text-left pl-3 text-sm ${rightWins ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
				{rightValue}
			</div>
		</div>
	)
}

interface PlayerCompareRowProps {
	leftPick: { webName: string; totalPoints: number; minutes: number; starts: boolean; isCaptain: boolean } | null
	rightPick: { webName: string; totalPoints: number; minutes: number; starts: boolean; isCaptain: boolean } | null
	posLabel: string
	isBench: boolean
}

function PlayerCompareRow({ leftPick, rightPick, posLabel, isBench }: PlayerCompareRowProps) {
	const bg = isBench ? 'bg-accent/20' : ''
	const leftStatus = leftPick ? getPlayedStatus(leftPick.minutes, leftPick.starts) : 'NOT_STARTED'
	const rightStatus = rightPick ? getPlayedStatus(rightPick.minutes, rightPick.starts) : 'NOT_STARTED'
	const leftPts = leftPick?.totalPoints ?? 0
	const rightPts = rightPick?.totalPoints ?? 0
	const leftWins = leftPts > rightPts
	const rightWins = rightPts > leftPts

	return (
		<div className={`grid grid-cols-[1fr_auto_1fr] items-center py-2 px-3 border-b last:border-0 ${bg}`}>
			{/* Left entry player */}
			<div className="flex items-center gap-1.5 justify-end">
				{leftPick ? (
					<>
						<span className={`text-xs text-right truncate max-w-[90px] ${leftPick.isCaptain ? 'font-bold' : ''}`}>
							{leftPick.webName}{leftPick.isCaptain ? ' (C)' : ''}
						</span>
						<PlayedDot status={leftStatus} />
						<span className={`text-xs font-mono w-6 text-right flex-shrink-0 ${leftWins ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
							{leftPts}
						</span>
					</>
				) : (
					<span className="text-xs text-muted-foreground">—</span>
				)}
			</div>

			{/* Center position label */}
			<div className="text-[10px] text-muted-foreground text-center min-w-[36px] px-1 font-mono">{posLabel}</div>

			{/* Right entry player */}
			<div className="flex items-center gap-1.5 justify-start">
				{rightPick ? (
					<>
						<span className={`text-xs font-mono w-6 text-left flex-shrink-0 ${rightWins ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
							{rightPts}
						</span>
						<PlayedDot status={rightStatus} />
						<span className={`text-xs truncate max-w-[90px] ${rightPick.isCaptain ? 'font-bold' : ''}`}>
							{rightPick.isCaptain ? '(C) ' : ''}{rightPick.webName}
						</span>
					</>
				) : (
					<span className="text-xs text-muted-foreground">—</span>
				)}
			</div>
		</div>
	)
}

export function EntryCompareSheet({ entries, gameweek, open, onOpenChange }: EntryCompareSheetProps) {
	const [liveData, setLiveData] = useState<[LiveCalcData | null, LiveCalcData | null]>([null, null])
	const [isLoading, setIsLoading] = useState(false)

	useEffect(() => {
		if (!open) return

		let cancelled = false
		setIsLoading(true)
		setLiveData([null, null])

		const fetchBoth = async () => {
			const [resA, resB] = await Promise.allSettled([
				executeQuery<LiveCalcDataResponse>(GET_LIVE_POINTS, {
					entryId: Number(entries[0].id),
					eventId: gameweek
				}),
				executeQuery<LiveCalcDataResponse>(GET_LIVE_POINTS, {
					entryId: Number(entries[1].id),
					eventId: gameweek
				})
			])

			if (cancelled) return

			const a = resA.status === 'fulfilled' ? resA.value.calcLivePointsByEntry : null
			const b = resB.status === 'fulfilled' ? resB.value.calcLivePointsByEntry : null
			setLiveData([a, b])
			setIsLoading(false)
		}

		void fetchBoth()
		return () => { cancelled = true }
	}, [open, entries, gameweek])

	const [entryA, entryB] = entries
	const [liveA, liveB] = liveData

	const gwPtsA = entryA.gwPoints ?? entryA.livePoints
	const gwPtsB = entryB.gwPoints ?? entryB.livePoints
	const gwNetA = entryA.gwNetPoints ?? entryA.livePoints
	const gwNetB = entryB.gwNetPoints ?? entryB.livePoints
	const costA = entryA.eventCost ?? 0
	const costB = entryB.eventCost ?? 0
	const totalA = entryA.totalPoints ?? entryA.livePoints
	const totalB = entryB.totalPoints ?? entryB.livePoints

	const picksA = liveA
		? [...liveA.pickList].sort((a, b) => a.position - b.position)
		: [...entryA.picks].sort((a, b) => a.position - b.position)
	const picksB = liveB
		? [...liveB.pickList].sort((a, b) => a.position - b.position)
		: [...entryB.picks].sort((a, b) => a.position - b.position)

	const maxPicks = Math.max(picksA.length, picksB.length)

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className="w-full sm:max-w-[680px] overflow-y-auto p-0 flex flex-col"
			>
				<SheetHeader className="p-4 pb-3 border-b">
					<SheetTitle className="text-sm">
						<span className="text-primary">{entryA.teamName}</span>
						<span className="text-muted-foreground mx-2">vs</span>
						<span className="text-primary">{entryB.teamName}</span>
					</SheetTitle>
					<p className="text-xs text-muted-foreground">GW{gameweek} Comparison</p>
				</SheetHeader>

				<div className="flex-1 overflow-y-auto">
					{/* Overview section */}
					<div className="px-3 pt-3 pb-1">
						<p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 px-1">Overview</p>
						<div className="border rounded-lg overflow-hidden">
							{/* Entry headers */}
							<div className="grid grid-cols-[1fr_auto_1fr] bg-muted/30 px-3 py-2">
								<div className="text-right text-xs font-medium truncate pr-3">{entryA.teamName}</div>
								<div className="min-w-[80px]" />
								<div className="text-left text-xs font-medium truncate pl-3">{entryB.teamName}</div>
							</div>

							<div className="px-3">
								<OverviewRow
									label="Manager"
									leftValue={<span className="text-foreground text-xs">{entryA.managerName}</span>}
									rightValue={<span className="text-foreground text-xs">{entryB.managerName}</span>}
								/>
								<OverviewRow
									label="GW Pts"
									leftValue={costA > 0 ? `${gwPtsA} (-${costA})` : gwPtsA}
									rightValue={costB > 0 ? `${gwPtsB} (-${costB})` : gwPtsB}
									leftWins={gwPtsA > gwPtsB}
									rightWins={gwPtsB > gwPtsA}
								/>
								<OverviewRow
									label="GW Net"
									leftValue={gwNetA}
									rightValue={gwNetB}
									leftWins={gwNetA > gwNetB}
									rightWins={gwNetB > gwNetA}
								/>
								<OverviewRow
									label="Total Pts"
									leftValue={totalA}
									rightValue={totalB}
									leftWins={totalA > totalB}
									rightWins={totalB > totalA}
								/>
								<OverviewRow
									label="Overall Rank"
									leftValue={formatOR(entryA.overallRank)}
									rightValue={formatOR(entryB.overallRank)}
									leftWins={!!entryA.overallRank && !!entryB.overallRank && entryA.overallRank < entryB.overallRank}
									rightWins={!!entryA.overallRank && !!entryB.overallRank && entryB.overallRank < entryA.overallRank}
								/>
								<OverviewRow
									label="Chip"
									leftValue={<ChipBadges chips={entryA.chips} />}
									rightValue={<ChipBadges chips={entryB.chips} />}
								/>
								<OverviewRow
									label="Played"
									leftValue={`${entryA.playersPlayed}/${entryA.playersPlayed + entryA.playersToPlay}`}
									rightValue={`${entryB.playersPlayed}/${entryB.playersPlayed + entryB.playersToPlay}`}
									leftWins={entryA.playersPlayed > entryB.playersPlayed}
									rightWins={entryB.playersPlayed > entryA.playersPlayed}
								/>
							</div>
						</div>
					</div>

					{/* Squad comparison section */}
					<div className="px-3 pt-4 pb-4">
						<p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 px-1">Squad Comparison</p>

						{isLoading ? (
							<div className="border rounded-lg overflow-hidden">
								{Array.from({ length: 15 }).map((_, i) => (
									<div key={i} className="grid grid-cols-[1fr_auto_1fr] items-center py-2 px-3 border-b last:border-0">
										<Skeleton className="h-3 w-24 ml-auto" />
										<div className="min-w-[36px]" />
										<Skeleton className="h-3 w-24" />
									</div>
								))}
							</div>
						) : (
							<div className="border rounded-lg overflow-hidden">
								{/* Column headers */}
								<div className="grid grid-cols-[1fr_auto_1fr] bg-muted/30 px-3 py-1.5">
									<div className="text-right text-[10px] text-muted-foreground pr-3">{entryA.teamName}</div>
									<div className="min-w-[36px]" />
									<div className="text-left text-[10px] text-muted-foreground pl-3">{entryB.teamName}</div>
								</div>

								{/* Starting XI label */}
								<div className="px-3 py-1 bg-muted/10 border-b">
									<span className="text-[10px] text-muted-foreground font-medium">Starting XI</span>
								</div>

								{Array.from({ length: Math.min(11, maxPicks) }).map((_, i) => {
									const pA = picksA[i]
									const pB = picksB[i]

									const leftPick = liveA && pA
										? {
												webName: pA.webName,
												totalPoints: (pA as { totalPoints?: number }).totalPoints ?? 0,
												minutes: (pA as { minutes?: number }).minutes ?? 0,
												starts: (pA as { starts?: boolean }).starts ?? false,
												isCaptain: liveA.captainName === pA.webName
											}
										: pA
											? { webName: pA.webName, totalPoints: 0, minutes: 0, starts: false, isCaptain: (pA as { isCaptain?: boolean }).isCaptain ?? false }
											: null

									const rightPick = liveB && pB
										? {
												webName: pB.webName,
												totalPoints: (pB as { totalPoints?: number }).totalPoints ?? 0,
												minutes: (pB as { minutes?: number }).minutes ?? 0,
												starts: (pB as { starts?: boolean }).starts ?? false,
												isCaptain: liveB.captainName === pB.webName
											}
										: pB
											? { webName: pB.webName, totalPoints: 0, minutes: 0, starts: false, isCaptain: (pB as { isCaptain?: boolean }).isCaptain ?? false }
											: null

									const elementType = (pA as { elementType?: number; elementTypeName?: string })?.elementType
										?? (pA as { elementTypeName?: string })?.elementTypeName
										?? 0
									const posLabel = typeof elementType === 'number'
										? elementTypeLabel(elementType, i + 1)
										: String(elementType ?? '—').slice(0, 3)

									return (
										<PlayerCompareRow
											key={i}
											leftPick={leftPick}
											rightPick={rightPick}
											posLabel={posLabel}
											isBench={false}
										/>
									)
								})}

								{/* Bench label */}
								{maxPicks > 11 && (
									<div className="px-3 py-1 bg-accent/30 border-b border-t">
										<span className="text-[10px] text-muted-foreground font-medium">Substitutes</span>
									</div>
								)}

								{maxPicks > 11 && Array.from({ length: maxPicks - 11 }).map((_, i) => {
									const idx = 11 + i
									const pA = picksA[idx]
									const pB = picksB[idx]

									const leftPick = liveA && pA
										? {
												webName: pA.webName,
												totalPoints: (pA as { totalPoints?: number }).totalPoints ?? 0,
												minutes: (pA as { minutes?: number }).minutes ?? 0,
												starts: (pA as { starts?: boolean }).starts ?? false,
												isCaptain: liveA.captainName === pA.webName
											}
										: pA
											? { webName: pA.webName, totalPoints: 0, minutes: 0, starts: false, isCaptain: (pA as { isCaptain?: boolean }).isCaptain ?? false }
											: null

									const rightPick = liveB && pB
										? {
												webName: pB.webName,
												totalPoints: (pB as { totalPoints?: number }).totalPoints ?? 0,
												minutes: (pB as { minutes?: number }).minutes ?? 0,
												starts: (pB as { starts?: boolean }).starts ?? false,
												isCaptain: liveB.captainName === pB.webName
											}
										: pB
											? { webName: pB.webName, totalPoints: 0, minutes: 0, starts: false, isCaptain: (pB as { isCaptain?: boolean }).isCaptain ?? false }
											: null

									return (
										<PlayerCompareRow
											key={idx}
											leftPick={leftPick}
											rightPick={rightPick}
											posLabel="SUB"
											isBench
										/>
									)
								})}
							</div>
						)}
					</div>
				</div>
			</SheetContent>
		</Sheet>
	)
}
