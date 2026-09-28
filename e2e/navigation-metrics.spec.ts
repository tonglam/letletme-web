import { expect, test } from '@playwright/test'

type Sample = { metricName: string; measurementKind: string; result: string; value?: number; navigationId?: string }

for (const { locale, width, directed } of [
 ...['en', 'zh-CN'].flatMap(locale => [1440, 390].map(width => ({ locale, width, directed: false }))),
 { locale: 'zh-CN', width: 390, directed: true }
]) {
 test.describe(directed ? 'C14 directed dark UTC' : `C14 ${locale} ${width}`, () => {
  test.use({ timezoneId: directed ? 'UTC' : 'Australia/Perth' })
		test(`C14 actual navigation clocks ${locale} ${width}px`, async ({ page }, testInfo) => {
			test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Dedicated SSR fixture suite only')
			const zh = locale === 'zh-CN'
			const prefix = zh ? '/zh-CN' : ''
			const samples: Sample[] = []
   const observedNavigationIds = new Set<string>()
   if (directed) await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
			await page.setViewportSize({ width, height: 900 })
			await page.route('**/api/vitals', async route => {
				samples.push(...(route.request().postDataJSON().samples ?? []))
				await route.fulfill({ status: 204, body: '' })
			})
			const assertMetric = async (name: string, kind: string, after: number) => {
				await expect.poll(() => samples.slice(after).filter(s => s.metricName === name).length).toBeGreaterThan(0)
				const sample = samples.slice(after).find(s => s.metricName === name)!
				expect(sample.result).toBe('ok')
				expect(sample.measurementKind).toBe(kind)
				expect(Number.isFinite(sample.value)).toBe(true)
				expect(sample.value!).toBeGreaterThanOrEqual(0)
    expect(sample.navigationId).toMatch(/^nav-[A-Za-z0-9_-]{8,52}$/)
    // Directory IDs correlate server seeds and may survive router-cache restores.
    if (name === 'MARKET_CONTENT_READY') expect(observedNavigationIds.has(sample.navigationId!)).toBe(false)
    observedNavigationIds.add(sample.navigationId!)
			}
			await page.goto(`${prefix}/explore/market`)
			await expect(page.getByRole('heading', { name: zh ? '市场' : 'Market', exact: true })).toBeVisible()
			await expect(page.getByRole('region', { name: zh ? '持有率变化' : 'Ownership change', exact: true })).toContainText('Saka')
			await assertMetric('MARKET_CONTENT_READY', 'initial_navigation', 0)
			let before = samples.length
			await page.getByRole('contentinfo').getByRole('link', { name: zh ? '球员' : 'Players', exact: true }).click()
			await expect(page).toHaveURL(url => url.pathname === `${prefix}/explore/player-stats`)
			await expect(page.getByRole('region', { name: zh ? '球员' : 'Players', exact: true })).toContainText('Saka')
			await assertMetric('PLAYER_DIRECTORY_PAINT', 'in_page_navigation', before)
			before = samples.length
			await page.goBack()
			await expect(page).toHaveURL(url => url.pathname === `${prefix}/explore/market`)
			await expect(page.getByRole('heading', { name: zh ? '市场' : 'Market', exact: true })).toBeVisible()
			await expect(page.getByRole('region', { name: zh ? '持有率变化' : 'Ownership change', exact: true })).toContainText('Saka')
			await assertMetric('MARKET_CONTENT_READY', 'in_page_navigation', before)
			before = samples.length
			await page.goForward()
			await expect(page).toHaveURL(url => url.pathname === `${prefix}/explore/player-stats`)
			await expect(page.getByRole('region', { name: zh ? '球员' : 'Players', exact: true })).toContainText('Saka')
			await assertMetric('PLAYER_DIRECTORY_PAINT', 'in_page_navigation', before)
   if (directed) await expect(page.locator('html')).toHaveClass(/dark/)
   expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(directed ? 'UTC' : 'Australia/Perth')
			await testInfo.attach('navigation-metric-samples', {
				body: JSON.stringify({ caseId: 'C14', variantIds: directed ? ['C14.directed.09', 'C14.directed.10', 'C14.directed.11'] : [`C14.A.${locale}.${width === 1440 ? 'desktop1440' : 'mobile390'}.base`], locale, viewport: { width, height: 900 }, theme: directed ? 'dark' : 'system', timezone: directed ? 'UTC' : 'Australia/Perth', environment: 'isolated-fixture', samples, observedNavigationIds: Array.from(observedNavigationIds), wholeVariantComplete: false }, null, 2),
				contentType: 'application/json'
			})
		})
 })
}
