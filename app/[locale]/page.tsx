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
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Link } from '@/i18n/navigation'
import { getPageLocale, type LocaleParams } from '@/i18n/page'
import type { Session } from '@/lib/auth'
import { computeTimeLeft } from '@/lib/home-deadline'
import {
	getHomeGameweek,
	getHomePublicBootstrap,
	getHomeVerifiedEntryContext
} from '@/lib/home-data-server'
import type { HomeFixturesResponse } from '@/lib/graphql/operations/home'
import { hasSessionCookieHint } from '@/lib/session'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { RouteIntlProvider } from '@/components/i18n/RouteIntlProvider'
import { ROUTE_CLIENT_NAMESPACES } from '@/i18n/client-namespaces'

export const dynamic = 'force-dynamic'

function DeadlineScoreboardFallback() {
	return (
		<div
			className="scoreboard rounded-xl p-6 sm:p-7"
			aria-hidden="true"
		>
			<Skeleton className="h-4 w-32 bg-fascia-foreground/10" />
			<Skeleton className="mt-3 h-9 w-44 bg-fascia-foreground/10" />
			<Skeleton className="mt-5 h-20 w-full bg-fascia-foreground/10" />
			<Skeleton className="mt-4 h-4 w-56 max-w-full bg-fascia-foreground/10" />
		</div>
	)
}

function HomePersonalStripFallback() {
	return (
		<div
			className="min-h-[25rem] overflow-hidden rounded-xl border border-foreground/10 bg-card p-4 sm:p-5"
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
			<div className="mt-4 space-y-2 border-t border-border/50 pt-3">
				<Skeleton className="h-3 w-24" />
				{Array.from({ length: 6 }).map((_, index) => (
					<Skeleton key={index} className="h-11 w-full" />
				))}
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
		<PersonalDesk session={session} />
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
	const { session, entryId } = await getHomeVerifiedEntryContext()
	if (!session?.user) return null

	return (
		<>
			<HomePersonalHydratedMarker enabled />
			<HomePersonalStrip
				session={session}
				entryId={entryId}
			/>
		</>
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
						<p className="mb-6 flex items-center gap-2.5 font-display text-xs font-semibold uppercase tracking-caps-wide text-muted-foreground">
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
						{/* Matchday entry only. Browse/create competitions live in HomeTournamentBand. */}
						<div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
							<Button
								size="lg"
								className="shadow-sticker font-display text-base font-semibold uppercase tracking-caps transition-transform hover:-translate-y-0.5"
								asChild
							>
								<Link
									href="/live/points"
									prefetch={false}
								>
									{t('openLivePoints')}
									<ArrowRight data-icon="inline-end" />
								</Link>
							</Button>
							<Button
								size="lg"
								variant="outline"
								className="font-display text-base font-semibold uppercase tracking-caps"
								asChild
							>
								<Link
									href="/live/competitions"
									prefetch={false}
								>
									{t('liveCompetitionStandings')}
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
	const { bootstrap, bootstrapFailed } = await getHomePublicBootstrap()
		.then(bootstrap => ({ bootstrap, bootstrapFailed: false }))
		.catch(error => {
			console.error('[home-deadline] bootstrap failed', {
				error: error instanceof Error ? error.name : 'UnknownError'
			})
			return { bootstrap: null, bootstrapFailed: true }
		})
	const nextEventId = bootstrap?.context.nextEventId ?? null
	const deadlineTime = bootstrap?.context.nextDeadlineTime ?? null
	const deadlineMs = deadlineTime ? Date.parse(deadlineTime) : Number.NaN

	return (
		<DeadlineSection
			nextEventId={nextEventId}
			deadlineTime={deadlineTime}
			initialTimeLeft={computeTimeLeft(
				Number.isFinite(deadlineMs) ? deadlineMs : null
			)}
			bootstrapFailed={bootstrapFailed}
		/>
	)
}

async function HomeTournamentBand() {
	const t = await getTranslations('Home')

	return (
		<section
			className="fascia border-y"
			aria-labelledby="home-tournament-band-title"
		>
			<div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:py-9">
				<div className="max-w-xl">
					<p className="font-display text-xs font-semibold uppercase tracking-caps-wide text-electric/80">
						{t('competitionBandEyebrow')}
					</p>
					<h2
						id="home-tournament-band-title"
						className="mt-2 font-display text-2xl font-bold uppercase tracking-wide sm:text-3xl"
					>
						{t('competitionBandTitle')}
					</h2>
					<p className="mt-2 text-sm leading-6 text-electric/75">
						{t('competitionBandDescription')}
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button
						variant="outline"
						className="min-h-11 border-electric/50 bg-transparent font-display font-semibold uppercase tracking-caps text-electric hover:bg-electric hover:text-plum"
						asChild
					>
						<Link
							href="/competitions/browse"
							prefetch={false}
						>
							{t('browseCompetitions')}
						</Link>
					</Button>
					<Button
						className="min-h-11 bg-electric font-display font-semibold uppercase tracking-caps text-plum hover:bg-electric/90"
						asChild
					>
						<Link
							href="/competitions/create"
							prefetch={false}
						>
							{t('createCompetition')}
							<ArrowRight data-icon="inline-end" />
						</Link>
					</Button>
				</div>
			</div>
		</section>
	)
}

async function HomeInsights() {
	const [t, bootstrap] = await Promise.all([
		getTranslations('Home'),
		getHomePublicBootstrap().catch(error => {
			console.error('[home-insights] bootstrap failed', {
				error: error instanceof Error ? error.name : 'UnknownError'
			})
			return null
		})
	])
	const currentEventId = bootstrap?.context.currentEventId ?? null
	const nextEventId = bootstrap?.context.nextEventId ?? null
	const gameweek = currentEventId
		? await getHomeGameweek(currentEventId).catch(error => {
				console.error('[home-insights] gameweek failed', {
					error: error instanceof Error ? error.name : 'UnknownError'
				})
				return null
			})
		: null
	const initialFixtures: HomeFixturesResponse | null =
		bootstrap && nextEventId !== null
			? {
					season: bootstrap.context.season,
					revision: bootstrap.context.revision,
					eventId: nextEventId,
					fixtures: bootstrap.fixtures
				}
			: null
	const fixturesSeedKey = initialFixtures
		? `${initialFixtures.season}:${initialFixtures.revision}:${initialFixtures.eventId}`
		: `${bootstrap?.context.season ?? 'unknown'}:${bootstrap?.context.revision ?? 'unknown'}:none`

	if (!bootstrap) {
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
								overview={
									gameweek?.gameweekDesk.overviewState === 'AVAILABLE'
										? gameweek.gameweekDesk.overview
										: null
								}
							/>
						</div>
					</section>

					<section className="border-y bg-secondary/40 py-10">
						<div className="mx-auto max-w-4xl px-4">
							<div className="grid gap-8 md:grid-cols-2">
								<TeamOfTheWeekSection
									currentEventId={currentEventId}
									dreamTeam={
										gameweek?.gameweekDesk.boardsState === 'AVAILABLE'
											? gameweek.gameweekDesk.dreamTeam
											: []
									}
									hasError={gameweek === null}
								/>
								<GameweekStatsSection
									currentEventId={currentEventId}
									transfersIn={gameweek?.topTransfersIn ?? []}
									transfersOut={gameweek?.topTransfersOut ?? []}
									hasError={
										gameweek === null ||
										gameweek.transfersState === 'UNAVAILABLE'
									}
								/>
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
					<MatchesSection
						key={fixturesSeedKey}
						initialFixtures={initialFixtures}
					/>
				</div>
			</section>
		</>
	)
}

export default async function Home({ params }: { params: LocaleParams }) {
	await getPageLocale(params)
	void getHomePublicBootstrap()
	return (
		<RouteIntlProvider namespaces={ROUTE_CLIENT_NAMESPACES.home}>
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
		</RouteIntlProvider>
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
