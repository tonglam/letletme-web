import { expect, test } from '@playwright/test'

test.use({ timezoneId: 'Australia/Perth', colorScheme: 'light' })
for (const locale of ['en', 'zh-CN']) {
 for (const width of [1440, 390]) {
  test(`C05 anonymous directory inputs clear and reset ${locale} ${width}px`, async ({ page, context }) => {
   const zh = locale === 'zh-CN'
   await page.setViewportSize({ width, height: 900 })
   await page.addInitScript(() => localStorage.setItem('theme', 'system'))
   await page.goto(`${zh ? '/zh-CN' : ''}/explore/player-stats`)
   expect((await context.cookies()).some(cookie => cookie.name.includes('session_token'))).toBe(false)
   expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('Australia/Perth')
   const input = page.getByRole('textbox', { name: zh ? '按姓名搜索球员' : 'Search players by name', exact: true }).first()
   const picker = input.locator('../..')
   const saka = picker.getByRole('button', { name: /^Saka MID/ })
   const palmer = picker.getByRole('button', { name: /^Palmer MID/ })
   await expect(saka).toBeVisible()
   await expect(palmer).toBeVisible()
   await input.fill('Saka')
   await expect(saka).toBeVisible()
   await expect(palmer).toHaveCount(0)
   await picker.getByRole('button', { name: zh ? '清除球员搜索' : 'Clear player search', exact: true }).click()
   await expect(input).toHaveValue('')
   await expect(palmer).toBeVisible()
   await input.fill('   ')
   await expect(saka).toBeVisible()
   await expect(palmer).toBeVisible()
   for (const query of ['萨卡', 'z'.repeat(200), 'no-such-player']) {
    const response = page.waitForResponse(response => response.url().endsWith('/api/graphql') && response.request().postDataJSON()?.query?.includes('SearchPlayersForPicker') && response.request().postDataJSON()?.variables?.search === query)
    await input.fill(query)
    expect((await response).ok()).toBe(true)
    await expect(picker.getByText(zh ? '没有球员符合当前筛选条件。' : 'No players match the current filters.', { exact: true })).toBeVisible()
    await expect(saka).toHaveCount(0)
    await expect(palmer).toHaveCount(0)
   }
   await picker.getByRole('button', { name: zh ? '重置' : 'Reset', exact: true }).click()
   await expect(input).toHaveValue('')
   await expect(saka).toBeVisible()
   await expect(palmer).toBeVisible()
   let releaseOld!: () => void
   const oldGate = new Promise<void>(resolve => { releaseOld = resolve })
   let oldStarted!: () => void
   const oldRequestStarted = new Promise<void>(resolve => { oldStarted = resolve })
   let oldSettled!: () => void
   const oldRequestSettled = new Promise<void>(resolve => { oldSettled = resolve })
   const queries: string[] = []
   await page.route('**/api/graphql', async route => {
    const body = route.request().postDataJSON()
    if (!body?.query?.includes('SearchPlayersForPicker')) return route.continue()
    queries.push(body.variables.search)
    if (body.variables.search !== 'Sa') return route.continue()
    const response = await route.fetch()
    oldStarted()
    await oldGate
    try { await route.fulfill({ response }) } catch (error) {
     if (!route.request().failure()) throw error
    } finally { oldSettled() }
   })
   await input.fill('Sa')
   await oldRequestStarted
   await input.fill('Pa')
   await expect(palmer).toBeVisible()
   await expect(saka).toHaveCount(0)
   releaseOld()
   await oldRequestSettled
   await expect(input).toHaveValue('Pa')
   await expect(palmer).toBeVisible()
   await expect(saka).toHaveCount(0)
   expect(queries).toEqual(['Sa', 'Pa'])
   await page.unroute('**/api/graphql')
   const debouncedQueries: string[] = []
   await page.route('**/api/graphql', route => {
    const body = route.request().postDataJSON()
    if (body?.query?.includes('SearchPlayersForPicker')) debouncedQueries.push(body.variables.search)
    return route.continue()
   })
   await page.clock.install()
   await page.clock.pauseAt(new Date(Date.now() + 1_000))
   await input.fill('P')
   await page.clock.runFor(100)
   await input.fill('Pal')
   await page.clock.runFor(299)
   expect(debouncedQueries).toEqual([])
   await page.clock.runFor(1)
   await expect.poll(() => debouncedQueries).toEqual(['Pal'])
   await expect(palmer).toBeVisible()
   await expect(saka).toHaveCount(0)
   await page.clock.resume()
   await page.unroute('**/api/graphql')
   await expect(page).toHaveURL(url => url.pathname.endsWith('/explore/player-stats') && !url.searchParams.has('p1'))
  })
 }
}
