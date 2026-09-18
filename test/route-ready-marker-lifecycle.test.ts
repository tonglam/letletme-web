import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { it } from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

// Execute the actual component effect with deferred paint observations. Hook
// state persists across renders, and cleanup runs before the next effect.
function harness(kind: 'initial_navigation' | 'in_page_navigation') {
 const refs: { current: unknown }[] = []
 const paints: ((value: number) => void)[] = []
 const reports: { result: string }[] = []
 let cursor = 0
 let effect: (() => (() => void) | undefined) | undefined
 let cleanup: (() => void) | undefined
 const exports: Record<string, (props: Record<string, unknown>) => void> = {}
 const code = ts.transpileModule(readFileSync('components/analytics/RouteReadyMarker.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
 }).outputText
 runInNewContext(code, {
  exports, performance: { now: () => 100 }, crypto: { randomUUID: () => 'fixture' },
  require(name: string) {
   if (name === 'react') return {
    useRef(value: unknown) { const index = cursor++; return refs[index] ?? (refs[index] = { current: value }) },
    useEffect(callback: typeof effect) { effect = callback }
   }
   if (name === 'next/navigation') return { usePathname: () => '/data/players' }
   if (name.endsWith('/client-vitals')) return { reportBrowserPerformanceMetric: (value: { result: string }) => reports.push(value) }
   if (name.endsWith('/web-vitals')) return { normalizeMetricPage: (value: string) => value }
   if (name.endsWith('/route-navigation')) return {
    routeReadyStartTime: () => 10, routeReadyMeasurementKind: () => kind,
    observeElementPaintTime: () => new Promise<number>(resolve => paints.push(resolve)),
    nextPaintOpportunityTime: async () => 110,
    measureRouteReadyDuration: (_path: string, end: number) => end - 10,
    clearRouteReadyStart() {}
   }
   throw new Error(`Unexpected import: ${name}`)
  }
 })
 return {
  paints, reports,
  render(key: string) {
   cleanup?.(); cursor = 0
   exports.RouteReadyMarker({ name: 'PLAYER_DIRECTORY_PAINT', readyKey: key, elementTiming: 'players', audienceHint: 'public' })
   cleanup = effect?.()
  }
 }
}

for (const kind of ['initial_navigation', 'in_page_navigation'] as const) {
 it(`${kind}: canceled paint does not consume the clock of its replacement`, async () => {
  const h = harness(kind)
  h.render('revision-A')
  h.render('revision-B')
  assert.equal(h.paints.length, 2, 'replacement must still observe paint')
  h.paints[0](120)
  await new Promise<void>(resolve => setImmediate(resolve))
  assert.equal(h.reports.length, 0, 'canceled revision must not report')
  h.paints[1](130)
  await new Promise<void>(resolve => setImmediate(resolve))
  assert.equal(h.reports.length, 1)
  assert.equal(h.reports[0].result, 'ok')
  h.render('revision-C')
  assert.equal(h.paints.length, 2, 'completed navigation must not be counted again')
 })
}
