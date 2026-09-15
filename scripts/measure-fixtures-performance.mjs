import { atMost, finishLongTaskObservation, navigationComplete, installVitals, measureNavigation, performanceMetadata, percentile, distribution } from './performance-metrics.mjs'
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



function summarize(runs) {
	return {
		runs: runs.length,
		status200: runs.every(run => run.status === 200),
		lcpMs: distribution(runs.map(run => run.navigation), 'lcpMs'),
		observedLongTaskBlockingMs: distribution(runs, 'observedLongTaskBlockingMs'),
		cls: distribution(runs.map(run => run.navigation), 'cls'),
		ttfbMs: distribution(runs.map(run => run.navigation), 'ttfbMs'),
		loadMs: distribution(runs, 'loadMs'),
		htmlResponseMs: distribution(runs.map(run => run.navigation), 'htmlResponseMs'),
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
			await installVitals(page, '__fixturesPerformance')

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
			runUrl.searchParams.set('_perfSource', 'synthetic')
			let response
			const navigation = await measureNavigation(browser, profile, runUrl.toString(), {
				page,
				onResponse: value => { response = value }
			})
			await page.waitForTimeout(500)
			const responseBody = response ? await response.body() : Buffer.alloc(0)
			const documentBytes =
				response?.headers()['content-encoding'] != null
					? encodedDocumentBytes || responseBody.byteLength
					: brotliCompressSync(responseBody).byteLength
			const cold = await page.evaluate(() => {
				const navigation = performance.getEntriesByType('navigation')[0]
				return {
					lcpMs: window.__fixturesPerformance?.lcp ?? null,
					cls: window.__fixturesPerformance?.cls ?? null,
					phase: 'interaction',
					inpMs: window.__fixturesPerformance?.inp ?? null,
					fcpMs: window.__fixturesPerformance?.fcp ?? null,
					observationInterval: { startMs: 0, endMs: performance.now() },
					observedLongTaskBlockingMs: window.__fixturesPerformance?.observedLongTaskBlockingMs ?? null,
					loadMs: navigation?.loadEventEnd ?? null,
					htmlResponseMs: navigation?.responseEnd ?? null,
					ttfbMs: navigation?.responseStart ?? null
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

			await finishLongTaskObservation(page)
			const final = await page.evaluate(() => ({
				cls: window.__fixturesPerformance?.cls ?? null,
				phase: 'interaction',
				inpMs: window.__fixturesPerformance?.inp ?? null,
				fcpMs: window.__fixturesPerformance?.fcp ?? null,
				observationInterval: { startMs: 0, endMs: performance.now() },
				observedLongTaskBlockingMs: window.__fixturesPerformance?.observedLongTaskBlockingMs ?? null,
				horizontalOverflow:
					document.documentElement.scrollWidth > window.innerWidth
			}))
			runs.push({
				navigation,
				status: response?.status() ?? 0,
				...cold,
				cls: final.cls,
				observedLongTaskBlockingMs: final.observedLongTaskBlockingMs,
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
			...performanceMetadata(),
			measurements,
			raw: rawMeasurements,
			acceptance: {
				navigationComplete: allRuns.every(run => navigationComplete(run.navigation)),
				mobileLcp:
					atMost(mobile.lcpMs.p50, 2_500) && atMost(mobile.lcpMs.max, 3_000),
				mobileObservedBlocking: atMost(mobile.observedLongTaskBlockingMs.max, 100),
				mobileCls: atMost(mobile.cls.max, 0.02),
				documentTransferBytes: allRuns.every(
					run => atMost(run.documentBytes, 51 * 1024)
				),
				htmlResponse:
					atMost(percentile(allRuns.map(run => run.htmlResponseMs), 95), 2_000),
				firstWindow:
					allRuns.every(run => run.firstWindowRequestCount === 1) &&
					atMost(percentile(allRuns.map(run => run.firstWindowMs), 50), 1_000) &&
					atMost(percentile(allRuns.map(run => run.firstWindowMs), 95), 1_500),
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
