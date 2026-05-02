import { DeadlineSection } from '@/components/home/DeadlineSection'
import { GameweekStatsSection } from '@/components/home/GameweekStatsSection'
import { H2HSection } from '@/components/home/H2HSection'
import { MatchesSection } from '@/components/home/MatchesSection'
import { PriceChangesSection } from '@/components/home/PriceChangesSection'
import { StatsSection } from '@/components/home/StatsSection'
import { TeamOfTheWeekSection } from '@/components/home/TeamOfTheWeekSection'
import RootLayout from '@/components/layout/RootLayout'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_CURRENT_AND_NEXT_EVENTS,
	GET_EVENT_FIXTURES,
	GET_EVENT_OVERALL_RESULT,
	type EventFixturesResponse,
	type EventOverallResultResponse,
	type EventsResponse,
} from '@/lib/graphql/queries'
import homeStats from '@/lib/home-stats'

async function safeQuery<T>(
	query: string,
	variables?: Record<string, unknown>,
	options?: Parameters<typeof executeQuery>[2],
): Promise<T | null> {
	try {
		return await executeQuery<T>(query, variables, options)
	} catch (err) {
		console.error('[page] RSC fetch failed:', err)
		return null
	}
}

export default async function Home() {
	// Fetch events + overall result in parallel — neither depends on the other
	const [eventsData, overallResultData] = await Promise.all([
		safeQuery<EventsResponse>(GET_CURRENT_AND_NEXT_EVENTS, undefined, {
			cache: 'force-cache',
			next: { revalidate: 300 },
		}),
		safeQuery<EventOverallResultResponse>(GET_EVENT_OVERALL_RESULT, undefined, {
			cache: 'force-cache',
			next: { revalidate: 3600 },
		}),
	])

	const currentEventId = eventsData?.current[0]?.id ?? null
	const nextEvent = eventsData?.next[0] ?? null

	// Initial fixtures depend on next event ID — fetch after events resolve
	const initialFixtures = nextEvent?.id
		? await safeQuery<EventFixturesResponse>(
				GET_EVENT_FIXTURES,
				{ eventId: nextEvent.id },
				{ cache: 'force-cache', next: { revalidate: 300 } },
			)
		: null

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
						<PriceChangesSection />
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
							<TeamOfTheWeekSection currentEventId={currentEventId} />
							<GameweekStatsSection currentEventId={currentEventId} />
						</div>
					</div>
				</section>

				<section className="bg-background py-8">
					<div className="container max-w-4xl mx-auto px-4">
						<MatchesSection
							initialEventId={nextEvent?.id ?? null}
							initialFixtures={initialFixtures}
						/>
					</div>
				</section>
			</div>
		</RootLayout>
	)
}
