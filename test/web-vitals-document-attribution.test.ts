import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { it } from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

type Metric = { name: string; value: number; delta: number; rating: string; id: string }
type Report = { name: string; page: string; navigationId?: string; value: number }
type Listener = (event: { persisted: boolean }) => void

function harness() {
	const hooks: { current?: unknown; deps?: unknown[]; callback?: unknown; cleanup?: () => void }[] = []
	const effects: (() => void)[] = []
	const listeners = new Map<string, Set<Listener>>()
	const reports: Report[] = []
	const location = { pathname: '/live/matches' }
	let cursor = 0
	let callback: (metric: Metric) => void
	const exports: { WebVitalsReporter?: () => void } = {}
	const changed = (a?: unknown[], b?: unknown[]) => !a || !b || a.length !== b.length || a.some((v, i) => !Object.is(v, b[i]))
	const code = ts.transpileModule(readFileSync('components/analytics/WebVitalsReporter.tsx', 'utf8'), {
		compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
	}).outputText
	runInNewContext(code, {
		exports,
		document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} },
		window: {
			location,
			addEventListener(name: string, listener: Listener) {
				if (!listeners.has(name)) listeners.set(name, new Set())
				listeners.get(name)!.add(listener)
			},
			removeEventListener(name: string, listener: Listener) { listeners.get(name)?.delete(listener) }
		},
		require(name: string) {
			if (name === 'react') return {
				useRef(value: unknown) { const i = cursor++; return hooks[i] ?? (hooks[i] = { current: value }) },
				useCallback(fn: unknown, deps: unknown[]) {
					const i = cursor++
					if (!hooks[i] || changed(hooks[i].deps, deps)) hooks[i] = { callback: fn, deps }
					return hooks[i].callback
				},
				useEffect(fn: () => (() => void) | void, deps?: unknown[]) {
					const i = cursor++
					if (!hooks[i] || changed(hooks[i].deps, deps)) effects.push(() => {
						hooks[i]?.cleanup?.()
						hooks[i] = { deps, cleanup: fn() || undefined }
					})
				}
			}
			if (name === 'next/navigation') return { usePathname: () => location.pathname }
			if (name === 'next/web-vitals') return { useReportWebVitals(fn: typeof callback) { callback = fn } }
			if (name.endsWith('/client-vitals')) return {
				reportBrowserPerformanceMetric: (metric: Report) => reports.push(metric),
				reportBrowserRuntimeError() {}, resolveAudienceHint: () => 'public',
				resolveNavigationId: () => 'current-player-navigation'
			}
			if (name.endsWith('/web-vitals')) return { normalizeMetricPage: (path: string) => path.replace(/^\/zh-CN(?=\/)/, '') }
			if (name.endsWith('/route-navigation')) return { markBackgroundResumeStart() {} }
			throw new Error(`Unexpected import: ${name}`)
		}
	})
	return {
		reports,
		render(path: string) { location.pathname = path; cursor = 0; exports.WebVitalsReporter!(); effects.splice(0).forEach(fn => fn()) },
		pageshow(persisted: boolean) { listeners.get('pageshow')?.forEach(fn => fn({ persisted })) },
		report(name: string) { callback({ name, value: 123, delta: 123, rating: 'good', id: `document-${name}` }) },
		unmount() { hooks.forEach(hook => hook.cleanup?.()) },
		listenerCount: () => listeners.get('pageshow')?.size ?? 0
	}
}

it('delayed document vitals retain the initial page after SPA navigation without borrowing a route navigation ID', () => {
	const h = harness()
	h.render('/live/matches')
	h.render('/explore/player-stats')
	for (const name of ['LCP', 'INP', 'CLS']) h.report(name)
	assert.equal(h.reports.length, 3)
	for (const report of h.reports) {
		assert.equal(report.page, '/live/matches')
		assert.equal(report.navigationId, undefined)
		assert.equal(report.value, 123)
	}
})

it('BFCache restore starts attribution at the restored URL and subsequent SPA navigation preserves it', () => {
	const h = harness()
	h.render('/live/matches')
	h.render('/zh-CN/explore/player-stats')
	h.pageshow(false)
	h.report('LCP')
	assert.equal(h.reports[0].page, '/live/matches')
	h.pageshow(true)
	h.render('/explore/fixtures')
	for (const name of ['LCP', 'INP', 'CLS']) h.report(name)
	for (const report of h.reports.slice(1)) assert.equal(report.page, '/explore/player-stats')
	assert.equal(h.listenerCount(), 1)
	h.unmount()
	assert.equal(h.listenerCount(), 0)
})
