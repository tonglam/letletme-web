import { expect, test } from '@playwright/test'
import en from '../messages/en.json'
import zhCN from '../messages/zh-CN.json'

test.use({ timezoneId: 'Australia/Perth', colorScheme: 'light' })
const PLAYER_SEARCH_MAX_LENGTH = 50

function boundPlayerSearch(value: string): string {
 let bounded = ''
 for (const character of value) {
  const next = bounded + character
  if (next.length > PLAYER_SEARCH_MAX_LENGTH) break
  bounded = next
 }
 return bounded
}

const directoryContexts = [
 ...['en', 'zh-CN'].flatMap(locale => [1440, 390].map(width => ({
  locale, width, theme: 'system', timezoneId: 'Australia/Perth',
  variantIds: [`PS01.A.${locale}.${width === 1440 ? 'desktop1440' : 'mobile390'}.base`]
 }))),
 { locale: 'zh-CN', width: 390, theme: 'dark', timezoneId: 'UTC', variantIds: ['PS01.state.01', 'PS01.state.02'] }
]

for (const profile of directoryContexts) {
 test.describe(`PS01 ${profile.locale} ${profile.width}px ${profile.theme} ${profile.timezoneId}`, () => {
  test.use({ timezoneId: profile.timezoneId })
  test('directory every filter option, combined constraints and reset', async ({ page, context }, testInfo) => {
   test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Fixture-only directory assertions')
   test.setTimeout(60_000) // Entire 50-option journey, not an interaction performance budget.
   const t = (profile.locale === 'en' ? en : zhCN).PlayerDirectory
   await page.setViewportSize({ width: profile.width, height: 900 })
   await page.addInitScript(theme => localStorage.setItem('theme', theme), profile.theme)
   await page.goto(`${profile.locale === 'en' ? '' : '/zh-CN'}/explore/player-stats`)
   const input = page.getByRole('textbox', { name: t.search, exact: true }).first()
   const picker = input.locator('../..')
   const list = picker.locator('[aria-busy]')
   const rows = list.getByRole('button', { name: /^(Saka|Palmer) MID/ })
   await expect(rows).toHaveCount(2)
   expect((await context.cookies()).some(cookie => cookie.name.includes('session_token'))).toBe(false)
   expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(profile.timezoneId)
   expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe(profile.theme)
   expect(await page.evaluate(() => innerWidth)).toBe(profile.width)
   if (profile.theme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/)

   const observations: Array<{ control: string; option: string; variables: unknown; names: string[] }> = []
   const fetchedKeys = new Set<string>()
   let requestCount = 0
   page.on('request', request => {
    if (request.url().endsWith('/api/graphql') && request.postDataJSON()?.query?.includes('SearchPlayersForPicker')) requestCount++
   })
   // The shared fixture returns Saka and Palmer without server filtering. Assert the
   // outbound contract and rendered client filtering separately; this is not an
   // assertion that the real GraphQL resolver implements those predicates.
   async function choose(control: string, index: number, optionCount: number,
    variables: Record<string, unknown>, names: string[]) {
    const trigger = picker.getByRole('combobox', { name: control, exact: true })
    await expect(trigger).toBeEnabled()
    await trigger.click()
    const options = page.getByRole('option')
    await expect(options).toHaveCount(optionCount)
    const option = options.nth(index)
    const label = await option.innerText()
    const selected = await option.getAttribute('data-state') === 'checked'
    const key = JSON.stringify(variables)
    const before = requestCount
    const responsePromise = selected || fetchedKeys.has(key) ? null : page.waitForResponse(response =>
     response.url().endsWith('/api/graphql') && response.request().postDataJSON()?.query?.includes('SearchPlayersForPicker'))
    await option.click()
    if (responsePromise) {
     const response = await responsePromise
     expect(response.ok()).toBe(true)
     expect(response.request().postDataJSON().variables).toMatchObject(variables)
     expect((await response.json()).errors ?? []).toHaveLength(0)
     fetchedKeys.add(key)
    } else {
     // Let the documented 300 ms debounce settle for an unchanged or memory-cached query.
     await page.waitForTimeout(350)
     expect(requestCount).toBe(before)
    }
    await expect(list).toHaveAttribute('aria-busy', 'false')
    await expect(rows.locator('span').filter({ hasText: /^(Saka|Palmer)$/ })).toHaveText(names)
    await expect(list.getByRole('alert')).toHaveCount(0)
    if (!names.length) await expect(list.getByText(t.noPlayers, { exact: true })).toBeVisible()
    observations.push({ control, option: label, variables, names })
   }
   const all = ['Palmer', 'Saka']
   const base = { search: null, filter: null, sort: 'TOTAL_POINTS_DESC', ownershipBand: null, cursor: null }
   for (let index = 1; index <= 3; index++) {
    await choose(t.filterTeam, index, 4, { ...base, filter: { teamId: index } }, index === 1 ? ['Saka'] : index === 2 ? ['Palmer'] : [])
   }
   await choose(t.filterTeam, 0, 4, base, all)
   for (const [index, position] of ['GOALKEEPER', 'DEFENDER', 'MIDFIELDER', 'FORWARD'].map((value, index) => [index, value] as const)) {
    await choose(t.filterPosition, index + 1, 5, { ...base, filter: { position } }, position === 'MIDFIELDER' ? all : [])
   }
   await choose(t.filterPosition, 0, 5, base, all)
   for (let index = 1; index <= 24; index++) {
    const maxPrice = 160 - index * 5
    await choose(t.maxPriceLabel, index, 25, { ...base, filter: { maxPrice } }, maxPrice >= 105 ? all : maxPrice >= 100 ? ['Saka'] : [])
   }
   await choose(t.maxPriceLabel, 0, 25, base, all)
   for (const [index, ownershipBand] of ['LE5', 'GT5_LE15', 'GT15_LE40', 'GT40'].map((value, index) => [index, value] as const)) {
    await choose(t.ownBandLabel, index + 1, 5, { ...base, ownershipBand }, index === 2 ? ['Saka'] : index === 3 ? ['Palmer'] : [])
   }
   await choose(t.ownBandLabel, 0, 5, base, all)
   for (const [index, sort] of ['TOTAL_POINTS_DESC', 'FORM_DESC', 'PRICE_DESC', 'PRICE_ASC', 'OWNERSHIP_DESC', 'NAME_ASC'].map((value, index) => [index, value] as const)) {
    await choose(t.sortLabel, index, 6, { ...base, sort }, sort === 'PRICE_ASC' ? ['Saka', 'Palmer'] : all)
   }
   await choose(t.sortLabel, 0, 6, base, all)
   await choose(t.filterTeam, 1, 4, { ...base, filter: { teamId: 1 } }, ['Saka'])
   await choose(t.filterPosition, 3, 5, { ...base, filter: { teamId: 1, position: 'MIDFIELDER' } }, ['Saka'])
   await choose(t.maxPriceLabel, 12, 25, { ...base, filter: { teamId: 1, position: 'MIDFIELDER', maxPrice: 100 } }, ['Saka'])
   await choose(t.ownBandLabel, 3, 5, { ...base, filter: { teamId: 1, position: 'MIDFIELDER', maxPrice: 100 }, ownershipBand: 'GT15_LE40' }, ['Saka'])
   const beforeReset = requestCount
   await picker.getByRole('button', { name: t.resetFilters, exact: true }).click()
   await page.waitForTimeout(350)
   expect(requestCount).toBe(beforeReset)
   await expect(list).toHaveAttribute('aria-busy', 'false')
   await expect(rows).toHaveCount(2)
   await expect(input).toHaveValue('')
   await expect(picker.getByRole('combobox', { name: t.filterTeam, exact: true })).toHaveText(t.allTeams)
   await expect(picker.getByRole('combobox', { name: t.filterPosition, exact: true })).toHaveText(t.allPositions)
   await expect(picker.getByRole('combobox', { name: t.maxPriceLabel, exact: true })).toHaveText(t.maxPriceAny)
   await expect(picker.getByRole('combobox', { name: t.ownBandLabel, exact: true })).toHaveText(t.ownBandLabel)
   await expect(page).toHaveURL(url => url.pathname.endsWith('/explore/player-stats') && !url.searchParams.has('p1'))
   await testInfo.attach('PS01-context-proof', { body: JSON.stringify({ ...profile, observations,
    assertionScope: 'Directory options and combined client filtering; no real resolver, performance, detail/compare, or badge-removal proof' }), contentType: 'application/json' })
  })
 })
}

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
    const boundedQuery = boundPlayerSearch(query)
    const response = page.waitForResponse(response => response.url().endsWith('/api/graphql') && response.request().postDataJSON()?.query?.includes('SearchPlayersForPicker') && response.request().postDataJSON()?.variables?.search === boundedQuery)
    await input.fill(query)
    await expect(input).toHaveValue(boundedQuery)
    const responseResult = await response
    expect(responseResult.ok()).toBe(true)
    expect((await responseResult.json()).errors ?? []).toHaveLength(0)
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
