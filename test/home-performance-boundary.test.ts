import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { createContext, runInContext } from 'node:vm'

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
const fixturesClient = readFileSync(
	'app/data/fixtures/FixturesClient.tsx',
	'utf8'
)
const tournamentClient = readFileSync(
	'app/live/tournaments/TournamentClient.tsx',
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

	it('keeps the optional squad seed pending until its read resolves', () => {
		assert.doesNotMatch(fixturesClient, /squad\?\.state \?\? 'unavailable'/)
		assert.match(fixturesClient, /squadKeySet\.size === 0 && squad != null/)
		assert.match(fixturesClient, /squadState === 'unavailable'/)
	})

	it('does not publish a canonical competition ready marker for a last-good board', () => {
		assert.match(
			tournamentClient,
			/competitionBoardReady = Boolean\([\s\S]*?standingsReady &&\s*!showingLastGood &&/
		)
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
		classifyFunctionalStatus,
		classifyNavigationSample,
		classifyPerformanceStatus,
		distribution,
		extractReadyMetrics,
		hasValidProductionIdentity,
		isUsableReadyMetric,
		isProductionMeasurementUrl,
		missingMetricReasons,
		navigationComplete,
		readyMetricFor
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
	assert.equal(navigationComplete({ ...productionSample, businessResult: 'unavailable', releaseSha: 'a'.repeat(40), origin: 'vercel' }), false)
	assert.equal(navigationComplete({ ...productionSample, businessResult: 'ok', releaseSha: 'a'.repeat(40), origin: 'vercel' }), true)
	assert.equal(isProductionMeasurementUrl('http://localhost:3200/explore/fixtures'), false)
	assert.equal(readyMetricFor('https://letletme.top/profile'), null)
	assert.equal(readyMetricFor('https://letletme.top/zh-CN/live/matches'), 'LIVE_MATCHDAY_READY')
	assert.equal(readyMetricFor('https://letletme.top/zh-CN/explore/price-predictions'), 'HOME_PRICE_CHANGES_READY')
	assert.equal(isUsableReadyMetric({ name: 'READY', value: 1, result: 'ok' }), true)
	assert.equal(isUsableReadyMetric({ name: 'READY', value: 0, result: 'unavailable' }), false)
	assert.equal(isUsableReadyMetric({ name: 'READY', value: 1, result: 'error' }), false)
	assert.equal(isUsableReadyMetric({ name: 'READY', value: 1, result: 'ok', interactionId: 'old' }), false)
	assert.equal(isUsableReadyMetric({ name: 'READY', value: 1, result: 'ok', interactionId: 'current' }, true), true)
	assert.equal(
		classifyFunctionalStatus({
			status: 200,
			businessResult: 'ok',
			readyMs: null
		}),
		'PASS'
	)
	assert.equal(
		classifyFunctionalStatus({
			status: 200,
			businessResult: 'unavailable',
			readyMs: 100
		}),
		'FAIL'
	)
	assert.equal(
		classifyFunctionalStatus({ status: 200, readyMs: null }),
		'NOT_OBSERVED'
	)
	assert.equal(
		classifyPerformanceStatus({ readyMs: 2_500 }, { budgetMs: 2_500 }),
		'PASS'
	)
	assert.equal(
		classifyPerformanceStatus({ readyMs: 2_501 }, { budgetMs: 2_500 }),
		'FAIL'
	)
	assert.equal(
		classifyPerformanceStatus({ readyMs: null }, { budgetMs: 2_500 }),
		'NOT_OBSERVED'
	)
	assert.equal(
		classifyPerformanceStatus(
			{ readyMs: 100, browserCache: 'cold', browserCacheApplied: false },
			{ budgetMs: 2_500 }
		),
		'BLOCKED'
	)
	assert.equal(
		classifyPerformanceStatus(
			{
				readyMs: 100,
				browserCache: 'warm',
				browserCacheApplied: true,
				browserCachePrimed: false
			},
			{ budgetMs: 2_500 }
		),
		'BLOCKED'
	)
	assert.equal(
		classifyPerformanceStatus(
			{
				readyMs: 100,
				browserCache: 'warm',
				browserCacheApplied: true,
				browserCachePrimed: true
			},
			{ budgetMs: 2_500 }
		),
		'PASS'
	)
	assert.deepEqual(
		missingMetricReasons({
			readyMs: 100,
			lcpMs: 10,
			cls: 0,
			inpMs: 20,
			fcpMs: 5,
			ttfbMs: 3,
			browserCache: 'cold',
			browserCacheApplied: false,
			browserCacheReason: 'CDP unavailable'
		}),
		{ browserCache: 'CDP unavailable' }
	)
	assert.deepEqual(
		missingMetricReasons({
			phase: 'navigation',
			lcpMs: 100,
			cls: null,
			inpMs: null,
			fcpMs: 80,
			ttfbMs: 20,
			readyMs: 500
		}),
		{
			cls: 'metric was not observed before the observation ended',
			inpMs: 'no interaction occurred during navigation measurement'
		}
	)
	assert.deepEqual(
		classifyNavigationSample({
			status: 200,
			phase: 'navigation',
			businessResult: 'ok',
			readyMs: 1_000,
			lcpMs: null,
			cls: 0,
			inpMs: null,
			fcpMs: 1,
			ttfbMs: 1
		}),
		{
			functionalStatus: 'PASS',
			performanceStatus: 'PASS',
			missingReason: {
				lcpMs: 'metric was not observed before the observation ended',
				inpMs: 'no interaction occurred during navigation measurement'
			}
		}
	)
	assert.deepEqual(
		extractReadyMetrics({
			name: 'FIXTURES_WINDOW_READY',
			value: 123,
			metricId: 'legacy'
		}),
		[{ name: 'FIXTURES_WINDOW_READY', value: 123, metricId: 'legacy' }]
	)
	assert.deepEqual(
		extractReadyMetrics({
			schemaVersion: 2,
			samples: [
				{ metricName: 'FIXTURES_WINDOW_READY', value: 456, result: 'ok' },
				{ metric: 'lcp_ms', value: 789 },
				{ metricName: 'NON_FINITE', value: Number.NaN },
				{ metricName: 42, value: 1 }
			]
		}),
		[
			{
				metricName: 'FIXTURES_WINDOW_READY',
				value: 456,
				result: 'ok',
				name: 'FIXTURES_WINDOW_READY'
			}
		]
	)
	assert.deepEqual(
		extractReadyMetrics({ samples: [{ name: 'HOME_READY', value: 0 }] }),
		[{ name: 'HOME_READY', value: 0 }]
	)
})

it('ships a valid favicon for browsers that probe the conventional path', () => {
	const favicon = readFileSync('public/favicon.ico')
	assert.equal(favicon.readUInt16LE(0), 0)
	assert.equal(favicon.readUInt16LE(2), 1)
})

it('keeps synthetic performance URLs deterministic and cache control explicit', () => {
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
		assert.doesNotMatch(
			source,
			/searchParams\.set\([\s\S]*?['"](?:cold|_[A-Za-z]+Perf)['"]/
		)
	}
	assert.match(
		readFileSync('scripts/performance-metrics.mjs', 'utf8'),
		/Network\.setCacheDisabled/
	)
})

	it('uses the browser vitals build and the same page for navigation plus follow-up probes', () => {
		const metrics = readFileSync('scripts/performance-metrics.mjs', 'utf8')
	assert.match(metrics, /web-vitals\.iife\.js/)
	assert.match(metrics, /globalThis\.webVitals = webVitals/)
	assert.match(metrics, /options\.page\?\.context\(\)/)
	assert.match(metrics, /options\.onResponse\?\.\(response\)/)
	assert.match(metrics, /readySequence/)
	assert.match(metrics, /isUsableReadyMetric/)
	assert.match(metrics, /classifyFunctionalStatus/)
	assert.match(metrics, /classifyPerformanceStatus/)
	assert.match(metrics, /missingMetricReasons/)
	assert.match(metrics, /setBrowserCacheMode/)
	assert.match(metrics, /browserCacheApplied/)
	assert.match(metrics, /browserCachePrimed/)
	assert.match(metrics, /warm-cache-prime-failed/)
	assert.match(metrics, /readyDetails\?\.\[name\]/)
	assert.match(
		metrics,
		/Production measurements must use the existing logged-in Chrome tab/
	)
	assert.match(metrics, /toolElapsedMs/)
	assert.match(metrics, /allowInteractionMetrics/)
	assert.match(metrics, /No ready metric configured/)
	assert.match(metrics, /snapshotLongTaskObservation/)
	assert.match(metrics, /finishLongTaskObservation\(page\)/)
	assert.match(metrics, /requests: requests\.slice\(\)/)
	assert.match(metrics, /page\.off\('requestfinished'/)
	assert.match(metrics, /if \(ownsPage\) await releaseThrottle/)
	assert.match(metrics, /if \(ownsPage\) void page\.close\(\)/)
	assert.match(metrics, /observationTask = \(async \(\) =>/)
	assert.match(metrics, /cancelObservation\?\.\(timeoutError\)/)
	assert.match(metrics, /await observationTask\?\.catch\(\(\) => \{\}\)/)
	assert.match(metrics, /const expectedGameweek = target\.searchParams\.get\('gw'\)/)
	assert.match(metrics, /data-competition-gameweek=/)
	assert.match(readFileSync('scripts/measure-home-performance.mjs', 'utf8'), /navigationComplete:/)
	assert.match(readFileSync('scripts/measure-competitions-performance.mjs', 'utf8'), /navigationComplete:/)
	const homeMeasurement = readFileSync('scripts/measure-home-performance.mjs', 'utf8')
	assert.doesNotMatch(homeMeasurement, /throttleMobile\(/)
	assert.match(homeMeasurement, /throttleProfile\(page, profile\)/)
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
	const competitionsMeasurement = readFileSync(
		'scripts/measure-competitions-performance.mjs',
		'utf8'
	)
	assert.match(
		competitionsMeasurement,
		/Production measurements must use the existing logged-in Chrome tab/
	)
	assert.match(
		readFileSync('e2e/public-experience.spec.ts', 'utf8'),
		/isProductionMeasurementUrl\(baseURL/
	)
	assert.doesNotMatch(competitionsMeasurement, /_competitionsPerf/)
	assert.match(competitionsMeasurement, /COMPETITIONS_PERF_GAMEWEEK/)
	for (const name of ['home', 'gameweek', 'player-stats']) {
		const source = readFileSync(`scripts/measure-${name}-performance.mjs`, 'utf8')
		assert.match(source, /extractReadyMetrics/)
	}
})

it('reports non-finite and non-numeric measurements as missing without losing business success', async () => {
 const { classifyNavigationSample, missingMetricReasons } = await import('../scripts/performance-metrics.mjs')
 const complete = { status: 200, businessResult: 'ok', readyMs: 100, lcpMs: 50, cls: 0, inpMs: 10, fcpMs: 20, ttfbMs: 5 }
 assert.deepEqual(missingMetricReasons(complete), {})
 for (const key of ['readyMs', 'lcpMs', 'cls', 'inpMs', 'fcpMs', 'ttfbMs']) {
  for (const invalid of [Number.NaN, Infinity, -Infinity, '123']) {
   const sample = { ...complete, [key]: invalid }
   assert.deepEqual(missingMetricReasons(sample), { [key]: 'metric value was not a finite number' })
   const result = classifyNavigationSample(sample)
   assert.equal(result.functionalStatus, 'PASS')
   assert.equal(result.performanceStatus, key === 'readyMs' ? 'NOT_OBSERVED' : 'PASS')
   assert.equal(result.missingReason[key], 'metric value was not a finite number')
  }
 }
})


it('invalid ready telemetry cannot retain a preceding successful duration', async () => {
 const { installVitals } = await import('../scripts/performance-metrics.mjs')
 let installedSource = ''
 await installVitals({ addInitScript: async ({ content }: { content: string }) => { installedSource = content } })
 const captured: unknown[] = []
 const browserWindow = {
  webVitals: Object.fromEntries(['onLCP', 'onCLS', 'onINP', 'onFCP', 'onTTFB'].map(name => [name, () => {}])),
  fetch: async (_input: string, _init?: { body: string }) => new Response(null, { status: 204 }),
  __capturePerformanceMetric: (value: unknown) => captured.push(value),
  __performanceMetrics: undefined as undefined | {
   ready: Record<string, number>, readyDetails: Record<string, { result: string }>, readySequence: Record<string, number>
  }
 }
 // Exercise the emitted collector initializer, with Web Vitals registration stubbed.
 // No browser, network, session or production endpoint is involved.
 const initializerStart = installedSource.indexOf(';(', installedSource.indexOf('globalThis.webVitals = webVitals;'))
 assert.ok(initializerStart > 0)
 runInContext(installedSource.slice(initializerStart), createContext({
  window: browserWindow, location: { href: 'http://localhost/collector-fixture' },
  navigator: { sendBeacon: () => true }, PerformanceObserver: { supportedEntryTypes: [] },
  URL, Request, Response
 }))
 const send = async (result: string, value: number, navigationId: string, extra: { measurementKind?: string, interactionId?: string } = {}) => {
  await browserWindow.fetch('/api/vitals', { body: JSON.stringify({ schemaVersion: 2, samples: [
   { metricName: 'READY', value, result, navigationId, ...extra }
  ] }) })
 }
 for (const result of ['unavailable', 'error']) {
  await send('ok', 125, 'nav-old')
  assert.equal(browserWindow.__performanceMetrics?.ready.READY, 125)
  const sequence = browserWindow.__performanceMetrics?.readySequence.READY
  const notifications = captured.length
  await send(result, 0, 'nav-new')
  assert.equal(browserWindow.__performanceMetrics?.ready.READY, undefined)
  assert.equal(browserWindow.__performanceMetrics?.readyDetails.READY.result, result)
  assert.equal(browserWindow.__performanceMetrics?.readySequence.READY, sequence)
  assert.equal(captured.length, notifications + 1)
  await send('ok', 240, 'nav-new')
  assert.equal(browserWindow.__performanceMetrics?.ready.READY, 240)
 }
 // Excluded interaction telemetry is not a replacement navigation observation.
 const navigationState = JSON.stringify(browserWindow.__performanceMetrics)
 const notifications = captured.length
 for (const extra of [{ measurementKind: 'interaction' }, { interactionId: 'interaction-late' }]) {
  for (const result of ['ok', 'unavailable', 'error']) {
   await send(result, 50, 'nav-current', extra)
   assert.equal(JSON.stringify(browserWindow.__performanceMetrics), navigationState)
   assert.equal(captured.length, notifications)
  }
 }
 const sendBatch = async (batchId: string, navigationId: string, value: number) => {
  await browserWindow.fetch('/api/vitals', { body: JSON.stringify({ schemaVersion: 2, batchId, samples: [
   { metricName: 'READY', result: 'ok', navigationId, value }
  ] }) })
 }
 await sendBatch('batch-a', 'nav-a', 125)
 await sendBatch('batch-b', 'nav-b', 240)
 const latestNavigation = JSON.stringify(browserWindow.__performanceMetrics)
 const beforeReplay = captured.length
 await sendBatch('batch-a', 'nav-a', 125)
 assert.equal(JSON.stringify(browserWindow.__performanceMetrics), latestNavigation)
 assert.equal(captured.length, beforeReplay)
})

it('navigation report does not pair late failure with the earlier ready time', async () => {
 const { measureNavigation } = await import('../scripts/performance-metrics.mjs')
 let source = ''
 let currentUrl = 'http://localhost/collector-fixture'
 const location = { href: currentUrl }
 const browserWindow: Record<string, any> = {
  webVitals: Object.fromEntries(['onLCP', 'onCLS', 'onINP', 'onFCP', 'onTTFB'].map(name => [name, () => {}])),
  fetch: async () => new Response(null, { status: 204 })
 }
 const sandbox = createContext({
  window: browserWindow, location, navigator: { sendBeacon: () => true },
  PerformanceObserver: { supportedEntryTypes: [] }, URL, Request, Response,
  performance: { now: () => 500, getEntriesByType: () => [], getEntriesByName: () => [] },
  document: { documentElement: { scrollWidth: 1440 } }, innerWidth: 1440
 })
 const emit = async (result: string, value: number) => browserWindow.fetch('/api/vitals', {
  body: JSON.stringify({ schemaVersion: 2, samples: [{ metricName: 'READY', result, value }] })
 })
 const page = {
  context: () => ({}), setDefaultTimeout: () => {}, on: () => {}, off: () => {},
  addInitScript: async ({ content }: { content: string }) => { source = content },
  exposeBinding: async (_name: string, callback: (...args: any[]) => void) => {
   browserWindow.__capturePerformanceMetric = (metric: unknown) => callback(null, metric)
  },
  goto: async (url: string) => {
   currentUrl = url; location.href = url
   runInContext(source.slice(source.indexOf(';(', source.indexOf('globalThis.webVitals = webVitals;'))), sandbox)
   await emit('ok', 125)
   return { status: () => 200, headers: () => ({}) }
  },
  url: () => currentUrl,
  evaluate: async (fn: (...args: any[]) => unknown, arg: unknown) => runInContext(`(${fn.toString()})(${JSON.stringify(arg)})`, sandbox),
  waitForFunction: async (fn: (...args: any[]) => unknown, arg: unknown) => {
   assert.equal(runInContext(`(${fn.toString()})(${JSON.stringify(arg)})`, sandbox), true)
  },
  // Deterministically deliver a failure during the collector's settling window.
  waitForTimeout: async () => { await emit('unavailable', 0) }
 }
 const result = await measureNavigation({ version: () => 'isolated-collector-double' },
  { name: 'desktop', viewport: { width: 1440, height: 900 } }, currentUrl,
  { page, readyMetric: 'READY' })
 assert.equal(result.error, null)
 assert.ok('businessResult' in result)
 assert.ok('functionalStatus' in result)
 assert.ok('performanceStatus' in result)
 assert.equal(result.businessResult, 'unavailable')
 assert.equal(result.functionalStatus, 'FAIL')
 assert.equal(result.readyMs, null)
 assert.equal(result.performanceStatus, 'NOT_OBSERVED')
})

it('rejects entity and gameweek redirects before collecting readiness', async () => {
 const { measureNavigation } = await import('../scripts/performance-metrics.mjs')
 for (const changedKey of ['p1', 'p2', 'tournamentId', 'gw', null]) {
  const target = new URL('http://localhost/explore/player-stats?p1=13&p2=27&tournamentId=3&gw=4')
  const redirected = new URL(target)
  if (changedKey) redirected.searchParams.set(changedKey, '99')
  let waitedForReady = false
  const page = {
   context: () => ({}), setDefaultTimeout: () => {}, on: () => {}, off: () => {},
   addInitScript: async () => {}, exposeBinding: async () => {},
   goto: async () => ({ status: () => 200, headers: () => ({}) }),
   url: () => redirected.href,
   waitForFunction: async () => { waitedForReady = true },
   waitForTimeout: async () => {},
   evaluate: async (_fn: unknown, arg: unknown) => typeof arg === 'string' ? 125 : ({
    endMs: 200, metrics: { ready: { PLAYER_COMPARE_PAINT: 125 },
     readyDetails: { PLAYER_COMPARE_PAINT: { result: 'ok' } } }
   })
  }
  const result = await measureNavigation({ version: () => 'isolated-page-double' },
   { name: 'desktop', viewport: { width: 1440, height: 900 } }, target.href, { page })
  if (changedKey) {
   assert.equal(result.error, 'Unexpected response or redirect', changedKey)
   assert.equal(result.readyMs, null, changedKey)
   assert.equal(waitedForReady, false, changedKey)
  } else {
   assert.equal(result.error, null)
   assert.equal(result.readyMs, 125)
   assert.equal(waitedForReady, true)
  }
 }
})


it('collector rejects a new batch from a superseded navigation using the route-start identity', async () => {
 const { installVitals } = await import('../scripts/performance-metrics.mjs')
 let source = ''
 await installVitals({ addInitScript: async ({ content }: { content: string }) => { source = content } })
 let activeNavigationId: string | null = 'nav-a'
 const browserWindow = {
  webVitals: Object.fromEntries(['onLCP', 'onCLS', 'onINP', 'onFCP', 'onTTFB'].map(name => [name, () => {}])),
  fetch: async (_input: string, _init?: { body: string }) => new Response(null, { status: 204 }),
  __performanceMetrics: undefined as undefined | { ready: Record<string, number> }
 }
 const initializerStart = source.indexOf(';(', source.indexOf('globalThis.webVitals = webVitals;'))
 runInContext(source.slice(initializerStart), createContext({
  window: browserWindow, location: { href: 'http://localhost/collector-fixture' },
  navigator: { sendBeacon: () => true }, PerformanceObserver: { supportedEntryTypes: [] },
  performance: { getEntriesByName: () => activeNavigationId ? [{ detail: { navigationId: activeNavigationId } }] : [] },
  URL, Request, Response
 }))
 const send = async (batchId: string, navigationId: string, value: number) => {
  await browserWindow.fetch('/api/vitals', { body: JSON.stringify({ schemaVersion: 2, batchId, samples: [
   { metricName: 'READY', result: 'ok', measurementKind: 'in_page_navigation', navigationId, value }
  ] }) })
 }
 await send('batch-a', 'nav-a', 125)
 assert.equal(browserWindow.__performanceMetrics?.ready.READY, 125)
 activeNavigationId = 'nav-b'
 assert.equal(browserWindow.__performanceMetrics?.ready.READY, undefined)
 await send('batch-a-before-b', 'nav-a', 129)
 assert.equal(browserWindow.__performanceMetrics?.ready.READY, undefined)
 await send('batch-b', 'nav-b', 240)
 await send('batch-a-late-new', 'nav-a', 130)
 assert.equal(browserWindow.__performanceMetrics?.ready.READY, 240)
 activeNavigationId = null
 assert.equal(browserWindow.__performanceMetrics?.ready.READY, undefined)
 await send('batch-missing-identity', 'nav-b', 241)
 assert.equal(browserWindow.__performanceMetrics?.ready.READY, undefined)
})
