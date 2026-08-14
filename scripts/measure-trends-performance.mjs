import { chromium } from '@playwright/test'
import { brotliCompressSync } from 'node:zlib'

const targetUrl = process.env.TRENDS_PERF_URL ?? 'https://letletme.top/zh-CN/explore/selections'
const runCount = Number.parseInt(process.env.TRENDS_PERF_RUNS ?? '5', 10)
if (!Number.isInteger(runCount) || runCount < 1 || runCount > 20) throw new Error('TRENDS_PERF_RUNS must be an integer from 1 through 20')

const profiles = [
	{ name: 'desktop', viewport: { width: 1440, height: 900 } },
	{ name: 'mobile', viewport: { width: 390, height: 844 } }
]
const percentile = (values, p) => {
	const ordered = [...values].sort((a, b) => a - b)
	return Number(ordered[Math.min(ordered.length - 1, Math.max(0, Math.ceil(p / 100 * ordered.length) - 1))].toFixed(2))
}
const distribution = (runs, key) => ({ p50: percentile(runs.map(run => run[key]), 50), p95: percentile(runs.map(run => run[key]), 95), max: Number(Math.max(...runs.map(run => run[key])).toFixed(2)) })

async function measure(browser, profile, index) {
	const context = await browser.newContext({ viewport: profile.viewport })
	const page = await context.newPage()
	await page.addInitScript(() => {
		window.__trendsPerf = { lcp: 0, cls: 0, tbt: 0 }
		new PerformanceObserver(list => list.getEntries().forEach(entry => { window.__trendsPerf.lcp = entry.startTime })).observe({ type: 'largest-contentful-paint', buffered: true })
		new PerformanceObserver(list => list.getEntries().forEach(entry => { if (!entry.hadRecentInput) window.__trendsPerf.cls += entry.value })).observe({ type: 'layout-shift', buffered: true })
		new PerformanceObserver(list => list.getEntries().forEach(entry => { window.__trendsPerf.tbt += Math.max(0, entry.duration - 50) })).observe({ type: 'longtask', buffered: true })
	})
	const cdp = await context.newCDPSession(page)
	await cdp.send('Network.enable')
	let documentRequestId = null
	let encodedDocumentBytes = 0
	cdp.on('Network.responseReceived', event => { if (event.type === 'Document') documentRequestId = event.requestId })
	cdp.on('Network.loadingFinished', event => { if (event.requestId === documentRequestId) encodedDocumentBytes = event.encodedDataLength })
	let deskRequests = 0
	page.on('request', request => { if (new URL(request.url()).pathname.endsWith('/api/trends/public-desk')) deskRequests += 1 })
	const url = new URL(targetUrl)
	url.searchParams.set('_trendsPerf', `${profile.name}-${index}-${Date.now()}`)
	const response = await page.goto(url.toString(), { waitUntil: 'load' })
	await page.waitForTimeout(500)
	const firstSelect = page.locator('select').nth(1)
	const eventSelect = page.locator('select').nth(2)
	const before = deskRequests
	let switchMs = null
	let initialEvent = null
	if (await eventSelect.count()) {
		initialEvent = await eventSelect.inputValue()
		const targetEvent = initialEvent === '1' ? '2' : '1'
		const start = performance.now()
		const responsePromise = page.waitForResponse(
			response => new URL(response.url()).pathname.endsWith('/api/trends/public-desk'),
			{ timeout: 3000 },
		).catch(() => null)
		await eventSelect.selectOption(targetEvent)
		if (await responsePromise) await page.waitForTimeout(25)
		switchMs = performance.now() - start
	}
	const beforeCached = deskRequests
	if (initialEvent && await eventSelect.count()) {
		await eventSelect.selectOption(initialEvent)
		await page.waitForTimeout(100)
	} else if (await firstSelect.count() && await firstSelect.inputValue()) {
		await firstSelect.selectOption({ index: 0 })
		await page.waitForTimeout(100)
	}
	const values = await page.evaluate(() => {
		const nav = performance.getEntriesByType('navigation')[0]
		return { lcpMs: window.__trendsPerf?.lcp ?? 0, cls: window.__trendsPerf?.cls ?? 0, tbtMs: window.__trendsPerf?.tbt ?? 0, ttfbMs: nav?.responseStart ?? 0, htmlResponseMs: nav?.responseEnd ?? 0, horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth }
	})
	const body = response ? await response.body() : Buffer.alloc(0)
	const documentBytes = response?.headers()['content-encoding'] ? encodedDocumentBytes || body.byteLength : brotliCompressSync(body).byteLength
	await context.close()
	return { status: response?.status() ?? 0, ...values, documentBytes, switchMs: switchMs ?? Number.POSITIVE_INFINITY, deskRequestCount: deskRequests, firstSwitchRequests: deskRequests - before, cachedSwitchRequests: deskRequests - beforeCached }
}

const browser = await chromium.launch({ headless: true })
const raw = {}
try {
	for (const profile of profiles) {
		raw[profile.name] = []
		for (let index = 0; index < runCount; index += 1) raw[profile.name].push(await measure(browser, profile, index))
	}
} finally { await browser.close() }
const measurements = Object.fromEntries(Object.entries(raw).map(([name, runs]) => [name, { runs: runs.length, status200: runs.every(run => run.status === 200), lcpMs: distribution(runs, 'lcpMs'), tbtMs: distribution(runs, 'tbtMs'), cls: distribution(runs, 'cls'), htmlResponseMs: distribution(runs, 'htmlResponseMs'), documentBytes: distribution(runs, 'documentBytes'), switchMs: distribution(runs, 'switchMs'), firstSwitchRequests: runs.map(run => run.firstSwitchRequests), cachedSwitchRequests: runs.map(run => run.cachedSwitchRequests), horizontalOverflow: runs.some(run => run.horizontalOverflow) }]))
console.log(JSON.stringify({ url: new URL(targetUrl).origin + new URL(targetUrl).pathname, measuredAt: new Date().toISOString(), measurements, acceptance: { mobileLcp: measurements.mobile.lcpMs.p50 <= 2500 && measurements.mobile.lcpMs.p95 <= 3000, mobileTbt: measurements.mobile.tbtMs.p95 <= 100, cls: Object.values(measurements).every(measurement => measurement.cls.p95 <= 0.02), cachedSwitch: Object.values(measurements).every(measurement => measurement.cachedSwitchRequests.every(count => count === 0)) } }, null, 2))
