import { DeadlineSection } from '@/components/home/DeadlineSection'
import { HomePersonalHydratedMarker } from '@/components/analytics/HomePersonalHydratedMarker'
import { RouteReadyMarker } from '@/components/analytics/RouteReadyMarker'
import {
	HomePriceChangeDesk,
	HomePriceChangeDeskFallback
} from '@/components/home/HomePriceChangeDesk'
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
import type {
	HomeGameweek,
	HomeGameweekPlayer
} from '@/lib/graphql/operations/home'
import { computeTimeLeft } from '@/lib/home-deadline'
import {
	getHomeGameweek,
	loadHomeFixtures,
	getHomePublicBootstrap,
	getHomeVerifiedEntryContext
} from '@/lib/home-data-server'
import { hasSessionCookieHint } from '@/lib/session'
import {
	resolveSeasonPresentation,
	type SeasonPresentation
} from '@/lib/season-presentation'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { getFormatter, getTranslations } from 'next-intl/server'
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
					<Skeleton
						key={index}
						className="h-11 w-full"
					/>
				))}
			</div>
		</div>
	)
}

function HomePersonalStrip({
	session,
	entryId,
	presentation
}: {
	session: Session | null
	entryId: number | null
	presentation: SeasonPresentation
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
			session={session}
			presentation={presentation}
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
	const bootstrapPromise = getHomePublicBootstrap().catch(error => {
		console.info('[home-personal] bootstrap unavailable', {
			error: error instanceof Error ? error.name : 'UnknownError'
		})
		return null
	})
	const { session, entryId } = await getHomeVerifiedEntryContext()
	const bootstrap = await bootstrapPromise
	if (!session?.user) return null
	const presentation = resolveSeasonPresentation(bootstrap?.context)

	return (
		<>
			<HomePersonalHydratedMarker enabled />
			<HomePersonalStrip
				session={session}
				entryId={entryId}
				presentation={presentation}
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
			console.info('[home-deadline] bootstrap unavailable', {
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

type HomeGameweekOverview = NonNullable<
	HomeGameweek['gameweekDesk']['overview']
>

function HomePerformanceDesk({
	currentEventId,
	overview,
	dreamTeam,
	hasTeamError
}: {
	currentEventId: number | null
	overview: HomeGameweekOverview | null
	dreamTeam: HomeGameweekPlayer[]
	hasTeamError: boolean
}) {
	const t = useTranslations('Home')

	return (
		<section
			className="border-t bg-muted/20 py-10"
			aria-label={t('performanceDesk')}
		>
			<div className="mx-auto max-w-4xl px-4">
				<div className="space-y-8">
					<StatsSection
						currentEventId={currentEventId}
						overview={overview}
					/>
					<TeamOfTheWeekSection
						currentEventId={currentEventId}
						dreamTeam={dreamTeam}
						hasError={hasTeamError}
					/>
				</div>
			</div>
			<RouteReadyMarker
				name="HOME_PERFORMANCE_READY"
				readyKey={String(currentEventId ?? 'unavailable')}
				audienceHint="public"
				goodMs={2_000}
				poorMs={3_000}
			/>
		</section>
	)
}

function HomeMarketDesk() {
	const t = useTranslations('Home')

	return (
		<section
			data-home-market-section
			className="border-y bg-secondary/40 py-10"
			aria-label={t('marketDesk')}
		>
			<div className="mx-auto max-w-6xl px-4">
				<div
					data-home-market-grid
					className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]"
				>
					<Suspense fallback={<MarketTeaserFallback />}>
						<MarketTeaser />
					</Suspense>
					<Suspense fallback={<HomePriceChangeDeskFallback />}>
						<HomePriceChangeDesk />
					</Suspense>
				</div>
			</div>
		</section>
	)
}

function HomeFixturesDesk({
	fixturesSeedKey,
	initialFixtures
}: {
	fixturesSeedKey: string
	initialFixtures: Awaited<ReturnType<typeof loadHomeFixtures>> | null
}) {
	const t = useTranslations('Home')

	return (
		<section
			className="border-t py-10"
			aria-label={t('fixturesDesk')}
		>
			<div className="mx-auto max-w-4xl px-4">
				<MatchesSection
					key={fixturesSeedKey}
					initialFixtures={initialFixtures}
				/>
				<RouteReadyMarker
					name="HOME_FIXTURES_READY"
					readyKey={fixturesSeedKey}
					audienceHint="public"
					goodMs={2_000}
					poorMs={3_000}
				/>
			</div>
		</section>
	)
}

async function HomePerformanceSection() {
	const [t, format, bootstrap] = await Promise.all([
		getTranslations('Home'),
		getFormatter(),
		getHomePublicBootstrap().catch(() => null)
	])
	const currentEventId = bootstrap?.context.currentEventId ?? null
	const preferDurable =
		currentEventId !== null &&
		bootstrap?.context.latestFinishedEventId !== null &&
		bootstrap?.context.latestFinishedEventId !== undefined &&
		currentEventId <= bootstrap.context.latestFinishedEventId
	const gameweek = currentEventId
		? await getHomeGameweek(currentEventId, { preferDurable }).catch(() => null)
		: null
	const presentation = resolveSeasonPresentation(
		bootstrap?.context,
		gameweek?.gameweekDesk.lifecycle ?? null
	)
	const deadlineMs = presentation.nextDeadlineTime
		? Date.parse(presentation.nextDeadlineTime)
		: Number.NaN
	const deadlineLabel = Number.isFinite(deadlineMs)
		? format.dateTime(new Date(deadlineMs), {
				dateStyle: 'medium',
				timeStyle: 'short'
			})
		: t('deadlineNotPublished')

	const homePhaseNotice = (() => {
		switch (presentation.phase) {
			case 'PRESEASON':
				return {
					eyebrow: t('preseasonHomeEyebrow'),
					title: t('preseasonHomeTitle', {
						gameweek: presentation.nextEventId ?? 1
					}),
					description: t('preseasonHomeDescription', {
						gameweek: presentation.nextEventId ?? 1,
						deadline: deadlineLabel
					})
				}
			case 'PRE_DEADLINE':
				return {
					eyebrow: t('preDeadlineHomeEyebrow'),
					title: t('preDeadlineHomeTitle', {
						gameweek:
							presentation.currentEventId ?? presentation.nextEventId ?? 1
					}),
					description: t('preDeadlineHomeDescription', {
						gameweek:
							presentation.currentEventId ?? presentation.nextEventId ?? 1,
						deadline: deadlineLabel
					})
				}
			case 'BETWEEN_GAMEWEEKS':
				return {
					eyebrow: t('betweenGameweeksEyebrow'),
					title: t('betweenGameweeksTitle'),
					description: t('betweenGameweeksDescription')
				}
			case 'OFFSEASON':
				return {
					eyebrow: t('offseasonHomeEyebrow'),
					title: t('offseasonHomeTitle'),
					description: t('offseasonHomeDescription')
				}
			case 'UNAVAILABLE':
				return {
					eyebrow: t('gameweekStats'),
					title: t('insightsUnavailable'),
					description: t('insightsUnavailableDescription')
				}
			default:
				return null
		}
	})()

	if (!bootstrap || homePhaseNotice) {
		return (
			<section className="py-10">
				<div className="mx-auto max-w-4xl px-4">
					<div className="rounded-xl border bg-card px-6 py-7">
						<p className="chyron">{homePhaseNotice?.eyebrow}</p>
						<h2 className="mt-2 font-display text-2xl font-bold uppercase tracking-wide">
							{homePhaseNotice?.title}
						</h2>
						<p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
							{homePhaseNotice?.description}
						</p>
						{presentation.phase === 'PRESEASON' ||
						presentation.phase === 'PRE_DEADLINE' ||
						presentation.phase === 'BETWEEN_GAMEWEEKS' ||
						presentation.phase === 'OFFSEASON' ? (
							<div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold">
								<Link
									className="underline underline-offset-4"
									href="/explore/fixtures"
								>
									{t('viewFixtures')}
								</Link>
								<Link
									className="underline underline-offset-4"
									href="/explore/market"
								>
									{t('exploreMarket')}
								</Link>
							</div>
						) : null}
					</div>
				</div>
			</section>
		)
	}

	if (
		presentation.phase !== 'LIVE' &&
		presentation.phase !== 'SETTLING' &&
		presentation.phase !== 'SETTLED'
	) {
		return null
	}

	return (
		<HomePerformanceDesk
			currentEventId={currentEventId}
			overview={
				gameweek?.gameweekDesk.overviewState === 'AVAILABLE'
					? gameweek.gameweekDesk.overview
					: null
			}
			dreamTeam={
				gameweek?.gameweekDesk.boardsState === 'AVAILABLE'
					? gameweek.gameweekDesk.dreamTeam
					: []
			}
			hasTeamError={
				gameweek === null || gameweek.gameweekDesk.boardsState === 'UNAVAILABLE'
			}
		/>
	)
}

async function HomeFixturesSection() {
	const bootstrap = await getHomePublicBootstrap().catch(() => null)
	const currentEventId = bootstrap?.context.currentEventId ?? null
	const nextEventId = bootstrap?.context.nextEventId ?? null
	const eventId =
		bootstrap?.context.currentEventId ?? bootstrap?.context.nextEventId ?? null
	let initialFixtures = eventId
		? await loadHomeFixtures(eventId).catch(() => null)
		: null

	// Core keeps the current event until the next deadline, even after every
	// fixture in that event has settled. The home desk is date-oriented, so
	// move to the next event once the current one is over.
	if (
		initialFixtures &&
		currentEventId !== null &&
		nextEventId !== null &&
		nextEventId !== currentEventId &&
		(initialFixtures.state === 'SETTLED' ||
			(initialFixtures.fixtures.length > 0 &&
				initialFixtures.fixtures.every(fixture => fixture.finished)))
	) {
		initialFixtures = await loadHomeFixtures(nextEventId).catch(
			() => initialFixtures
		)
	}
	const fixturesSeedKey = initialFixtures
		? `${initialFixtures.season}:${initialFixtures.source}:${initialFixtures.state}:${initialFixtures.revision}:${initialFixtures.eventId}`
		: `${bootstrap?.context.season ?? 'unknown'}:${bootstrap?.context.revision ?? 'unknown'}:none`
	return (
		<HomeFixturesDesk
			fixturesSeedKey={fixturesSeedKey}
			initialFixtures={initialFixtures}
		/>
	)
}

function HomePerformanceSectionFallback() {
	return (
		<section
			className="border-t bg-muted/20 py-10"
			aria-hidden="true"
		>
			<div className="mx-auto max-w-4xl px-4">
				<div className="space-y-8">
					<div className="rounded-xl border bg-card p-6">
						<Skeleton className="h-6 w-40" />
						<div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
							{[1, 2, 3, 4].map(item => (
								<Skeleton
									key={item}
									className="h-28"
								/>
							))}
						</div>
					</div>
					<TeamOfTheWeekSectionFallback currentEventId={null} />
				</div>
			</div>
		</section>
	)
}

function HomeMarketSectionFallback() {
	return (
		<section
			className="border-y bg-secondary/40 py-10"
			aria-hidden="true"
		>
			<div className="mx-auto max-w-6xl px-4">
				<div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
					<MarketTeaserFallback />
					<HomePriceChangeDeskFallback />
				</div>
			</div>
		</section>
	)
}

function HomeFixturesSectionFallback() {
	return (
		<section
			className="border-t py-10"
			aria-hidden="true"
		>
			<div className="mx-auto max-w-4xl px-4">
				<div className="rounded-xl border bg-card p-6">
					<Skeleton className="h-6 w-44" />
					<Skeleton className="mt-6 h-72 w-full" />
				</div>
			</div>
		</section>
	)
}

export default async function Home({ params }: { params: LocaleParams }) {
	await getPageLocale(params)
	void getHomePublicBootstrap().catch(() => undefined)
	return (
		<RouteIntlProvider namespaces={ROUTE_CLIENT_NAMESPACES.home}>
			<PageShell>
				<div className="flex flex-col">
					<HomeHero />

					<HomeTournamentBand />

					<Suspense fallback={<HomePerformanceSectionFallback />}>
						<HomePerformanceSection />
					</Suspense>
					<Suspense fallback={<HomeMarketSectionFallback />}>
						<HomeMarketDesk />
					</Suspense>
					<Suspense fallback={<HomeFixturesSectionFallback />}>
						<HomeFixturesSection />
					</Suspense>
				</div>
			</PageShell>
		</RouteIntlProvider>
	)
}
