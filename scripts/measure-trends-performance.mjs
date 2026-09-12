import { atMost, navigationComplete, installVitals, measureNavigation, performanceMetadata, percentile, distribution } from './performance-metrics.mjs'
import { chromium } from '@playwright/test'
import { brotliCompressSync } from 'node:zlib'

const targetUrl =
	process.env.TRENDS_PERF_URL ?? 'https://letletme.top/zh-CN/explore/selections'
const runCount = Number.parseInt(process.env.TRENDS_PERF_RUNS ?? '5', 10)
if (!Number.isInteger(runCount) || runCount < 1 || runCount > 20)
	throw new Error('TRENDS_PERF_RUNS must be an integer from 1 through 20')

const profiles = [
	{ name: 'desktop', viewport: { width: 1440, height: 900 } },
	{ name: 'mobile', viewport: { width: 390, height: 844 } }
]

async function measure(browser, profile, index) {
	const context = await browser.newContext({ viewport: profile.viewport })
	const page = await context.newPage()
	await installVitals(page, '__trendsPerf')
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
	let deskRequests = 0
	page.on('request', request => {
		if (new URL(request.url()).pathname.endsWith('/api/trends/public-desk'))
			deskRequests += 1
	})
	const url = new URL(targetUrl)
	url.searchParams.set('_trendsPerf', `${profile.name}-${index}-${Date.now()}`)
	url.searchParams.set('_perfSource', 'synthetic')
	let response
	const navigation = await measureNavigation(browser, profile, url.toString(), {
		page,
		onResponse: value => { response = value }
	})
	await page.waitForTimeout(500)
	const firstSelect = page.locator('select').nth(1)
	const eventSelect = page.locator('select').nth(2)
	const deskReady = (await page.locator('h2').count()) > 0
	const before = deskRequests
	let switchMs = null
	let initialEvent = null
	if (deskReady && (await eventSelect.count())) {
		initialEvent = await eventSelect.inputValue()
		const targetEvent = initialEvent === '1' ? '2' : '1'
		const start = performance.now()
		const responsePromise = page
			.waitForResponse(
				response =>
					new URL(response.url()).pathname.endsWith('/api/trends/public-desk'),
				{ timeout: 3000 }
			)
			.catch(() => null)
		await eventSelect.selectOption(targetEvent)
		if (await responsePromise) await page.waitForTimeout(25)
		switchMs = performance.now() - start
	}
	const beforeCached = deskRequests
	if (initialEvent && (await eventSelect.count())) {
		await eventSelect.selectOption(initialEvent)
		await page.waitForTimeout(100)
	} else if ((await firstSelect.count()) && (await firstSelect.inputValue())) {
		await firstSelect.selectOption({ index: 0 })
		await page.waitForTimeout(100)
	}
	const values = await page.evaluate(() => {
		const nav = performance.getEntriesByType('navigation')[0]
		return {
			lcpMs: window.__trendsPerf?.lcp ?? null,
			cls: window.__trendsPerf?.cls ?? null,
			phase: 'interaction',
			inpMs: window.__trendsPerf?.inp ?? null,
			fcpMs: window.__trendsPerf?.fcp ?? null,
			observationInterval: { startMs: 0, endMs: performance.now() },
			observedLongTaskBlockingMs: window.__trendsPerf?.observedLongTaskBlockingMs ?? null,
			ttfbMs: nav?.responseStart ?? null,
			htmlResponseMs: nav?.responseEnd ?? null,
			horizontalOverflow:
				document.documentElement.scrollWidth > window.innerWidth
		}
	})
	const body = response ? await response.body() : Buffer.alloc(0)
	const documentBytes = response?.headers()['content-encoding']
		? encodedDocumentBytes || body.byteLength
		: brotliCompressSync(body).byteLength
	await context.close()
	return {
		navigation,
		status: response?.status() ?? 0,
		...values,
		documentBytes,
		switchMs: switchMs ?? null,
		deskRequestCount: deskRequests,
		firstSwitchRequests: deskRequests - before,
		cachedSwitchRequests: deskRequests - beforeCached
	}
}

const browser = await chromium.launch({ headless: true })
const raw = {}
try {
	for (const profile of profiles) {
		raw[profile.name] = []
		for (let index = 0; index < runCount; index += 1)
			raw[profile.name].push(await measure(browser, profile, index))
	}
} finally {
	await browser.close()
}
const measurements = Object.fromEntries(
	Object.entries(raw).map(([name, runs]) => [
		name,
		{
			runs: runs.length,
			status200: runs.every(run => run.status === 200),
			lcpMs: distribution(runs.map(run => run.navigation), 'lcpMs'),
			observedLongTaskBlockingMs: distribution(runs.map(run => run.navigation), 'observedLongTaskBlockingMs'),
			cls: distribution(runs.map(run => run.navigation), 'cls'),
			htmlResponseMs: distribution(runs.map(run => run.navigation), 'htmlResponseMs'),
			documentBytes: distribution(runs, 'documentBytes'),
			switchMs: distribution(runs, 'switchMs'),
			firstSwitchRequests: runs.map(run => run.firstSwitchRequests),
			cachedSwitchRequests: runs.map(run => run.cachedSwitchRequests),
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
				navigationComplete: Object.values(raw).flat().every(run => navigationComplete(run.navigation)),
				mobileLcp:
					atMost(measurements.mobile.lcpMs.p50, 2500) &&
					atMost(measurements.mobile.lcpMs.max, 3000),
				mobileObservedBlocking: atMost(measurements.mobile.observedLongTaskBlockingMs.max, 100),
				cls: Object.values(measurements).every(
					measurement => atMost(measurement.cls.max, 0.02)
				),
				cachedSwitch: Object.values(measurements).every(measurement =>
					measurement.cachedSwitchRequests.every(count => count === 0)
				)
			}
		},
		null,
		2
	)
)
