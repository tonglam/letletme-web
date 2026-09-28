import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 390, height: 900 }, locale: 'zh-CN', timezoneId: 'UTC', colorScheme: 'dark' })
test.beforeEach(async ({ page, context }) => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Faults require the isolated fixture')
  expect((await context.cookies()).filter(cookie => /session/i.test(cookie.name))).toHaveLength(0)
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
})

test('MKT01.state.02 unpublished future date uses the published date honestly', async ({ page }, testInfo) => {
  await page.goto('/zh-CN/explore/market?period=DAILY&date=2099-01-01')
  await expect(page.locator('html')).toHaveClass(/dark/)
  expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('UTC')
  await expect(page.locator('#market-most-selected-share li')).toHaveCount(4)
  await expect(page.locator('main')).not.toContainText('2099')
  await expect(page.locator('a[aria-current="date"]')).toHaveAttribute('href', /date=2026-08-03/)
  await expect(page.locator('a[aria-current="date"][href*="2099"]')).toHaveCount(0)
  await testInfo.attach('planned-context', { contentType: 'application/json', body: JSON.stringify({ variantId: 'MKT01.state.02', persona: 'A', locale: 'zh-CN', viewport: { width: 390, height: 900 }, theme: 'dark', timezone: 'UTC', scenario: 'not-published', requestedDate: '2099-01-01', selectedPublishedDate: '2026-08-03', scope: 'Unavailable requested date cannot masquerade as a published date; latest available date is explicit. Does not prove total absence of all publications.', performanceStatus: 'NOT_RUN', readyMs: null, wholeVariantComplete: false }) })
})

test('MKT02.state.03 history error settles and reselecting recovers the same player', async ({ page }, testInfo) => {
  let calls = 0
  await page.route('**/api/market/price-history?**', async route => {
    expect(new URL(route.request().url()).searchParams.get('playerId')).toBe('1')
    calls++
    if (calls === 1) return route.fulfill({ status: 503, json: { error: 'fixture unavailable' } })
    await route.fulfill({ json: { items: [{ playerId: 1, changeDate: '2026-08-03', oldValue: 99, newValue: 100, changeType: 'RISE', transfersIn: null, transfersOut: null }] } })
  })
  await page.goto('/zh-CN/explore/market')
  await expect(page.locator('html')).toHaveClass(/dark/)
  expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('UTC')
  const selectSaka = async () => {
    await page.getByRole('searchbox', { name: '按姓名搜索球员', exact: true }).fill('Sa')
    const row = page.getByRole('list', { name: '球员搜索结果', exact: true }).getByRole('listitem').filter({ has: page.getByRole('link', { name: 'Saka', exact: true }) })
    await expect(row).toHaveCount(1)
    await row.getByRole('button', { name: '历史', exact: true }).click()
  }
  await selectSaka()
  await expect(page.getByRole('alert').filter({ hasText: '无法加载球员身价历史。' })).toBeVisible()
  await expect(page.getByText('正在加载球员身价历史…', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Saka 尚无真实身价变化记录。', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('list', { name: 'Saka 的身价历史', exact: true })).toHaveCount(0)
  expect(calls).toBe(1)
  await page.getByRole('button', { name: '选择其他球员', exact: true }).click()
  await selectSaka()
  await expect(page.getByRole('list', { name: 'Saka 的身价历史', exact: true })).toContainText('£9.9m → £10.0m')
  await expect(page.getByRole('alert').filter({ hasText: '无法加载球员身价历史。' })).toHaveCount(0)
  expect(calls).toBe(2)
  await testInfo.attach('planned-context', { contentType: 'application/json', body: JSON.stringify({ variantId: 'MKT02.state.03', persona: 'A', locale: 'zh-CN', viewport: { width: 390, height: 900 }, theme: 'dark', timezone: 'UTC', scenario: 'error', playerId: 1, calls, scope: 'Error is distinct from empty history; loading ends; actual clear and same-player reselection recovers with one new request.', performanceStatus: 'NOT_RUN', readyMs: null, wholeVariantComplete: false }) })
})


test('MKT03.state.03 partial availability retains rows and retries the missing page', async ({ page }, testInfo) => {
  let calls = 0
  let complete: { revision: string; items: unknown[]; totalCount: number; nextOffset: number | null }
  await page.route('**/api/market/availability?**', async route => {
    calls++
    const offset = Number(new URL(route.request().url()).searchParams.get('offset'))
    if (calls === 1) {
      expect(offset).toBe(0)
      complete = await (await route.fetch()).json()
      expect(complete.items).toHaveLength(6)
      return route.fulfill({ json: { ...complete, items: complete.items.slice(0, 2), nextOffset: 2 } })
    }
    expect(offset).toBe(2)
    if (calls === 2) return route.fulfill({ status: 503, json: { error: 'fixture missing page' } })
    return route.fulfill({ json: { ...complete, items: complete.items.slice(2), nextOffset: null } })
  })
  await page.goto('/zh-CN/explore/market')
  await expect(page.locator('html')).toHaveClass(/dark/)
  expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('UTC')
  const board = page.locator('#market-most-selected-share')
  await expect(board.locator('li')).toHaveCount(4)
  const disclosure = page.getByTestId('market-availability-disclosure')
  await disclosure.locator('summary').click()
  await expect(disclosure.locator('li')).toHaveCount(2)
  await page.locator('#market-availability-search').fill('NoSuchFixturePlayer')
  await expect(page.locator('#market-availability-search-status')).toHaveText('部分更新暂时无法载入，已显示当前已载入的结果。')
  await expect(page.getByText('没有匹配的出场状态更新。', { exact: true })).toHaveCount(0)
  await expect(board.locator('li')).toHaveCount(4)
  expect(calls).toBe(2)
  await disclosure.getByRole('button', { name: '重试载入更新', exact: true }).click()
  await expect(page.locator('#market-availability-search-status')).toHaveText('没有匹配的出场状态更新。')
  expect(calls).toBe(3)
  await disclosure.getByRole('button', { name: '清除球员搜索', exact: true }).click()
  await expect(disclosure.locator('li')).toHaveCount(6)
  await expect(board.locator('li')).toHaveCount(4)
  await testInfo.attach('planned-context', { contentType: 'application/json', body: JSON.stringify({ variantId: 'MKT03.state.03', persona: 'A', locale: 'zh-CN', viewport: page.viewportSize(), theme: 'dark', timezone: 'UTC', scenario: 'partial', calls, scope: 'Partial page failure retains main ownership list and distinguishes incomplete search from no matches; explicit retry completes remaining page, clearing restores six rows without duplicates.', readyMs: null, performanceStatus: 'NOT_RUN', wholeVariantComplete: false }) })
})


for (const empty of [true]) test(`MKT03.state.${empty ? '02' : '01'} ownership and availability ${empty ? 'empty' : 'ready'}`, async ({ page }, testInfo) => {
  test.skip(process.env.E2E_MARKET_READINESS !== '1', 'Requires isolated market cache control')
  const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}`
  const seed = await (await fetch(`${fixture}/graphql`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: 'query GetMarketPulseSummary { __typename }' }) })).json()
  if (empty) Object.assign(seed.data.marketPulse, { mostSelected: [], availabilityUpdateCount: 0, availabilityHighlights: [], availabilityUpdates: [] })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  try {
    expect((await fetch(`${fixture}/__performance`, { method: 'POST', body: JSON.stringify({ rules: [{ operation: 'GetMarketPulseSummary', data: seed.data }] }) })).ok).toBe(true)
    await page.goto('/zh-CN/explore/market')
    await expect(page.locator('html')).toHaveClass(/dark/)
    expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('UTC')
    const board = page.locator('#market-most-selected-share')
    const options = ['ALL', 'GOALKEEPER', 'DEFENDER', 'MIDFIELDER', 'FORWARD']
    expect(await board.locator('[data-market-position-filter]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-market-position-filter')).sort())).toEqual([...options].sort())
    for (const option of options) {
      const button = board.locator(`[data-market-position-filter="${option}"]`)
      await button.click()
      await expect(button).toHaveAttribute('aria-pressed', 'true')
      await expect(board.locator('li')).toHaveCount(empty ? 0 : option === 'ALL' ? 4 : 1)
      if (empty) await expect(board.getByRole('status')).toHaveText('当前周期暂无数据。')
      else if (option !== 'ALL') await expect(board.locator('li')).toContainText(`Market ${option}`)
    }
    await board.locator('[data-market-position-filter="ALL"]').click()
    const disclosure = page.getByTestId('market-availability-disclosure')
    if (empty) {
      await expect(page.locator('#market-squad-status-share')).toHaveCount(0)
      await expect(disclosure).toHaveCount(0)
      await expect(page.locator('#market-availability-search')).toHaveCount(0)
    } else {
      await disclosure.locator('summary').click()
      await expect(disclosure.locator('li')).toHaveCount(6)
      await page.locator('#market-availability-search').fill('NoSuchFixturePlayer')
      await expect(page.locator('#market-availability-search-status')).toHaveText('没有匹配的出场状态更新。')
      await expect(disclosure.locator('li')).toHaveCount(0)
      await disclosure.getByRole('button', { name: '清除球员搜索', exact: true }).click()
      await expect(disclosure.locator('li')).toHaveCount(6)
      await disclosure.locator('summary').click()
      await expect(disclosure).not.toHaveAttribute('open', '')
      await expect(board.locator('li')).toHaveCount(4)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(errors).toEqual([])
    await testInfo.attach('planned-context', { contentType: 'application/json', body: JSON.stringify({ variantId: `MKT03.state.${empty ? '02' : '01'}`, persona: 'A', locale: 'zh-CN', viewport: page.viewportSize(), theme: 'dark', timezone: 'UTC', scenario: empty ? 'empty' : 'ready', options, pageErrors: errors, scope: empty ? 'Authoritative empty summary; every position remains empty; availability section, disclosure and search absent by hasAvailabilityEvidence condition.' : 'Exact position option set; correct rows; availability expansion, empty search, clear and collapse preserve main list.', readyMs: null, performanceStatus: 'NOT_RUN', wholeVariantComplete: false }) })
  } finally {
    expect((await fetch(`${fixture}/__performance`, { method: 'POST', body: JSON.stringify({ rules: [] }) })).ok).toBe(true)
  }
})
