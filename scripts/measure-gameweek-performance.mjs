import { brotliCompressSync } from 'node:zlib'
import { chromium } from '@playwright/test'

const targetUrl =
	process.env.GAMEWEEK_PERF_URL ?? 'https://letletme.top/zh-CN/explore/gameweek'
const runCount = Number.parseInt(process.env.GAMEWEEK_PERF_RUNS ?? '5', 10)
const targetEvent = Number.parseInt(
	process.env.GAMEWEEK_PERF_TARGET_EVENT ?? '8',
	10
)

if (!Number.isInteger(runCount) || runCount < 1 || runCount > 20) {
	throw new Error('GAMEWEEK_PERF_RUNS must be an integer from 1 through 20')
}
if (!Number.isInteger(targetEvent) || targetEvent < 1 || targetEvent > 38) {
	throw new Error(
		'GAMEWEEK_PERF_TARGET_EVENT must be an integer from 1 through 38'
	)
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
	const values = runs
		.map(run => run[field])
		.filter(value => typeof value === 'number' && Number.isFinite(value))
	if (values.length === 0) return null
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
		initialContentReadyMs: distribution(runs, 'initialContentReadyMs'),
		deskSwitchReadyMs: distribution(runs, 'deskSwitchReadyMs'),
		firstDeskRequestCounts: runs.map(run => run.firstDeskRequestCount),
		cachedDeskRequestCounts: runs.map(run => run.cachedDeskRequestCount),
		interactionSkipped: runs.filter(run => run.interactionSkipped).length,
		horizontalOverflow: runs.some(run => run.horizontalOverflow),
		keptCommittedDuringLoad: runs.every(run => run.keptCommittedDuringLoad)
	}
}

async function waitForReady(page) {
	await page.waitForFunction(
		() => document.readyState === 'complete',
		undefined,
		{ timeout: 15_000 }
	)
}

async function waitForGameweekHeading(page, eventId) {
	await page.waitForFunction(
		id => {
			const text =
				document.querySelector('#gw-overview-title')?.textContent ?? ''
			return (
				text.includes(`Gameweek ${id}`) ||
				text.includes(`GW ${id}`) ||
				text.includes(`第 ${id} 轮`)
			)
		},
		eventId,
		{ timeout: 15_000 }
	)
}

async function measureRun(browser, profile, index) {
	const context = await browser.newContext({ viewport: profile.viewport })
	const page = await context.newPage()
	await page.addInitScript(() => {
		window.__gameweekPerformance = { cls: 0, lcp: 0, tbt: 0 }
		new PerformanceObserver(list => {
			for (const entry of list.getEntries())
				window.__gameweekPerformance.lcp = entry.startTime
		}).observe({ type: 'largest-contentful-paint', buffered: true })
		new PerformanceObserver(list => {
			for (const entry of list.getEntries()) {
				if (!entry.hadRecentInput)
					window.__gameweekPerformance.cls += entry.value
			}
		}).observe({ type: 'layout-shift', buffered: true })
		new PerformanceObserver(list => {
			for (const entry of list.getEntries()) {
				window.__gameweekPerformance.tbt += Math.max(0, entry.duration - 50)
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

	let deskRequestCount = 0
	let readyMetric = null
	page.on('request', request => {
		if (new URL(request.url()).pathname === '/api/gameweek/desk')
			deskRequestCount += 1
	})
	await page.route('**/api/vitals', async route => {
		try {
			const metric = route.request().postDataJSON()
			if (metric?.name === 'GAMEWEEK_CONTENT_READY') readyMetric = metric.value
		} catch {
			// Keep the performance run independent from telemetry parsing.
		}
		await route.fulfill({ status: 204, body: '' })
	})

	const runUrl = new URL(targetUrl)
	runUrl.searchParams.set(
		'_gameweekPerf',
		`${profile.name}-${index}-${Date.now()}`
	)
	const response = await page.goto(runUrl.toString(), { waitUntil: 'load' })
	await waitForReady(page)
	const telemetryDeadline = Date.now() + 5_000
	while (readyMetric == null && Date.now() < telemetryDeadline)
		await page.waitForTimeout(50)
	await page.waitForTimeout(250)
	const initialReadyMetric = readyMetric

	const beforeFirst = deskRequestCount
	const maxGameweek = await page
		.locator('#gameweek-jump-input')
		.getAttribute('max')
	const selectedGameweek = await page
		.locator('#gameweek-jump-input')
		.inputValue()
	const canSelect =
		Number(maxGameweek) >= targetEvent &&
		Number(selectedGameweek) !== targetEvent
	let keptCommittedDuringLoad = true
	let interactionSkipped = false
	let deskSwitchReadyMs = null
	if (canSelect) {
		const originalHeading = await page
			.locator('#gw-overview-title')
			.textContent()
		const input = page.locator('#gameweek-jump-input')
		const startedAt = performance.now()
		await input.fill(String(targetEvent))
		await input.press('Enter')
		await page.waitForTimeout(25)
		keptCommittedDuringLoad =
			(await page.locator('#gw-overview-title').textContent()) ===
			originalHeading
		await waitForGameweekHeading(page, targetEvent)
		deskSwitchReadyMs = performance.now() - startedAt
	} else {
		interactionSkipped = true
		await page.evaluate(async eventId => {
			await fetch(`/api/gameweek/desk?eventId=${eventId}`, {
				headers: { Accept: 'application/json' }
			})
		}, targetEvent)
	}
	const firstDeskRequestCount = deskRequestCount - beforeFirst
	let cachedDeskRequestCount = 0
	if (canSelect) {
		const previousEvent = targetEvent > 1 ? targetEvent - 1 : targetEvent + 1
		if (previousEvent >= 1 && previousEvent <= Number(maxGameweek)) {
			const beforeCached = deskRequestCount
			const input = page.locator('#gameweek-jump-input')
			await input.fill(String(previousEvent))
			await input.press('Enter')
			await waitForGameweekHeading(page, previousEvent)
			await input.fill(String(targetEvent))
			await input.press('Enter')
			await waitForGameweekHeading(page, targetEvent)
			cachedDeskRequestCount = Math.max(0, deskRequestCount - beforeCached - 1)
		}
	}

	const responseBody = response ? await response.body() : Buffer.alloc(0)
	const documentBytes =
		response?.headers()['content-encoding'] != null
			? encodedDocumentBytes || responseBody.byteLength
			: brotliCompressSync(responseBody).byteLength
	const values = await page.evaluate(() => {
		const navigation = performance.getEntriesByType('navigation')[0]
		return {
			lcpMs: window.__gameweekPerformance?.lcp ?? 0,
			cls: window.__gameweekPerformance?.cls ?? 0,
			tbtMs: window.__gameweekPerformance?.tbt ?? 0,
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
		initialContentReadyMs: initialReadyMetric ?? 0,
		deskSwitchReadyMs,
		firstDeskRequestCount,
		cachedDeskRequestCount,
		interactionSkipped,
		keptCommittedDuringLoad
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

const measurements = Object.fromEntries(
	Object.entries(raw).map(([profile, runs]) => [profile, summarize(runs)])
)
const allRuns = Object.values(raw).flat()
const selectableRuns = allRuns.filter(run => !run.interactionSkipped)
const mobile = measurements.mobile

console.log(
	JSON.stringify(
		{
			url: new URL(targetUrl).origin + new URL(targetUrl).pathname,
			measuredAt: new Date().toISOString(),
			targetEvent,
			measurements,
			acceptance: {
				mobileLcp: mobile.lcpMs.p50 <= 2_500 && mobile.lcpMs.p95 <= 3_000,
				mobileTbt: mobile.tbtMs.max <= 100,
				cls: allRuns.every(run => run.cls <= 0.02),
				htmlResponse:
					percentile(
						allRuns.map(run => run.htmlResponseMs),
						95
					) <= 2_000,
				documentTransferBytes: allRuns.every(
					run => run.documentBytes <= 51 * 1024
				),
				firstDeskReady:
					selectableRuns.length === 0 ||
					selectableRuns.every(
						run =>
							typeof run.deskSwitchReadyMs === 'number' &&
							run.deskSwitchReadyMs <= 1_500
					),
				firstDeskRequest:
					selectableRuns.length === 0 ||
					selectableRuns.every(run => run.firstDeskRequestCount === 1),
				cachedDesk:
					selectableRuns.length === 0 ||
					selectableRuns.every(run => run.cachedDeskRequestCount === 0),
				layout: allRuns.every(
					run => run.keptCommittedDuringLoad && !run.horizontalOverflow
				)
			},
			note: 'If the live page max gameweek is below GAMEWEEK_PERF_TARGET_EVENT, interaction checks are recorded as skipped and the script probes the desk API directly. Run Lighthouse separately for the score gate.'
		},
		null,
		2
	)
)
