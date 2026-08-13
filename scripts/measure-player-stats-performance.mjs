import { chromium } from '@playwright/test'
import { brotliCompressSync } from 'node:zlib'

const targetUrl =
	process.env.PLAYER_STATS_PERF_URL ??
	'https://letletme.top/zh-CN/explore/player-stats'
const runCount = Number.parseInt(process.env.PLAYER_STATS_PERF_RUNS ?? '5', 10)
const playerIds = (process.env.PLAYER_STATS_PERF_PLAYER_IDS ?? '13,27')
	.split(',')
	.map(value => Number.parseInt(value, 10))

if (!Number.isInteger(runCount) || runCount < 1 || runCount > 20) {
	throw new Error('PLAYER_STATS_PERF_RUNS must be an integer from 1 through 20')
}
if (
	playerIds.length !== 2 ||
	playerIds.some(id => !Number.isInteger(id) || id <= 0) ||
	playerIds[0] === playerIds[1]
) {
	throw new Error(
		'PLAYER_STATS_PERF_PLAYER_IDS must contain two distinct positive integers'
	)
}

const profiles = [
	{ name: 'desktop', viewport: { width: 1440, height: 900 } },
	{ name: 'mobile', viewport: { width: 390, height: 844 } }
]
const scenarios = [
	{ name: 'directory', query: {}, readyMetric: 'PLAYER_DIRECTORY_READY' },
	{
		name: 'detail',
		query: { p1: String(playerIds[0]) },
		readyMetric: 'PLAYER_DETAIL_READY'
	},
	{
		name: 'compare',
		query: { p1: String(playerIds[0]), p2: String(playerIds[1]) },
		readyMetric: 'PLAYER_COMPARE_READY'
	}
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

function summarize(runs) {
	return {
		runs: runs.length,
		status200: runs.every(run => run.status === 200),
		lcpMs: distribution(runs, 'lcpMs'),
		tbtMs: distribution(runs, 'tbtMs'),
		cls: distribution(runs, 'cls'),
		ttfbMs: distribution(runs, 'ttfbMs'),
		htmlResponseMs: distribution(runs, 'htmlResponseMs'),
		documentBytes: distribution(runs, 'documentBytes'),
		readyMs: distribution(runs, 'readyMs'),
		deskBrowserRequestCounts: runs.map(run => run.deskBrowserRequestCount),
		horizontalOverflow: runs.some(run => run.horizontalOverflow)
	}
}

async function measureRun(browser, profile, scenario, index) {
	const context = await browser.newContext({ viewport: profile.viewport })
	const page = await context.newPage()
	await page.addInitScript(() => {
		window.__playerStatsPerformance = { cls: 0, lcp: 0, tbt: 0 }
		new PerformanceObserver(list => {
			for (const entry of list.getEntries()) {
				window.__playerStatsPerformance.lcp = entry.startTime
			}
		}).observe({ type: 'largest-contentful-paint', buffered: true })
		new PerformanceObserver(list => {
			for (const entry of list.getEntries()) {
				if (!entry.hadRecentInput) {
					window.__playerStatsPerformance.cls += entry.value
				}
			}
		}).observe({ type: 'layout-shift', buffered: true })
		new PerformanceObserver(list => {
			for (const entry of list.getEntries()) {
				window.__playerStatsPerformance.tbt += Math.max(0, entry.duration - 50)
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
		if (event.requestId === documentRequestId) {
			encodedDocumentBytes = event.encodedDataLength
		}
	})

	let deskBrowserRequestCount = 0
	let readyMs = null
	page.on('request', request => {
		const url = new URL(request.url())
		if (url.pathname === '/api/player-stats/desk') {
			deskBrowserRequestCount += 1
		}
	})
	await page.route('**/api/vitals', async route => {
		try {
			const metric = route.request().postDataJSON()
			if (metric?.name === scenario.readyMetric) readyMs = metric.value
		} catch {
			// A malformed telemetry payload should not abort the measurement itself.
		}
		await route.fulfill({ status: 204, body: '' })
	})

	const runUrl = new URL(targetUrl)
	for (const [key, value] of Object.entries(scenario.query)) {
		runUrl.searchParams.set(key, value)
	}
	runUrl.searchParams.set(
		'_playerStatsPerf',
		`${profile.name}-${scenario.name}-${index}-${Date.now()}`
	)
	const response = await page.goto(runUrl.toString(), { waitUntil: 'load' })
	await page.waitForFunction(
		metricName =>
			performance.getEntriesByType('navigation').length > 0 &&
			document.readyState === 'complete' &&
			Boolean(metricName),
		scenario.readyMetric,
		{ timeout: 15_000 }
	)
	const telemetryDeadline = Date.now() + 5_000
	while (readyMs == null && Date.now() < telemetryDeadline) {
		await page.waitForTimeout(50)
	}
	await page.waitForTimeout(250)

	const responseBody = response ? await response.body() : Buffer.alloc(0)
	const documentBytes =
		response?.headers()['content-encoding'] != null
			? encodedDocumentBytes || responseBody.byteLength
			: brotliCompressSync(responseBody).byteLength
	const values = await page.evaluate(() => {
		const navigation = performance.getEntriesByType('navigation')[0]
		return {
			lcpMs: window.__playerStatsPerformance?.lcp ?? 0,
			cls: window.__playerStatsPerformance?.cls ?? 0,
			tbtMs: window.__playerStatsPerformance?.tbt ?? 0,
			ttfbMs: navigation?.responseStart ?? 0,
			htmlResponseMs: navigation?.responseEnd ?? 0,
			horizontalOverflow:
				document.documentElement.scrollWidth > window.innerWidth
		}
	})
	await context.close()
	return {
		status: response?.status() ?? 0,
		...values,
		documentBytes,
		readyMs: readyMs ?? Number.POSITIVE_INFINITY,
		deskBrowserRequestCount
	}
}

const browser = await chromium.launch({ headless: true })
const raw = {}
try {
	for (const profile of profiles) {
		raw[profile.name] = {}
		for (const scenario of scenarios) {
			const runs = []
			for (let index = 0; index < runCount; index += 1) {
				runs.push(await measureRun(browser, profile, scenario, index))
			}
			raw[profile.name][scenario.name] = runs
		}
	}
} finally {
	await browser.close()
}

const measurements = Object.fromEntries(
	Object.entries(raw).map(([profile, profileScenarios]) => [
		profile,
		Object.fromEntries(
			Object.entries(profileScenarios).map(([scenario, runs]) => [
				scenario,
				summarize(runs)
			])
		)
	])
)
const allRuns = Object.values(raw).flatMap(profile =>
	Object.values(profile).flat()
)
const mobile = measurements.mobile

console.log(
	JSON.stringify(
		{
			url: new URL(targetUrl).origin + new URL(targetUrl).pathname,
			measuredAt: new Date().toISOString(),
			measurements,
			acceptance: {
				mobileLcp:
					mobile.directory.lcpMs.p50 <= 2_500 &&
					mobile.directory.lcpMs.p95 <= 3_000,
				mobileTbt: raw.mobile.directory.every(run => run.tbtMs <= 100),
				cls: allRuns.every(run => run.cls <= 0.02),
				htmlResponse:
					percentile(
						allRuns.map(run => run.htmlResponseMs),
						95
					) <= 2_000,
				defaultDocument: Object.values(raw).every(profile =>
					profile.directory.every(run => run.documentBytes <= 51 * 1024)
				),
				directoryReady: Object.values(raw).every(
					profile =>
						percentile(
							profile.directory.map(run => run.readyMs),
							95
						) <= 1_000
				),
				detailReady: Object.values(raw).every(
					profile =>
						percentile(
							profile.detail.map(run => run.readyMs),
							95
						) <= 1_500
				),
				compareReady: Object.values(raw).every(
					profile =>
						percentile(
							profile.compare.map(run => run.readyMs),
							95
						) <= 1_500
				),
				serverSeedAvoidsBrowserDeskFetch: Object.values(raw).every(profile =>
					[...profile.detail, ...profile.compare].every(
						run => run.deskBrowserRequestCount === 0
					)
				),
				layout: allRuns.every(run => !run.horizontalOverflow)
			},
			note: 'Cold deep links are revision-pinned in RSC and therefore should not issue a browser desk GET. Client dedupe, cancellation, and zero-network warm-cache behavior are enforced by the player-stats-desk-client unit contract.'
		},
		null,
		2
	)
)
