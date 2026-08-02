import { DeadlineSection } from '@/components/home/DeadlineSection'
import {
	GameweekStatsSection,
	GameweekStatsSectionFallback,
} from '@/components/home/GameweekStatsSection'
import { MatchesSection } from '@/components/home/MatchesSection'
import {
	PriceChangesSection,
	PriceChangesSectionFallback,
} from '@/components/home/PriceChangesSection'
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
import { executePublicServerQuery } from '@/lib/graphql-server'
import {
	GET_EVENT_FIXTURES,
	GET_EVENT_OVERALL_RESULT,
	type EventFixturesResponse,
	type EventOverallResultResponse,
} from '@/lib/graphql/operations/events'
import homeStats from '@/lib/home-stats'
import { ArrowRight, BarChart3, Radio, Trophy } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'

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
				{[1, 2, 3].map((i) => (
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

function HomeHero() {
	const t = useTranslations('Home')
	const capabilities = [
		{ icon: Radio, label: t('livePoints') },
		{ icon: BarChart3, label: t('playerAnalysis') },
		{ icon: Trophy, label: t('privateTournaments') },
	] as const

	return (
		<section className="pitch-markings texture-grain relative isolate overflow-hidden border-b">
			<div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-14 lg:grid-cols-[1.12fr_0.88fr] lg:items-center lg:px-8 lg:py-20">
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
					<div className="mt-8 flex flex-col gap-3 sm:flex-row">
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
							<Link href="/data/player-stats">{t('comparePlayers')}</Link>
						</Button>
					</div>

					<ul className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-foreground/10 pt-5">
						{capabilities.map(({ icon: Icon, label }, index) => (
							<li key={label} className="flex items-center gap-2.5">
								<span className="font-mono text-xs font-semibold text-primary-ink">
									0{index + 1}
								</span>
								<Icon aria-hidden="true" className="size-4 text-muted-foreground" />
								<span className="font-display text-sm font-semibold uppercase tracking-[0.12em]">
									{label}
								</span>
							</li>
						))}
					</ul>
				</div>

				<Suspense fallback={<DeadlineScoreboardFallback />}>
					<HomeDeadline />
				</Suspense>
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
			{currentEventId !== null && (
				<>
					<section className="py-10">
						<div className="mx-auto max-w-4xl px-4">
							<StatsSection currentEventId={currentEventId} overallResult={overallResult} />
						</div>
					</section>

					<section className="border-y bg-secondary/40 py-10">
						<div className="mx-auto max-w-4xl px-4">
							<div className="grid gap-8 md:grid-cols-2">
								<Suspense fallback={<TeamOfTheWeekSectionFallback currentEventId={currentEventId} />}>
									<TeamOfTheWeekSection currentEventId={currentEventId} />
								</Suspense>
								<Suspense fallback={<GameweekStatsSectionFallback />}>
									<GameweekStatsSection currentEventId={currentEventId} />
								</Suspense>
							</div>
						</div>
					</section>
				</>
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

				<Suspense fallback={<PriceChangesSectionFallback />}>
					<PriceChangesSection />
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
