import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const vitalsSource = readFileSync(require.resolve('web-vitals'), 'utf8')
export const performanceProfiles = [
	{ name: 'desktop', viewport: { width: 1440, height: 900 } },
	{ name: 'mobile', viewport: { width: 390, height: 844 } }
]
export function percentile(values, p) {
	const sorted = values.filter(value => typeof value === 'number' && Number.isFinite(value)).sort((a, b) => a - b)
	return sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length * p / 100) - 1)] : null
}
export function distribution(runs, field) {
	const values = runs.map(run => run[field]).filter(value => typeof value === 'number' && Number.isFinite(value))
	return { observed: values.length, missing: runs.length - values.length, p50: percentile(values, 50), min: values.length ? Math.min(...values) : null, max: values.length ? Math.max(...values) : null }
}
export function performanceMetadata() {
	let sourceSha = null
	try { sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() } catch {}
	return { schemaVersion: 2, sourceSha, collector: 'web-vitals@6.2.1', measuredAt: new Date().toISOString() }
}

/** The alias is used only by the existing interaction diagnostics. */
export async function installVitals(page, alias = '__performanceMetrics') {
	const initialize = aliasName => {
		const state = { lcp: null, cls: null, inp: null, fcp: null, ttfb: null, observedLongTaskBlockingMs: null, ready: {} }
		window[aliasName] = state
		window.__performanceMetrics = state
		const notify = () => { void window.__capturePerformanceMetric?.({ ...state, documentUrl: location.href }) }
		for (const [fn, key] of [['onLCP', 'lcp'], ['onCLS', 'cls'], ['onINP', 'inp'], ['onFCP', 'fcp'], ['onTTFB', 'ttfb']]) {
			window.webVitals[fn](metric => { state[key] = metric.value; notify() }, { reportAllChanges: true })
		}
		if (PerformanceObserver.supportedEntryTypes.includes('longtask')) {
			state.observedLongTaskBlockingMs = 0
			new PerformanceObserver(list => {
				for (const entry of list.getEntries()) state.observedLongTaskBlockingMs += Math.max(0, entry.duration - 50)
				notify()
			}).observe({ type: 'longtask', buffered: true })
		}
		const capture = async body => {
			try {
				const raw = typeof body === 'string' ? body : await body?.text?.()
				const metric = JSON.parse(raw)
				if (typeof metric.name === 'string' && typeof metric.value === 'number') {
					state.ready[metric.name] = metric.value
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
	await page.addInitScript({ content: `${vitalsSource}\n;(${initialize.toString()})(${JSON.stringify(alias)})` })
}

export async function throttleProfile(page, profile) {
	if (profile.name !== 'mobile') return
	const cdp = await page.context().newCDPSession(page)
	await cdp.send('Network.enable')
	await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8, connectionType: 'cellular4g' })
	await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
}

export function readyMetricFor(url) {
	const parsed = new URL(url)
	const pathname = parsed.pathname
	if (pathname.includes('/explore/player-stats')) return parsed.searchParams.has('p2') ? 'PLAYER_COMPARE_PAINT' : parsed.searchParams.has('p1') ? 'PLAYER_DETAIL_PAINT' : 'PLAYER_DIRECTORY_PAINT'
	if (pathname.includes('/explore/fixtures')) return 'FIXTURES_WINDOW_READY'
	if (pathname.includes('/explore/gameweek')) return 'GAMEWEEK_CONTENT_READY'
	if (pathname.includes('/explore/market')) return 'MARKET_CONTENT_READY'
	if (pathname.includes('/explore/selections')) return 'TRENDS_DESK_READY'
	if (pathname.includes('/live/competitions')) return 'LIVE_COMPETITION_BOARD_READY'
	if (pathname.endsWith('/competitions/browse')) return 'COMPETITIONS_BROWSE_READY'
	if (pathname.endsWith('/competitions/create')) return 'COMPETITIONS_CREATE_READY'
	if (/\/competitions\/\d+\/manage$/.test(pathname)) return 'COMPETITIONS_MANAGE_READY'
	if (pathname.includes('/price-predictions')) return null
	return 'HOME_MARKET_READY'
}

/** A dedicated navigation, without clicks. Page hide finalizes web-vitals. */
export async function measureNavigation(browser, profile, url, options = {}) {
	const ownContext = !options.context
	const context = options.context ?? await browser.newContext({ viewport: profile.viewport, storageState: options.storageState })
	if (options.prepareContext) await options.prepareContext(context)
	const page = await context.newPage()
	page.setDefaultTimeout(30_000)
	let latest = {}
	await page.exposeBinding('__capturePerformanceMetric', (_, metric) => { if (metric.documentUrl !== 'about:blank') latest = metric })
	await installVitals(page)
	await throttleProfile(page, profile)
	const errors = []
	page.on('pageerror', error => errors.push(error.message))
	const requests = []
	page.on('requestfinished', request => {
		requests.push({ path: new URL(request.url()).pathname, type: request.resourceType(), method: request.method(), timing: request.timing() })
	})
	const sample = { ...performanceMetadata(), browserVersion: browser.version(), profile: profile.name, viewport: profile.viewport, cpuRate: profile.name === 'mobile' ? 4 : 1, network: profile.name === 'mobile' ? '150ms RTT / 1.6Mbps down / 750Kbps up' : 'unthrottled', browserCache: options.browserCache ?? 'cold', serverCache: options.serverCache ?? 'uncontrolled', url: String(url), phase: 'navigation', status: null, readyMs: null, lcpMs: null, cls: null, inpMs: null, fcpMs: null, ttfbMs: null, htmlResponseMs: null, observedLongTaskBlockingMs: null, error: null }
	let timer
	try {
		await Promise.race([
			(async () => {
				const target = new URL(url)
				target.searchParams.set('_perfSource', 'synthetic')
				const response = await page.goto(target.href, { waitUntil: 'commit' })
				sample.status = response?.status() ?? null
				sample.releaseSha = response?.headers()['x-letletme-release'] ?? null
				sample.origin = response?.headers()['x-letletme-origin'] ?? null
				const actual = new URL(page.url())
				if (sample.status !== 200 || actual.pathname !== target.pathname || (target.searchParams.has('tournamentId') && actual.searchParams.get('tournamentId') !== target.searchParams.get('tournamentId'))) throw new Error('Unexpected response or redirect')
				const metric = options.readyMetric ?? readyMetricFor(url)
				if (metric) {
					await page.waitForFunction(name => typeof window.__performanceMetrics?.ready?.[name] === 'number', metric)
					sample.readyMs = await page.evaluate(name => window.__performanceMetrics.ready[name], metric)
				} else {
					await page.locator('[data-letletme-contract="price_changes"][data-status="READY"]').waitFor({ state: 'attached' })
					await page.locator('#price-change-search').waitFor({ state: 'visible' })
					sample.readyMs = await page.evaluate(() => performance.now())
				}
				if (target.pathname.endsWith('/live/competitions') && options.requireCompetitionMarker !== false) {
					await page.locator(`[data-competition-perf-ready="detail"][data-competition-tournament-id="${target.searchParams.get('tournamentId')}"]`).waitFor({ state: 'visible' })
				}
				await page.waitForTimeout(5_000)
				const details = await page.evaluate(() => {
					const nav = performance.getEntriesByType('navigation')[0]
					return { endMs: performance.now(), htmlResponseMs: nav?.responseEnd || null, loadMs: nav?.loadEventEnd || null, horizontalOverflow: document.documentElement.scrollWidth > innerWidth, resources: performance.getEntriesByType('resource').map(r => ({ path: new URL(r.name).pathname, initiatorType: r.initiatorType, startTime: r.startTime, responseEnd: r.responseEnd, transferSize: r.transferSize, encodedBodySize: r.encodedBodySize, decodedBodySize: r.decodedBodySize })), metrics: window.__performanceMetrics }
				})
				latest = details.metrics
				delete details.metrics
				Object.assign(sample, details)
				if (options.screenshot) await page.screenshot({ path: options.screenshot, fullPage: true })
				await page.goto('about:blank', { waitUntil: 'commit' })
			})(),
			new Promise((_, reject) => { timer = setTimeout(() => { void page.close(); reject(new Error('Navigation observation exceeded 30000ms')) }, 30_000) })
		])
	} catch (error) {
		sample.error = error.message
	} finally {
		clearTimeout(timer)
		await page.close().catch(() => {})
		if (ownContext) await context.close()
	}
	Object.assign(sample, { lcpMs: latest.lcp ?? null, cls: latest.cls ?? null, inpMs: latest.inp ?? null, fcpMs: latest.fcp ?? null, ttfbMs: latest.ttfb ?? null, observedLongTaskBlockingMs: latest.observedLongTaskBlockingMs ?? null, businessMetrics: latest.ready ?? {}, requests, errors })
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
	const browser = await chromium.launch()
	const samples = []
	try {
		for (const profile of performanceProfiles) for (const url of urls) {
			for (let i = 0; i < runs; i++) {
				const context = await browser.newContext({ viewport: profile.viewport, storageState: process.env.PERF_STORAGE_STATE })
				try {
					for (const browserCache of ['cold', 'warm']) samples.push(await measureNavigation(browser, profile, url, { context, browserCache }))
				} finally { await context.close() }
			}
		}
	} finally { await browser.close() }
	console.log(JSON.stringify({ ...performanceMetadata(), samples }, null, 2))
}
