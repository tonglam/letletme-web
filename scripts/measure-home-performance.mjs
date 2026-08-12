import { chromium } from '@playwright/test'

const baseUrl = process.env.HOME_PERF_URL ?? 'https://letletme.top/'
const runCount = Number.parseInt(process.env.HOME_PERF_RUNS ?? '10', 10)
const concurrency = Number.parseInt(
	process.env.HOME_PERF_CONCURRENCY ?? '20',
	10
)

if (!Number.isInteger(runCount) || runCount < 1 || runCount > 50) {
	throw new Error('HOME_PERF_RUNS must be an integer from 1 through 50')
}
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 50) {
	throw new Error('HOME_PERF_CONCURRENCY must be an integer from 1 through 50')
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
	return Number(ordered[index].toFixed(2))
}

function summarize(runs) {
	const field = name => runs.map(run => run[name])
	return {
		runs: runs.length,
		status200: runs.every(run => run.status === 200),
		lcpMs: {
			p50: percentile(field('lcpMs'), 50),
			p95: percentile(field('lcpMs'), 95)
		},
		cls: {
			p50: percentile(field('cls'), 50),
			p95: percentile(field('cls'), 95)
		},
		loadMs: {
			p50: percentile(field('loadMs'), 50),
			p95: percentile(field('loadMs'), 95)
		},
		ttfbMs: {
			p50: percentile(field('ttfbMs'), 50),
			p95: percentile(field('ttfbMs'), 95)
		},
		horizontalOverflow: runs.some(run => run.horizontalOverflow)
	}
}

const browser = await chromium.launch({ headless: true })
const measurements = {}
try {
	for (const profile of profiles) {
		const runs = []
		for (let index = 0; index < runCount; index += 1) {
			const context = await browser.newContext({ viewport: profile.viewport })
			const page = await context.newPage()
			await page.addInitScript(() => {
				window.__homePerformance = { cls: 0, lcp: 0 }
				new PerformanceObserver(list => {
					for (const entry of list.getEntries()) {
						window.__homePerformance.lcp = entry.startTime
					}
				}).observe({ type: 'largest-contentful-paint', buffered: true })
				new PerformanceObserver(list => {
					for (const entry of list.getEntries()) {
						if (!entry.hadRecentInput) {
							window.__homePerformance.cls += entry.value
						}
					}
				}).observe({ type: 'layout-shift', buffered: true })
			})
			const response = await page.goto(
				`${baseUrl}${baseUrl.includes('?') ? '&' : '?'}cold=${profile.name}-${index}`,
				{ waitUntil: 'load' }
			)
			await page.waitForTimeout(500)
			const browserMetrics = await page.evaluate(() => {
				const navigation = performance.getEntriesByType('navigation')[0]
				return {
					lcpMs: window.__homePerformance?.lcp ?? 0,
					cls: window.__homePerformance?.cls ?? 0,
					loadMs: navigation?.loadEventEnd ?? 0,
					ttfbMs: navigation?.responseStart ?? 0,
					horizontalOverflow:
						document.documentElement.scrollWidth > window.innerWidth
				}
			})
			runs.push({ status: response?.status() ?? 0, ...browserMetrics })
			await context.close()
		}
		measurements[profile.name] = summarize(runs)
	}
} finally {
	await browser.close()
}

const concurrentStartedAt = performance.now()
const concurrentResponses = await Promise.all(
	Array.from({ length: concurrency }, (_, index) =>
		fetch(
			`${baseUrl}${baseUrl.includes('?') ? '&' : '?'}concurrency=${index}`,
			{ headers: { Accept: 'text/html' }, cache: 'no-store' }
		)
	)
)

console.log(
	JSON.stringify(
		{
			url: new URL(baseUrl).origin,
			measuredAt: new Date().toISOString(),
			coldLoads: measurements,
			concurrency: {
				requests: concurrency,
				status200: concurrentResponses.filter(
					response => response.status === 200
				).length,
				totalMs: Number((performance.now() - concurrentStartedAt).toFixed(2))
			}
		},
		null,
		2
	)
)
