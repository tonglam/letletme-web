import { DeadlineSection } from '@/components/home/DeadlineSection'
import { HomePersonalHydratedMarker } from '@/components/analytics/HomePersonalHydratedMarker'
import {
	GameweekStatsSection,
	GameweekStatsSectionFallback
} from '@/components/home/GameweekStatsSection'
import { MatchesSection } from '@/components/home/MatchesSection'
import {
	MarketTeaser,
	MarketTeaserFallback
} from '@/components/home/MarketTeaser'
import {
	PersonalDesk,
	PersonalDeskBindPrompt
} from '@/components/home/PersonalDesk'
import { StatsSection } from '@/components/home/StatsSection'
import {
	TeamOfTheWeekSection,
	TeamOfTheWeekSectionFallback
} from '@/components/home/TeamOfTheWeekSection'
import PageShell from '@/components/layout/PageShell'
import { GameweekBadge } from '@/components/stats/GameweekBadge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Link } from '@/i18n/navigation'
import { getPageLocale, type LocaleParams } from '@/i18n/page'
import type { Session } from '@/lib/auth'
import {
	CacheTag,
	publicFetchOptions,
	RevalidateSeconds
} from '@/lib/cache-policy'
import { getCurrentAndNextEvents } from '@/lib/events'
import { executePublicServerQuery } from '@/lib/graphql-server'
import {
	GET_EVENT_FIXTURES,
	GET_EVENT_OVERALL_RESULT,
	type EventFixturesResponse,
	type EventOverallResultResponse
} from '@/lib/graphql/operations/events'
import homeStats from '@/lib/home-stats'
import { getVerifiedEntryContext, hasSessionCookieHint } from '@/lib/session'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

async function safeQuery<T>(
	query: string,
	variables?: Record<string, unknown>,
	options?: Parameters<typeof executePublicServerQuery>[2]
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
						<GameweekBadge
							gameweek={eventId}
							size="sm"
						/>
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
		<div
			className="scoreboard rounded-xl p-6 sm:p-7"
			aria-hidden="true"
		>
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
			className="overflow-hidden rounded-xl border border-foreground/10 bg-card p-4 sm:p-5"
			aria-hidden="true"
		>
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
				<div className="min-w-0 space-y-2 sm:max-w-[16rem]">
					<Skeleton className="h-6 w-40" />
					<Skeleton className="h-4 w-28" />
				</div>
				<div className="grid min-w-0 flex-1 grid-cols-3 gap-2">
					<Skeleton className="h-14" />
					<Skeleton className="h-14" />
					<Skeleton className="h-14" />
				</div>
			</div>
		</div>
	)
}

function HomePersonalStrip({
	session,
	entryId
}: {
	session: Session | null
	entryId: number | null
}) {
	const user = session?.user

	// Guests: hide the desk entirely. Hero CTAs + navbar sign-in already cover them.
	if (!user) {
		return null
	}

	if (!entryId) {
		return <PersonalDeskBindPrompt />
	}

	return (
		<PersonalDesk
			entryId={entryId}
			session={session}
		/>
	)
}

async function HomePersonalSlot({
	hasSessionCookie
}: {
	hasSessionCookie: boolean
}) {
	// The cookie is a layout hint only. Authorization always comes from the
	// fresh, cache-bypassing Better Auth session below.
	if (!hasSessionCookie) return null
	const { session, entryId } = await getVerifiedEntryContext()
	if (!session?.user) return null

	return (
		<HomePersonalStrip
			session={session}
			entryId={entryId}
		/>
	)
}

async function HomeHero() {
	// Reading the cookie header is local and runs alongside translation lookup;
	// only verified sessions below are allowed to touch the database.
	const [t, hasSessionCookie] = await Promise.all([
		getTranslations('Home'),
		hasSessionCookieHint()
	])

	return (
		<section className="pitch-markings texture-grain relative isolate overflow-hidden border-b">
			<div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-14 lg:gap-12 lg:px-8 lg:py-20">
				{/* Primary hero: copy + deadline only — keeps the classic two-column balance */}
				<div className="grid gap-12 lg:grid-cols-[1.12fr_0.88fr] lg:items-center">
					<div>
						<p className="mb-6 flex items-center gap-2.5 font-display text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
							<span
								className="live-dot"
								aria-hidden="true"
							/>
							{t('matchdayBadge')}
						</p>
						<h1 className="max-w-3xl text-balance font-display text-5xl font-bold uppercase leading-[0.95] tracking-[-0.01em] sm:text-6xl lg:text-7xl">
							{t.rich('headline', {
								marker: chunks => <span className="marker">{chunks}</span>
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
								<Link
									href="/live/tournaments"
									prefetch={false}
								>
									{t('liveTournamentStandings')}
								</Link>
							</Button>
						</div>
					</div>

					<Suspense fallback={<DeadlineScoreboardFallback />}>
						<HomeDeadline />
					</Suspense>
				</div>

				<span
					hidden
					data-home-audience-hint={hasSessionCookie ? 'session-hint' : 'public'}
				/>
				<HomePersonalHydratedMarker enabled={hasSessionCookie} />
				{hasSessionCookie ? (
					<Suspense fallback={<HomePersonalStripFallback />}>
						<HomePersonalSlot hasSessionCookie={hasSessionCookie} />
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
						<Link href="/tournament/browse">{t('browseTournaments')}</Link>
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
		safeQuery<EventOverallResultResponse>(
			GET_EVENT_OVERALL_RESULT,
			undefined,
			publicFetchOptions({
				revalidate: RevalidateSeconds.homeInsights,
				tags: [CacheTag.gameweekStats, CacheTag.events]
			})
		)
	])
	const currentEventId = eventsData?.current[0]?.id ?? null
	const nextEventId = eventsData?.next[0]?.id ?? null
	const overallResult =
		currentEventId && overallResultData
			? homeStats.pickEventOverallResult(
					overallResultData.eventOverallResult,
					currentEventId
				)
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
									fallback={
										<TeamOfTheWeekSectionFallback
											currentEventId={currentEventId}
										/>
									}
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
				publicFetchOptions({
					revalidate: RevalidateSeconds.publicStats,
					tags: [CacheTag.fixtures, CacheTag.events]
				})
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
