import { expect, test } from '@playwright/test'

type Sample = { metricName: string; measurementKind: string; result: string; value?: number }

for (const locale of ['en', 'zh-CN']) {
	for (const width of [1440, 390]) {
		test(`C14 actual navigation clocks ${locale} ${width}px`, async ({ page }) => {
			test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Dedicated SSR fixture suite only')
			const zh = locale === 'zh-CN'
			const prefix = zh ? '/zh-CN' : ''
			const samples: Sample[] = []
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
			await expect(page.getByRole('region', { name: zh ? '球员' : 'Players', exact: true })).toContainText('Saka')
			await assertMetric('PLAYER_DIRECTORY_PAINT', 'in_page_navigation', before)
		})
	}
}
