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
		assert.match(homeServerData, /timeoutMs: 1_500/)
		for (const removed of [
			'GET_ENTRY_LEAGUES',
			'GET_ENTRY_OFFICIAL_H2H_DESK',
			'GET_ENTRY,',
			'<Suspense'
		]) {
			assert.doesNotMatch(personalDesk, new RegExp(removed))
		}
	})

	it('keeps league rows compact and performs no background requests', () => {
		for (const removed of [
			'executeQuery',
			'GET_ENTRY_OFFICIAL_H2H_DESK',
			'usePageActive',
			'setInterval',
			'officialH2H',
			'totalTeamNum',
			'matchPoints',
			'opponent'
		]) {
			assert.doesNotMatch(leagueList, new RegExp(removed))
		}
		assert.match(leagueList, /row\.name/)
		assert.match(leagueList, /row\.rank/)
		assert.match(leagueList, /row\.movement\.direction/)
		assert.match(leagueList, /HOME_LEAGUE_RANKS_READY/)
		assert.match(leagueList, /elementtiming: 'home-league-ranks'/)
		assert.match(routeReadyMarker, /observeElementPaintTime/)
		assert.match(routeNavigation, /PerformanceObserver/)
		assert.match(routeNavigation, /buffered: true/)
		assert.match(leagueList, /<details/)
		assert.doesNotMatch(leagueList, /'use client'/)
		assert.doesNotMatch(leagueList, /useState|useEffect|useMemo/)
		assert.doesNotMatch(personalDesk, /personalLeaguesCount/)
		assert.doesNotMatch(leagueList, /visible\.length\}\/\{rows\.length/)
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
		assert.match(measurement, /observed: values\.length/)
		assert.match(measurement, /waitForReadyMetric/)
	})
})
