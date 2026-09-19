import { expect, test } from '@playwright/test'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
// Preserve the existing ESM collector through Playwright's CommonJS test transform.
const loadCollector = new Function('url', 'return import(url)') as (url: string) => Promise<{ installVitals: (page: unknown) => Promise<void> }>

test.describe('Briefing state observation', () => {
 test.describe.configure({ mode: 'serial' })
 test.use({ viewport: { width: 390, height: 900 }, timezoneId: 'UTC', colorScheme: 'dark' })
 test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.BRIEFING_PUBLIC_ENABLED !== 'true', 'Isolated enabled fixture only')
 const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
 test.afterEach(async () => { expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ reset: true, rules: [] }) })).ok).toBe(true) })
 for (const [variantId, state, title, description] of [['BRIEF02.state.01', 'READY', '本周还没有资讯', '编辑台还没有发布本周期次。'], ['BRIEF02.state.02', 'STALE', '这一期已经过期', '截止时间窗口已经结束，编辑台正在等待下一期经过核验的资讯。']] as const) {
  test(`${variantId} records errors, upstream reads and observed vitals`, async ({ page }, testInfo) => {
   const errors: string[] = []
   page.on('pageerror', error => errors.push(error.message))
   const { installVitals } = await loadCollector(pathToFileURL(path.join(process.cwd(), 'scripts/performance-metrics.mjs')).href)
   await installVitals(page)
   await page.addInitScript(({ expectedTitle, expectedDescription }) => {
    const state = window as unknown as { __briefingStateReadyMs: number | null }
    state.__briefingStateReadyMs = null
    const check = () => {
     const panel = document.querySelector('main section[role="status"]')
     if (state.__briefingStateReadyMs !== null || location.pathname !== '/zh-CN/briefing/week' || document.readyState === 'loading') return
     if (!document.documentElement.classList.contains('dark') || panel?.querySelector('h1')?.textContent?.trim() !== expectedTitle) return
     const paragraphs = panel.querySelectorAll('p')
     if (paragraphs.length < 2 || paragraphs[1].textContent?.trim() !== expectedDescription || document.querySelector('main article, main [aria-busy="true"]')) return
     state.__briefingStateReadyMs = performance.now()
     observer.disconnect()
    }
    const observer = new MutationObserver(check)
    observer.observe(document, { subtree: true, childList: true, characterData: true, attributes: true })
    document.addEventListener('DOMContentLoaded', check, { once: true })
    check()
   }, { expectedTitle: title, expectedDescription: description })
   expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ reset: true, rules: [{ operation: 'BriefingWeek', variables: { locale: 'ZH_CN' }, data: { briefingWeek: { state, revision: 11, publicationId: 'briefing-metrics', publishedAt: null, sourceCheckedAt: null, staleAt: null, event: null, featured: [], sections: [] } } }] }) })).ok).toBe(true)
   const response = await page.goto('/zh-CN/briefing/week')
   expect(response?.status()).toBe(200)
   await expect(page).toHaveURL(/\/zh-CN\/briefing\/week$/)
   await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible()
   await expect(page.getByText(description, { exact: true })).toBeVisible()
   await expect(page.locator('html')).toHaveClass(/\bdark\b/)
   await expect(page.locator('main article')).toHaveCount(0)
   await expect.poll(() => page.evaluate(() => (window as unknown as { __briefingStateReadyMs: number | null }).__briefingStateReadyMs)).not.toBeNull()
   const observations = await (await fetch(fixture)).json()
   const counts: Record<string, number> = {}
   for (const request of observations.requests) counts[request.operation] = (counts[request.operation] ?? 0) + 1
   expect(counts.BriefingWeek).toBeGreaterThan(0)
   const observed = await page.evaluate(() => {
    const metrics = (window as unknown as { __performanceMetrics: { cls: number | null; fcp: number | null; ttfb: number | null } }).__performanceMetrics
    return { readyMs: (window as unknown as { __briefingStateReadyMs: number | null }).__briefingStateReadyMs, cls: metrics.cls, fcpMs: metrics.fcp, ttfbMs: metrics.ttfb, observationEndMs: performance.now(), viewport: innerWidth, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }
   })
   expect(errors).toEqual([])
   expect(observed.viewport).toBe(390)
   expect(observed.timezone).toBe('UTC')
   await testInfo.attach(`${variantId}-metrics`, { body: JSON.stringify({ variantId, environment: 'isolated-fixture', fixtureRevision: 11, requestCounts: counts, runtimeErrors: errors, ...observed, readyMetricKind: 'business_dom_observed', eventToPaintMs: null, budgetMs: 2500, performanceStatus: 'NOT_OBSERVED', readyPerformanceStatus: observed.readyMs === null ? 'NOT_OBSERVED' : observed.readyMs <= 2500 ? 'PASS' : 'FAIL', limitation: 'CLS is observed only through observationEndMs, not final session CLS. Ready clock is first full state DOM observation after DOMContentLoaded/theme resolution, not physical paint; event-to-paint remains missing. State samples excluded from normal performance distributions.' }), contentType: 'application/json' })
  })
 }
})
