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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
import { ArrowRight, BarChart3, Radio, Sparkles, Trophy } from 'lucide-react'
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
		<div className="mb-8 flex-grow">
			<Card className="p-4 md:p-6">
				<div className="mb-6 flex items-center justify-between">
					<h2 className="flex items-center gap-2 text-xl font-bold">
						{t('upcomingMatches')}
						{eventId !== null && (
							<span className="text-sm font-medium text-muted-foreground">
								(GW {eventId})
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
			</Card>
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
		<section className="relative isolate overflow-hidden border-b bg-card">
			<div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.16),transparent_42%),linear-gradient(to_bottom_right,hsl(var(--background)),hsl(var(--accent)/0.48))]" />
			<div aria-hidden="true" className="absolute -right-24 top-16 -z-10 size-80 rounded-full border border-primary/15 bg-primary/5 blur-2xl" />
			<div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[1.35fr_0.65fr] lg:items-end lg:px-8 lg:py-24">
				<div className="max-w-3xl">
					<Badge variant="outline" className="mb-5 gap-2 border-primary/25 bg-background/70 px-3 py-1.5 text-primary shadow-sm backdrop-blur">
						<Sparkles aria-hidden="true" className="size-3.5" />
						{t('analyticsLive')}
					</Badge>
					<h1 className="max-w-3xl text-balance text-4xl font-bold leading-[1.02] tracking-[-0.035em] sm:text-6xl lg:text-7xl">
						{t('headline')}
					</h1>
					<p className="mt-6 max-w-2xl text-pretty text-lg leading-8 text-muted-foreground sm:text-xl">
						{t('intro')}
					</p>
					<div className="mt-8 flex flex-col gap-3 sm:flex-row">
						<Button size="lg" asChild>
							<Link href="/live/points">
								{t('openLivePoints')}
								<ArrowRight data-icon="inline-end" />
							</Link>
						</Button>
						<Button size="lg" variant="outline" asChild>
							<Link href="/data/player-stats">{t('comparePlayers')}</Link>
						</Button>
					</div>
				</div>

				<div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
					{capabilities.map(({ icon: Icon, label }, index) => (
						<div key={label} className="flex items-center gap-4 rounded-2xl border bg-background/75 p-4 shadow-sm backdrop-blur">
							<span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
								<Icon aria-hidden="true" className="size-5" />
							</span>
							<div>
								<p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">0{index + 1}</p>
								<p className="font-semibold">{label}</p>
							</div>
						</div>
					))}
				</div>
			</div>
		</section>
	)
}

function DeadlineSectionFallback() {
	const t = useTranslations('Home')
	return (
		<section className="border-b bg-primary/5">
			<div className="mx-auto flex max-w-4xl flex-col items-center gap-5 px-4 py-12" aria-label={t('loadingDeadline')} aria-busy="true">
				<Skeleton className="h-10 w-48" />
				<Skeleton className="h-5 w-72 max-w-full" />
				<Skeleton className="h-32 w-full max-w-xl rounded-2xl" />
			</div>
		</section>
	)
}

async function HomeDeadline() {
	const eventsData = await getCurrentAndNextEvents()
	const nextEvent = eventsData?.next[0] ?? null

	return (
		<section className="border-b bg-primary/5">
			<div className="mx-auto max-w-4xl px-4">
				<DeadlineSection
					nextEventId={nextEvent?.id ?? null}
					deadlineTime={nextEvent?.deadlineTime ?? null}
				/>
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
			<section className="bg-background py-8">
				<div className="mx-auto max-w-4xl px-4">
					<Card className="flex flex-col items-center gap-3 p-8 text-center">
						<span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
							<BarChart3 aria-hidden="true" className="size-5" />
						</span>
						<h2 className="text-2xl font-bold">{t('insightsUnavailable')}</h2>
						<p className="max-w-lg text-muted-foreground">
							{t('insightsUnavailableDescription')}
						</p>
					</Card>
				</div>
			</section>
		)
	}

	return (
		<>
			<section className="bg-background py-8">
				<div className="mx-auto max-w-4xl px-4">
					<StatsSection currentEventId={currentEventId} overallResult={overallResult} />
				</div>
			</section>

			<section className="border-y bg-muted/35 py-8">
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

			<section className="bg-background py-8">
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
				<Suspense fallback={<DeadlineSectionFallback />}>
					<HomeDeadline />
				</Suspense>

				<section className="bg-background py-8">
					<div className="mx-auto max-w-4xl px-4">
						<Suspense fallback={<PriceChangesSectionFallback />}>
							<PriceChangesSection />
						</Suspense>
					</div>
				</section>
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
		<div className="mx-auto grid w-full max-w-4xl gap-8 px-4 py-8 md:grid-cols-2" aria-label={t('loadingInsights')} aria-busy="true">
			<TeamOfTheWeekSectionFallback currentEventId={null} />
			<GameweekStatsSectionFallback />
		</div>
	)
}
