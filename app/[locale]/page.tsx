import { DeadlineSection } from '@/components/home/DeadlineSection'
import {
	GameweekStatsSection,
	GameweekStatsSectionFallback,
} from '@/components/home/GameweekStatsSection'
import { MatchesSection } from '@/components/home/MatchesSection'
import { MarketTeaser, MarketTeaserFallback } from '@/components/home/MarketTeaser'
import { StatsSection } from '@/components/home/StatsSection'
import {
	TeamOfTheWeekSection,
	TeamOfTheWeekSectionFallback,
} from '@/components/home/TeamOfTheWeekSection'
import PageShell from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Link } from '@/i18n/navigation'
import { getPageLocale, type LocaleParams } from '@/i18n/page'
import { getCurrentAndNextEvents } from '@/lib/events'
import { executePublicServerQuery, executeServerQuery } from '@/lib/graphql-server'
import {
	GET_ENTRY,
	type EntrySummaryResponse,
} from '@/lib/graphql/operations/entries'
import {
	GET_EVENT_FIXTURES,
	GET_EVENT_OVERALL_RESULT,
	type EventFixturesResponse,
	type EventOverallResultResponse,
} from '@/lib/graphql/operations/events'
import homeStats from '@/lib/home-stats'
import { getCurrentSession } from '@/lib/session'
import { formatCompactNumber, formatInteger } from '@/lib/utils'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { Suspense, type ReactNode } from 'react'

export const dynamic = 'force-dynamic'

async function safeQuery<T>(
	query: string,
	variables?: Record<string, unknown>,
	options?: Parameters<typeof executePublicServerQuery>[2],
): Promise<T | null> {
	try {
		return await executePublicServerQuery<T>(query, variables, options)
	} catch (err) {
		console.error('[page] RSC fetch failed:', err)
		return null
	}
}

function MatchesSectionFallback({ eventId }: { eventId: number | null }) {
	const t = useTranslations('Home')
	return (
		<div className="rounded-xl border bg-card p-4 md:p-6">
			<div className="mb-6 flex items-center justify-between">
				<h2 className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wide">
					{t('upcomingMatches')}
					{eventId !== null && (
						<span className="rounded-md bg-plum px-2 py-0.5 font-mono text-xs font-semibold tracking-[0.14em] text-electric">
							GW{eventId}
						</span>
					)}
				</h2>
				<div className="flex items-center gap-1">
					<Skeleton className="h-8 w-8" />
					<Skeleton className="h-8 w-8" />
				</div>
			</div>
			<div className="flex flex-col gap-4">
				{[1, 2, 3].map(i => (
					<Skeleton
						key={i}
						className="h-20 w-full"
					/>
				))}
			</div>
		</div>
	)
}

function DeadlineScoreboardFallback() {
	return (
		<div className="scoreboard rounded-xl p-6 sm:p-7" aria-hidden="true">
			<Skeleton className="h-4 w-32 bg-white/10" />
			<Skeleton className="mt-3 h-9 w-44 bg-white/10" />
			<Skeleton className="mt-5 h-20 w-full bg-white/10" />
			<Skeleton className="mt-4 h-4 w-56 max-w-full bg-white/10" />
		</div>
	)
}

function HomePersonalStripFallback() {
	return (
		<div
			className="overflow-hidden rounded-xl border border-foreground/10 bg-card"
			aria-hidden="true"
		>
			<div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between lg:p-5">
				<div className="min-w-0 flex-1 space-y-2">
					<Skeleton className="h-3 w-20" />
					<Skeleton className="h-6 w-44" />
					<Skeleton className="h-4 w-28" />
				</div>
				<div className="grid w-full grid-cols-3 gap-2 lg:max-w-md">
					<Skeleton className="h-14" />
					<Skeleton className="h-14" />
					<Skeleton className="h-14" />
				</div>
				<Skeleton className="h-10 w-full lg:w-40" />
			</div>
		</div>
	)
}

function PersonalDeskShell({
	accent = 'default',
	children,
}: {
	accent?: 'default' | 'warning'
	children: ReactNode
}) {
	const ringClass =
		accent === 'warning' ? 'border-pink/35' : 'border-foreground/10'

	return (
		<article
			className={`overflow-hidden rounded-xl border bg-card p-4 shadow-sticker-sm sm:p-5 ${ringClass}`}
		>
			{children}
		</article>
	)
}

async function HomePersonalStrip() {
	const t = await getTranslations('Home')
	const session = await getCurrentSession()
	const user = session?.user

	// Guests: hide the desk entirely. Hero CTAs + navbar sign-in already cover them;
	// an empty "personal" band under the hero only adds noise.
	if (!user) {
		return null
	}

	const entryId =
		user.fplEntryVerifiedAt && typeof user.fplEntryId === 'number' ? user.fplEntryId : null

	// Signed in but not bound: keep a compact prompt so the next step is obvious.
	if (!entryId) {
		return (
			<PersonalDeskShell accent="warning">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
					<div className="min-w-0 max-w-xl">
						<p className="font-display text-lg font-bold uppercase tracking-wide sm:text-xl">
							{t('bindEntryTitle')}
						</p>
						<p className="mt-1.5 text-sm leading-6 text-muted-foreground">
							{t('bindEntryPrompt')}
						</p>
					</div>
					<Button
						className="min-h-11 shrink-0 font-display font-semibold uppercase tracking-[0.1em]"
						asChild
					>
						<Link href="/onboarding/bind-entry">
							{t('bindEntryCta')}
							<ArrowRight data-icon="inline-end" />
						</Link>
					</Button>
				</div>
			</PersonalDeskShell>
		)
	}

	// Empty names stay blank (""). Null/missing numerics render as 0 — not mock ranks/values.
	let teamName = ''
	let managerName = ''
	let overallPoints = 0
	let overallRank = 0
	let teamValue = 0

	try {
		// Session-scoped read: avoids requiring GRAPHQL_SERVICE_TOKEN for this strip.
		const entryData = await executeServerQuery<EntrySummaryResponse>(
			GET_ENTRY,
			{ id: entryId },
			{ cache: 'no-store', timeoutMs: 4_000 },
		)
		const entry = entryData.entry
		if (entry) {
			teamName = entry.entryName?.trim() ?? ''
			managerName = entry.playerName?.trim() ?? ''
			overallPoints = typeof entry.overallPoints === 'number' ? entry.overallPoints : 0
			overallRank = typeof entry.overallRank === 'number' ? entry.overallRank : 0
			teamValue = typeof entry.teamValue === 'number' ? entry.teamValue : 0
		}
	} catch (err) {
		console.error('[home-personal-strip] entry fetch failed:', err)
	}

	const metricTiles = [
		{
			label: t('personalPointsLabel'),
			value: formatInteger(overallPoints),
		},
		{
			label: t('personalRankLabel'),
			value: formatCompactNumber(overallRank),
		},
		{
			label: t('personalTeamValueLabel'),
			value: `£${(teamValue / 10).toFixed(1)}m`,
		},
	] as const

	// Status strip only — navigation stays on the hero CTAs (live points / standings)
	// and tournament pills so this desk doesn't repeat the same actions.
	return (
		<PersonalDeskShell>
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
				<div className="min-w-0 sm:max-w-[16rem] sm:shrink-0">
					<p className="truncate font-display text-xl font-bold uppercase leading-tight tracking-wide">
						{teamName}
					</p>
					<p className="mt-1 truncate text-sm text-muted-foreground">
						<span className="sr-only">{t('personalManagerLabel')}: </span>
						{managerName}
					</p>
				</div>

				<div className="grid min-w-0 flex-1 grid-cols-3 gap-px overflow-hidden rounded-lg border border-foreground/10 bg-foreground/10">
					{metricTiles.map(tile => (
						<div
							key={tile.label}
							className="bg-background px-2 py-2.5 text-center sm:px-3 sm:py-3"
						>
							<p className="font-mono text-base font-semibold tabular-nums tracking-tight text-primary-ink sm:text-lg">
								{tile.value}
							</p>
							<p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
								{tile.label}
							</p>
						</div>
					))}
				</div>
			</div>
		</PersonalDeskShell>
	)
}

async function HomeHero() {
	const t = await getTranslations('Home')
	// Gate the desk band so guests never see a personal-strip skeleton flash.
	const session = await getCurrentSession()
	const showPersonalDesk = Boolean(session?.user)

	return (
		<section className="pitch-markings texture-grain relative isolate overflow-hidden border-b">
			<div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-14 lg:gap-12 lg:px-8 lg:py-20">
				{/* Primary hero: copy + deadline only — keeps the classic two-column balance */}
				<div className="grid gap-12 lg:grid-cols-[1.12fr_0.88fr] lg:items-center">
					<div>
						<p className="mb-6 flex items-center gap-2.5 font-display text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
							<span className="live-dot" aria-hidden="true" />
							{t('matchdayBadge')}
						</p>
						<h1 className="max-w-3xl text-balance font-display text-5xl font-bold uppercase leading-[0.95] tracking-[-0.01em] sm:text-6xl lg:text-7xl">
							{t.rich('headline', {
								marker: chunks => <span className="marker">{chunks}</span>,
							})}
						</h1>
						<p className="mt-6 max-w-xl text-pretty text-lg leading-8 text-muted-foreground">
							{t('intro')}
						</p>
						{/* Matchday entry only. Browse/create tournaments live in HomeTournamentBand. */}
						<div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
							<Button
								size="lg"
								className="shadow-sticker font-display text-base font-semibold uppercase tracking-[0.1em] transition-transform hover:-translate-y-0.5"
								asChild
							>
								<Link href="/live/points">
									{t('openLivePoints')}
									<ArrowRight data-icon="inline-end" />
								</Link>
							</Button>
							<Button
								size="lg"
								variant="outline"
								className="font-display text-base font-semibold uppercase tracking-[0.1em]"
								asChild
							>
								<Link href="/live/tournament">{t('liveTournamentStandings')}</Link>
							</Button>
						</div>
					</div>

					<Suspense fallback={<DeadlineScoreboardFallback />}>
						<HomeDeadline />
					</Suspense>
				</div>

				{showPersonalDesk ? (
					<Suspense fallback={<HomePersonalStripFallback />}>
						<HomePersonalStrip />
					</Suspense>
				) : null}
			</div>
		</section>
	)
}

async function HomeDeadline() {
	const eventsData = await getCurrentAndNextEvents()
	const nextEvent = eventsData?.next[0] ?? null

	return (
		<DeadlineSection
			nextEventId={nextEvent?.id ?? null}
			deadlineTime={nextEvent?.deadlineTime ?? null}
		/>
	)
}

async function HomeTournamentBand() {
	const t = await getTranslations('Home')

	return (
		<section
			className="border-y bg-plum text-electric"
			aria-labelledby="home-tournament-band-title"
		>
			<div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:py-9">
				<div className="max-w-xl">
					<p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-electric/80">
						{t('tournamentBandEyebrow')}
					</p>
					<h2
						id="home-tournament-band-title"
						className="mt-2 font-display text-2xl font-bold uppercase tracking-wide sm:text-3xl"
					>
						{t('tournamentBandTitle')}
					</h2>
					<p className="mt-2 text-sm leading-6 text-electric/75">
						{t('tournamentBandDescription')}
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button
						variant="outline"
						className="min-h-11 border-electric/50 bg-transparent font-display font-semibold uppercase tracking-[0.08em] text-electric hover:bg-electric hover:text-plum"
						asChild
					>
						<Link href="/tournament/list">{t('browseTournaments')}</Link>
					</Button>
					<Button
						className="min-h-11 bg-electric font-display font-semibold uppercase tracking-[0.08em] text-plum hover:bg-electric/90"
						asChild
					>
						<Link href="/tournament/create">
							{t('createTournament')}
							<ArrowRight data-icon="inline-end" />
						</Link>
					</Button>
				</div>
			</div>
		</section>
	)
}

async function HomeInsights() {
	const t = await getTranslations('Home')
	const [eventsData, overallResultData] = await Promise.all([
		getCurrentAndNextEvents(),
		safeQuery<EventOverallResultResponse>(GET_EVENT_OVERALL_RESULT, undefined, {
			cache: 'force-cache',
			next: { revalidate: 3600 },
			timeoutMs: 5_000,
		}),
	])
	const currentEventId = eventsData?.current[0]?.id ?? null
	const nextEventId = eventsData?.next[0]?.id ?? null
	const overallResult =
		currentEventId && overallResultData
			? homeStats.pickEventOverallResult(overallResultData.eventOverallResult, currentEventId)
			: null

	if (!eventsData) {
		return (
			<section className="py-10">
				<div className="mx-auto max-w-4xl px-4">
					<div className="rounded-xl border border-dashed px-6 py-5 text-center">
						<p className="chyron justify-center">{t('gameweekStats')}</p>
						<p className="mt-2 text-sm font-medium text-muted-foreground">
							{t('insightsUnavailable')} — {t('insightsUnavailableDescription')}
						</p>
					</div>
				</div>
			</section>
		)
	}

	return (
		<>
			{currentEventId !== null ? (
				<>
					<section className="py-10">
						<div className="mx-auto max-w-4xl px-4">
							<StatsSection
								currentEventId={currentEventId}
								overallResult={overallResult}
							/>
						</div>
					</section>

					<section className="border-y bg-secondary/40 py-10">
						<div className="mx-auto max-w-4xl px-4">
							<div className="grid gap-8 md:grid-cols-2">
								<Suspense
									fallback={<TeamOfTheWeekSectionFallback currentEventId={currentEventId} />}
								>
									<TeamOfTheWeekSection currentEventId={currentEventId} />
								</Suspense>
								<Suspense fallback={<GameweekStatsSectionFallback />}>
									<GameweekStatsSection currentEventId={currentEventId} />
								</Suspense>
							</div>
						</div>
					</section>
				</>
			) : (
				<section className="py-10">
					<div className="mx-auto max-w-4xl px-4">
						<div className="rounded-xl border bg-card px-6 py-7">
							<p className="chyron">{t('betweenGameweeksEyebrow')}</p>
							<h2 className="mt-2 font-display text-2xl font-bold uppercase tracking-wide">
								{t('betweenGameweeksTitle')}
							</h2>
							<p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
								{t('betweenGameweeksDescription')}
							</p>
						</div>
					</div>
				</section>
			)}

			<section className="py-10">
				<div className="mx-auto max-w-4xl px-4">
					<Suspense fallback={<MatchesSectionFallback eventId={nextEventId} />}>
						<InitialMatchesSection eventId={nextEventId} />
					</Suspense>
				</div>
			</section>
		</>
	)
}

async function InitialMatchesSection({ eventId }: { eventId: number | null }) {
	const initialFixtures = eventId
		? await safeQuery<EventFixturesResponse>(
				GET_EVENT_FIXTURES,
				{ eventId },
				{ cache: 'force-cache', next: { revalidate: 300 }, timeoutMs: 5_000 },
			)
		: null

	return (
		<MatchesSection
			initialEventId={eventId}
			initialFixtures={initialFixtures}
		/>
	)
}

export default async function Home({ params }: { params: LocaleParams }) {
	await getPageLocale(params)
	return (
		<PageShell>
			<div className="flex flex-col">
				<HomeHero />

				<HomeTournamentBand />

				<Suspense fallback={<MarketTeaserFallback />}>
					<MarketTeaser />
				</Suspense>

				<Suspense fallback={<PageInsightsFallback />}>
					<HomeInsights />
				</Suspense>
			</div>
		</PageShell>
	)
}

function PageInsightsFallback() {
	const t = useTranslations('Home')
	return (
		<div
			className="mx-auto grid w-full max-w-4xl gap-8 px-4 py-10 md:grid-cols-2"
			aria-label={t('loadingInsights')}
			aria-busy="true"
		>
			<TeamOfTheWeekSectionFallback currentEventId={null} />
			<GameweekStatsSectionFallback />
		</div>
	)
}
