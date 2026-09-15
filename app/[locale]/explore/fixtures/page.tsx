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
import type { FixturePlanningMarketSignals } from '@/lib/graphql/operations/market'
import {
	resolveFixturePlanningGameweek,
	resolveFixturePlanningHorizon
} from '@/lib/review-gameweek'
import { loadPersonalSquadSeed } from '@/lib/load-entry-squad-picks'
import { Suspense } from 'react'
import { FixturesSeedProvider, FixturesSeedCommit } from '@/app/data/fixtures/FixturesSeedContext'
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


async function MarketStream({ navigationId, promise }: {
	navigationId: string
	promise: ReturnType<typeof loadFixturePlanningSignals>
}) {
	const market = await promise.catch(() => null)
	return <FixturesSeedCommit navigationId={navigationId} update={{ market: {
		mostSelected: market?.marketPulse?.mostSelected ?? [],
		transferMovers: market?.marketPulse?.transferMovers ?? []
	} }} />
}
async function OwnershipStream({ navigationId, promise }: {
	navigationId: string
	promise: ReturnType<typeof loadFixturePlanningGameweekOwnership>
}) {
	const ownership = await promise.catch(() => null)
	return <FixturesSeedCommit navigationId={navigationId} update={{ market: {
		gameweekOwnership: ownership?.marketOwnershipOverview ?? null
	} }} />
}
async function SquadStream({ navigationId, promise }: {
	navigationId: string
	promise: ReturnType<typeof loadPersonalSquadSeed>
}) {
	return <FixturesSeedCommit navigationId={navigationId} update={{ squad: await promise }} />
}

async function renderFixturesPage({ params }: PageProps) {
	await getPageLocale(params)
	const eventsPromise = getCurrentAndNextEvents()
	const events = await eventsPromise
	const fromGw = resolveFixturePlanningGameweek(events)
	if (fromGw == null || fromGw <= 0) return <CurrentGameweekUnavailable titleKey="fixturesUnavailableTitle" />
	const horizon = resolveFixturePlanningHorizon(fromGw, DEFAULT_FDR_HORIZON)
	if (horizon == null) return <CurrentGameweekUnavailable titleKey="fixturesUnavailableTitle" />

	// Schedule the public window before optional personal and market work.
	const windowPromise = loadFixtureWindow(fromGw, horizon)
	const teamsPromise = loadFixtureTeams().catch(() => ({ teams: [] }))
	const squadPromise = loadPersonalSquadSeed(eventsPromise)
	const marketPromise = loadFixturePlanningSignals()
	const ownershipPromise = loadFixturePlanningGameweekOwnership()
	const marketSignalsPromise: Promise<FixturePlanningMarketSignals> = Promise.all([
		marketPromise.catch(() => null),
		ownershipPromise.catch(() => null)
	]).then(([market, ownership]) => ({
		mostSelected: market?.marketPulse?.mostSelected ?? [],
		transferMovers: market?.marketPulse?.transferMovers ?? [],
		gameweekOwnership: ownership?.marketOwnershipOverview ?? null,
		rollingOwnership: null
	}))
	// The stream readers may render after these promises settle.
	void marketPromise.catch(() => undefined)
	void ownershipPromise.catch(() => undefined)
	let fixturesByEvent: Record<number, FixturePlanningFixture[]> = {}
	let unknownEventIds: number[] = []
	try {
		const window = await windowPromise
		fixturesByEvent = window.fixturesByEvent
		unknownEventIds = window.unknownEventIds
	} catch (error) {
		unstable_rethrow(error)
		console.error('[fixtures] public window unavailable:', error)
	}
	const { teams } = await teamsPromise
	const navigationId = crypto.randomUUID()
	return (
		<FixturesSeedProvider navigationId={navigationId}>
			<FixturesClient fromGw={fromGw} initialHorizon={horizon}
				initialFixturesByEvent={fixturesByEvent} initialUnknownEventIds={unknownEventIds}
				knownTeams={teams ?? []} squadPromise={squadPromise}
				marketSignalsPromise={marketSignalsPromise} />
			<Suspense fallback={null}><SquadStream navigationId={navigationId} promise={squadPromise} /></Suspense>
			<Suspense fallback={null}><MarketStream navigationId={navigationId} promise={marketPromise} /></Suspense>
			<Suspense fallback={null}><OwnershipStream navigationId={navigationId} promise={ownershipPromise} /></Suspense>
		</FixturesSeedProvider>
	)
}

export default async function FixturesPage(props: PageProps) {
	return withCapacityRunForRequest(() => renderFixturesPage(props))
}
