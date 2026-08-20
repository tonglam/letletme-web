import FixturesClient from '@/app/data/fixtures/FixturesClient'
import { CurrentGameweekUnavailable } from '@/components/feedback/CurrentGameweekUnavailable'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { withCapacityRunForRequest } from '@/lib/capacity-run'
import { DEFAULT_FDR_HORIZON } from '@/lib/fixtures-fdr'
import { getCurrentAndNextEvents } from '@/lib/events'
import { loadFixtureTeams } from '@/lib/fixture-team-seed-server'
import { loadFixtureWindow } from '@/lib/fixture-window-server'
import {
	loadFixturePlanningGameweekOwnership,
	loadFixturePlanningSignals
} from '@/lib/fixture-planning-seed-server'
import type { FixturePlanningFixture } from '@/lib/fixture-window'
import {
	type FixturePlanningMarketSignals,
} from '@/lib/graphql/operations/market'
import {
	type TeamForPickerItem,
} from '@/lib/graphql/operations/players'
import { resolveFixturePlanningGameweek } from '@/lib/review-gameweek'
import { loadEntrySquadPicks } from '@/lib/load-entry-squad-picks'
import {
	squadPickKeys,
	type SquadLoadState,
	type SquadPickSeed
} from '@/lib/squad-picks'
import { getVerifiedEntryContext } from '@/lib/session'
import { unstable_rethrow } from 'next/navigation'

export const dynamic = 'force-dynamic'

type PageProps = { params: LocaleParams }

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/explore/fixtures',
		titleKey: 'fixturesTitle',
		descriptionKey: 'fixturesDescription'
	})
}

async function renderFixturesPage({ params }: PageProps) {
	await getPageLocale(params)

	const [events, { session, entryId }] = await Promise.all([
		getCurrentAndNextEvents(),
		getVerifiedEntryContext()
	])
	const fromGw = resolveFixturePlanningGameweek(events)

	if (fromGw == null || fromGw <= 0) {
		return <CurrentGameweekUnavailable titleKey="fixturesUnavailableTitle" />
	}

	const horizon = DEFAULT_FDR_HORIZON

	const fixturesByEvent: Record<number, FixturePlanningFixture[]> = {}
	let marketSignals: FixturePlanningMarketSignals | null = null
	let mySquadKeys: string[] = []
	let mySquadPicks: SquadPickSeed[] = []
	let squadState: SquadLoadState = entryId != null ? 'not-published' : 'unbound'
	let knownTeams: TeamForPickerItem[] = []
	let unknownEventIds: number[] = []

	try {
		const [
			fixtureWindow,
			market,
			gameweekOwnership,
			squadResult,
			teamsResponse
		] = await Promise.all([
			loadFixtureWindow(fromGw, horizon),
			loadFixturePlanningSignals().catch(err => {
				console.error('[fixtures] market pulse seed failed:', err)
				return null
			}),
			loadFixturePlanningGameweekOwnership().catch(err => {
				console.error('[fixtures] gameweek ownership seed failed:', err)
				return null
			}),
			entryId != null && session
				? loadEntrySquadPicks(session, entryId, events).catch(err => {
						console.error('[fixtures] entry picks seed failed:', err)
						return {
							picks: [] as SquadPickSeed[],
							state: 'unavailable' as const
						}
					})
				: Promise.resolve({
						picks: [] as SquadPickSeed[],
						state: 'unbound' as const
			}),
			loadFixtureTeams().catch(err => {
				console.error('[fixtures] team directory seed failed:', err)
				return { teams: [] }
			})
		])

		Object.entries(fixtureWindow.fixturesByEvent).forEach(([id, fixtures]) => {
			fixturesByEvent[Number(id)] = fixtures
		})
		unknownEventIds = fixtureWindow.unknownEventIds
		const hasMarketSignals = market != null || gameweekOwnership != null
		marketSignals = hasMarketSignals
			? {
					mostSelected: market?.marketPulse?.mostSelected ?? [],
					transferMovers: market?.marketPulse?.transferMovers ?? [],
					gameweekOwnership: gameweekOwnership?.marketOwnershipOverview ?? null,
					rollingOwnership: null
				}
			: null
		mySquadPicks = squadResult.picks
		squadState = squadResult.state
		knownTeams = teamsResponse.teams ?? []
	} catch (error) {
		unstable_rethrow(error)
		console.error('[fixtures] RSC seed failed:', error)
	}

	mySquadKeys = squadPickKeys(mySquadPicks)

	return (
		<FixturesClient
			fromGw={fromGw}
			initialHorizon={horizon}
			initialFixturesByEvent={fixturesByEvent}
			initialUnknownEventIds={unknownEventIds}
			marketSignals={marketSignals}
			knownTeams={knownTeams}
			mySquadKeys={mySquadKeys}
			mySquadPicks={mySquadPicks}
			hasLinkedEntry={entryId != null || mySquadPicks.length > 0}
			squadState={squadState}
		/>
	)
}

export default async function FixturesPage(props: PageProps) {
	return withCapacityRunForRequest(() => renderFixturesPage(props))
}
