import { installVitals, measureNavigation, performanceMetadata, distribution } from './performance-metrics.mjs'
import { chromium } from '@playwright/test'

const origin = process.env.COMPETITIONS_PERF_ORIGIN ?? 'https://letletme.top'
const locale = process.env.COMPETITIONS_PERF_LOCALE ?? 'zh-CN'
const runsInput = process.env.COMPETITIONS_PERF_RUNS ?? '3'
const parsedRuns = Number(runsInput)
if (
	!/^[1-9]\d*$/.test(runsInput) ||
	!Number.isSafeInteger(parsedRuns) ||
	parsedRuns < 1
) {
	throw new Error('COMPETITIONS_PERF_RUNS must be a positive integer')
}
const runs = Math.min(20, parsedRuns)
const tournamentId = process.env.COMPETITIONS_PERF_TOURNAMENT_ID
if (!/^[1-9]\d*$/.test(tournamentId ?? '')) {
	throw new Error(
		'COMPETITIONS_PERF_TOURNAMENT_ID is required for authenticated measurements'
	)
}
const storageState = process.env.COMPETITIONS_PERF_STORAGE_STATE
// Authenticated competition routes must never silently measure the login page.
if (!storageState) {
	throw new Error(
		'COMPETITIONS_PERF_STORAGE_STATE is required for authenticated measurements'
	)
}
const paths = [
	'/competitions/browse',
	'/competitions/create',
	`/competitions/${tournamentId}/manage`,
	`/live/competitions?tournamentId=${tournamentId}`
]

function readySelector(path) {
	if (path === '/competitions/browse')
		return '[data-competition-perf-ready="browse"]'
	if (path === '/competitions/create')
		return '[data-competition-perf-ready="create"]'
	if (path.endsWith('/manage'))
		return `[data-competition-perf-ready="manage"][data-competition-tournament-id="${tournamentId}"]`
	return `[data-competition-perf-ready="detail"][data-competition-tournament-id="${tournamentId}"]`
}


async function measure(browser, path, index) {
	const context = await browser.newContext({
		viewport: { width: 390, height: 844 },
		storageState
	})
	const page = await context.newPage()
	await installVitals(page, '__competitionPerf')
	const requests = []
	page.on('request', request =>
		requests.push({
			url: request.url(),
			method: request.method(),
			resourceType: request.resourceType()
		})
	)
	const url = new URL(`${origin}/${locale}${path}`)
	url.searchParams.set('_competitionsPerf', `${path}-${index}-${Date.now()}`)
	url.searchParams.set('_perfSource', 'synthetic')
	const navigation = await measureNavigation(browser, { name: 'mobile', viewport: { width: 390, height: 844 } }, url.toString(), { storageState })
	const response = await page.goto(url.toString(), { waitUntil: 'load' })
	const expected = new URL(`${origin}/${locale}${path}`)
	const actual = new URL(page.url())
	if (actual.origin !== expected.origin || actual.pathname !== expected.pathname || (expected.searchParams.has('tournamentId') && actual.searchParams.get('tournamentId') !== tournamentId)) {
		throw new Error(
			`Authenticated measurement was redirected away from ${path}: ${page.url()}`
		)
	}
	const ready = page.locator(readySelector(path))
	await ready.waitFor({ state: 'visible', timeout: 30_000 })
	if ((await ready.count()) !== 1) {
		throw new Error(
			`Authenticated measurement did not load the expected competition state for ${path}`
		)
	}
	await page.waitForTimeout(500)
	const metrics = await page.evaluate(() => {
		const navigation = performance.getEntriesByType('navigation')[0]
		return {
			lcp: window.__competitionPerf.lcp,
			cls: window.__competitionPerf.cls,
			phase: 'interaction',
			inpMs: window.__competitionPerf?.inp ?? null,
			fcpMs: window.__competitionPerf?.fcp ?? null,
			observationInterval: { startMs: 0, endMs: performance.now() },
			observedLongTaskBlockingMs: window.__competitionPerf?.observedLongTaskBlockingMs ?? null,
			ttfb: navigation?.responseStart ?? null,
			html: navigation?.responseEnd ?? null,
			overflow: document.documentElement.scrollWidth > innerWidth
		}
	})
	const result = {
		path,
		navigation,
		status: response?.status() ?? 0,
		...metrics,
		initialRequests: requests.filter(
			request => !request.url.includes('_next/static')
		).length,
		rscPrefetches: requests.filter(
			request =>
				request.url.includes('/_rsc') || request.url.includes('__next_rsc__')
		).length,
		playerStatsPrefetches: requests.filter(request =>
			request.url.includes('/explore/player-stats')
		).length,
		requests: requests
			.map(request => request.url)
			.filter(url => url.includes('/api/') || url.includes('/graphql'))
	}
	await context.close()
	return result
}

const browser = await chromium.launch({ headless: true })
const measurements = {}
try {
	for (const path of paths) {
		measurements[path] = []
		for (let index = 0; index < runs; index += 1)
			measurements[path].push(await measure(browser, path, index))
	}
} finally {
	await browser.close()
}

const summary = Object.fromEntries(
	Object.entries(measurements).map(([path, values]) => [
		path,
		{
			runs: values.length,
			status200: values.every(value => value.status === 200),
			lcpMs: distribution(values.map(value => value.navigation), 'lcpMs'),
			ttfbMs: distribution(values.map(value => value.navigation), 'ttfbMs'),
			htmlResponseMs: distribution(values.map(value => value.navigation), 'htmlResponseMs'),
			observedLongTaskBlockingMs: distribution(values.map(value => value.navigation), 'observedLongTaskBlockingMs'),
			cls: distribution(values.map(value => value.navigation), 'cls'),
			initialRequests: values.map(value => value.initialRequests),
			rscPrefetches: values.map(value => value.rscPrefetches),
			playerStatsPrefetches: values.map(value => value.playerStatsPrefetches),
			overflow: values.some(value => value.overflow)
		}
	])
)

console.log(
	JSON.stringify(
		{
			...performanceMetadata(),
			origin,
			locale,
			summary,
			raw: measurements
		},
		null,
		2
	)
)
