import { atMost, finishLongTaskObservation, navigationComplete, installVitals, measureNavigation, performanceMetadata, percentile, distribution } from './performance-metrics.mjs'
import { chromium } from '@playwright/test'
import { brotliCompressSync } from 'node:zlib'

const targetUrl =
	process.env.MARKET_PERF_URL ?? 'https://letletme.top/zh-CN/explore/market'
const runCount = Number.parseInt(process.env.MARKET_PERF_RUNS ?? '5', 10)

if (!Number.isInteger(runCount) || runCount < 1 || runCount > 20) {
	throw new Error('MARKET_PERF_RUNS must be an integer from 1 through 20')
}

const profiles = [
	{ name: 'desktop', viewport: { width: 1440, height: 900 } },
	{ name: 'mobile', viewport: { width: 390, height: 844 } }
]



async function measureRun(browser, profile, index) {
	const context = await browser.newContext({ viewport: profile.viewport })
	const page = await context.newPage()
	await installVitals(page, '__marketPerformance')

	const cdp = await context.newCDPSession(page)
	await cdp.send('Network.enable')
	let documentRequestId = null
	let encodedDocumentBytes = 0
	cdp.on('Network.responseReceived', event => {
		if (event.type === 'Document') documentRequestId = event.requestId
	})
	cdp.on('Network.loadingFinished', event => {
		if (event.requestId === documentRequestId)
			encodedDocumentBytes = event.encodedDataLength
	})

	let marketRequestCount = 0
	let playerStatsPrefetchCount = 0
	page.on('request', request => {
		const url = new URL(request.url())
		if (url.pathname.startsWith('/api/market/')) marketRequestCount += 1
		if (
			url.pathname.includes('/explore/player-stats') &&
			request.method() === 'GET'
		) {
			playerStatsPrefetchCount += 1
		}
	})

	const runUrl = new URL(targetUrl)
	runUrl.searchParams.set(
		'_marketPerf',
		`${profile.name}-${index}-${Date.now()}`
	)
	runUrl.searchParams.set('_perfSource', 'synthetic')
	let response
	const navigation = await measureNavigation(browser, profile, runUrl.toString(), {
		page,
		onResponse: value => { response = value }
	})
	await page.waitForTimeout(500)
	const responseBody = response ? await response.body() : Buffer.alloc(0)
	const rawDocumentBytes = responseBody.byteLength
	const documentBytes =
		response?.headers()['content-encoding'] != null
			? encodedDocumentBytes || responseBody.byteLength
			: brotliCompressSync(responseBody).byteLength
	const cold = await page.evaluate(() => {
		const navigation = performance.getEntriesByType('navigation')[0]
		return {
			lcpMs: window.__marketPerformance?.lcp ?? null,
			cls: window.__marketPerformance?.cls ?? null,
			phase: 'interaction',
			inpMs: window.__marketPerformance?.inp ?? null,
			fcpMs: window.__marketPerformance?.fcp ?? null,
			observationInterval: { startMs: 0, endMs: performance.now() },
			observedLongTaskBlockingMs: window.__marketPerformance?.observedLongTaskBlockingMs ?? null,
			ttfbMs: navigation?.responseStart ?? null,
			htmlResponseMs: navigation?.responseEnd ?? null
		}
	})

	const searchInput = page.locator('#market-player-search')
	const lookupToggle = page.locator('[data-testid="market-open-player-search"]')
	if (await lookupToggle.count()) {
		await lookupToggle.first().click()
		await page.waitForTimeout(50)
	}
	if (!(await searchInput.count())) {
		throw new Error('Market player lookup did not open for measurement')
	}
	let searchRequestCount = 0
	let cachedSearchRequestCount = 0
	const beforeSearch = marketRequestCount
	await searchInput.fill('sal')
	await page
		.locator('#market-player-results')
		.waitFor({ state: 'visible', timeout: 3_000 })
	searchRequestCount = marketRequestCount - beforeSearch
	await searchInput.fill('')
	await page
		.locator('#market-player-results')
		.waitFor({ state: 'hidden', timeout: 1_000 })
	const beforeCachedSearch = marketRequestCount
	await searchInput.fill('sal')
	await page
		.locator('#market-player-results')
		.waitFor({ state: 'visible', timeout: 1_000 })
	cachedSearchRequestCount =
		marketRequestCount - beforeCachedSearch

	let historyRequestCount = 0
	const firstHistoryButton = page
		.locator('#market-player-results button')
		.first()
	if (await firstHistoryButton.count()) {
		const beforeHistory = marketRequestCount
		await firstHistoryButton.click()
		await page.waitForTimeout(700)
		historyRequestCount = marketRequestCount - beforeHistory
	}

	let availabilityRequestCount = 0
	const availabilityDisclosure = page.locator(
		'[data-testid="market-availability-disclosure"]'
	)
	if (await availabilityDisclosure.count()) {
		const beforeAvailability = marketRequestCount
		await availabilityDisclosure.locator('summary').click()
		await page.waitForTimeout(700)
		availabilityRequestCount = marketRequestCount - beforeAvailability
	}

	await finishLongTaskObservation(page)
	const final = await page.evaluate(() => ({
		observedSessionCls: window.__marketPerformance?.cls ?? null,
		phase: 'interaction',
		inpMs: window.__marketPerformance?.inp ?? null,
		fcpMs: window.__marketPerformance?.fcp ?? null,
		observationInterval: { startMs: 0, endMs: performance.now() },
		observedLongTaskBlockingMs: window.__marketPerformance?.observedLongTaskBlockingMs ?? null,
		horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth
	}))
	await context.close()
	return {
		navigation,
		status: response?.status() ?? 0,
		...cold,
		...final,
		cls: cold.cls,
		rawDocumentBytes,
		documentBytes,
		marketRequestCount,
		playerStatsPrefetchCount,
		searchRequestCount,
		cachedSearchRequestCount,
		historyRequestCount,
		availabilityRequestCount
	}
}

const browser = await chromium.launch({ headless: true })
const raw = {}
try {
	for (const profile of profiles) {
		raw[profile.name] = []
		for (let index = 0; index < runCount; index += 1) {
			raw[profile.name].push(await measureRun(browser, profile, index))
		}
	}
} finally {
	await browser.close()
}

const allRuns = Object.values(raw).flat()
const measurements = Object.fromEntries(
	Object.entries(raw).map(([profile, runs]) => [
		profile,
		{
			runs: runs.length,
			status200: runs.every(run => run.status === 200),
			lcpMs: distribution(runs.map(run => run.navigation), 'lcpMs'),
			observedLongTaskBlockingMs: distribution(runs.map(run => run.navigation), 'observedLongTaskBlockingMs'),
			cls: distribution(runs.map(run => run.navigation), 'cls'),
			observedSessionCls: distribution(runs, 'observedSessionCls'),
			ttfbMs: distribution(runs.map(run => run.navigation), 'ttfbMs'),
			htmlResponseMs: distribution(runs.map(run => run.navigation), 'htmlResponseMs'),
			rawDocumentBytes: distribution(runs, 'rawDocumentBytes'),
			documentBytes: distribution(runs, 'documentBytes'),
			marketRequestCounts: runs.map(run => run.marketRequestCount),
			searchRequestCounts: runs.map(run => run.searchRequestCount),
			cachedSearchRequestCounts: runs.map(run => run.cachedSearchRequestCount),
			historyRequestCounts: runs.map(run => run.historyRequestCount),
			availabilityRequestCounts: runs.map(run => run.availabilityRequestCount),
			playerStatsPrefetchCounts: runs.map(run => run.playerStatsPrefetchCount),
			horizontalOverflow: runs.some(run => run.horizontalOverflow)
		}
	])
)

console.log(
	JSON.stringify(
		{
			url: new URL(targetUrl).origin + new URL(targetUrl).pathname,
			...performanceMetadata(),
			measurements,
			raw,
			acceptance: {
				navigationComplete: allRuns.every(run => navigationComplete(run.navigation)),
				mobileLcp:
					atMost(measurements.mobile.lcpMs.p50, 2500) &&
					atMost(measurements.mobile.lcpMs.max, 3000),
				mobileObservedBlocking: atMost(measurements.mobile.observedLongTaskBlockingMs.max, 100),
				cls: allRuns.every(run => atMost(run.navigation.cls, 0.02)),
				htmlResponse:
					atMost(percentile(
						allRuns.map(run => run.htmlResponseMs),
						95
					), 2000),
				documentBytes: allRuns.every(run => atMost(run.documentBytes, 135 * 1024)),
				rawDocumentBytes: allRuns.every(
					run => atMost(run.rawDocumentBytes, 135 * 1024)
				),
				initialRequests: allRuns.every(run => atMost(run.marketRequestCount, 30)),
				noPlayerStatsPrefetch: allRuns.every(
					run => run.playerStatsPrefetchCount === 0
				),
				cachedSearch: allRuns.every(run => run.cachedSearchRequestCount === 0),
				layout: allRuns.every(run => !run.horizontalOverflow)
			},
			note: 'rawDocumentBytes is the uncompressed response body. documentBytes is encoded transfer size (Brotli-equivalent for an uncompressed local response). The rawDocumentBytes gate is the strict HTML budget; compare both with the pre-change baseline.'
		},
		null,
		2
	)
)
