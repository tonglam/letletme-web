import { brotliCompressSync } from 'node:zlib'
import { chromium } from '@playwright/test'

const targetUrl =
	process.env.FIXTURES_PERF_URL ??
	'https://letletme.top/explore/fixtures'
const runCount = Number.parseInt(process.env.FIXTURES_PERF_RUNS ?? '5', 10)

if (!Number.isInteger(runCount) || runCount < 1 || runCount > 20) {
	throw new Error('FIXTURES_PERF_RUNS must be an integer from 1 through 20')
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

function summarize(runs) {
	return {
		runs: runs.length,
		status200: runs.every(run => run.status === 200),
		lcpMs: distribution(runs, 'lcpMs'),
		tbtMs: distribution(runs, 'tbtMs'),
		cls: distribution(runs, 'cls'),
		ttfbMs: distribution(runs, 'ttfbMs'),
		loadMs: distribution(runs, 'loadMs'),
		htmlResponseMs: distribution(runs, 'htmlResponseMs'),
		documentBytes: distribution(runs, 'documentBytes'),
		firstWindowMs: distribution(runs, 'firstWindowMs'),
		firstWindowRequestCounts: runs.map(run => run.firstWindowRequestCount),
		cachedWindowRequestCounts: runs.map(run => run.cachedWindowRequestCount),
		keptCommittedDuringLoad: runs.every(run => run.keptCommittedDuringLoad),
		horizontalOverflow: runs.some(run => run.horizontalOverflow)
	}
}

async function waitForPressed(page, labelPattern) {
	await page.waitForFunction(
		pattern =>
			Array.from(document.querySelectorAll('button')).some(button => {
				const label = button.textContent?.trim() ?? ''
				return (
					new RegExp(pattern).test(label) &&
					button.getAttribute('aria-pressed') === 'true'
				)
			}),
		labelPattern,
		{ timeout: 15_000 }
	)
}

const browser = await chromium.launch({ headless: true })
const rawMeasurements = {}

try {
	for (const profile of profiles) {
		const runs = []
		for (let index = 0; index < runCount; index += 1) {
			const context = await browser.newContext({ viewport: profile.viewport })
			const page = await context.newPage()
			await page.addInitScript(() => {
				window.__fixturesPerformance = { cls: 0, lcp: 0, tbt: 0 }
				new PerformanceObserver(list => {
					for (const entry of list.getEntries()) {
						window.__fixturesPerformance.lcp = entry.startTime
					}
				}).observe({ type: 'largest-contentful-paint', buffered: true })
				new PerformanceObserver(list => {
					for (const entry of list.getEntries()) {
						if (!entry.hadRecentInput) {
							window.__fixturesPerformance.cls += entry.value
						}
					}
				}).observe({ type: 'layout-shift', buffered: true })
				new PerformanceObserver(list => {
					for (const entry of list.getEntries()) {
						window.__fixturesPerformance.tbt += Math.max(0, entry.duration - 50)
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

			let windowRequestCount = 0
			page.on('request', request => {
				const url = new URL(request.url())
				if (
					request.method() === 'GET' &&
					url.pathname === '/api/fixtures/window'
				) {
					windowRequestCount += 1
				}
			})

			const runUrl = new URL(targetUrl)
			runUrl.searchParams.set(
				'_fixturesPerf',
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
					lcpMs: window.__fixturesPerformance?.lcp ?? 0,
					cls: window.__fixturesPerformance?.cls ?? 0,
					tbtMs: window.__fixturesPerformance?.tbt ?? 0,
					loadMs: navigation?.loadEventEnd ?? 0,
					htmlResponseMs: navigation?.responseEnd ?? 0,
					ttfbMs: navigation?.responseStart ?? 0
				}
			})

			const fiveGws = page.getByRole('button', { name: /^(5 GWs|5 轮)$/ })
			const eightGws = page.getByRole('button', { name: /^(8 GWs|8 轮)$/ })
			const beforeFirstWindow = windowRequestCount
			const windowStartedAt = performance.now()
			await eightGws.click()
			const stillLoading =
				(await eightGws.getAttribute('aria-busy')) === 'true'
			const keptCommittedDuringLoad =
				!stillLoading ||
				(await fiveGws.getAttribute('aria-pressed')) === 'true'
			await waitForPressed(page, '^(8 GWs|8 轮)$')
			const firstWindowMs = performance.now() - windowStartedAt
			const firstWindowRequestCount =
				windowRequestCount - beforeFirstWindow

			await fiveGws.click()
			await waitForPressed(page, '^(5 GWs|5 轮)$')
			const beforeCachedWindow = windowRequestCount
			await eightGws.click()
			await waitForPressed(page, '^(8 GWs|8 轮)$')
			await page.waitForTimeout(100)
			const cachedWindowRequestCount =
				windowRequestCount - beforeCachedWindow

			const final = await page.evaluate(() => ({
				cls: window.__fixturesPerformance?.cls ?? 0,
				tbtMs: window.__fixturesPerformance?.tbt ?? 0,
				horizontalOverflow:
					document.documentElement.scrollWidth > window.innerWidth
			}))
			runs.push({
				status: response?.status() ?? 0,
				...cold,
				cls: final.cls,
				tbtMs: final.tbtMs,
				documentBytes,
				firstWindowMs,
				firstWindowRequestCount,
				cachedWindowRequestCount,
				keptCommittedDuringLoad,
				horizontalOverflow: final.horizontalOverflow
			})
			await context.close()
		}
		rawMeasurements[profile.name] = runs
	}
} finally {
	await browser.close()
}

const measurements = Object.fromEntries(
	Object.entries(rawMeasurements).map(([profile, runs]) => [
		profile,
		summarize(runs)
	])
)
const mobile = measurements.mobile
const allRuns = Object.values(rawMeasurements).flat()

console.log(
	JSON.stringify(
		{
			url: new URL(targetUrl).origin + new URL(targetUrl).pathname,
			measuredAt: new Date().toISOString(),
			measurements,
			acceptance: {
				mobileLcp:
					mobile.lcpMs.p50 <= 2_500 && mobile.lcpMs.p95 <= 3_000,
				mobileTbt: mobile.tbtMs.max <= 100,
				mobileCls: mobile.cls.max <= 0.02,
				documentTransferBytes: allRuns.every(
					run => run.documentBytes <= 51 * 1024
				),
				htmlResponse:
					percentile(allRuns.map(run => run.htmlResponseMs), 95) <= 2_000,
				firstWindow:
					allRuns.every(run => run.firstWindowRequestCount === 1) &&
					percentile(allRuns.map(run => run.firstWindowMs), 50) <= 1_000 &&
					percentile(allRuns.map(run => run.firstWindowMs), 95) <= 1_500,
				cachedWindow: allRuns.every(
					run => run.cachedWindowRequestCount === 0
				),
				layout:
					allRuns.every(run => run.keptCommittedDuringLoad) &&
					allRuns.every(run => !run.horizontalOverflow)
			},
			note: 'documentBytes is encoded transfer size (Brotli-equivalent when the local server is uncompressed). Run Lighthouse separately for the desktop score gate.'
		},
		null,
		2
	)
)
