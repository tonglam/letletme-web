'use client'

import { GameweekSelector } from '@/components/data/GameweekSelector'
import PageShell from '@/components/layout/PageShell'
import { StatsPageHeader } from '@/components/stats/StatsSurfaces'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Link, usePathname, useRouter } from '@/i18n/navigation'
import type {
	EntryEventResult,
	EntryGameweekTransfers
} from '@/lib/graphql/operations/entries'
import type { MyFplReviewState } from '@/lib/graphql/operations/my-fpl'
import type { SeasonIdentity } from './_lib/team-stats-model'
import type { SeasonPresentationPhase } from '@/lib/season-presentation'
import { cn } from '@/lib/utils'
import { AlertCircle, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TeamGameweekOverall } from './_components/TeamGameweekOverall'
import { TeamSeasonCharts } from './_components/TeamSeasonCharts'
import { TeamSeasonOverall } from './_components/TeamSeasonOverall'
import { TeamSquadSection } from './_components/TeamSquadSection'
import { TeamSquadPitch } from './_components/TeamSquadPitch'
import { TeamStatsDeepDive } from './_components/TeamStatsDeepDive'
import { useTeamStats, type InitialEntryHistory } from './_hooks/useTeamStats'
import {
	TeamGameweekWorkspaceProvider,
	useTeamGameweekWorkspace
} from './_lib/team-gameweek-workspace'
import {
	buildTeamStatsQueryString,
	parseTeamStatsGw,
	parseTeamStatsView,
	type TeamStatsPageView
} from './_lib/team-stats-url'

interface TeamStatsClientProps {
	entryId: number
	currentGameweek: number
	initialSelectedGameweek?: number
	initialEntryEventResult: EntryEventResult | null
	initialEntryGameweekState?: MyFplReviewState
	initialDeskState?: MyFplReviewState
	initialPastSeasonsState?: MyFplReviewState
	initialEntryHistory?: InitialEntryHistory
	initialEntryIdentity?: SeasonIdentity | null
	/** null = deferred client fetch; array = SSR complete */
	initialEntryTransfers?: EntryGameweekTransfers[] | null
	initialError: string | null
	initialRequestComplete: boolean
	initialSeasonPhase: SeasonPresentationPhase
}

/**
 * Page tabs: Season (fixed) | GW28 | GW27 | …
 * Selector: replace current GW tab by default; optional “New tab” mode.
 * Season never closes; at least one GW tab always remains.
 */
export default function TeamStatsClient(props: TeamStatsClientProps) {
	const t = useTranslations('TeamStats')
	const router = useRouter()
	const pathname = usePathname()
	const searchParams = useSearchParams()

	const initialSelectedGameweek =
		props.initialSelectedGameweek && props.initialSelectedGameweek > 0
			? props.initialSelectedGameweek
			: props.currentGameweek

	const view = useMemo(
		() => parseTeamStatsView(searchParams.get('view')),
		[searchParams]
	)

	const {
		currentGameweek,
		deskState,
		emptyStateMessage,
		error,
		gameweekState,
		isLoading,
		isTransfersLoading,
		pastSeasonsState,
		seasonLogs,
		seasonOverall,
		selectedGameweek,
		setSelectedGameweek,
		teamStats
	} = useTeamStats({
		...props,
		initialSelectedGameweek,
		preseason: props.initialSeasonPhase === 'PRESEASON',
		loadGameweekData: view === 'gameweek'
	})

	// Prefer live current; fall back to selected seed / history-driven max
	const maxGw =
		currentGameweek > 0
			? currentGameweek
			: props.currentGameweek > 0
				? props.currentGameweek
				: initialSelectedGameweek > 0
					? initialSelectedGameweek
					: 0

	const replaceQuery = useCallback(
		(next: { view: TeamStatsPageView; gw: number | null }) => {
			const qs = buildTeamStatsQueryString({
				view: next.view,
				gw: next.gw != null && next.gw > 0 ? next.gw : null
			})
			const href = qs ? `${pathname}?${qs}` : pathname
			router.replace(href, { scroll: false })
		},
		[pathname, router]
	)

	const handleActiveGameweekChange = useCallback(
		(gw: number, enterGameweekView: boolean) => {
			setSelectedGameweek(gw)
			const viewNow = parseTeamStatsView(searchParams.get('view'))
			// open/select → gameweek; close retarget keeps Season if that was active
			replaceQuery({
				view:
					enterGameweekView || viewNow === 'gameweek' ? 'gameweek' : 'season',
				gw
			})
		},
		[replaceQuery, searchParams, setSelectedGameweek]
	)

	useEffect(() => {
		if (maxGw <= 0) return
		const raw = searchParams.get('gw')
		if (raw == null) return
		const n = Number(raw)
		if (Number.isFinite(n) && n > maxGw) {
			replaceQuery({ view, gw: maxGw })
			setSelectedGameweek(maxGw)
		}
	}, [maxGw, replaceQuery, searchParams, setSelectedGameweek, view])

	const hasAnyContent = Boolean(seasonOverall || teamStats || seasonLogs)
	const showSwitch = Boolean(seasonOverall || seasonLogs || currentGameweek > 0)

	const seedGw =
		initialSelectedGameweek > 0 ? initialSelectedGameweek : maxGw || 1

	return (
		<PageShell>
			<div className="container mx-auto max-w-4xl px-4 py-8">
				<StatsPageHeader title={t('title')} />

				{error ? (
					<Alert
						variant="destructive"
						className="mb-6"
					>
						<AlertCircle aria-hidden="true" />
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				) : null}

				{showSwitch ? (
					<TeamGameweekWorkspaceProvider
						maxGw={maxGw}
						initialGameweek={seedGw}
						onActiveGameweekChange={handleActiveGameweekChange}
					>
						<TeamStatsViews
							view={view}
							onNavigateSeason={() =>
								replaceQuery({
									view: 'season',
									gw: selectedGameweek > 0 ? selectedGameweek : null
								})
							}
							selectedGameweek={selectedGameweek}
							currentGameweek={currentGameweek}
							maxGw={maxGw}
							entryId={props.entryId}
							isLoading={isLoading}
							isTransfersLoading={isTransfersLoading}
							gameweekState={gameweekState}
							deskState={deskState}
							teamStats={teamStats}
							seasonOverall={seasonOverall}
							preseason={props.initialSeasonPhase === 'PRESEASON'}
							pastSeasonsState={pastSeasonsState}
							seasonLogs={seasonLogs}
							emptyStateMessage={emptyStateMessage}
							hasAnyContent={hasAnyContent}
							searchParamsGw={searchParams.get('gw')}
						/>
					</TeamGameweekWorkspaceProvider>
				) : (
					<Card
						className="p-6 shadow-sm"
						aria-live="polite"
						aria-busy={isLoading}
					>
						<p className="text-sm text-muted-foreground">
							{isLoading ? t('loading') : t('noStats')}
						</p>
					</Card>
				)}
			</div>
		</PageShell>
	)
}

interface TeamStatsViewsProps {
	view: TeamStatsPageView
	onNavigateSeason: () => void
	selectedGameweek: number
	currentGameweek: number
	maxGw: number
	entryId: number
	isLoading: boolean
	isTransfersLoading: boolean
	gameweekState?: MyFplReviewState
	deskState: ReturnType<typeof useTeamStats>['deskState']
	teamStats: ReturnType<typeof useTeamStats>['teamStats']
	seasonOverall: ReturnType<typeof useTeamStats>['seasonOverall']
	preseason: boolean
	pastSeasonsState?: MyFplReviewState
	seasonLogs: ReturnType<typeof useTeamStats>['seasonLogs']
	emptyStateMessage: string | null
	hasAnyContent: boolean
	searchParamsGw: string | null
}

function TeamStatsViews({
	view,
	onNavigateSeason,
	selectedGameweek,
	currentGameweek,
	maxGw,
	entryId,
	isLoading,
	isTransfersLoading,
	gameweekState,
	deskState,
	teamStats,
	seasonOverall,
	preseason,
	pastSeasonsState,
	seasonLogs,
	emptyStateMessage,
	hasAnyContent,
	searchParamsGw
}: TeamStatsViewsProps) {
	const t = useTranslations('TeamStats')
	const workspace = useTeamGameweekWorkspace()
	const lastUrlGwRef = useRef<string | null>(null)
	const [openInNewTab, setOpenInNewTab] = useState(false)

	// URL → open/focus GW tab when deep-linked
	useEffect(() => {
		if (searchParamsGw === lastUrlGwRef.current) return
		lastUrlGwRef.current = searchParamsGw
		const urlGw = parseTeamStatsGw(
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

	const handleSelectorChange = (gw: number) => {
		if (openInNewTab) {
			workspace.openGameweek(gw)
		} else {
			workspace.selectGameweek(gw)
		}
	}

	const tabTriggerClass = (active: boolean) =>
		cn(
			'relative inline-flex h-11 items-center gap-0.5 rounded-none border-b-2 bg-transparent px-3 pb-3 pt-2 text-sm font-semibold sm:px-4',
			active
				? 'border-primary-ink text-foreground'
				: 'border-transparent text-muted-foreground hover:text-foreground'
		)

	return (
		<div className="w-full">
			{/* Primary tabs: Season | GW28 | GW27 | … */}
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
								className={cn(
									'inline-flex items-stretch',
									active && 'text-foreground'
								)}
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
				<div className="space-y-6 sm:space-y-8">
					{deskState === 'PENDING' ? (
						<Alert className="shadow-sm">
							<AlertDescription>{t('reviewPending')}</AlertDescription>
						</Alert>
					) : deskState === 'UNAVAILABLE' ? (
						<Alert
							variant="destructive"
							className="shadow-sm"
						>
							<AlertDescription>{t('reviewUnavailable')}</AlertDescription>
						</Alert>
					) : null}
					{pastSeasonsState === 'PENDING' ? (
						<Alert className="shadow-sm">
							<AlertDescription>{t('pastSeasonsPending')}</AlertDescription>
						</Alert>
					) : null}
					{pastSeasonsState === 'UNAVAILABLE' ? (
						<Alert
							variant="destructive"
							className="shadow-sm"
						>
							<AlertDescription>{t('pastSeasonsUnavailable')}</AlertDescription>
						</Alert>
					) : null}
					{seasonOverall ? (
						<TeamSeasonOverall
							snapshot={seasonOverall}
							variant="full"
							preseason={preseason}
						/>
					) : null}

					{seasonLogs ? <TeamSeasonCharts logs={seasonLogs} /> : null}

					{seasonLogs ? (
						<div>
							<p className="mb-4 eyebrow">{t('seasonLogs')}</p>
							<TeamStatsDeepDive
								logs={seasonLogs}
								transfersLoading={isTransfersLoading}
							/>
						</div>
					) : !seasonOverall && !hasAnyContent ? (
						<Card className="p-6 shadow-sm">
							<p className="text-sm text-muted-foreground">
								{isLoading ? t('loading') : t('noStats')}
							</p>
						</Card>
					) : null}
				</div>
			) : (
				<div>
					{deskState === 'PENDING' ? (
						<Alert className="mb-5 shadow-sm">
							<AlertDescription>{t('reviewPending')}</AlertDescription>
						</Alert>
					) : deskState === 'UNAVAILABLE' ? (
						<Alert
							variant="destructive"
							className="mb-5 shadow-sm"
						>
							<AlertDescription>{t('reviewUnavailable')}</AlertDescription>
						</Alert>
					) : null}
					{(seasonOverall || currentGameweek > 0) && (
						<div className="mb-5 space-y-3 sm:mb-6">
							<GameweekSelector
								onGameweekChange={handleSelectorChange}
								currentGameweek={currentGameweek}
								selectedGameweek={selectedGameweek}
								disabled={isLoading || !currentGameweek}
							/>
							<div className="flex items-center gap-2 px-0.5">
								<input
									id="team-stats-open-in-new-tab"
									type="checkbox"
									className="size-4 shrink-0 rounded border border-input accent-primary"
									checked={openInNewTab}
									onChange={e => setOpenInNewTab(e.target.checked)}
								/>
								<Label
									htmlFor="team-stats-open-in-new-tab"
									className="cursor-pointer text-sm font-normal text-muted-foreground"
								>
									{t('openInNewTab')}
								</Label>
							</div>
						</div>
					)}

					{teamStats ? (
						<>
							<TeamSquadPitch stats={teamStats} />
							<TeamGameweekOverall stats={teamStats} />
							<TeamSquadSection picks={teamStats.eventPicks} />
						</>
					) : (
						<Card
							className="p-6 shadow-sm"
							aria-live="polite"
							aria-busy={isLoading}
						>
							<p className="text-sm text-muted-foreground">
								{isLoading ? t('loading') : (emptyStateMessage ?? t('noStats'))}
							</p>
							{gameweekState === 'PENDING' ? (
								<Link
									href={`/live/points/${entryId}`}
									className="mt-3 inline-flex text-sm font-semibold text-primary-ink underline-offset-4 hover:underline"
								>
									{t('openLive')}
								</Link>
							) : null}
						</Card>
					)}
				</div>
			)}
		</div>
	)
}
