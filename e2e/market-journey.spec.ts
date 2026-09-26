import { expect, test } from '@playwright/test'

const variants = [
 { id: 'J02.state.01', locale: 'zh-CN', width: 390, theme: 'dark', timezone: 'UTC', scenario: 'ready' },
 ...['en', 'zh-CN'].flatMap(locale => [1440, 390].map(width => ({
  id: `J02.A.${locale}.${width === 1440 ? 'desktop1440' : 'mobile390'}.base`, locale, width, theme: 'system', timezone: 'Australia/Perth', scenario: 'baseline'
 })))
]

for (const variant of variants) {
test.describe(`J02 planned market journey ${variant.id}`, () => {
 const { locale, width, theme, timezone, scenario } = variant
 const zh = locale === 'zh-CN'
 const prefix = zh ? '/zh-CN' : ''
 const labels = {
  period: zh ? '持有率比较周期' : 'Ownership comparison period',
  daily: zh ? '每日' : 'Daily', gameweek: zh ? 'GW 比较' : 'GW comparison',
  dates: zh ? '每日快照日期' : 'Daily snapshot dates',
  search: zh ? '按姓名搜索球员' : 'Search players by name',
  results: zh ? '球员搜索结果' : 'Player search results',
  history: zh ? '历史' : 'History', priceHistory: zh ? 'Saka 的身价历史' : 'Price history for Saka',
  choose: zh ? '选择其他球员' : 'Choose another player',
  overall: zh ? '球员总览' : 'Player overall'
 }
 test.use({ viewport: { width, height: 900 }, colorScheme: theme === 'dark' ? 'dark' : 'light', timezoneId: timezone, locale })
 test('actual links preserve historical date and player identity', async ({ page, context }, testInfo) => {
		test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Only the isolated fixture supports this planned scenario')
		await page.addInitScript(theme => localStorage.setItem('theme', theme), theme)
		expect((await context.cookies()).filter(cookie => /session/i.test(cookie.name))).toHaveLength(0)
		const historyRequests: number[] = []
		await page.route('**/api/graphql', async route => {
			const body = route.request().postDataJSON()
			if (!body?.query?.includes('query GetPlayerValueHistory(')) return route.continue()
			const playerId = Number(body.variables.playerId)
			historyRequests.push(playerId)
			await route.fulfill({ json: { data: { playerValueHistory: [{ playerId, changeDate: '2026-08-03', oldValue: 99, newValue: 100, changeType: 'RISE', transfersIn: null, transfersOut: null }] } } })
		})
		await page.goto(prefix || '/')
		await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /light/)
		expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(timezone)
		const homeMarket = page.locator('[data-home-carousel="home-market"]')
		await expect(homeMarket).toContainText('Saka')
		const marketLink = homeMarket.locator(`a[href="${prefix}/explore/market"]:visible`)
		await expect(marketLink).toHaveCount(1)
		await marketLink.click()
		await expect(page).toHaveURL(new RegExp(`${prefix}/explore/market$`))
		await expect(page.locator('#market-most-selected-share li')).toHaveCount(4)
		const periods = page.getByRole('navigation', { name: labels.period, exact: true })
		await periods.getByRole('link', { name: labels.gameweek, exact: true }).click()
		await expect(page).toHaveURL(/period=GAMEWEEK/)
		await expect(periods.getByRole('link', { name: labels.gameweek, exact: true })).toHaveAttribute('aria-current', 'page')
		await expect(page.locator('#market-ownership-share')).toContainText('GW2')
		await periods.getByRole('link', { name: labels.daily, exact: true }).click()
		await expect(page).toHaveURL(/period=DAILY/)
		const historicalDate = page.getByRole('navigation', { name: labels.dates, exact: true }).locator('a[href*="date=2026-08-02"]')
		await expect(historicalDate).toHaveCount(1)
		await historicalDate.click()
		await expect(page).toHaveURL(/period=DAILY&date=2026-08-02/)
		await expect(historicalDate).toHaveAttribute('aria-current', 'date')
		await expect(page.locator('#market-ownership-share')).toContainText('Saka')
		const marketUrl = page.url()
		await page.getByRole('searchbox', { name: labels.search, exact: true }).fill('Sa')
		const saka = page.getByRole('list', { name: labels.results, exact: true }).getByRole('listitem').filter({ has: page.getByRole('link', { name: 'Saka', exact: true }) })
		await expect(saka).toHaveCount(1)
		await saka.getByRole('button', { name: labels.history, exact: true }).click()
		await expect(page.getByRole('heading', { level: 3, name: 'Saka', exact: true })).toBeVisible()
		await expect(page.getByRole('list', { name: labels.priceHistory, exact: true })).toContainText('£9.9m → £10.0m')
		await page.getByRole('button', { name: labels.choose, exact: true }).click()
		await page.getByRole('searchbox', { name: labels.search, exact: true }).fill('Sa')
		await saka.getByRole('link', { name: 'Saka', exact: true }).click()
		await expect(page).toHaveURL(new RegExp(`${prefix}/explore/player-stats\\?p1=1$`))
		await expect(page.getByRole('region', { name: labels.overall, exact: true })).toContainText('Saka')
		await page.locator('button[aria-controls="ps-context-panel"]').click()
		const detailHistory = page.locator('#ps-market-section ul li')
		await expect(detailHistory).toHaveCount(1)
		await expect(detailHistory).toContainText(new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: timezone }).format(new Date('2026-08-03T00:00:00Z')))
		await expect(detailHistory).toContainText('£10.0m')
		await expect(page.locator('#ps-market-section [aria-busy="true"]')).toHaveCount(0)
		expect(historyRequests).toEqual([1])
		await page.goBack()
		await expect(page).toHaveURL(marketUrl)
		await expect(page.getByRole('navigation', { name: labels.dates, exact: true }).locator('[aria-current="date"]')).toHaveAttribute('href', /date=2026-08-02/)
		await expect(page.locator('#market-ownership-share')).toContainText('Saka')
		await testInfo.attach(`${variant.id}-binding`, { contentType: 'application/json', body: JSON.stringify({ variantId: variant.id, persona: 'A', locale, viewport: { width, height: 900 }, theme, timezone, scenario, historicalDate: '2026-08-02', playerId: 1, returnedUrl: marketUrl, readyMs: null, performanceStatus: 'NOT_RUN', raceCoverage: 'Separate MKT02 controlled race tests; not inferred from this ready journey' }) })
	})
})
}
