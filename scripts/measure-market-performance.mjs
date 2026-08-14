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

function percentile(values, percentileValue) {
	const ordered = [...values].sort((left, right) => left - right)
	const index = Math.min(
		ordered.length - 1,
		Math.ceil((percentileValue / 100) * ordered.length) - 1
	)
	return Number(ordered[Math.max(0, index)].toFixed(2))
}

function distribution(runs, field) {
	const values = runs.map(run => run[field])
	return {
		p50: percentile(values, 50),
		p95: percentile(values, 95),
		max: Number(Math.max(...values).toFixed(2))
	}
}

async function measureRun(browser, profile, index) {
	const context = await browser.newContext({ viewport: profile.viewport })
	const page = await context.newPage()
	await page.addInitScript(() => {
		window.__marketPerformance = { cls: 0, lcp: 0, tbt: 0 }
		new PerformanceObserver(list => {
			for (const entry of list.getEntries())
				window.__marketPerformance.lcp = entry.startTime
		}).observe({ type: 'largest-contentful-paint', buffered: true })
		new PerformanceObserver(list => {
			for (const entry of list.getEntries()) {
				if (!entry.hadRecentInput) window.__marketPerformance.cls += entry.value
			}
		}).observe({ type: 'layout-shift', buffered: true })
		new PerformanceObserver(list => {
			for (const entry of list.getEntries()) {
				window.__marketPerformance.tbt += Math.max(0, entry.duration - 50)
			}
		}).observe({ type: 'longtask', buffered: true })
	})

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
	const response = await page.goto(runUrl.toString(), { waitUntil: 'load' })
	await page.waitForTimeout(500)
	const responseBody = response ? await response.body() : Buffer.alloc(0)
	const documentBytes =
		response?.headers()['content-encoding'] != null
			? encodedDocumentBytes || responseBody.byteLength
			: brotliCompressSync(responseBody).byteLength
	const cold = await page.evaluate(() => {
		const navigation = performance.getEntriesByType('navigation')[0]
		return {
			lcpMs: window.__marketPerformance?.lcp ?? 0,
			cls: window.__marketPerformance?.cls ?? 0,
			tbtMs: window.__marketPerformance?.tbt ?? 0,
			ttfbMs: navigation?.responseStart ?? 0,
			htmlResponseMs: navigation?.responseEnd ?? 0
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
	await searchInput.fill('sal')
	await page
		.locator('#market-player-results')
		.waitFor({ state: 'visible', timeout: 1_000 })
	cachedSearchRequestCount =
		marketRequestCount - beforeSearch - searchRequestCount

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

	const final = await page.evaluate(() => ({
		cls: window.__marketPerformance?.cls ?? 0,
		tbtMs: window.__marketPerformance?.tbt ?? 0,
		horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth
	}))
	await context.close()
	return {
		status: response?.status() ?? 0,
		...cold,
		...final,
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
			lcpMs: distribution(runs, 'lcpMs'),
			tbtMs: distribution(runs, 'tbtMs'),
			cls: distribution(runs, 'cls'),
			ttfbMs: distribution(runs, 'ttfbMs'),
			htmlResponseMs: distribution(runs, 'htmlResponseMs'),
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
			measuredAt: new Date().toISOString(),
			measurements,
			acceptance: {
				mobileLcp:
					measurements.mobile.lcpMs.p50 <= 2500 &&
					measurements.mobile.lcpMs.p95 <= 3000,
				mobileTbt: measurements.mobile.tbtMs.max <= 100,
				cls: allRuns.every(run => run.cls <= 0.02),
				htmlResponse:
					percentile(
						allRuns.map(run => run.htmlResponseMs),
						95
					) <= 2000,
				documentBytes: allRuns.every(run => run.documentBytes <= 135 * 1024),
				initialRequests: allRuns.every(run => run.marketRequestCount <= 30),
				noPlayerStatsPrefetch: allRuns.every(
					run => run.playerStatsPrefetchCount === 0
				),
				cachedSearch: allRuns.every(run => run.cachedSearchRequestCount === 0),
				layout: allRuns.every(run => !run.horizontalOverflow)
			},
			note: 'Run against a deployed or production-like server. This script reports encoded HTML transfer (Brotli-equivalent for an uncompressed local response); compare its JSON output with the pre-change baseline.'
		},
		null,
		2
	)
)
