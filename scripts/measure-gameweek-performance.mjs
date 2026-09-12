import { atMost, navigationComplete, installVitals, measureNavigation, performanceMetadata, percentile, distribution } from './performance-metrics.mjs'
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



function summarize(runs) {
	return {
		runs: runs.length,
		status200: runs.every(run => run.status === 200),
		lcpMs: distribution(runs.map(run => run.navigation), 'lcpMs'),
		observedLongTaskBlockingMs: distribution(runs.map(run => run.navigation), 'observedLongTaskBlockingMs'),
		cls: distribution(runs.map(run => run.navigation), 'cls'),
		ttfbMs: distribution(runs.map(run => run.navigation), 'ttfbMs'),
		htmlResponseMs: distribution(runs.map(run => run.navigation), 'htmlResponseMs'),
		documentBytes: distribution(runs, 'documentBytes'),
		initialContentReadyMs: distribution(runs, 'initialContentReadyMs'),
		deskSwitchReadyMs: distribution(runs, 'deskSwitchReadyMs'),
		firstDeskRequestCounts: runs.map(run => run.firstDeskRequestCount),
		cachedDeskRequestCounts: runs.map(run => run.cachedDeskRequestCount),
		skippedDeskProbeStatuses: runs.map(run => run.skippedDeskProbeStatus),
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
	await installVitals(page, '__gameweekPerformance')

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
	runUrl.searchParams.set('_perfSource', 'synthetic')
	let response
	const navigation = await measureNavigation(browser, profile, runUrl.toString(), {
		page,
		onResponse: value => { response = value }
	})
	readyMetric = await page.evaluate(
		name => window.__performanceMetrics?.ready?.[name] ?? null,
		'GAMEWEEK_CONTENT_READY'
	)
	await waitForReady(page)
	const telemetryDeadline = Date.now() + 5_000
	while (readyMetric == null && Date.now() < telemetryDeadline) {
		readyMetric = await page.evaluate(
			name => window.__performanceMetrics?.ready?.[name] ?? null,
			'GAMEWEEK_CONTENT_READY'
		)
		await page.waitForTimeout(50)
	}
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
	let skippedDeskProbeStatus = null
	if (canSelect) {
		const originalHeading = await page
			.locator('#gw-overview-title')
			.textContent()
		const input = page.locator('#gameweek-jump-input')
		const startedAt = performance.now()
		await input.fill(String(targetEvent))
		await input.press('Enter')
		await page.waitForTimeout(25)
		const isBusy = (await input.getAttribute('aria-busy')) === 'true'
		keptCommittedDuringLoad =
			!isBusy ||
			(await page.locator('#gw-overview-title').textContent()) ===
				originalHeading
		await waitForGameweekHeading(page, targetEvent)
		deskSwitchReadyMs = performance.now() - startedAt
	} else {
		interactionSkipped = true
		skippedDeskProbeStatus = await page.evaluate(async eventId => {
			const response = await fetch(`/api/gameweek/desk?eventId=${eventId}`, {
				headers: { Accept: 'application/json' }
			})
			return response.status
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
			lcpMs: window.__gameweekPerformance?.lcp ?? null,
			cls: window.__gameweekPerformance?.cls ?? null,
			phase: 'interaction',
			inpMs: window.__gameweekPerformance?.inp ?? null,
			fcpMs: window.__gameweekPerformance?.fcp ?? null,
			observationInterval: { startMs: 0, endMs: performance.now() },
			observedLongTaskBlockingMs: window.__gameweekPerformance?.observedLongTaskBlockingMs ?? null,
			ttfbMs: navigation?.responseStart ?? null,
			htmlResponseMs: navigation?.responseEnd ?? null,
			horizontalOverflow:
				document.documentElement.scrollWidth > window.innerWidth
		}
	})
	await context.close()
	return {
		navigation,
		status: response?.status() ?? 0,
		...values,
		documentBytes,
		initialContentReadyMs: initialReadyMetric ?? null,
		deskSwitchReadyMs,
		firstDeskRequestCount,
		cachedDeskRequestCount,
		interactionSkipped,
		skippedDeskProbeStatus,
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
			...performanceMetadata(),
			targetEvent,
			measurements,
			raw,
			acceptance: {
				navigationComplete: allRuns.every(run => navigationComplete(run.navigation)),
				mobileLcp: atMost(mobile.lcpMs.p50, 2_500) && atMost(mobile.lcpMs.max, 3_000),
				mobileObservedBlocking: atMost(mobile.observedLongTaskBlockingMs.max, 100),
				cls: allRuns.every(run => atMost(run.navigation.cls, 0.02)),
				htmlResponse:
					atMost(percentile(
						allRuns.map(run => run.htmlResponseMs),
						95
					), 2_000),
				documentTransferBytes: allRuns.every(
					run => atMost(run.documentBytes, 51 * 1024)
				),
				firstDeskReady:
					selectableRuns.length === 0 ||
					selectableRuns.every(
						run =>
							typeof run.deskSwitchReadyMs === 'number' &&
							atMost(run.deskSwitchReadyMs, 1_500)
					),
				firstDeskRequest:
					selectableRuns.length === 0 ||
					selectableRuns.every(run => run.firstDeskRequestCount === 1),
				skippedDeskProbe: allRuns
					.filter(run => run.interactionSkipped)
					.every(run => run.skippedDeskProbeStatus === 200),
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
