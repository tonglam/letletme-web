import { atMost, navigationComplete, installVitals, measureNavigation, performanceMetadata, percentile, distribution } from './performance-metrics.mjs'
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
	{ name: 'directory', query: {}, readyMetric: 'PLAYER_DIRECTORY_PAINT' },
	{
		name: 'detail',
		query: { p1: String(playerIds[0]) },
		readyMetric: 'PLAYER_DETAIL_PAINT'
	},
	{
		name: 'compare',
		query: { p1: String(playerIds[0]), p2: String(playerIds[1]) },
		readyMetric: 'PLAYER_COMPARE_PAINT'
	}
]



function distributionNullable(runs, field) {
	return distribution(
		runs.filter(run => run[field] != null),
		field
	)
}

function summarize(runs) {
	return {
		runs: runs.length,
		status200: runs.every(run => run.status === 200),
		lcpMs: distribution(runs.map(run => run.navigation), 'lcpMs'),
		fcpMs: distribution(runs.map(run => run.navigation), 'fcpMs'),
		observedLongTaskBlockingMs: distribution(runs.map(run => run.navigation), 'observedLongTaskBlockingMs'),
		cls: distribution(runs.map(run => run.navigation), 'cls'),
		ttfbMs: distribution(runs.map(run => run.navigation), 'ttfbMs'),
		htmlResponseMs: distribution(runs.map(run => run.navigation), 'htmlResponseMs'),
		documentBytes: distribution(runs, 'documentBytes'),
		readyMs: distribution(runs, 'readyMs'),
		paintMs: distribution(runs, 'paintMs'),
		deskDurationMs: distributionNullable(runs, 'deskDurationMs'),
		chunkBytes: distribution(runs, 'chunkBytes'),
		deskBrowserRequestCounts: runs.map(run => run.deskBrowserRequestCount),
		deskCacheStatuses: runs.flatMap(run => run.deskCacheStatuses),
		serverTiming: runs.flatMap(run => run.serverTiming),
		releaseShas: Array.from(
			new Set(runs.map(run => run.releaseSha).filter(Boolean))
		),
		interactions: runs.flatMap(run => run.interactions ?? []),
		horizontalOverflow: runs.some(run => run.horizontalOverflow)
	}
}

async function waitForEnabled(page, selector, timeoutMs = 8_000) {
	await page.waitForFunction(
		query => {
			const element = document.querySelector(query)
			return element instanceof HTMLButtonElement && !element.disabled
		},
		selector,
		{ timeout: timeoutMs }
	)
}

async function measureClickInteraction(
	page,
	metrics,
	name,
	metricName,
	action
) {
	const metricOffset = metrics.length
	const initialReadySequence = await page.evaluate(
		name => window.__performanceMetrics?.readySequence?.[name] ?? 0,
		metricName
	)
	const resourceOffset = await page.evaluate(
		() => performance.getEntriesByType('resource').length
	)
	const startedAt = performance.now()
	await action()
	const metric = await (async () => {
		const deadline = Date.now() + 8_000
		while (Date.now() < deadline) {
			const nextMetric = metrics
				.slice(metricOffset)
				.find(item => item?.name === metricName)
			if (nextMetric) return nextMetric
			const sharedMetric = await page.evaluate(
				({ name, initialSequence }) => {
					const sequence = window.__performanceMetrics?.readySequence?.[name] ?? 0
					if (sequence <= initialSequence) return null
					return window.__performanceMetrics?.readyDetails?.[name] ?? {
						name,
						value: window.__performanceMetrics?.ready?.[name]
					}
				},
				{ name: metricName, initialSequence: initialReadySequence }
			)
			if (sharedMetric) return sharedMetric
			await new Promise(resolve => setTimeout(resolve, 50))
		}
		return null
	})()
	const resources = await page.evaluate(
		offset =>
			performance
				.getEntriesByType('resource')
				.slice(offset)
				.map(entry => ({
					name: entry.name,
					startTime: entry.startTime,
					responseEnd: entry.responseEnd
				})),
		resourceOffset
	)
	const deskResources = resources.filter(resource =>
		resource.name.includes('/api/player-stats/desk')
	)
	const chunkResources = resources.filter(resource =>
		resource.name.includes('/_next/static/chunks/')
	)
	const parallelChunkDesk = deskResources.some(desk =>
		chunkResources.some(
			chunk =>
				Math.max(desk.startTime, chunk.startTime) <
				Math.min(desk.responseEnd, chunk.responseEnd)
		)
	)
	return {
		name,
		metricName,
		durationMs: Number((performance.now() - startedAt).toFixed(2)),
		paintMs: metric?.value ?? null,
		cacheStatus: metric?.cacheStatus ?? 'unknown',
		navigationId: metric?.navigationId ?? null,
		interactionId: metric?.interactionId ?? null,
		parallelChunkDesk,
		success: metric != null
	}
}

async function runSamePageInteractions(page, metrics) {
	const interactions = []
	const firstResult = page
		.locator('[data-player-stats-directory-result]')
		.first()
	await firstResult.waitFor({ state: 'visible', timeout: 8_000 })
	interactions.push(
		await measureClickInteraction(
			page,
			metrics,
			'same-page-detail',
			'PLAYER_DETAIL_PAINT',
			() => firstResult.click()
		)
	)

	const addCompare = page.locator('[data-player-stats-add-compare="true"]')
	await addCompare.waitFor({ state: 'visible', timeout: 8_000 })
	await waitForEnabled(page, '[data-player-stats-add-compare="true"]')
	await addCompare.click()
	const secondResult = page
		.locator('[data-player-stats-directory-result]')
		.first()
	await secondResult.waitFor({ state: 'visible', timeout: 8_000 })
	interactions.push(
		await measureClickInteraction(
			page,
			metrics,
			'same-page-compare',
			'PLAYER_COMPARE_PAINT',
			() => secondResult.click()
		)
	)

	const editFirst = page.locator('[data-player-stats-edit-slot="first"]')
	await editFirst.waitFor({ state: 'visible', timeout: 8_000 })
	await waitForEnabled(page, '[data-player-stats-edit-slot="first"]')
	await editFirst.click()
	const recent = page.locator('[data-player-stats-recent-player]').first()
	await recent.waitFor({ state: 'visible', timeout: 8_000 })
	interactions.push(
		await measureClickInteraction(
			page,
			metrics,
			'client-warm-cache',
			'PLAYER_DETAIL_PAINT',
			() => recent.click()
		)
	)
	return interactions
}

async function measureRun(browser, profile, scenario, index) {
	const context = await browser.newContext({ viewport: profile.viewport })
	const page = await context.newPage()
	await installVitals(page, '__playerStatsPerformance')

	const cdp = await context.newCDPSession(page)
	await cdp.send('Network.enable')
	let documentRequestId = null
	let encodedDocumentBytes = 0
	let chunkBytes = 0
	const chunkRequestIds = new Set()
	cdp.on('Network.responseReceived', event => {
		if (event.type === 'Document') documentRequestId = event.requestId
		if (
			event.type === 'Script' &&
			event.response.url.includes('/_next/static/chunks/')
		) {
			chunkRequestIds.add(event.requestId)
		}
	})
	cdp.on('Network.loadingFinished', event => {
		if (event.requestId === documentRequestId) {
			encodedDocumentBytes = event.encodedDataLength
		}
		if (chunkRequestIds.has(event.requestId)) {
			chunkBytes += event.encodedDataLength
		}
	})

	let deskBrowserRequestCount = 0
	const deskRequestStarts = []
	const deskResponses = []
	const serverTiming = []
	let releaseSha = null
	let readyMs = null
	let paintMs = null
	const telemetry = []
	page.on('request', request => {
		const url = new URL(request.url())
		if (url.pathname === '/api/player-stats/desk') {
			deskBrowserRequestCount += 1
			deskRequestStarts.push({
				url: request.url(),
				startedAt: performance.now()
			})
		}
	})
	page.on('response', response => {
		const url = new URL(response.url())
		const headers = response.headers()
		const responseServerTiming = response.headers()['server-timing']
		if (responseServerTiming) serverTiming.push(responseServerTiming)
		if (url.pathname === '/api/player-stats/desk') {
			const started = deskRequestStarts.shift()
			deskResponses.push({
				status: response.status(),
				durationMs: started
					? Number((performance.now() - started.startedAt).toFixed(2))
					: null,
				cacheStatus:
					headers['x-vercel-cache'] ??
					headers['cf-cache-status'] ??
					headers['x-letletme-cache-status'] ??
					'unknown',
				serverTiming: responseServerTiming ?? null
			})
		}
		if (url.pathname === new URL(targetUrl).pathname) {
			releaseSha = headers['x-letletme-release'] ?? releaseSha
		}
	})
	await page.route('**/api/vitals', async route => {
		try {
			const metric = route.request().postDataJSON()
			if (metric && typeof metric === 'object') {
				telemetry.push(metric)
				if (metric.name === scenario.readyMetric) {
					readyMs = metric.value
					paintMs = metric.value
				}
			}
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
	runUrl.searchParams.set('_perfSource', 'synthetic')
	let response
	const navigation = await measureNavigation(browser, profile, runUrl.toString(), {
		page,
		onResponse: value => { response = value }
	})
	releaseSha = response?.headers()['x-letletme-release'] ?? releaseSha
	readyMs = await page.evaluate(
		name => window.__performanceMetrics?.ready?.[name] ?? null,
		scenario.readyMetric
	)
	paintMs = readyMs
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
		readyMs = await page.evaluate(
			name => window.__performanceMetrics?.ready?.[name] ?? null,
			scenario.readyMetric
		)
		paintMs = readyMs
		await page.waitForTimeout(50)
	}
	await page.waitForTimeout(250)

	const responseBody = response ? await response.body() : Buffer.alloc(0)
	const documentBytes =
		response?.headers()['content-encoding'] != null
			? encodedDocumentBytes || responseBody.byteLength
			: brotliCompressSync(responseBody).byteLength

	const interactions =
		scenario.name === 'directory'
			? await runSamePageInteractions(page, telemetry)
			: []
	const values = await page.evaluate(() => {
		const navigation = performance.getEntriesByType('navigation')[0]
		return {
			lcpMs: window.__playerStatsPerformance?.lcp ?? null,
			cls: window.__playerStatsPerformance?.cls ?? null,
			phase: 'interaction',
			inpMs: window.__playerStatsPerformance?.inp ?? null,
			fcpMs: window.__playerStatsPerformance?.fcp ?? null,
			observationInterval: { startMs: 0, endMs: performance.now() },
			observedLongTaskBlockingMs: window.__playerStatsPerformance?.observedLongTaskBlockingMs ?? null,
			ttfbMs: navigation?.responseStart ?? null,
			htmlResponseMs: navigation?.responseEnd ?? null,
			horizontalOverflow:
				document.documentElement.scrollWidth > window.innerWidth
		}
	})
	const deskDurationMs =
		deskResponses.find(item => item.durationMs != null)?.durationMs ?? null
	const deskCacheStatuses = deskResponses.map(item => item.cacheStatus)
	await context.close()
	return {
		navigation,
		status: response?.status() ?? 0,
		...values,
		documentBytes,
		chunkBytes,
		readyMs: readyMs ?? null,
		paintMs: paintMs ?? readyMs ?? null,
		deskBrowserRequestCount,
		deskDurationMs,
		deskCacheStatuses,
		serverTiming,
		releaseSha,
		interactions
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
			...performanceMetadata(),
			measurements,
			raw,
			acceptance: {
				navigationComplete: allRuns.every(run => navigationComplete(run.navigation)),
				mobileLcp:
					atMost(mobile.directory.lcpMs.p50, 2_500) &&
					atMost(mobile.directory.lcpMs.max, 3_000),
				mobileObservedBlocking: raw.mobile.directory.every(run => atMost(run.navigation.observedLongTaskBlockingMs, 100)),
				cls: allRuns.every(run => atMost(run.navigation.cls, 0.02)),
				htmlResponse:
					atMost(percentile(
						allRuns.map(run => run.htmlResponseMs),
						95
					), 2_000),
				defaultDocument: Object.values(raw).every(profile =>
					profile.directory.every(run => atMost(run.documentBytes, 51 * 1024))
				),
				directoryReady: Object.values(raw).every(
					profile =>
						atMost(percentile(
							profile.directory.map(run => run.readyMs),
							95
						), 1_000)
				),
				detailReady: Object.values(raw).every(
					profile =>
						atMost(percentile(
							profile.detail.map(run => run.readyMs),
							95
						), 1_500)
				),
				compareReady: Object.values(raw).every(
					profile =>
						atMost(percentile(
							profile.compare.map(run => run.readyMs),
							95
						), 1_500)
				),
				directoryPaint: Object.values(raw).every(
					profile =>
						atMost(percentile(
							profile.directory.map(run => run.paintMs),
							95
						), 1_000)
				),
				detailPaint: Object.values(raw).every(
					profile =>
						atMost(percentile(
							profile.detail.map(run => run.paintMs),
							95
						), 1_500)
				),
				comparePaint: Object.values(raw).every(
					profile =>
						atMost(percentile(
							profile.compare.map(run => run.paintMs),
							95
						), 1_500)
				),
				samePageInteraction: Object.values(raw).every(profile =>
					profile.directory.every(run =>
						run.interactions?.every(interaction => interaction.success)
					)
				),
				chunkDeskParallel: Object.values(raw).every(profile =>
					profile.directory.every(run =>
						run.interactions?.some(interaction => interaction.parallelChunkDesk)
					)
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
