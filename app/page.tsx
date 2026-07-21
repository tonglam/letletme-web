import { DeadlineSection } from '@/components/home/DeadlineSection'
import {
	GameweekStatsSection,
	GameweekStatsSectionFallback,
} from '@/components/home/GameweekStatsSection'
import { H2HSection } from '@/components/home/H2HSection'
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
import RootLayout from '@/components/layout/RootLayout'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getCurrentAndNextEvents } from '@/lib/events'
import { executePublicServerQuery } from '@/lib/graphql-server'
import {
	GET_EVENT_FIXTURES,
	GET_EVENT_OVERALL_RESULT,
	type EventFixturesResponse,
	type EventOverallResultResponse,
} from '@/lib/graphql/queries'
import homeStats from '@/lib/home-stats'
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
	return (
		<div className="flex-grow mb-8">
			<Card className="p-4 md:p-6">
				<div className="flex items-center justify-between mb-6">
					<h2 className="text-xl font-bold flex items-center gap-2">
						Upcoming Matches
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
				<div className="space-y-4">
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

async function InitialMatchesSection({ eventId }: { eventId: number | null }) {
	const initialFixtures = eventId
		? await safeQuery<EventFixturesResponse>(
				GET_EVENT_FIXTURES,
				{ eventId },
				{ cache: 'force-cache', next: { revalidate: 300 } },
			)
		: null

	return (
		<MatchesSection
			initialEventId={eventId}
			initialFixtures={initialFixtures}
		/>
	)
}

export default async function Home() {
	// Fetch events + overall result in parallel — neither depends on the other
	const [eventsData, overallResultData] = await Promise.all([
		getCurrentAndNextEvents(),
		safeQuery<EventOverallResultResponse>(GET_EVENT_OVERALL_RESULT, undefined, {
			cache: 'force-cache',
			next: { revalidate: 3600 },
		}),
	])

	const currentEventId = eventsData?.current[0]?.id ?? null
	const nextEvent = eventsData?.next[0] ?? null

	const overallResult =
		currentEventId && overallResultData
			? homeStats.pickEventOverallResult(overallResultData.eventOverallResult, currentEventId)
			: null

	return (
		<RootLayout className="!px-0">
			<div className="flex flex-col">
				<section className="bg-primary/5">
					<div className="container max-w-4xl mx-auto px-4">
						<DeadlineSection
							nextEventId={nextEvent?.id ?? null}
							deadlineTime={nextEvent?.deadlineTime ?? null}
						/>
					</div>
				</section>

				<section className="bg-background py-8">
					<div className="container max-w-4xl mx-auto px-4">
						<Suspense fallback={<PriceChangesSectionFallback />}>
							<PriceChangesSection />
						</Suspense>
					</div>
				</section>

				<section className="bg-muted/30 py-8">
					<div className="container max-w-4xl mx-auto px-4">
						<H2HSection />
					</div>
				</section>

				<section className="bg-background py-8">
					<div className="container max-w-4xl mx-auto px-4">
						<StatsSection currentEventId={currentEventId} overallResult={overallResult} />
					</div>
				</section>

				<section className="bg-muted/30 py-8">
					<div className="container max-w-4xl mx-auto px-4">
						<div className="grid md:grid-cols-2 gap-8">
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

				<section className="bg-background py-8">
					<div className="container max-w-4xl mx-auto px-4">
						<Suspense fallback={<MatchesSectionFallback eventId={nextEvent?.id ?? null} />}>
							<InitialMatchesSection eventId={nextEvent?.id ?? null} />
						</Suspense>
					</div>
				</section>
			</div>
		</RootLayout>
	)
}
