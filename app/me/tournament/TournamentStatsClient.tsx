'use client'

import { GameweekSelector } from '@/components/data/GameweekSelector'
import PageShell from '@/components/layout/PageShell'
import { StatsPageHeader } from '@/components/stats/StatsSurfaces'
import { ShareActions } from '@/components/share/ShareActions'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Link, usePathname, useRouter } from '@/i18n/navigation'
import { cn } from '@/lib/utils'
import type { MyFplSnapshotMeta } from '@/lib/graphql/operations/my-fpl'
import { AlertCircle, X } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import {
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState
} from 'react'
import { TournamentPerformance } from './_components/TournamentPerformance'
import { TournamentSeasonCharts } from './_components/TournamentSeasonCharts'
import { TournamentSeasonField } from './_components/TournamentSeasonField'
import { TournamentSeasonMeSection } from './_components/TournamentSeasonMe'
import { TournamentStatsHeader } from './_components/TournamentStatsHeader'
import { TournamentGameweekDetails } from './_components/TournamentGameweekDetails'
import {
	useTournamentStats,
	type TournamentStatsClientProps
} from './_hooks/useTournamentStats'
import {
	TournamentGameweekWorkspaceProvider,
	useTournamentGameweekWorkspace
} from './_lib/tournament-gameweek-workspace'
import {
	isKnownTournamentId,
	readLastTournamentId,
	writeLastTournamentId
} from './_lib/tournament-stats-preference'
import {
	buildTournamentStatsQueryString,
	parseTournamentStatsGw,
	parseTournamentStatsView,
	type TournamentStatsPageView
} from './_lib/tournament-stats-url'

function TournamentStatsBody(props: TournamentStatsClientProps) {
	const t = useTranslations('TournamentStats')
	const format = useFormatter()
	const lifecycleT = useTranslations('TournamentLifecycle')
	const router = useRouter()
	const pathname = usePathname()
	const searchParams = useSearchParams()
	const restoredPreferenceRef = useRef(false)

	const view = useMemo(
		() => parseTournamentStatsView(searchParams.get('view')),
		[searchParams]
	)

	const {
		dataGameweek,
		error,
		filteredStandings,
		hasMoreStandings,
		boardSearch,
		insightsReady,
		isBoardLoading,
		isLoading,
		loadMoreStandings,
		seasonField,
		seasonMe,
		seasonPath,
		seasonPathLoading,
		seasonPathState,
		selectedGameweek,
		setSelectedGameweek,
		selectedTournament,
		selectedTournamentId,
		setSelectedTournamentId,
		setStandingsSearch,
		standingsSearch,
		snapshotMeta,
		tournamentStats,
		tournaments,
		usedFallbackGameweek,
		reviewState,
		currentGameweek
	} = useTournamentStats({
		...props,
		loadGameweekData: view === 'gameweek',
		loadSeasonPath: view === 'season'
	})
	const shareRef = useRef<HTMLDivElement | null>(null)
	const shareText = useMemo(() => {
		const name = selectedTournament?.name ?? t('title')
		const lines =
			view === 'season'
				? [`# ${name} · ${t('viewSeason')}`]
				: [`# ${name} · GW${selectedGameweek || currentGameweek}`]

		if (view === 'season') {
			if (seasonMe) {
				const gapToLeader =
					seasonMe.gapToLeader == null
						? '—'
						: seasonMe.gapToLeader === 0
							? t('leading')
							: String(seasonMe.gapToLeader)
				lines.push(
					`${t('tournamentRank')}: ${seasonMe.tournamentRank ?? '—'}`,
					`${t('totalPoints')}: ${seasonMe.totalPoints ?? '—'}`,
					`${t('gapToLeader')}: ${gapToLeader}`
				)
			}
			if (seasonField) {
				lines.push(
					'',
					t('tournamentFieldAsOf', { gameweek: seasonField.asOfGameweek }),
					`${t('fieldTeams')}: ${seasonField.entryCount}`,
					`${t('fieldLeaderPoints')}: ${seasonField.leaderPoints ?? '—'}`,
					`${t('fieldAveragePoints')}: ${
						seasonField.averagePoints == null
							? '—'
							: format.number(seasonField.averagePoints, {
									minimumFractionDigits: 2,
									maximumFractionDigits: 2
								})
					}`,
					'',
					t('standings')
				)
				for (const row of seasonField.standings.slice(0, 12)) {
					lines.push(
						`- ${row.rank ?? '—'} ${row.teamName} · ${row.totalPoints ?? '—'} total`
					)
				}
			} else {
				lines.push('', t('tournamentFieldEmpty'))
			}
		} else {
			if (tournamentStats) {
				lines.push(`${t('myRank')}: ${tournamentStats.myRank ?? '—'}`)
				lines.push(
					`${t('topScore')}: ${tournamentStats.topPerformers[0]?.points ?? '—'}`
				)
			}
			lines.push('', t('standings'))
			for (const row of filteredStandings.slice(0, 12)) {
				lines.push(
					`- ${row.displayRank ?? '—'} ${row.teamName} · ${row.gameweekPoints} GW · ${row.totalPoints} total`
				)
			}
		}
		lines.push(
			'',
			typeof window !== 'undefined'
				? window.location.href
				: 'https://letletme.top/my-fpl/competitions'
		)
		return lines.join('\n')
	}, [
		currentGameweek,
		filteredStandings,
		format,
		seasonField,
		seasonMe,
		selectedGameweek,
		selectedTournament,
		t,
		tournamentStats,
		view
	])

	const maxGw =
		dataGameweek && dataGameweek > 0
			? Math.max(dataGameweek, currentGameweek)
			: currentGameweek

	const seedGw =
		props.initialSliceGameweek && props.initialSliceGameweek > 0
			? props.initialSliceGameweek
			: props.initialDataGameweek && props.initialDataGameweek > 0
				? props.initialDataGameweek
				: currentGameweek

	const replaceQuery = useCallback(
		(next: {
			view: TournamentStatsPageView
			gw: number | null
			tournamentId?: string
		}) => {
			const qs = buildTournamentStatsQueryString({
				tournamentId: next.tournamentId ?? selectedTournamentId,
				view: next.view,
				gw: next.gw != null && next.gw > 0 ? next.gw : null
			})
			const href = qs ? `${pathname}?${qs}` : pathname
			router.replace(href, { scroll: false })
		},
		[pathname, router, selectedTournamentId]
	)

	const handleActiveGameweekChange = useCallback(
		(gw: number, enterGameweekView: boolean) => {
			setSelectedGameweek(gw)
			const viewNow = parseTournamentStatsView(searchParams.get('view'))
			replaceQuery({
				view:
					enterGameweekView || viewNow === 'gameweek' ? 'gameweek' : 'season',
				gw
			})
		},
		[replaceQuery, searchParams, setSelectedGameweek]
	)
	const handleNavigateSeason = useCallback(() => {
		setStandingsSearch('')
		// Season is an as-of-latest-finalized view. Do not carry the historical
		// GW through the URL: workspace hydration would interpret it as a new
		// gameweek selection and immediately switch the tab back to Gameweek.
		replaceQuery({ view: 'season', gw: null })
	}, [replaceQuery, setStandingsSearch])

	// URL gw → selected gameweek
	useEffect(() => {
		// Season is always a latest-finalized snapshot. A bookmarked `gw` query
		// must not hydrate the prior event back into the gameweek state and
		// trigger a historical desk request after the season desk has loaded.
		if (view === 'season' || maxGw <= 0) return
		const raw = searchParams.get('gw')
		if (raw == null) return
		const next = parseTournamentStatsGw(raw, maxGw, selectedGameweek || maxGw)
		if (next > 0 && next !== selectedGameweek) setSelectedGameweek(next)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [searchParams, maxGw, view])

	// Restore last tournament when URL has no tournamentId (bare /my-fpl/competitions)
	useEffect(() => {
		if (restoredPreferenceRef.current) return
		if (tournaments.length === 0) return

		const urlId = searchParams.get('tournamentId')
		if (urlId && isKnownTournamentId(urlId, tournaments)) {
			// Explicit URL wins — remember it and stop
			writeLastTournamentId(props.entryId, urlId)
			restoredPreferenceRef.current = true
			return
		}

		const lastId = readLastTournamentId(props.entryId)
		if (lastId && isKnownTournamentId(lastId, tournaments)) {
			if (lastId !== selectedTournamentId) {
				setSelectedTournamentId(lastId)
				replaceQuery({
					tournamentId: lastId,
					view,
					gw: selectedGameweek > 0 ? selectedGameweek : seedGw
				})
			} else {
				// Already on stored id (SSR happened to match) — still pin URL
				writeLastTournamentId(props.entryId, lastId)
				if (!urlId) {
					replaceQuery({
						tournamentId: lastId,
						view,
						gw: selectedGameweek > 0 ? selectedGameweek : seedGw
					})
				}
			}
		} else if (selectedTournamentId) {
			// First visit: remember SSR default
			writeLastTournamentId(props.entryId, selectedTournamentId)
		}
		restoredPreferenceRef.current = true
		// eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot restore per mount
	}, [tournaments, props.entryId])

	// Keep preference in sync when selection changes after restore
	useEffect(() => {
		if (!restoredPreferenceRef.current) return
		if (!selectedTournamentId) return
		if (!isKnownTournamentId(selectedTournamentId, tournaments)) return
		writeLastTournamentId(props.entryId, selectedTournamentId)
	}, [props.entryId, selectedTournamentId, tournaments])

	const handleTournamentChange = (id: string) => {
		writeLastTournamentId(props.entryId, id)
		setSelectedTournamentId(id)
		// Keep view; clamp gw in URL
		replaceQuery({
			tournamentId: id,
			view,
			gw: selectedGameweek > 0 ? selectedGameweek : seedGw
		})
	}

	return (
		<PageShell>
			<div className="container mx-auto max-w-4xl px-4 py-8">
				<StatsPageHeader
					title={t('title')}
					badge={
						<ShareActions
							text={shareText}
							imageRef={shareRef}
							title={selectedTournament?.name ?? t('title')}
						/>
					}
				/>
				<div
					ref={shareRef}
					data-share-preserve-width="true"
				>
					{error ? (
						<Alert
							variant="destructive"
							className="mb-6"
							role="alert"
						>
							<AlertCircle aria-hidden="true" />
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					) : null}
					{snapshotMeta ? (
						<Alert className="mb-6">
							<AlertDescription>
								{snapshotMeta.kind === 'FINAL'
									? t('snapshotFinal', {
											date: formatSnapshotDate(snapshotMeta, format)
										})
									: t('snapshotProvisional', {
											date: formatSnapshotDate(snapshotMeta, format)
										})}{' '}
								{snapshotMeta.freshness === 'STALE'
									? t('snapshotStale')
									: snapshotMeta.freshness === 'GENERATING'
										? t('snapshotGenerating')
										: null}
								{snapshotMeta.kind === 'PROVISIONAL' && selectedTournamentId ? (
									<Link
										href={`/live/competitions/${selectedTournamentId}`}
										className="ml-2 font-semibold text-primary-ink underline-offset-4 hover:underline"
									>
										{t('openLive')}
									</Link>
								) : null}
							</AlertDescription>
						</Alert>
					) : null}

					{/* Frame: tournament picker always on */}
					<TournamentStatsHeader
						onTournamentChange={handleTournamentChange}
						selectedTournament={selectedTournament}
						selectedTournamentId={selectedTournamentId}
						tournaments={tournaments}
					/>

					{!selectedTournament ? (
						<Card
							className="p-6 shadow-sm"
							role="status"
						>
							<p className="text-sm text-muted-foreground">{t('noLinked')}</p>
						</Card>
					) : !insightsReady ? (
						<Card
							className="p-6 shadow-sm"
							aria-live="polite"
							aria-busy={isLoading}
						>
							<p className="text-sm text-muted-foreground">
								{isLoading
									? t('loading')
									: selectedTournament.setupStatus === 'FAILED'
										? lifecycleT('memberFailure')
										: selectedTournament.warningSummaries?.length ||
											  selectedTournament.setupHasWarnings
											? lifecycleT('warningSummary')
											: selectedTournament.standingsReadyAt
												? lifecycleT('enrichingMessage')
												: lifecycleT('leavePageMessage')}
							</p>
						</Card>
					) : (
						<TournamentGameweekWorkspaceProvider
							maxGw={maxGw > 0 ? maxGw : seedGw}
							initialGameweek={selectedGameweek > 0 ? selectedGameweek : seedGw}
							onActiveGameweekChange={handleActiveGameweekChange}
						>
							<TournamentViews
								view={view}
								onNavigateSeason={handleNavigateSeason}
								currentGameweek={currentGameweek}
								selectedTournamentId={selectedTournament?.id ?? null}
								maxGw={maxGw > 0 ? maxGw : seedGw}
								selectedGameweek={selectedGameweek}
								dataGameweek={dataGameweek}
								usedFallbackGameweek={usedFallbackGameweek}
								isLoading={isLoading}
								tournamentStats={tournamentStats}
								seasonField={seasonField}
								seasonMe={seasonMe}
								seasonPath={seasonPath}
								seasonPathLoading={seasonPathLoading}
								seasonPathState={seasonPathState}
								filteredStandings={filteredStandings}
								hasMoreStandings={hasMoreStandings}
								hasMoreSeasonRows={
									hasMoreStandings &&
									standingsSearch.trim() === '' &&
									boardSearch === ''
								}
								isBoardLoading={isBoardLoading}
								loadMoreStandings={loadMoreStandings}
								reviewState={reviewState}
								standingsSearch={standingsSearch}
								setStandingsSearch={setStandingsSearch}
								searchParamsGw={searchParams.get('gw')}
							/>
						</TournamentGameweekWorkspaceProvider>
					)}
				</div>
			</div>
		</PageShell>
	)
}

function TournamentViews({
	view,
	onNavigateSeason,
	currentGameweek,
	selectedTournamentId,
	maxGw,
	selectedGameweek,
	dataGameweek,
	usedFallbackGameweek,
	isLoading,
	tournamentStats,
	seasonField,
	seasonMe,
	seasonPath,
	seasonPathLoading,
	seasonPathState,
	filteredStandings,
	hasMoreStandings,
	hasMoreSeasonRows,
	isBoardLoading,
	loadMoreStandings,
	reviewState,
	standingsSearch,
	setStandingsSearch,
	searchParamsGw
}: {
	view: TournamentStatsPageView
	onNavigateSeason: () => void
	currentGameweek: number
	selectedTournamentId: number | null
	maxGw: number
	selectedGameweek: number
	dataGameweek: number | null
	usedFallbackGameweek: boolean
	isLoading: boolean
	tournamentStats: ReturnType<typeof useTournamentStats>['tournamentStats']
	seasonField: ReturnType<typeof useTournamentStats>['seasonField']
	seasonMe: ReturnType<typeof useTournamentStats>['seasonMe']
	seasonPath: ReturnType<typeof useTournamentStats>['seasonPath']
	seasonPathLoading: boolean
	seasonPathState: ReturnType<typeof useTournamentStats>['seasonPathState']
	filteredStandings: ReturnType<typeof useTournamentStats>['filteredStandings']
	hasMoreStandings: boolean
	hasMoreSeasonRows: boolean
	isBoardLoading: boolean
	loadMoreStandings: () => void
	reviewState: ReturnType<typeof useTournamentStats>['reviewState']
	standingsSearch: string
	setStandingsSearch: (v: string) => void
	searchParamsGw: string | null
}) {
	const t = useTranslations('TournamentStats')
	const workspace = useTournamentGameweekWorkspace()
	const lastUrlGwRef = useRef<string | null>(null)
	const [openInNewTab, setOpenInNewTab] = useState(false)

	// URL → open/focus GW tab when deep-linked (Team parity)
	useEffect(() => {
		if (searchParamsGw === lastUrlGwRef.current) return
		lastUrlGwRef.current = searchParamsGw
		const urlGw = parseTournamentStatsGw(
			searchParamsGw,
			maxGw,
			workspace.activeGameweek > 0 ? workspace.activeGameweek : maxGw
		)
		if (urlGw < 1) return
		if (
			urlGw === workspace.activeGameweek &&
			workspace.openGameweeks.includes(urlGw)
		) {
			return
		}
		if (view === 'gameweek' || searchParamsGw != null) {
			workspace.openGameweek(urlGw)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- deliberate URL gate
	}, [searchParamsGw, maxGw, view])

	const tabTriggerClass = (active: boolean) =>
		cn(
			'relative inline-flex h-11 items-center gap-0.5 rounded-none border-b-2 bg-transparent px-3 pb-3 pt-2 text-sm font-semibold sm:px-4',
			active
				? 'border-primary-ink text-foreground'
				: 'border-transparent text-muted-foreground hover:text-foreground'
		)

	const handleSelectorChange = (gw: number) => {
		if (openInNewTab) workspace.openGameweek(gw)
		else workspace.selectGameweek(gw)
	}

	return (
		<div className="w-full">
			{/* Season | GW28 | GW27 … */}
			<div className="mb-6 border-b border-border/70">
				<div
					role="tablist"
					aria-label={t('viewSwitchLabel')}
					className="flex w-full flex-wrap items-stretch justify-start gap-0 overflow-x-auto"
				>
					<button
						type="button"
						role="tab"
						aria-selected={view === 'season'}
						className={tabTriggerClass(view === 'season')}
						onClick={onNavigateSeason}
					>
						{t('viewSeason')}
					</button>

					{workspace.openGameweeks.map(gw => {
						const active = view === 'gameweek' && selectedGameweek === gw
						const closable = workspace.canCloseGameweek(gw)
						return (
							<div
								key={gw}
								role="presentation"
								className="inline-flex items-stretch"
							>
								<button
									type="button"
									role="tab"
									aria-selected={active}
									className={cn(
										tabTriggerClass(active),
										closable ? 'pr-1 sm:pr-1.5' : undefined
									)}
									onClick={() => workspace.openGameweek(gw)}
								>
									<span className="font-mono tabular-nums">GW{gw}</span>
								</button>
								{closable ? (
									<button
										type="button"
										className={cn(
											'-ml-0.5 mb-px inline-flex items-center self-center rounded-sm p-1 text-muted-foreground',
											'hover:bg-muted/60 hover:text-foreground',
											'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
										)}
										aria-label={t('closeGameweekTab', { gameweek: gw })}
										onClick={e => {
											e.stopPropagation()
											workspace.closeGameweek(gw)
										}}
									>
										<X
											className="size-3.5"
											aria-hidden="true"
										/>
									</button>
								) : null}
							</div>
						)
					})}
				</div>
			</div>

			{view === 'season' ? (
				<div className="space-y-5 sm:space-y-6">
					{reviewState === 'UNAVAILABLE' ? (
						<Alert>
							<AlertDescription>
								{t('reviewUnavailable')}{' '}
								<Link
									href={`/live/competitions/${selectedTournamentId}`}
									className="font-semibold text-primary-ink underline-offset-4 hover:underline"
								>
									{t('openLive')}
								</Link>
							</AlertDescription>
						</Alert>
					) : null}
					<p className="sr-only">{t('viewSeasonHint')}</p>
					{/* A — tournament as a whole */}
					<TournamentSeasonField
						field={seasonField}
						hasMoreServerRows={hasMoreSeasonRows}
						isLoadingServerRows={isBoardLoading}
						onLoadMoreServerRows={loadMoreStandings}
					/>
					{/* B — me in this tournament */}
					<TournamentSeasonMeSection me={seasonMe} />
					<TournamentSeasonCharts
						points={seasonPath}
						loading={seasonPathLoading}
						state={seasonPathState}
						onOpenGameweek={gw => workspace.openGameweek(gw)}
					/>
				</div>
			) : (
				<div className="space-y-5 sm:space-y-6">
					{usedFallbackGameweek && dataGameweek !== null ? (
						<Alert>
							<AlertDescription>
								{t('fallbackGameweekNotice', { gameweek: dataGameweek })}
							</AlertDescription>
						</Alert>
					) : null}

					<div className="space-y-3">
						<GameweekSelector
							onGameweekChange={handleSelectorChange}
							currentGameweek={currentGameweek}
							selectedGameweek={selectedGameweek}
							disabled={isLoading || maxGw < 1}
						/>
						<div className="flex items-center gap-2 px-0.5">
							<input
								id="tournament-stats-open-in-new-tab"
								type="checkbox"
								className="size-4 shrink-0 rounded border border-input accent-primary"
								checked={openInNewTab}
								onChange={e => setOpenInNewTab(e.target.checked)}
							/>
							<Label
								htmlFor="tournament-stats-open-in-new-tab"
								className="cursor-pointer text-sm font-normal text-muted-foreground"
							>
								{t('openInNewTab')}
							</Label>
						</div>
					</div>

					{tournamentStats ? (
						<>
							<TournamentPerformance
								dataGameweek={selectedGameweek}
								stats={tournamentStats}
							/>
							<TournamentGameweekDetails
								filteredStandings={filteredStandings}
								onSearchChange={setStandingsSearch}
								search={standingsSearch}
								stats={tournamentStats}
								hasMoreServerRows={hasMoreStandings}
								isLoadingServerRows={isBoardLoading}
								onLoadMoreServerRows={loadMoreStandings}
							/>
						</>
					) : (
						<Card
							className="p-6 shadow-sm"
							aria-live="polite"
							aria-busy={isLoading}
						>
							<p className="text-sm text-muted-foreground">
								{isLoading ? (
									t('loading')
								) : reviewState === 'PENDING' ? (
									<>
										{t('resultsPending')}{' '}
										<Link
											href={`/live/competitions/${selectedTournamentId}`}
											className="font-semibold text-primary-ink underline-offset-4 hover:underline"
										>
											{t('openLive')}
										</Link>
									</>
								) : reviewState === 'UNAVAILABLE' ? (
									<>
										{t('reviewUnavailable')}{' '}
										<Link
											href={`/live/competitions/${selectedTournamentId}`}
											className="font-semibold text-primary-ink underline-offset-4 hover:underline"
										>
											{t('openLive')}
										</Link>
									</>
								) : (
									t('noStats')
								)}
							</p>
						</Card>
					)}
				</div>
			)}
		</div>
	)
}

export default function TournamentStatsClient(
	props: TournamentStatsClientProps
) {
	return (
		<Suspense
			fallback={
				<div className="container mx-auto max-w-4xl px-4 py-8">
					<div className="h-8 w-48 animate-pulse rounded bg-muted/60" />
					<div className="mt-6 h-28 w-full animate-pulse rounded-xl bg-muted/40" />
				</div>
			}
		>
			<TournamentStatsBody {...props} />
		</Suspense>
	)
}

function formatSnapshotDate(
	meta: MyFplSnapshotMeta,
	format: ReturnType<typeof useFormatter>
): string {
	const value = new Date(meta.publishedAt)
	return Number.isFinite(value.getTime())
		? format.dateTime(value, {
				dateStyle: 'medium',
				timeStyle: 'medium'
			})
		: meta.snapshotDate
}
