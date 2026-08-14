import FixturesClient from '@/app/data/fixtures/FixturesClient'
import { CurrentGameweekUnavailable } from '@/components/feedback/CurrentGameweekUnavailable'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { CacheTag, publicFetchOptions, RevalidateSeconds } from '@/lib/cache-policy'
import { DEFAULT_FDR_HORIZON } from '@/lib/fixtures-fdr'
import { getCurrentAndNextEvents } from '@/lib/events'
import { loadFixtureWindow } from '@/lib/fixture-window-server'
import type { FixturePlanningFixture } from '@/lib/fixture-window'
import { executePublicServerQuery } from '@/lib/graphql-server'
import {
	GET_MARKET_PULSE,
	type MarketPulse,
	type MarketPulseResponse,
} from '@/lib/graphql/operations/market'
import {
	GET_TEAMS_FOR_PICKER,
	type TeamForPickerItem,
	type TeamsForPickerResponse,
} from '@/lib/graphql/operations/players'
import { resolveFixturePlanningGameweek } from '@/lib/review-gameweek'
import { loadEntrySquadPicks } from '@/lib/load-entry-squad-picks'
import {
	squadPickKeys,
	type SquadLoadState,
	type SquadPickSeed,
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
		descriptionKey: 'fixturesDescription',
	})
}

export default async function FixturesPage({ params }: PageProps) {
	await getPageLocale(params)

	const [events, { session, entryId }] = await Promise.all([
		getCurrentAndNextEvents(),
		getVerifiedEntryContext(),
	])
	const fromGw = resolveFixturePlanningGameweek(events)

	if (fromGw == null || fromGw <= 0) {
		return <CurrentGameweekUnavailable titleKey="fixturesUnavailableTitle" />
	}

	const horizon = DEFAULT_FDR_HORIZON

	const fixturesByEvent: Record<number, FixturePlanningFixture[]> = {}
	let marketPulse: MarketPulse | null = null
	let mySquadKeys: string[] = []
	let mySquadPicks: SquadPickSeed[] = []
	let squadState: SquadLoadState = entryId != null ? 'not-published' : 'unbound'
	let knownTeams: TeamForPickerItem[] = []
	let unknownEventIds: number[] = []

	try {
		const [fixtureWindow, market, squadResult, teamsResponse] = await Promise.all([
			loadFixtureWindow(fromGw, horizon),
			executePublicServerQuery<MarketPulseResponse>(
				GET_MARKET_PULSE,
				{ days: 14 },
				publicFetchOptions({
					revalidate: RevalidateSeconds.market,
					tags: [CacheTag.market],
				}),
			).catch(err => {
				console.error('[fixtures] market pulse seed failed:', err)
				return null
			}),
			entryId != null && session
				? loadEntrySquadPicks(session, entryId, events)
						.catch(err => {
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
			executePublicServerQuery<TeamsForPickerResponse>(
				GET_TEAMS_FOR_PICKER,
				{},
				publicFetchOptions({
					revalidate: RevalidateSeconds.publicStats,
					tags: [CacheTag.fixtures],
				}),
			).catch(err => {
				console.error('[fixtures] team directory seed failed:', err)
				return { teams: [] }
			}),
		])

		Object.entries(fixtureWindow.fixturesByEvent).forEach(([id, fixtures]) => {
			fixturesByEvent[Number(id)] = fixtures
		})
		unknownEventIds = fixtureWindow.unknownEventIds
		marketPulse = market?.marketPulse ?? null
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
			marketPulse={marketPulse}
			knownTeams={knownTeams}
			mySquadKeys={mySquadKeys}
			mySquadPicks={mySquadPicks}
			hasLinkedEntry={entryId != null || mySquadPicks.length > 0}
			squadState={squadState}
		/>
	)
}
