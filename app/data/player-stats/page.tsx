'use client'

import RootLayout from '@/components/layout/RootLayout'
import {
	PlayerDirectoryPicker,
	type PlayerDirectoryOption
} from '@/components/player/PlayerDirectoryPicker'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_PLAYER_DETAIL,
	type PlayerDetailData,
	type PlayerDetailFixture,
	type PlayerDetailResponse
} from '@/lib/graphql/queries'
import { useEvent } from '@/lib/event-context'
import { format } from 'date-fns'
import {
	Activity,
	ArrowDownRight,
	ArrowUpRight,
	BarChart3,
	Calendar,
	Shield,
	Trophy,
	User,
	X,
	Zap
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

const RECENT_PLAYERS_KEY_1 = 'player-stats-recent-1'
const RECENT_PLAYERS_KEY_2 = 'player-stats-recent-2'
const RECENT_PLAYERS_MAX = 5

function loadRecentPlayers(key: string): PlayerDirectoryOption[] {
	try {
		const raw = localStorage.getItem(key)
		return raw ? (JSON.parse(raw) as PlayerDirectoryOption[]) : []
	} catch {
		return []
	}
}

function saveRecentPlayer(key: string, player: PlayerDirectoryOption) {
	try {
		const existing = loadRecentPlayers(key).filter(p => p.id !== player.id)
		localStorage.setItem(key, JSON.stringify([player, ...existing].slice(0, RECENT_PLAYERS_MAX)))
	} catch {
		// localStorage unavailable — silently ignore
	}
}

const DIFFICULTY_COLORS: Record<number, string> = {
	1: 'bg-emerald-500',
	2: 'bg-green-400',
	3: 'bg-amber-400',
	4: 'bg-orange-500',
	5: 'bg-red-600'
}

const formatPrice = (raw: number) => `£${(raw / 10).toFixed(1)}m`

const formatPriceDiff = (current: number, start: number) => {
	const diff = current - start
	if (diff === 0) return null
	const sign = diff > 0 ? '+' : ''
	return `${sign}${(diff / 10).toFixed(1)}m`
}

function StatCell({
	label,
	value,
	sub,
}: {
	label: string
	value: string | number | null
	sub?: string
}) {
	return (
		<div className="bg-accent/30 rounded-lg p-3 text-center">
			<p className="text-xs text-muted-foreground mb-1">{label}</p>
			<p className="text-xl font-bold">{value ?? '—'}</p>
			{sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
		</div>
	)
}

function IctBar({
	label,
	value,
	color,
	max = 100,
}: {
	label: string
	value: number | null
	color: string
	max?: number
}) {
	const numeric = value ?? 0
	const pct = Math.min(100, (numeric / max) * 100)
	return (
		<div>
			<div className="flex justify-between items-center mb-1">
				<span className="text-sm">{label}</span>
				<span className="text-sm font-medium">{numeric}</span>
			</div>
			<div className="w-full bg-muted rounded-full h-2">
				<div className={`${color} h-2 rounded-full`} style={{ width: `${pct}%` }} />
			</div>
		</div>
	)
}

function CompareRow({
	label,
	v1,
	v2,
	higherIsBetter = true,
}: {
	label: string
	v1: string | number | null
	v2: string | number | null
	higherIsBetter?: boolean
}) {
	const dv1 = v1 ?? '—'
	const dv2 = v2 ?? '—'
	const n1 = parseFloat(String(dv1).replace(/[^0-9.-]/g, ''))
	const n2 = parseFloat(String(dv2).replace(/[^0-9.-]/g, ''))
	const valid = !isNaN(n1) && !isNaN(n2) && n1 !== n2
	const p1Wins = valid && (higherIsBetter ? n1 > n2 : n1 < n2)
	const p2Wins = valid && (higherIsBetter ? n2 > n1 : n2 < n1)
	return (
		<div className="grid grid-cols-3 items-center py-2 border-b last:border-0 text-sm">
			<span className={`text-right pr-4 font-medium tabular-nums ${p1Wins ? 'text-primary' : ''}`}>{dv1}</span>
			<span className="text-center text-xs text-muted-foreground">{label}</span>
			<span className={`text-left pl-4 font-medium tabular-nums ${p2Wins ? 'text-primary' : ''}`}>{dv2}</span>
		</div>
	)
}

function CompareSectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
	return (
		<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
			{icon}
			{label}
		</h3>
	)
}

function DualIctBar({
	label,
	v1,
	v2,
	name1,
	name2,
	max,
}: {
	label: string
	v1: number | null
	v2: number | null
	name1: string
	name2: string
	max: number
}) {
	const n1 = v1 ?? 0
	const n2 = v2 ?? 0
	const pct1 = Math.min(100, (n1 / max) * 100)
	const pct2 = Math.min(100, (n2 / max) * 100)
	return (
		<div className="space-y-1">
			<div className="flex justify-between items-center text-xs text-muted-foreground">
				<span>{label}</span>
			</div>
			<div className="flex items-center gap-2 text-xs">
				<span className="w-16 text-right truncate text-muted-foreground">{name1}</span>
				<div className="flex-1 bg-muted rounded-full h-2">
					<div className="bg-blue-500 h-2 rounded-full" style={{ width: `${pct1}%` }} />
				</div>
				<span className="w-8 font-medium">{n1}</span>
			</div>
			<div className="flex items-center gap-2 text-xs">
				<span className="w-16 text-right truncate text-muted-foreground">{name2}</span>
				<div className="flex-1 bg-muted rounded-full h-2">
					<div className="bg-amber-500 h-2 rounded-full" style={{ width: `${pct2}%` }} />
				</div>
				<span className="w-8 font-medium">{n2}</span>
			</div>
		</div>
	)
}

function PlayerDetailSkeleton() {
	return (
		<div className="space-y-4">
			<Skeleton className="h-32 w-full rounded-lg" />
			<Skeleton className="h-12 w-full rounded-lg" />
			<Skeleton className="h-64 w-full rounded-lg" />
		</div>
	)
}

function PlayerMiniCard({
	detail,
	currentGameweek,
	accent,
}: {
	detail: PlayerDetailData
	currentGameweek: number | undefined
	accent: string
}) {
	const priceDiff = formatPriceDiff(detail.price, detail.startPrice)
	return (
		<Card className={`p-4 border-t-2 ${accent}`}>
			<div className="flex items-center gap-2 mb-1">
				<span className="font-bold truncate">{detail.webName}</span>
				<Badge variant="outline" className="text-xs shrink-0">{detail.elementTypeName}</Badge>
			</div>
			<p className="text-xs text-muted-foreground mb-3">{detail.teamShortName}</p>
			<div className="grid grid-cols-3 gap-2">
				<div className="text-center">
					<p className="text-[10px] text-muted-foreground">Price</p>
					<p className="text-sm font-bold">{formatPrice(detail.price)}</p>
					{priceDiff && (
						<p className={`text-[10px] ${priceDiff.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'}`}>
							{priceDiff}
						</p>
					)}
				</div>
				<div className="text-center">
					<p className="text-[10px] text-muted-foreground">GW{currentGameweek}</p>
					<p className="text-sm font-bold text-primary">{detail.eventPoints}</p>
				</div>
				<div className="text-center">
					<p className="text-[10px] text-muted-foreground">Total</p>
					<p className="text-sm font-bold">{detail.totalPoints}</p>
				</div>
				<div className="text-center">
					<p className="text-[10px] text-muted-foreground">Selected</p>
					<p className="text-sm font-bold">
						{detail.selectedByPercent != null ? `${detail.selectedByPercent}%` : '—'}
					</p>
				</div>
				<div className="text-center">
					<p className="text-[10px] text-muted-foreground">Form</p>
					<p className="text-sm font-bold">{detail.form ?? '—'}</p>
				</div>
			</div>
		</Card>
	)
}

export default function PlayerStatsPage() {
	const { currentEventId } = useEvent()
	const [currentGameweek] = useState<number | undefined>(currentEventId ?? undefined)

	const [selectedPlayer, setSelectedPlayer] = useState<PlayerDirectoryOption | null>(null)
	const [recentPlayers, setRecentPlayers] = useState<PlayerDirectoryOption[]>([])
	const [playerDetail, setPlayerDetail] = useState<PlayerDetailData | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const [selectedPlayer2, setSelectedPlayer2] = useState<PlayerDirectoryOption | null>(null)
	const [recentPlayers2, setRecentPlayers2] = useState<PlayerDirectoryOption[]>([])
	const [playerDetail2, setPlayerDetail2] = useState<PlayerDetailData | null>(null)
	const [isLoading2, setIsLoading2] = useState(false)
	const [error2, setError2] = useState<string | null>(null)

	// Load recent players after hydration: reading localStorage during the
	// initial render would make client HTML diverge from the prerendered HTML.
	useEffect(() => {
		let cancelled = false
		queueMicrotask(() => {
			if (cancelled) return
			setRecentPlayers(loadRecentPlayers(RECENT_PLAYERS_KEY_1))
			setRecentPlayers2(loadRecentPlayers(RECENT_PLAYERS_KEY_2))
		})
		return () => {
			cancelled = true
		}
	}, [])

	const isComparing = playerDetail !== null && playerDetail2 !== null


	const fetchPlayerDetail = useCallback(async (playerId: number, eventId: number) => {
		setIsLoading(true)
		setError(null)
		try {
			const res = await executeQuery<PlayerDetailResponse>(GET_PLAYER_DETAIL, { playerId, eventId })
			setPlayerDetail(res.playerDetail)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load player data.')
			setPlayerDetail(null)
		} finally {
			setIsLoading(false)
		}
	}, [])

	const fetchPlayerDetail2 = useCallback(async (playerId: number, eventId: number) => {
		setIsLoading2(true)
		setError2(null)
		try {
			const res = await executeQuery<PlayerDetailResponse>(GET_PLAYER_DETAIL, { playerId, eventId })
			setPlayerDetail2(res.playerDetail)
		} catch (err) {
			setError2(err instanceof Error ? err.message : 'Failed to load player data.')
			setPlayerDetail2(null)
		} finally {
			setIsLoading2(false)
		}
	}, [])

	const handleSelectPlayer = useCallback((player: PlayerDirectoryOption) => {
		setSelectedPlayer(player)
		saveRecentPlayer(RECENT_PLAYERS_KEY_1, player)
		setRecentPlayers(loadRecentPlayers(RECENT_PLAYERS_KEY_1))
	}, [])

	const handleSelectPlayer2 = useCallback((player: PlayerDirectoryOption) => {
		setSelectedPlayer2(player)
		saveRecentPlayer(RECENT_PLAYERS_KEY_2, player)
		setRecentPlayers2(loadRecentPlayers(RECENT_PLAYERS_KEY_2))
	}, [])

	const clearPlayer2 = useCallback(() => {
		setSelectedPlayer2(null)
		setPlayerDetail2(null)
		setError2(null)
	}, [])

	useEffect(() => {
		if (!selectedPlayer || !currentGameweek) return
		let cancelled = false
		void Promise.resolve().then(async () => {
			if (cancelled) return
			await fetchPlayerDetail(Number(selectedPlayer.id), currentGameweek)
		})
		return () => {
			cancelled = true
		}
	}, [selectedPlayer, currentGameweek, fetchPlayerDetail])

	useEffect(() => {
		if (!selectedPlayer2 || !currentGameweek) return
		let cancelled = false
		void Promise.resolve().then(async () => {
			if (cancelled) return
			await fetchPlayerDetail2(Number(selectedPlayer2.id), currentGameweek)
		})
		return () => {
			cancelled = true
		}
	}, [selectedPlayer2, currentGameweek, fetchPlayerDetail2])

	const priceDiff = playerDetail ? formatPriceDiff(playerDetail.price, playerDetail.startPrice) : null

	return (
		<RootLayout>
			<div className="container max-w-4xl mx-auto px-4 py-8">
				<h1 className="text-2xl font-bold mb-6">Player Statistics</h1>

				{/* Player pickers */}
				<div className="space-y-4 mb-6">
					{/* Player 1 */}
					<div>
						<p className="text-sm text-muted-foreground mb-2">Player 1</p>
						<PlayerDirectoryPicker
							onSelect={handleSelectPlayer}
							excludedPlayerIds={selectedPlayer2 ? [selectedPlayer2.id] : []}
						/>
						{recentPlayers.length > 0 && (
							<div className="flex flex-wrap items-center gap-2 mt-2">
								<span className="text-xs text-muted-foreground shrink-0">Recent:</span>
								{recentPlayers.map(p => (
									<button
										key={p.id}
										type="button"
										onClick={() => handleSelectPlayer(p)}
										className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
											selectedPlayer?.id === p.id
												? 'bg-primary text-primary-foreground border-primary'
												: 'bg-accent/40 hover:bg-accent border-transparent'
										}`}
									>
										{p.name}
										<span className="text-[10px] opacity-70">{p.teamShortName}</span>
									</button>
								))}
								<button
									type="button"
									onClick={() => {
										localStorage.removeItem(RECENT_PLAYERS_KEY_1)
										setRecentPlayers([])
										setSelectedPlayer(null)
										setPlayerDetail(null)
									}}
									className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-1"
								>
									Clear
								</button>
							</div>
						)}
					</div>

					{/* Divider */}
					<div className="flex items-center gap-3">
						<div className="flex-1 border-t border-dashed" />
						<span className="text-xs text-muted-foreground font-medium">vs</span>
						<div className="flex-1 border-t border-dashed" />
					</div>

					{/* Player 2 */}
					<div>
						<div className="flex items-center justify-between mb-2">
							<p className="text-sm text-muted-foreground">Player 2 (optional)</p>
							{selectedPlayer2 && (
								<button
									type="button"
									onClick={clearPlayer2}
									className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
								>
									<X className="h-3 w-3" />
									Remove
								</button>
							)}
						</div>
						<PlayerDirectoryPicker
							onSelect={handleSelectPlayer2}
							excludedPlayerIds={selectedPlayer ? [selectedPlayer.id] : []}
						/>
						{recentPlayers2.length > 0 && (
							<div className="flex flex-wrap items-center gap-2 mt-2">
								<span className="text-xs text-muted-foreground shrink-0">Recent:</span>
								{recentPlayers2.map(p => (
									<button
										key={p.id}
										type="button"
										onClick={() => handleSelectPlayer2(p)}
										className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
											selectedPlayer2?.id === p.id
												? 'bg-primary text-primary-foreground border-primary'
												: 'bg-accent/40 hover:bg-accent border-transparent'
										}`}
									>
										{p.name}
										<span className="text-[10px] opacity-70">{p.teamShortName}</span>
									</button>
								))}
								<button
									type="button"
									onClick={() => {
										localStorage.removeItem(RECENT_PLAYERS_KEY_2)
										setRecentPlayers2([])
										clearPlayer2()
									}}
									className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-1"
								>
									Clear
								</button>
							</div>
						)}
					</div>
				</div>

				{/* Main content */}
				{!selectedPlayer ? (
					<Card className="p-8 text-center">
						<User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
						<h2 className="text-lg font-medium">Select a player to view statistics</h2>
						<p className="text-muted-foreground mt-2 text-sm">
							Search by name or filter by team and position above.
						</p>
					</Card>
				) : isLoading || (selectedPlayer2 && isLoading2) ? (
					<PlayerDetailSkeleton />
				) : error ? (
					<Card className="p-8 text-center">
						<p className="text-sm text-destructive">{error}</p>
					</Card>
				) : playerDetail ? (
					<>
						{/* Header */}
						{isComparing ? (
							<div className="grid grid-cols-2 gap-3 mb-6">
								<PlayerMiniCard detail={playerDetail} currentGameweek={currentGameweek} accent="border-blue-500" />
								<PlayerMiniCard detail={playerDetail2!} currentGameweek={currentGameweek} accent="border-amber-500" />
							</div>
						) : (
							<Card className="p-5 mb-6">
								<div className="flex items-center gap-2 mb-1">
									<h2 className="text-2xl font-bold">{playerDetail.webName}</h2>
									<Badge variant="outline" className="text-xs">{playerDetail.elementTypeName}</Badge>
								</div>
								<p className="text-sm text-muted-foreground mb-4">{playerDetail.teamShortName}</p>
								<div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
									<div className="bg-accent/30 rounded-lg p-3 text-center">
										<p className="text-xs text-muted-foreground mb-1">Price</p>
										<p className="font-bold">{formatPrice(playerDetail.price)}</p>
										{priceDiff && (
											<p className={`text-xs mt-0.5 ${priceDiff.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'}`}>
												{priceDiff}
											</p>
										)}
									</div>
									<div className="bg-accent/30 rounded-lg p-3 text-center">
										<p className="text-xs text-muted-foreground mb-1">GW {currentGameweek} Pts</p>
										<p className="font-bold text-primary">{playerDetail.eventPoints}</p>
									</div>
									<div className="bg-accent/30 rounded-lg p-3 text-center">
										<p className="text-xs text-muted-foreground mb-1">Total Pts</p>
										<p className="font-bold">{playerDetail.totalPoints}</p>
									</div>
									<div className="bg-accent/30 rounded-lg p-3 text-center">
										<p className="text-xs text-muted-foreground mb-1">Selected</p>
										<p className="font-bold">
											{playerDetail.selectedByPercent != null ? `${playerDetail.selectedByPercent}%` : '—'}
										</p>
									</div>
									<div className="bg-accent/30 rounded-lg p-3 text-center">
										<p className="text-xs text-muted-foreground mb-1">Form</p>
										<p className="font-bold">{playerDetail.form ?? '-'}</p>
									</div>
								</div>
							</Card>
						)}

						{/* Comparison column headers */}
						{isComparing && (
							<div className="grid grid-cols-3 text-sm font-semibold mb-2 px-1">
								<span className="text-right pr-4 text-blue-500 truncate">{playerDetail.webName}</span>
								<span />
								<span className="text-left pl-4 text-amber-500 truncate">{playerDetail2!.webName}</span>
							</div>
						)}

						<Tabs defaultValue="overview">
							<TabsList className="w-full grid grid-cols-4 mb-6">
								<TabsTrigger value="overview">Overview</TabsTrigger>
								<TabsTrigger value="season">Season</TabsTrigger>
								<TabsTrigger value="ict">ICT</TabsTrigger>
								<TabsTrigger value="fixtures">Fixtures</TabsTrigger>
							</TabsList>

							{/* OVERVIEW */}
							<TabsContent value="overview">
								{isComparing ? (
									<Card className="p-5 space-y-5">
										<div>
											<CompareSectionHeader icon={<BarChart3 className="h-4 w-4" />} label={`GW ${currentGameweek}`} />
											<CompareRow label="Points" v1={playerDetail.eventPoints} v2={playerDetail2!.eventPoints} />
										</div>
										<div>
											<CompareSectionHeader icon={<Trophy className="h-4 w-4" />} label="Season Totals" />
											<CompareRow label="Total Points" v1={playerDetail.totalPoints} v2={playerDetail2!.totalPoints} />
											<CompareRow label="Goals" v1={playerDetail.goalsScored} v2={playerDetail2!.goalsScored} />
											<CompareRow label="Assists" v1={playerDetail.assists} v2={playerDetail2!.assists} />
											<CompareRow label="Clean Sheets" v1={playerDetail.cleanSheets} v2={playerDetail2!.cleanSheets} />
											<CompareRow label="Minutes" v1={playerDetail.minutes} v2={playerDetail2!.minutes} />
										</div>
										<div>
											<CompareSectionHeader icon={<Activity className="h-4 w-4" />} label="Ownership & Transfers" />
											<CompareRow
												label="Selected By %"
												v1={playerDetail.selectedByPercent != null ? `${playerDetail.selectedByPercent}%` : null}
												v2={playerDetail2!.selectedByPercent != null ? `${playerDetail2!.selectedByPercent}%` : null}
											/>
											<CompareRow label="Season In" v1={playerDetail.seasonTransfersIn.toLocaleString()} v2={playerDetail2!.seasonTransfersIn.toLocaleString()} />
											<CompareRow label="Season Out" v1={playerDetail.seasonTransfersOut.toLocaleString()} v2={playerDetail2!.seasonTransfersOut.toLocaleString()} higherIsBetter={false} />
											<CompareRow label="GW Net" v1={(playerDetail.transfersInEvent - playerDetail.transfersOutEvent).toLocaleString()} v2={(playerDetail2!.transfersInEvent - playerDetail2!.transfersOutEvent).toLocaleString()} />
										</div>
									</Card>
								) : (
									<Card className="p-5 space-y-6">
										<div>
											<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
												<BarChart3 className="h-4 w-4" />
												GW {currentGameweek}
											</h3>
											<StatCell label="Points" value={playerDetail.eventPoints} />
										</div>
										<div>
											<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
												<Trophy className="h-4 w-4" />
												Season Totals
											</h3>
											<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
												<StatCell label="Goals" value={playerDetail.goalsScored} />
												<StatCell label="Assists" value={playerDetail.assists} />
												<StatCell label="Clean Sheets" value={playerDetail.cleanSheets} />
												<StatCell label="Minutes" value={playerDetail.minutes} />
											</div>
										</div>
										<div>
											<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
												<Activity className="h-4 w-4" />
												Ownership & Transfers
											</h3>
											<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
												<StatCell
													label="Selected By"
													value={
														playerDetail.selectedByPercent != null
															? `${playerDetail.selectedByPercent}%`
															: null
													}
												/>
												<StatCell label="Season In" value={playerDetail.seasonTransfersIn.toLocaleString()} />
												<StatCell label="Season Out" value={playerDetail.seasonTransfersOut.toLocaleString()} />
												<StatCell label="GW Net" value={(playerDetail.transfersInEvent - playerDetail.transfersOutEvent).toLocaleString()} />
											</div>
										</div>
									</Card>
								)}
							</TabsContent>

							{/* SEASON STATS */}
							<TabsContent value="season">
								{isComparing ? (
									<Card className="p-5 space-y-5">
										<div>
											<CompareSectionHeader icon={<Trophy className="h-4 w-4" />} label="Attacking" />
											<CompareRow label="Goals" v1={playerDetail.goalsScored} v2={playerDetail2!.goalsScored} />
											<CompareRow label="Assists" v1={playerDetail.assists} v2={playerDetail2!.assists} />
										</div>
										<div>
											<CompareSectionHeader icon={<Shield className="h-4 w-4" />} label="Defensive" />
											<CompareRow label="Clean Sheets" v1={playerDetail.cleanSheets} v2={playerDetail2!.cleanSheets} />
											<CompareRow label="Goals Conceded" v1={playerDetail.goalsConceded} v2={playerDetail2!.goalsConceded} higherIsBetter={false} />
											<CompareRow label="Saves" v1={playerDetail.saves} v2={playerDetail2!.saves} />
											<CompareRow label="Pen. Saved" v1={playerDetail.penaltiesSaved} v2={playerDetail2!.penaltiesSaved} />
											<CompareRow label="Own Goals" v1={playerDetail.ownGoals} v2={playerDetail2!.ownGoals} higherIsBetter={false} />
										</div>
										<div>
											<CompareSectionHeader icon={<Activity className="h-4 w-4" />} label="Discipline" />
											<CompareRow label="Yellow Cards" v1={playerDetail.yellowCards} v2={playerDetail2!.yellowCards} higherIsBetter={false} />
											<CompareRow label="Red Cards" v1={playerDetail.redCards} v2={playerDetail2!.redCards} higherIsBetter={false} />
										</div>
										<div>
											<CompareSectionHeader icon={null} label="FPL" />
											<CompareRow label="Bonus" v1={playerDetail.bonus} v2={playerDetail2!.bonus} />
											<CompareRow label="BPS" v1={playerDetail.bps} v2={playerDetail2!.bps} />
											<CompareRow label="Minutes" v1={playerDetail.minutes} v2={playerDetail2!.minutes} />
											<CompareRow label="Total Points" v1={playerDetail.totalPoints} v2={playerDetail2!.totalPoints} />
										</div>
										<div>
											<CompareSectionHeader icon={null} label="Price" />
											<CompareRow label="Current" v1={formatPrice(playerDetail.price)} v2={formatPrice(playerDetail2!.price)} higherIsBetter={false} />
											<CompareRow label="Start" v1={formatPrice(playerDetail.startPrice)} v2={formatPrice(playerDetail2!.startPrice)} higherIsBetter={false} />
										</div>
									</Card>
								) : (
									<Card className="p-5 space-y-6">
										{/* GKP */}
										{playerDetail.elementType === 1 && (
											<>
												<div>
													<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
														<Shield className="h-4 w-4" />
														Goalkeeping
													</h3>
													<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
														<StatCell label="Saves" value={playerDetail.saves} />
														<StatCell label="Pen. Saved" value={playerDetail.penaltiesSaved} />
														<StatCell label="Clean Sheets" value={playerDetail.cleanSheets} />
														<StatCell label="Goals Conceded" value={playerDetail.goalsConceded} />
													</div>
												</div>
												<div>
													<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
														<Trophy className="h-4 w-4" />
														Outfield
													</h3>
													<div className="grid grid-cols-3 gap-3">
														<StatCell label="Goals" value={playerDetail.goalsScored} />
														<StatCell label="Assists" value={playerDetail.assists} />
														<StatCell label="Own Goals" value={playerDetail.ownGoals} />
													</div>
												</div>
											</>
										)}
										{/* DEF */}
										{playerDetail.elementType === 2 && (
											<>
												<div>
													<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
														<Shield className="h-4 w-4" />
														Defensive
													</h3>
													<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
														<StatCell label="Clean Sheets" value={playerDetail.cleanSheets} />
														<StatCell label="Goals Conceded" value={playerDetail.goalsConceded} />
														<StatCell label="Own Goals" value={playerDetail.ownGoals} />
														<StatCell label="Pen. Saved" value={playerDetail.penaltiesSaved} />
													</div>
												</div>
												<div>
													<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
														<Trophy className="h-4 w-4" />
														Attacking
													</h3>
													<div className="grid grid-cols-2 gap-3">
														<StatCell label="Goals" value={playerDetail.goalsScored} />
														<StatCell label="Assists" value={playerDetail.assists} />
													</div>
												</div>
											</>
										)}
										{/* MID */}
										{playerDetail.elementType === 3 && (
											<>
												<div>
													<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
														<Trophy className="h-4 w-4" />
														Attacking
													</h3>
													<div className="grid grid-cols-2 gap-3">
														<StatCell label="Goals" value={playerDetail.goalsScored} />
														<StatCell label="Assists" value={playerDetail.assists} />
													</div>
												</div>
												<div>
													<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
														<Shield className="h-4 w-4" />
														Defensive
													</h3>
													<div className="grid grid-cols-2 gap-3">
														<StatCell label="Clean Sheets" value={playerDetail.cleanSheets} />
														<StatCell label="Goals Conceded" value={playerDetail.goalsConceded} />
													</div>
												</div>
											</>
										)}
										{/* FWD */}
										{playerDetail.elementType === 4 && (
											<div>
												<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
													<Trophy className="h-4 w-4" />
													Attacking
												</h3>
												<div className="grid grid-cols-2 gap-3">
													<StatCell label="Goals" value={playerDetail.goalsScored} />
													<StatCell label="Assists" value={playerDetail.assists} />
												</div>
											</div>
										)}
										{/* All — Discipline */}
										<div>
											<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
												<Activity className="h-4 w-4" />
												Discipline
											</h3>
											<div className="grid grid-cols-2 gap-3">
												<StatCell label="Yellow Cards" value={playerDetail.yellowCards} />
												<StatCell label="Red Cards" value={playerDetail.redCards} />
											</div>
										</div>
										{/* All — FPL */}
										<div>
											<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">FPL</h3>
											<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
												<StatCell label="Bonus" value={playerDetail.bonus} />
												<StatCell label="BPS" value={playerDetail.bps} />
												<StatCell label="Minutes" value={playerDetail.minutes} />
												<StatCell label="Total Points" value={playerDetail.totalPoints} />
											</div>
										</div>
										{/* Price */}
										<div>
											<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Price</h3>
											<div className="grid grid-cols-3 gap-3">
												<StatCell label="Current" value={formatPrice(playerDetail.price)} />
												<StatCell label="Start" value={formatPrice(playerDetail.startPrice)} />
												<StatCell label="Change" value={priceDiff ?? '—'} />
											</div>
										</div>
									</Card>
								)}
							</TabsContent>

							{/* ICT */}
							<TabsContent value="ict">
								{isComparing ? (
									<Card className="p-5 space-y-5">
										<div>
											<CompareSectionHeader icon={<Zap className="h-4 w-4" />} label="ICT Values" />
											<CompareRow label="Influence" v1={playerDetail.influence} v2={playerDetail2!.influence} />
											<CompareRow label="Creativity" v1={playerDetail.creativity} v2={playerDetail2!.creativity} />
											<CompareRow label="Threat" v1={playerDetail.threat} v2={playerDetail2!.threat} />
											<CompareRow label="ICT Index" v1={playerDetail.ictIndex} v2={playerDetail2!.ictIndex} />
										</div>
										<div className="space-y-4 pt-2">
											<DualIctBar label="Influence" v1={playerDetail.influence} v2={playerDetail2!.influence} name1={playerDetail.webName} name2={playerDetail2!.webName} max={1500} />
											<DualIctBar label="Creativity" v1={playerDetail.creativity} v2={playerDetail2!.creativity} name1={playerDetail.webName} name2={playerDetail2!.webName} max={800} />
											<DualIctBar label="Threat" v1={playerDetail.threat} v2={playerDetail2!.threat} name1={playerDetail.webName} name2={playerDetail2!.webName} max={2000} />
											<DualIctBar label="ICT Index" v1={playerDetail.ictIndex} v2={playerDetail2!.ictIndex} name1={playerDetail.webName} name2={playerDetail2!.webName} max={300} />
										</div>
									</Card>
								) : (
									<Card className="p-5">
										<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
											<Zap className="h-4 w-4" />
											ICT Index
										</h3>
										<div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
											<StatCell label="Influence" value={playerDetail.influence} />
											<StatCell label="Creativity" value={playerDetail.creativity} />
											<StatCell label="Threat" value={playerDetail.threat} />
											<StatCell label="ICT Index" value={playerDetail.ictIndex} />
										</div>
										<div className="space-y-4">
											<IctBar label="Influence" value={playerDetail.influence} color="bg-blue-500" max={1500} />
											<IctBar label="Creativity" value={playerDetail.creativity} color="bg-emerald-500" max={800} />
											<IctBar label="Threat" value={playerDetail.threat} color="bg-rose-500" max={2000} />
											<IctBar label="ICT Index" value={playerDetail.ictIndex} color="bg-primary" max={300} />
										</div>
									</Card>
								)}
							</TabsContent>

							{/* FIXTURES */}
							<TabsContent value="fixtures">
								{isComparing ? (
									<Card className="p-5">
										<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
											<Calendar className="h-4 w-4" />
											Fixtures
										</h3>
										<div className="grid grid-cols-[2rem_1fr_1fr] gap-2 mb-2 px-1 text-sm font-semibold">
											<span />
											<span className="text-blue-500 truncate">{playerDetail.webName}</span>
											<span className="text-amber-500 truncate">{playerDetail2!.webName}</span>
										</div>
										<div className="space-y-0.5">
											{(() => {
												const groupByGW = (fixtures: PlayerDetailFixture[]) => {
													const map = new Map<number, PlayerDetailFixture[]>()
													for (const f of fixtures) {
														const arr = map.get(f.event) ?? []
														arr.push(f)
														map.set(f.event, arr)
													}
													return map
												}

												const f1Map = groupByGW(playerDetail.fixtures)
												const f2Map = groupByGW(playerDetail2!.fixtures)

												const gws = Array.from(
													new Set([...Array.from(f1Map.keys()), ...Array.from(f2Map.keys())])
												).sort((a, b) => a - b)

												const renderFixtureStack = (fixtures: PlayerDetailFixture[] | undefined) => {
													if (!fixtures || fixtures.length === 0) {
														return (
															<span className="text-xs font-medium text-amber-600 dark:text-amber-400">BGW</span>
														)
													}
													return (
														<div className="space-y-0.5">
															{fixtures.map((f, i) => (
																<div key={i} className="flex items-center gap-1.5 min-w-0">
																	<span className="truncate text-xs font-medium">
																		{f.againstTeamShortName} ({f.wasHome ? 'H' : 'A'})
																	</span>
																	{f.finished && f.score ? (
																		<span className="font-mono text-[10px] shrink-0">{f.score}</span>
																	) : null}
																	<div
																		className={`w-1.5 h-1.5 rounded-full shrink-0 ${DIFFICULTY_COLORS[f.difficulty] ?? 'bg-muted'}`}
																		title={`Difficulty: ${f.difficulty}`}
																	/>
																</div>
															))}
														</div>
													)
												}

												return gws.map(gw => {
													const g1 = f1Map.get(gw)
													const g2 = f2Map.get(gw)
													const isDGW = (g1?.length ?? 0) > 1 || (g2?.length ?? 0) > 1
													const isCurrentGw = gw === currentGameweek

													return (
														<div
															key={gw}
															className={`grid grid-cols-[2rem_1fr_1fr] gap-2 items-start px-2 py-1.5 rounded-md ${
																isCurrentGw ? 'bg-primary/10 border border-primary/20' : 'hover:bg-accent/40'
															}`}
														>
															<div className="flex flex-col items-start gap-0.5 pt-0.5">
																<span className="text-xs text-muted-foreground">GW{gw}</span>
																{isDGW && (
																	<Badge variant="secondary" className="text-[9px] h-3.5 px-1 leading-none">DGW</Badge>
																)}
															</div>
															{renderFixtureStack(g1)}
															{renderFixtureStack(g2)}
														</div>
													)
												})
											})()}
										</div>
									</Card>
								) : (
									<Card className="p-5">
										<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
											<Calendar className="h-4 w-4" />
											All Fixtures
										</h3>
										<div className="space-y-1">
											{(() => {
												const groupByGW = (fixtures: PlayerDetailFixture[]) => {
													const map = new Map<number, PlayerDetailFixture[]>()
													for (const f of fixtures) {
														const arr = map.get(f.event) ?? []
														arr.push(f)
														map.set(f.event, arr)
													}
													return map
												}
												const grouped = groupByGW(playerDetail.fixtures)
												const gws = Array.from(grouped.keys()).sort((a, b) => a - b)

												return gws.map(gw => {
													const fixtures = grouped.get(gw)!
													const isSelected = gw === currentGameweek
													const isDGW = fixtures.length > 1
													const isBGW = fixtures.length === 1 && fixtures[0].bgw

													return (
														<div
															key={gw}
															className={`px-3 py-2 rounded-md text-sm ${
																isSelected ? 'bg-primary/10 border border-primary/20' : 'hover:bg-accent/40'
															}`}
														>
															<div className="flex items-center gap-2 mb-1">
																<span className="text-xs text-muted-foreground w-8 shrink-0">GW{gw}</span>
																{isDGW && (
																	<Badge variant="secondary" className="text-[9px] h-3.5 px-1 leading-none">DGW</Badge>
																)}
																{isBGW && (
																	<Badge variant="outline" className="text-[9px] h-3.5 px-1 leading-none text-amber-600 border-amber-400">BGW</Badge>
																)}
															</div>
															{fixtures.map((fixture, i) => {
																const opponent = `${fixture.againstTeamShortName} (${fixture.wasHome ? 'H' : 'A'})`
																const kickoff = fixture.kickoffTime
																	? format(new Date(fixture.kickoffTime), 'dd MMM HH:mm')
																	: '—'
																return (
																	<div key={i} className="flex items-center justify-between">
																		<div className="flex items-center gap-2 min-w-0">
																			<span className="w-8 shrink-0" />
																			<span className="font-medium truncate">{opponent}</span>
																		</div>
																		<div className="flex items-center gap-3 shrink-0 ml-2">
																			<span className="text-xs text-muted-foreground">{kickoff}</span>
																			{fixture.finished && fixture.score ? (
																				<span className="font-mono text-xs font-semibold w-10 text-center">{fixture.score}</span>
																			) : (
																				<span className="text-xs text-muted-foreground w-10 text-center">—</span>
																)}
																			<div
																				className={`w-2 h-2 rounded-full shrink-0 ${DIFFICULTY_COLORS[fixture.difficulty] ?? 'bg-muted'}`}
																				title={`Difficulty: ${fixture.difficulty}`}
																			/>
																		</div>
																	</div>
																)
															})}
														</div>
													)
												})
											})()}
										</div>
										<div className="mt-4 pt-3 border-t flex items-center gap-4 text-xs text-muted-foreground">
											<span className="flex items-center gap-1.5">
												<ArrowUpRight className="h-3 w-3 text-emerald-500" />
												Transfers In: {playerDetail.seasonTransfersIn.toLocaleString()}
											</span>
											<span className="flex items-center gap-1.5">
												<ArrowDownRight className="h-3 w-3 text-rose-500" />
												Transfers Out: {playerDetail.seasonTransfersOut.toLocaleString()}
											</span>
										</div>
									</Card>
								)}
							</TabsContent>
						</Tabs>
					</>
				) : null}
			</div>
		</RootLayout>
	)
}
