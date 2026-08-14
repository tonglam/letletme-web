import { chromium } from '@playwright/test'

const baseUrl = process.env.HOME_PERF_URL ?? 'https://letletme.top/'
const runCount = Number.parseInt(process.env.HOME_PERF_RUNS ?? '5', 10)
const concurrency = Number.parseInt(
	process.env.HOME_PERF_CONCURRENCY ?? '20',
	10
)
const sessionCookie = process.env.HOME_PERF_SESSION_COOKIE?.trim() ?? ''

if (!Number.isInteger(runCount) || runCount < 1 || runCount > 50) {
	throw new Error('HOME_PERF_RUNS must be an integer from 1 through 50')
}
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 50) {
	throw new Error('HOME_PERF_CONCURRENCY must be an integer from 1 through 50')
}

const profiles = [
	{ name: 'desktop', viewport: { width: 1440, height: 900 }, slow4g: false },
	{ name: 'mobile', viewport: { width: 390, height: 844 }, slow4g: true }
]

function percentile(values, percentileValue) {
	if (values.length === 0) return null
	const ordered = [...values].sort((left, right) => left - right)
	const index = Math.min(
		ordered.length - 1,
		Math.ceil((percentileValue / 100) * ordered.length) - 1
	)
	return Number(ordered[index].toFixed(2))
}

function distribution(runs, field) {
	const values = runs
		.map(run => run[field])
		.filter(value => typeof value === 'number' && Number.isFinite(value))
	return {
		p50: percentile(values, 50),
		p95: percentile(values, 95),
		observed: values.length,
		missing: runs.length - values.length
	}
}

function summarize(runs) {
	return {
		runs: runs.length,
		readinessExpected: Boolean(sessionCookie),
		status200: runs.every(run => run.status === 200),
		lcpMs: distribution(runs, 'lcpMs'),
		tbtMs: distribution(runs, 'tbtMs'),
		cls: distribution(runs, 'cls'),
		loadMs: distribution(runs, 'loadMs'),
		ttfbMs: distribution(runs, 'ttfbMs'),
		teamDeskReadyMs: distribution(runs, 'teamDeskReadyMs'),
		leagueRanksReadyMs: distribution(runs, 'leagueRanksReadyMs'),
		transferredBytes: {
			html: distribution(runs, 'htmlBytes'),
			js: distribution(runs, 'jsBytes'),
			font: distribution(runs, 'fontBytes'),
			image: distribution(runs, 'imageBytes'),
			total: distribution(runs, 'totalBytes')
		},
		requests: distribution(runs, 'requestCount'),
		horizontalOverflow: runs.some(run => run.horizontalOverflow)
	}
}

async function applySessionCookie(context) {
	if (!sessionCookie) return
	const separator = sessionCookie.indexOf('=')
	if (separator <= 0) throw new Error('HOME_PERF_SESSION_COOKIE must be name=value')
	const url = new URL(baseUrl)
	const cookieName = sessionCookie.slice(0, separator)
	await context.addCookies([
		{
			name: cookieName,
			value: sessionCookie.slice(separator + 1),
			domain: url.hostname,
			path: '/',
			httpOnly: true,
			secure: url.protocol === 'https:' || cookieName.startsWith('__Secure-'),
			sameSite: 'Lax'
		}
	])
}

async function throttleMobile(page) {
	const session = await page.context().newCDPSession(page)
	await session.send('Network.enable')
	await session.send('Network.emulateNetworkConditions', {
		offline: false,
		latency: 150,
		downloadThroughput: (1.6 * 1024 * 1024) / 8,
		uploadThroughput: (750 * 1024) / 8,
		connectionType: 'cellular4g'
	})
}

function fixtureRequestTransport(request) {
	if (request.url().includes('/api/home/fixtures?')) return 'GET_ROUTE'
	if (
		request.method() === 'POST' &&
		request.url().includes('/api/graphql') &&
		(request.postData() ?? '').includes('GetEventFixtures')
	) {
		return 'GRAPHQL_POST'
	}
	return null
}

async function waitForReadyMetric(page, requestMetrics, name, timeoutMs = 5_000) {
	const startedAt = performance.now()
	while (performance.now() - startedAt < timeoutMs) {
		const browserValue = await page.evaluate(metricName => {
			const value = window.__homePerformance?.ready?.[metricName]
			return typeof value === 'number' ? value : null
		}, name)
		if (browserValue !== null) return browserValue
		const requestValue = requestMetrics.get(name)
		if (typeof requestValue === 'number') return requestValue
		await page.waitForTimeout(50)
	}
	return null
}

async function readCommittedFixtureEvent(page) {
	const matches = page.locator('[data-home-matches]').last()
	if ((await matches.count()) > 0) {
		const value = Number.parseInt(
			(await matches.getAttribute('data-home-fixtures-event')) ?? '',
			10
		)
		if (Number.isInteger(value)) return value
	}
	const badge = page.getByText(/^GW\d+$/).last()
	const value = Number.parseInt((await badge.textContent())?.replace(/^GW/, '') ?? '', 10)
	return Number.isInteger(value) ? value : null
}

async function waitForCommittedFixtureEvent(page, eventId, hasEventMarker) {
	if (hasEventMarker) {
		await page
			.locator(`[data-home-matches][data-home-fixtures-event="${eventId}"]`)
			.waitFor({ state: 'visible', timeout: 30_000 })
		return
	}
	await page
		.getByText(`GW${eventId}`, { exact: true })
		.last()
		.waitFor({ state: 'visible', timeout: 30_000 })
}

async function measureColdLoad(browser, profile, index) {
	const context = await browser.newContext({ viewport: profile.viewport })
	await applySessionCookie(context)
	const page = await context.newPage()
	if (profile.slow4g) await throttleMobile(page)
	let requestCount = 0
	const routeReady = new Map()
	page.on('request', request => {
		requestCount += 1
		if (!request.url().includes('/api/vitals') || request.method() !== 'POST') {
			return
		}
		try {
			const payload = JSON.parse(request.postData() ?? '{}')
			if (
				(payload.name === 'HOME_TEAM_DESK_READY' ||
					payload.name === 'HOME_LEAGUE_RANKS_READY') &&
				typeof payload.value === 'number'
			) {
				routeReady.set(payload.name, payload.value)
			}
		} catch {}
	})
	await page.addInitScript(() => {
		window.__homePerformance = { cls: 0, lcp: 0, tbt: 0, ready: {} }
		const captureMetric = async body => {
			try {
				const raw =
					typeof body === 'string'
						? body
						: body && typeof body.text === 'function'
							? await body.text()
							: ''
				const payload = JSON.parse(raw)
				if (
					(payload.name === 'HOME_TEAM_DESK_READY' ||
						payload.name === 'HOME_LEAGUE_RANKS_READY') &&
					typeof payload.value === 'number'
				) {
					window.__homePerformance.ready[payload.name] = payload.value
				}
			} catch {}
		}
		const nativeBeacon = navigator.sendBeacon?.bind(navigator)
		if (nativeBeacon) {
			navigator.sendBeacon = (url, data) => {
				if (String(url).includes('/api/vitals')) void captureMetric(data)
				return nativeBeacon(url, data)
			}
		}
		const nativeFetch = window.fetch.bind(window)
		window.fetch = (input, init) => {
			if (String(input).includes('/api/vitals')) void captureMetric(init?.body)
			return nativeFetch(input, init)
		}
		new PerformanceObserver(list => {
			for (const entry of list.getEntries()) {
				window.__homePerformance.lcp = entry.startTime
			}
		}).observe({ type: 'largest-contentful-paint', buffered: true })
		new PerformanceObserver(list => {
			for (const entry of list.getEntries()) {
				if (!entry.hadRecentInput) window.__homePerformance.cls += entry.value
			}
		}).observe({ type: 'layout-shift', buffered: true })
		new PerformanceObserver(list => {
			for (const entry of list.getEntries()) {
				window.__homePerformance.tbt += Math.max(0, entry.duration - 50)
			}
		}).observe({ type: 'longtask', buffered: true })
	})
	const navigationStartedAt = performance.now()
	const response = await page.goto(
		`${baseUrl}${baseUrl.includes('?') ? '&' : '?'}cold=${profile.name}-${index}`,
		{ waitUntil: 'load' }
	)
	const readySamples = new Map()
	if (sessionCookie) {
		const names = ['HOME_TEAM_DESK_READY', 'HOME_LEAGUE_RANKS_READY']
		const values = await Promise.all(
			names.map(name => waitForReadyMetric(page, routeReady, name))
		)
		for (let index = 0; index < names.length; index += 1) {
			readySamples.set(names[index], values[index])
		}
	}
	const elapsedAfterLoad = performance.now() - navigationStartedAt
	if (elapsedAfterLoad < 1_000) {
		await page.waitForTimeout(1_000 - elapsedAfterLoad)
	}
	const browserMetrics = await page.evaluate(() => {
		const navigation = performance.getEntriesByType('navigation')[0]
		const resources = performance.getEntriesByType('resource')
		const bytesFor = predicate =>
			resources
				.filter(predicate)
				.reduce((total, entry) => total + (entry.transferSize || 0), 0)
		const htmlBytes = navigation?.transferSize ?? 0
		const jsBytes = bytesFor(
			entry => entry.initiatorType === 'script' || /\.js(?:\?|$)/.test(entry.name)
		)
		const fontBytes = bytesFor(entry =>
			/\.(?:woff2?|ttf|otf)(?:\?|$)/i.test(entry.name)
		)
		const imageBytes = bytesFor(
			entry =>
				entry.initiatorType === 'img' ||
				/\.(?:png|jpe?g|webp|avif|svg)(?:\?|$)/i.test(entry.name)
		)
		const resourceBytes = resources.reduce(
			(total, entry) => total + (entry.transferSize || 0),
			0
		)
		return {
			lcpMs: window.__homePerformance?.lcp ?? 0,
			tbtMs: window.__homePerformance?.tbt ?? 0,
			cls: window.__homePerformance?.cls ?? 0,
			loadMs: navigation?.loadEventEnd ?? 0,
			ttfbMs: navigation?.responseStart ?? 0,
			htmlBytes,
			jsBytes,
			fontBytes,
			imageBytes,
			totalBytes: htmlBytes + resourceBytes,
			horizontalOverflow:
				document.documentElement.scrollWidth > window.innerWidth,
			serverTiming:
				navigation?.serverTiming?.map(item => ({
					name: item.name,
					duration: item.duration
				})) ?? [],
			teamDeskReadyMs:
				window.__homePerformance?.ready?.HOME_TEAM_DESK_READY ?? null,
			leagueRanksReadyMs:
				window.__homePerformance?.ready?.HOME_LEAGUE_RANKS_READY ?? null
		}
	})
	await context.close()
	return {
		status: response?.status() ?? 0,
		requestCount,
		...browserMetrics,
		teamDeskReadyMs:
			readySamples.get('HOME_TEAM_DESK_READY') ??
			browserMetrics.teamDeskReadyMs ??
			routeReady.get('HOME_TEAM_DESK_READY') ??
			null,
		leagueRanksReadyMs:
			readySamples.get('HOME_LEAGUE_RANKS_READY') ??
			browserMetrics.leagueRanksReadyMs ??
			routeReady.get('HOME_LEAGUE_RANKS_READY') ??
			null
	}
}

async function measureFixtureSwitch(browser, profile) {
	const context = await browser.newContext({ viewport: profile.viewport })
	try {
		await applySessionCookie(context)
		const page = await context.newPage()
		if (profile.slow4g) await throttleMobile(page)
		let fixtureRequests = 0
		const fixtureTransports = new Set()
		page.on('request', request => {
			const transport = fixtureRequestTransport(request)
			if (!transport) return
			fixtureRequests += 1
			fixtureTransports.add(transport)
		})
		await page.goto(baseUrl, { waitUntil: 'networkidle' })
		const next = page.getByRole('button', { name: /next gameweek|下一轮/i }).last()
		if ((await next.count()) === 0 || (await next.isDisabled())) {
			return {
				available: false,
				reason: 'navigation-unavailable',
				firstSwitchMs: null,
				firstSwitchRequests: 0,
				firstSwitchStatus: null,
				firstSwitchTransports: [],
				cachedSwitchMs: null,
				cachedSwitchRequests: 0
			}
		}
		const previous = page
			.getByRole('button', { name: /previous gameweek|上一轮/i })
			.last()
		const initialEventId = await readCommittedFixtureEvent(page)
		if (initialEventId === null) {
			return {
				available: false,
				reason: 'event-marker-unavailable',
				firstSwitchMs: null,
				firstSwitchRequests: 0,
				firstSwitchStatus: null,
				firstSwitchTransports: [],
				cachedSwitchMs: null,
				cachedSwitchRequests: 0
			}
		}
		const targetEventId = initialEventId + 1
		const hasEventMarker =
			(await page
				.locator('[data-home-matches]')
				.last()
				.getAttribute('data-home-fixtures-event')) !== null
		const startedAt = performance.now()
		const firstResponse = page.waitForResponse(response =>
			Boolean(fixtureRequestTransport(response.request()))
		)
		await next.click()
		const fixtureResponse = await firstResponse
		await waitForCommittedFixtureEvent(page, targetEventId, hasEventMarker)
		const firstSwitchMs = performance.now() - startedAt
		const requestsAfterFirst = fixtureRequests
		const cachedStartedAt = performance.now()
		await previous.click()
		await waitForCommittedFixtureEvent(page, initialEventId, hasEventMarker)
		const cachedSwitchMs = performance.now() - cachedStartedAt
		return {
			available: true,
			firstSwitchMs: Number(firstSwitchMs.toFixed(2)),
			firstSwitchRequests: requestsAfterFirst,
			firstSwitchStatus: fixtureResponse.status(),
			firstSwitchTransports: Array.from(fixtureTransports),
			cachedSwitchMs: Number(cachedSwitchMs.toFixed(2)),
			cachedSwitchRequests: fixtureRequests - requestsAfterFirst
		}
	} finally {
		await context.close()
	}
}

const browser = await chromium.launch({ headless: true })
const measurements = {}
const fixtureSwitches = {}
try {
	for (const profile of profiles) {
		const runs = []
		for (let index = 0; index < runCount; index += 1) {
			runs.push(await measureColdLoad(browser, profile, index))
		}
		measurements[profile.name] = summarize(runs)
		fixtureSwitches[profile.name] = await measureFixtureSwitch(browser, profile)
	}
} finally {
	await browser.close()
}

const concurrentStartedAt = performance.now()
const concurrentResponses = await Promise.all(
	Array.from({ length: concurrency }, async (_, index) => {
		const response = await fetch(
			`${baseUrl}${baseUrl.includes('?') ? '&' : '?'}concurrency=${index}`,
			{
				headers: {
					Accept: 'text/html',
					...(sessionCookie ? { Cookie: sessionCookie } : {})
				},
				cache: 'no-store'
			}
		)
		await response.arrayBuffer()
		return response
	})
)

console.log(
	JSON.stringify(
		{
			url: new URL(baseUrl).origin,
			measuredAt: new Date().toISOString(),
			audience: sessionCookie ? 'session-hint' : 'public',
			coldLoads: measurements,
			fixtureSwitches,
			concurrency: {
				requests: concurrency,
				status200: concurrentResponses.filter(response => response.status === 200)
					.length,
				totalMs: Number((performance.now() - concurrentStartedAt).toFixed(2))
			}
		},
		null,
		2
	)
)
