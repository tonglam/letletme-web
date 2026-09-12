import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const home = readFileSync('app/[locale]/page.tsx', 'utf8')
const personalDesk = readFileSync('components/home/PersonalDesk.tsx', 'utf8')
const homeServerData = readFileSync('lib/home-data-server.ts', 'utf8')
const leagueList = readFileSync(
	'components/home/PersonalLeagueRankList.tsx',
	'utf8'
)
const leagueCarousel = readFileSync(
	'components/home/PersonalLeagueCarousel.tsx',
	'utf8'
)
const autoCarousel = readFileSync(
	'components/home/HomeAutoCarousel.tsx',
	'utf8'
)
const matches = readFileSync('components/home/MatchesSection.tsx', 'utf8')
const deadline = readFileSync('components/home/DeadlineSection.tsx', 'utf8')
const homeGraphql = readFileSync('lib/graphql/operations/home.ts', 'utf8')
const routeReadyMarker = readFileSync(
	'components/analytics/RouteReadyMarker.tsx',
	'utf8'
)
const routeNavigation = readFileSync(
	'lib/analytics/route-navigation.ts',
	'utf8'
)
const guestNavigation = readFileSync(
	'components/layout/GuestNavigationActions.tsx',
	'utf8'
)
const proxy = readFileSync('proxy.ts', 'utf8')
const bindEntry = readFileSync(
	'app/onboarding/bind-entry/BindEntryForm.tsx',
	'utf8'
)

describe('Home first-screen performance boundary', () => {
	it('starts the revision-pinned public bootstrap before child rendering', () => {
		assert.match(home, /void getHomePublicBootstrap\(\)/)
		assert.doesNotMatch(home, /GET_EVENT_OVERALL_RESULT/)
		assert.doesNotMatch(home, /GET_EVENT_FIXTURES/)
		assert.doesNotMatch(home, /getCurrentAndNextEvents/)
		assert.match(home, /export const dynamic = 'force-dynamic'/)
	})

	it('keeps guest Home independent from verified session I/O', () => {
		assert.match(
			home,
			/Promise\.all\(\[\s*getTranslations\('Home'\),\s*hasSessionCookieHint\(\)/
		)
		assert.match(home, /if \(!hasSessionCookie\) return null/)
		assert.ok(
			home.indexOf('if (!hasSessionCookie) return null') <
				home.indexOf('await getHomeVerifiedEntryContext()')
		)
	})

	it('loads the complete bound Team Desk with one compact protected query', () => {
		assert.equal(
			(homeServerData.match(/executeServerQueryWithSession</g) ?? []).length,
			1
		)
		assert.match(homeServerData, /GET_HOME_PERSONAL_DESK/)
		assert.match(homeServerData, /timeoutMs: 5_000/)
		for (const removed of [
			'GET_ENTRY_LEAGUES',
			'GET_ENTRY,',
			'<Suspense'
		]) {
			assert.doesNotMatch(personalDesk, new RegExp(removed))
		}
	})

	it('keeps league rows compact and the server projection request-free', () => {
		for (const removed of [
			'executeQuery',
			'usePageActive',
			'setInterval',
			'officialH2H',
			'totalTeamNum',
			'matchPoints'
		]) {
			assert.doesNotMatch(leagueList, new RegExp(removed))
		}
		assert.match(leagueList, /row\.name/)
		assert.match(leagueList, /leagueType/)
		assert.match(leagueCarousel, /data-home-league-group/)
		assert.match(leagueCarousel, /renderFullContentAction/)
		assert.match(leagueList, /row\.rank/)
		assert.match(leagueList, /row\.movement\.direction/)
		assert.match(leagueList, /row\.h2hMatchup/)
		assert.match(leagueList, /data-home-h2h-matchup/)
		assert.match(leagueList, /\/live\/competitions\//)
		assert.match(leagueList, /HOME_LEAGUE_RANKS_READY/)
		assert.match(leagueList, /elementtiming: 'home-league-ranks'/)
		assert.match(routeReadyMarker, /observeElementPaintTime/)
		assert.match(routeReadyMarker, /routeReadyStartTime/)
		assert.match(
			routeReadyMarker,
			/observeElementPaintTime\(elementTiming, routeStartedAt\)/
		)
		assert.match(routeNavigation, /PerformanceObserver/)
		assert.match(routeNavigation, /buffered: true/)
		assert.match(routeNavigation, /paintedAt >= notBefore/)
		assert.match(routeReadyMarker, /nextPaintOpportunityTime\(\)/)
		assert.match(routeNavigation, /requestAnimationFrame/)
		assert.match(routeNavigation, /setTimeout\(finish, timeoutMs\)/)
		assert.doesNotMatch(leagueList, /<details/)
		assert.match(autoCarousel, /AUTO_ADVANCE_MS/)
		assert.doesNotMatch(leagueList, /'use client'/)
		assert.doesNotMatch(leagueList, /useState|useEffect|useMemo/)
		assert.doesNotMatch(personalDesk, /personalLeaguesCount/)
		assert.doesNotMatch(leagueList, /visible\.length\}\/\{rows\.length/)
		assert.doesNotMatch(
			leagueList,
			/min-w-0 flex-1 truncate text-sm (font-medium|font-semibold)/
		)
		assert.match(leagueList, /data-home-league-name="true"/)
		assert.match(leagueList, /className="home-league-name min-w-0 flex-1/)
	})

	it('shares an accessible auto-carousel contract across Home panels', () => {
		assert.match(autoCarousel, /AUTO_ADVANCE_MS/)
		assert.match(autoCarousel, /prefers-reduced-motion: reduce/)
		assert.match(autoCarousel, /aria-hidden=\{isInactive\}/)
		assert.match(autoCarousel, /inert=\{isInactive\}/)
		assert.match(autoCarousel, /tabIndex=\{isActive \? 0 : -1\}/)
		for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
			assert.match(autoCarousel, new RegExp(key))
		}
		assert.doesNotMatch(autoCarousel, /aria-live/)
	})

	it('requests only the typed current-matchup projection for H2H leagues', () => {
		assert.match(homeGraphql, /leagueRanks\s*\{[\s\S]*?\bleagueType\b/)
		assert.match(homeGraphql, /\bh2hMatchup\s*\{/)
		assert.match(homeGraphql, /\bviewer\s*\{/)
		assert.match(homeGraphql, /\bopponent\s*\{/)
		assert.doesNotMatch(homeGraphql, /\bentryOfficialH2HDesk\b/)
		assert.doesNotMatch(homeGraphql, /\bstandings\s*\{/)
		assert.doesNotMatch(homeGraphql, /\bmatches\s*\{/)
	})

	it('switches fixtures through one GET route without shipping GraphQL or Radix tabs', () => {
		assert.match(
			matches,
			/fetch\(`\/api\/home\/fixtures\?eventId=\$\{eventId\}`/
		)
		assert.match(matches, /new AbortController\(\)/)
		assert.match(matches, /requestGeneration !== generation\.current/)
		assert.match(matches, /startTransition\(\(\) => setCommitted/)
		assert.match(matches, /role="tablist"/)
		assert.doesNotMatch(
			matches,
			/graphql-client|GET_EVENT_FIXTURES|@\/components\/ui\/tabs/
		)
		assert.doesNotMatch(matches, /unoptimized/)
		assert.doesNotMatch(matches, /from 'sonner'/)
		assert.match(matches, /data-home-fixtures-event=\{committedEventId\}/)
	})

	it('resets the fixture controller when the RSC seed revision advances', () => {
		assert.match(home, /key=\{fixturesSeedKey\}/)
		assert.match(
			home,
			/initialFixtures\.season[\s\S]*initialFixtures\.revision[\s\S]*initialFixtures\.eventId/
		)
	})

	it('retains the last valid deadline only for transient bootstrap failures', () => {
		assert.match(home, /bootstrapFailed: true/)
		assert.match(
			deadline,
			/incomingSchedule \?\? \(bootstrapFailed \? lastValidSchedule : null\)/
		)
		assert.match(deadline, /else if \(!bootstrapFailed\)/)
	})

	it('uses one failure-isolated Home gameweek GraphQL root', () => {
		assert.match(homeGraphql, /homeGameweek\(eventId: \$eventId\)/)
		assert.match(homeGraphql, /transfersState/)
		assert.doesNotMatch(homeGraphql, /^\s+gameweekDesk\(eventId:/m)
		assert.doesNotMatch(homeGraphql, /^\s+topTransfersIn\(eventId:/m)
		assert.match(home, /gameweek\.gameweekDesk\.boardsState === 'UNAVAILABLE'/)
	})

	it('renders the guest navigation without Better Auth client code', () => {
		assert.doesNotMatch(guestNavigation, /auth-client|useSession|signOut/)
		assert.match(guestNavigation, /<details/)
		assert.match(guestNavigation, /prefetch=\{false\}/)
	})

	it('refreshes the persistent server navbar after entry binding', () => {
		assert.match(
			bindEntry,
			/await refetchSession[\s\S]*router\.push\(next\)[\s\S]*router\.refresh\(\)/
		)
	})

	it('keeps personalized HTML private when a session cookie is hinted', () => {
		assert.match(proxy, /hasSessionCookieHintInHeaders\(req\.headers\)/)
		assert.match(proxy, /private, no-store, no-transform/)
	})

	it('measures concurrent Home completion after consuming every response stream', () => {
		const measurement = readFileSync(
			'scripts/measure-home-performance.mjs',
			'utf8'
		)
		assert.match(measurement, /await response\.arrayBuffer\(\)/)
		assert.match(measurement, /Cookie: sessionCookie/)
		assert.match(measurement, /reason: 'navigation-unavailable'/)
		assert.match(measurement, /GetEventFixtures/)
		assert.match(measurement, /firstSwitchTransports/)
		assert.match(measurement, /waitForCommittedFixtureEvent/)
		assert.match(readFileSync('scripts/performance-metrics.mjs', 'utf8'), /observed: values\.length/)
		assert.match(measurement, /waitForReadyMetric/)
	})
})

it('performance acceptance rejects missing values and preserves missing sample counts', async () => {
	const {
		atMost,
		distribution,
		hasValidProductionIdentity,
		isProductionMeasurementUrl,
		navigationComplete
	} = await import('../scripts/performance-metrics.mjs')
	assert.equal(atMost(null, 2500), false)
	assert.equal(atMost(undefined, 2500), false)
	assert.equal(atMost(NaN, 2500), false)
	assert.equal(atMost(0, 2500), true)
	assert.deepEqual(distribution([{ lcp: null }, { lcp: 100 }, { lcp: 300 }], 'lcp'), { observed: 2, missing: 1, p50: 100, min: 100, max: 300 })
	assert.equal(navigationComplete({ status: 200, error: null, lcpMs: null, cls: 0, fcpMs: 1, ttfbMs: 1, readyMs: 1 }), false)
	const productionSample = { status: 200, error: null, url: 'https://letletme.top/explore/fixtures', lcpMs: 1, cls: 0, fcpMs: 1, ttfbMs: 1, readyMs: 1 }
	assert.equal(isProductionMeasurementUrl(productionSample.url), true)
	assert.equal(hasValidProductionIdentity(productionSample), false)
	assert.equal(navigationComplete(productionSample), false)
	assert.equal(navigationComplete({ ...productionSample, releaseSha: 'a'.repeat(40), origin: 'vercel' }), true)
	assert.equal(navigationComplete({ ...productionSample, releaseSha: 'a'.repeat(40), origin: 'overseas' }), true)
	assert.equal(navigationComplete({ ...productionSample, releaseSha: 'a'.repeat(40), origin: 'untrusted-proxy' }), false)
	assert.equal(isProductionMeasurementUrl('http://localhost:3200/explore/fixtures'), false)
})

it('uses the browser vitals build and the same page for navigation plus follow-up probes', () => {
	const metrics = readFileSync('scripts/performance-metrics.mjs', 'utf8')
	assert.match(metrics, /web-vitals\.iife\.js/)
	assert.match(metrics, /globalThis\.webVitals = webVitals/)
	assert.match(metrics, /options\.page\?\.context\(\)/)
	assert.match(metrics, /options\.onResponse\?\.\(response\)/)
	assert.match(metrics, /readySequence/)
	assert.match(metrics, /if \(ownsPage\) await releaseThrottle/)
	assert.match(readFileSync('scripts/measure-home-performance.mjs', 'utf8'), /navigationComplete:/)
	assert.match(readFileSync('scripts/measure-competitions-performance.mjs', 'utf8'), /navigationComplete:/)
	for (const name of [
		'home',
		'fixtures',
		'gameweek',
		'market',
		'player-stats',
		'trends',
		'competitions'
	]) {
		const source = readFileSync(`scripts/measure-${name}-performance.mjs`, 'utf8')
		assert.match(source, /measureNavigation\([\s\S]*\{[\s\S]*page,[\s\S]*onResponse/)
	}
})
