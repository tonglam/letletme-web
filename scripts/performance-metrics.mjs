import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const vitalsModulePath = require.resolve('web-vitals')
const vitalsSource = readFileSync(path.join(path.dirname(vitalsModulePath), 'web-vitals.iife.js'), 'utf8')
export const performanceProfiles = [
	{ name: 'desktop', viewport: { width: 1440, height: 900 } },
	{ name: 'mobile', viewport: { width: 390, height: 844 } }
]
export function percentile(values, p) {
	const sorted = values.filter(value => typeof value === 'number' && Number.isFinite(value)).sort((a, b) => a - b)
	return sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length * p / 100) - 1)] : null
}
export function atMost(value, limit) {
	return typeof value === 'number' && Number.isFinite(value) && value <= limit
}
export function isProductionMeasurementUrl(url) {
	try {
		const hostname = new URL(String(url)).hostname.toLowerCase()
		return hostname === 'letletme.top' || hostname.endsWith('.letletme.top')
	} catch {
		return false
	}
}
export function hasValidProductionIdentity(sample) {
	return /^[a-f0-9]{40}$/i.test(sample?.releaseSha ?? '') && /^(?:vercel|tencent|overseas)$/i.test(sample?.origin ?? '')
}
export function navigationComplete(sample) {
	const businessResult = sample?.businessResult ?? sample?.readyResult
	if (
		businessResult !== undefined &&
		businessResult !== null &&
		businessResult !== 'ok'
	)
		return false
	const metricsComplete = sample?.status === 200 && !sample.error && ['lcpMs', 'cls', 'fcpMs', 'ttfbMs', 'readyMs'].every(key => typeof sample[key] === 'number' && Number.isFinite(sample[key]))
	if (!metricsComplete) return false
	return !isProductionMeasurementUrl(sample.url) || hasValidProductionIdentity(sample)
}
export function distribution(runs, field) {
	const values = runs.map(run => run[field]).filter(value => typeof value === 'number' && Number.isFinite(value))
	return { observed: values.length, missing: runs.length - values.length, p50: percentile(values, 50), min: values.length ? Math.min(...values) : null, max: values.length ? Math.max(...values) : null }
}
export function performanceMetadata() {
	let sourceSha = null
	try { sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() } catch {}
	return { schemaVersion: 2, sourceSha, collectorSourceSha: sourceSha, collectorDigest: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'), collector: 'web-vitals@6.2.1', measuredAt: new Date().toISOString() }
}

/**
 * Extracts the ready markers emitted by both telemetry generations.
 *
 * The first generation sent one `{ name, value }` object. The current Web
 * client sends a v2 batch whose samples carry `metricName` and `value`.
 * Keeping this pure makes the measurement contract testable without a browser.
 */
export function extractReadyMetrics(payload) {
	if (payload == null || typeof payload !== 'object') return []
	const metrics = []
	if (
		typeof payload.name === 'string' &&
		typeof payload.value === 'number' &&
		Number.isFinite(payload.value)
	) {
		metrics.push({ ...payload })
	}
	if (!Array.isArray(payload.samples)) return metrics
	for (const sample of payload.samples) {
		if (sample == null || typeof sample !== 'object') continue
		const name =
			typeof sample.metricName === 'string'
				? sample.metricName
				: typeof sample.name === 'string'
					? sample.name
					: null
		if (
			!name ||
			typeof sample.value !== 'number' ||
			!Number.isFinite(sample.value)
		) {
			continue
		}
		metrics.push({ ...sample, name })
	}
	return metrics
}

/**
 * A ready marker is a usable business clock only when it completed normally.
 * Interaction markers stay out of navigation samples unless a collector opts
 * into them, so a delayed marker from an earlier click cannot make a new
 * navigation look ready.
 */
export function isUsableReadyMetric(metric, allowInteractionMetrics = false) {
	if (metric == null || typeof metric !== 'object') return false
	if (typeof metric.name !== 'string') return false
	if (
		typeof metric.value !== 'number' ||
		!Number.isFinite(metric.value) ||
		metric.value < 0
	)
		return false
	if (metric.result !== undefined && metric.result !== 'ok') return false
	const isInteraction =
		metric.measurementKind === 'interaction' ||
		typeof metric.interactionId === 'string'
	return allowInteractionMetrics || !isInteraction
}

/** The alias is used only by the existing interaction diagnostics. */
export async function installVitals(
	page,
	alias = '__performanceMetrics',
	options = {}
) {
	const allowInteractionMetrics = options.allowInteractionMetrics === true
	const initialize = (
		{ aliasName, captureTelemetry },
		extractMetrics,
		usableMetric,
		allowInteractions
	) => {
		const existing = window.__performanceMetrics
		const clsSupported = typeof PerformanceObserver !== 'undefined' && Array.isArray(PerformanceObserver.supportedEntryTypes) && PerformanceObserver.supportedEntryTypes.includes('layout-shift')
		const state = existing ?? { lcp: null, cls: clsSupported ? 0 : null, inp: null, fcp: null, ttfb: null, observedLongTaskBlockingMs: null, ready: {}, readySequence: {}, readyDetails: {} }
		state.readyDetails ??= {}
		state.readySequence ??= {}
		window[aliasName] = state
		window.__performanceMetrics = state
		if (existing) return
		const notify = () => { void window.__capturePerformanceMetric?.({ ...state, documentUrl: location.href }) }
		for (const [fn, key] of [['onLCP', 'lcp'], ['onCLS', 'cls'], ['onINP', 'inp'], ['onFCP', 'fcp'], ['onTTFB', 'ttfb']]) {
			window.webVitals[fn](metric => { state[key] = metric.value; notify() }, { reportAllChanges: true })
		}
		if (PerformanceObserver.supportedEntryTypes.includes('longtask')) {
			state.observedLongTaskBlockingMs = 0
			const add = entries => { for (const entry of entries) state.observedLongTaskBlockingMs += Math.max(0, entry.duration - 50) }
			const observer = new PerformanceObserver(list => { add(list.getEntries()); notify() })
			observer.observe({ type: 'longtask', buffered: true })
			window.__snapshotLongTaskObservation = () => { add(observer.takeRecords()) }
			window.__finishLongTaskObservation = () => { add(observer.takeRecords()); observer.disconnect() }
		}
		if (!captureTelemetry) return
		const capture = async body => {
			try {
				const raw = typeof body === 'string' ? body : await body?.text?.()
				const payload = JSON.parse(raw)
				for (const metric of extractMetrics(payload)) {
					state.readyDetails[metric.name] = metric
					if (!usableMetric(metric, allowInteractions)) continue
					state.ready[metric.name] = metric.value
					state.readySequence[metric.name] = (state.readySequence[metric.name] ?? 0) + 1
					notify()
				}
			} catch {}
		}
		const beacon = navigator.sendBeacon.bind(navigator)
		navigator.sendBeacon = (url, body) => {
			if (new URL(String(url), location.href).pathname === '/api/vitals') { void capture(body); return true }
			return beacon(url, body)
		}
		const fetch = window.fetch.bind(window)
		window.fetch = (input, init) => {
			const url = input instanceof Request ? input.url : String(input)
			if (new URL(url, location.href).pathname === '/api/vitals') {
				void capture(init?.body ?? (input instanceof Request ? input.clone() : null))
				return Promise.resolve(new Response(null, { status: 204 }))
			}
			return fetch(input, init)
		}
	}
	await page.addInitScript({ content: `${vitalsSource}\n;globalThis.webVitals = webVitals;\n;(${initialize.toString()})(${JSON.stringify({ aliasName: alias, captureTelemetry: true })}, ${extractReadyMetrics.toString()}, ${isUsableReadyMetric.toString()}, ${JSON.stringify(allowInteractionMetrics)})` })
}

export async function throttleProfile(page, profile) {
	if (profile.name !== 'mobile') return
	const cdp = await page.context().newCDPSession(page)
	await cdp.send('Network.enable')
	await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8, connectionType: 'cellular4g' })
	await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
	return async () => {
		await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
		await cdp.detach()
	}
}

export async function finishLongTaskObservation(page) {
	await page.evaluate(() => window.__finishLongTaskObservation?.())
}

export function readyMetricFor(url) {
	const parsed = new URL(url)
	const pathname = parsed.pathname
	if (pathname.includes('/explore/player-stats')) return parsed.searchParams.has('p2') ? 'PLAYER_COMPARE_PAINT' : parsed.searchParams.has('p1') ? 'PLAYER_DETAIL_PAINT' : 'PLAYER_DIRECTORY_PAINT'
	if (pathname.includes('/explore/fixtures')) return 'FIXTURES_WINDOW_READY'
	if (pathname.includes('/explore/gameweek')) return 'GAMEWEEK_CONTENT_READY'
	if (pathname.includes('/explore/market')) return 'MARKET_CONTENT_READY'
	if (pathname.includes('/explore/selections')) return 'TRENDS_DESK_READY'
	if (pathname.includes('/live/matches')) return 'LIVE_MATCHDAY_READY'
	if (pathname.includes('/live/competitions')) return 'LIVE_COMPETITION_BOARD_READY'
	if (pathname.includes('/price-predictions')) return 'HOME_PRICE_CHANGES_READY'
	if (pathname.endsWith('/competitions/browse')) return 'COMPETITIONS_BROWSE_READY'
	if (pathname.endsWith('/competitions/create')) return 'COMPETITIONS_CREATE_READY'
	if (/\/competitions\/\d+\/manage$/.test(pathname)) return 'COMPETITIONS_MANAGE_READY'
	if (/^\/(?:[a-z]{2}(?:-[A-Z]{2})?)?\/?$/.test(pathname)) return 'HOME_MARKET_READY'
	return null
}

/** A dedicated navigation, without clicks. Page hide finalizes web-vitals. Pass page to keep follow-up probes on this navigation. */
export async function measureNavigation(browser, profile, url, options = {}) {
	const ownContext = !options.context && !options.page
	const ownsPage = !options.page
	const context = options.context ?? options.page?.context() ?? await browser.newContext({ viewport: profile.viewport, storageState: options.storageState })
	if (options.prepareContext && !options.page) await options.prepareContext(context)
	const page = options.page ?? await context.newPage()
	page.setDefaultTimeout(30_000)
	let latest = {}
	const errors = []
	const onPageError = error => errors.push(error.message)
	page.on('pageerror', onPageError)
	const requests = []
	const onRequestFinished = request => {
		requests.push({ path: new URL(request.url()).pathname, type: request.resourceType(), method: request.method(), timing: request.timing() })
	}
	page.on('requestfinished', onRequestFinished)
	const sample = { ...performanceMetadata(), browserVersion: browser.version(), profile: profile.name, viewport: profile.viewport, cpuRate: profile.name === 'mobile' ? 4 : 1, network: profile.name === 'mobile' ? '150ms RTT / 1.6Mbps down / 750Kbps up' : 'unthrottled', browserCache: options.browserCache ?? 'cold', serverCache: options.serverCache ?? 'uncontrolled', url: String(url), phase: 'navigation', status: null, readyMs: null, lcpMs: null, cls: null, inpMs: null, fcpMs: null, ttfbMs: null, htmlResponseMs: null, observedLongTaskBlockingMs: null, error: null }
	let timer
	let releaseThrottle
	let observationTask
	let observationFinished = false
	let cancelObservation
	const observationCancelled = new Promise((_, reject) => {
		cancelObservation = reject
	})
	const awaitObservation = promise =>
		Promise.race([promise, observationCancelled])
	try {
		observationTask = (async () => {
			try {
				await awaitObservation(
					page.exposeBinding('__capturePerformanceMetric', (_, metric) => {
						if (metric.documentUrl !== 'about:blank') latest = metric
					})
				)
				await awaitObservation(installVitals(page))
				releaseThrottle = await awaitObservation(
					throttleProfile(page, profile)
				)
				const target = new URL(url)
				target.searchParams.set('_perfSource', 'synthetic')
				const response = await awaitObservation(
					page.goto(target.href, { waitUntil: 'commit' })
				)
				options.onResponse?.(response)
				sample.status = response?.status() ?? null
				sample.releaseSha = response?.headers()['x-letletme-release'] ?? null
				sample.origin = response?.headers()['x-letletme-origin'] ?? null
				if (/^[a-f0-9]{40}$/.test(sample.releaseSha ?? '')) sample.sourceSha = sample.releaseSha
				const actual = new URL(page.url())
				if (
					sample.status !== 200 ||
					actual.pathname !== target.pathname ||
					(target.searchParams.has('tournamentId') && actual.searchParams.get('tournamentId') !== target.searchParams.get('tournamentId')) ||
					(target.searchParams.has('gw') && actual.searchParams.get('gw') !== target.searchParams.get('gw'))
				) throw new Error('Unexpected response or redirect')
				const readyMetricName = options.readyMetric ?? readyMetricFor(url)
				if (!readyMetricName) {
					throw new Error(`No ready metric configured for ${target.pathname}`)
				}
				if (readyMetricName) {
					await awaitObservation(
						page.waitForFunction(
							name =>
								typeof window.__performanceMetrics?.ready?.[name] ===
								'number',
								readyMetricName
						)
					)
					sample.readyMs = await awaitObservation(
						page.evaluate(
							name => window.__performanceMetrics.ready[name],
							readyMetricName
						)
					)
				}
				if (target.pathname.endsWith('/live/competitions') && options.requireCompetitionMarker !== false) {
					const expectedGameweek = target.searchParams.get('gw')
					const gameweekSelector = expectedGameweek == null ? '' : `[data-competition-gameweek="${expectedGameweek}"]`
					await awaitObservation(
						page
							.locator(
								`[data-competition-perf-ready="detail"][data-competition-tournament-id="${target.searchParams.get('tournamentId')}"${gameweekSelector}]`
							)
							.waitFor({ state: 'visible' })
					)
				}
				await awaitObservation(page.waitForTimeout(5_000))
				const details = await awaitObservation(
					page.evaluate(ownsNavigationPage => {
						if (ownsNavigationPage) window.__finishLongTaskObservation?.()
						else window.__snapshotLongTaskObservation?.()
						const nav = performance.getEntriesByType('navigation')[0]
						return {
							endMs: performance.now(),
							htmlResponseMs: nav?.responseEnd || null,
							loadMs: nav?.loadEventEnd || null,
							horizontalOverflow:
								document.documentElement.scrollWidth > innerWidth,
							resources: performance
								.getEntriesByType('resource')
								.map(r => ({
									path: new URL(r.name).pathname,
									initiatorType: r.initiatorType,
									startTime: r.startTime,
									responseEnd: r.responseEnd,
									transferSize: r.transferSize,
									encodedBodySize: r.encodedBodySize,
									decodedBodySize: r.decodedBodySize
								})),
							metrics: window.__performanceMetrics
						}
					}, ownsPage)
				)
				const detailsMetrics = details.metrics
				latest = detailsMetrics
				sample.businessResult = readyMetricName
					? detailsMetrics?.readyDetails?.[readyMetricName]?.result ?? 'ok'
					: 'ok'
				sample.businessReasonCode = readyMetricName
					? detailsMetrics?.readyDetails?.[readyMetricName]?.reasonCode ?? null
					: null
				delete details.metrics
				Object.assign(sample, details)
				if (options.screenshot)
					await awaitObservation(
						page.screenshot({ path: options.screenshot, fullPage: true })
					)
				if (ownsPage) await releaseThrottle?.()
				if (ownsPage)
					await awaitObservation(
						page.goto('about:blank', { waitUntil: 'commit' })
					)
			} finally {
				observationFinished = true
			}
		})()
		await Promise.race([
			observationTask,
			new Promise((_, reject) => {
				timer = setTimeout(() => {
					if (observationFinished) return
					const timeoutError = new Error(
						'Navigation observation exceeded 30000ms'
					)
					cancelObservation?.(timeoutError)
					if (ownsPage) void page.close()
					reject(timeoutError)
				}, 30_000)
			})
		])
	} catch (error) {
		sample.error = error.message
	} finally {
		clearTimeout(timer)
		await observationTask?.catch(() => {})
		page.off('pageerror', onPageError)
		page.off('requestfinished', onRequestFinished)
		if (ownsPage) await page.close().catch(() => {})
		if (ownContext) await context.close()
	}
	Object.assign(sample, { lcpMs: latest.lcp ?? null, cls: latest.cls ?? null, inpMs: latest.inp ?? null, fcpMs: latest.fcp ?? null, ttfbMs: latest.ttfb ?? null, observedLongTaskBlockingMs: latest.observedLongTaskBlockingMs ?? null, businessMetrics: latest.ready ?? {}, requests: requests.slice(), errors: errors.slice() })
	const complete = navigationComplete(sample)
	if (!complete && isProductionMeasurementUrl(sample.url) && !sample.error) sample.error = 'Production measurement missing valid release/origin identity or required navigation metric'
	sample.navigationComplete = complete
	sample.observationInterval = { startMs: 0, endMs: sample.endMs ?? null, endReason: sample.error ?? 'business ready plus 5000ms' }
	sample.missing = Object.fromEntries(['lcpMs', 'cls', 'inpMs', 'fcpMs', 'ttfbMs', 'readyMs'].filter(key => sample[key] == null).map(key => [key, key === 'inpMs' ? 'no interaction in navigation phase' : sample.error ?? 'no observation']))
	if (process.env.PERF_OUTPUT_DIR) {
		mkdirSync(process.env.PERF_OUTPUT_DIR, { recursive: true })
		writeFileSync(path.join(process.env.PERF_OUTPUT_DIR, `${Date.now()}-${profile.name}-${Math.random().toString(16).slice(2)}.json`), JSON.stringify(sample, null, 2))
	}
	return sample
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const { chromium } = await import('@playwright/test')
	const urls = process.argv.slice(2)
	if (!urls.length) throw new Error('Provide absolute URLs to measure')
	const runs = Number(process.env.PERF_RUNS ?? 5)
	if (!Number.isInteger(runs) || runs < 1 || runs > 20) throw new Error('PERF_RUNS must be 1 through 20')
	const samples = []
	const profiles = performanceProfiles.filter(profile => !process.env.PERF_PROFILE || profile.name === process.env.PERF_PROFILE)
	for (const profile of profiles) for (const url of urls) {
		for (let i = 0; i < runs; i++) {
			const browser = await chromium.launch({ channel: 'chromium' })
			try {
				const context = await browser.newContext({ viewport: profile.viewport, storageState: process.env.PERF_STORAGE_STATE })
				for (const browserCache of ['cold', 'warm']) {
					console.error(`${profile.name} ${url} ${i + 1}/${runs} ${browserCache}`)
					samples.push(await measureNavigation(browser, profile, url, { context, browserCache }))
				}
			} finally { await browser.close() }
		}
	}
	console.log(JSON.stringify({ ...performanceMetadata(), samples }, null, 2))
}
