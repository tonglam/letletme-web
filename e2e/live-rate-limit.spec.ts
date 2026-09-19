import { expect, test, type Route } from '@playwright/test'
const graphqlFixtureUrl = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/graphql`
async function continueToGraphqlFixture(route: Route) { await route.continue({ url: graphqlFixtureUrl }) }
// Original coverage matrix: S18.directed.01/.02. Fault injection stays local.
test.describe('S18 refresh admission in the planned mobile environment', () => {
 test.use({ timezoneId: 'UTC', colorScheme: 'dark', viewport: { width: 390, height: 900 } })
 for (const switchGameweek of [false, true]) {
 test(`zh-CN refresh honors 429 window, switch GW=${switchGameweek}`,  async ({ page }, testInfo) => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Isolated fixture fault injection only')
  await page.clock.install()
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
  let inject = false
  let requests = 0
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/graphql', async route => {
   if (route.request().postDataJSON()?.query?.includes('EventLiveExplainBatch')) {
    await route.fulfill({ status: 200, json: { data: { eventLiveExplains: [] } } })
    return
   }
   if (route.request().postDataJSON()?.query?.includes('query PlayerLive(')) {
    await route.fulfill({ status: 200, json: { data: { playerLive: { minutes: 45, totalPoints: 6 } } } })
    return
   }
   if (route.request().postDataJSON()?.query?.includes('query EventLiveExplain(')) {
    await route.fulfill({ status: 200, json: { data: { eventLiveExplain: null } } })
    return
   }
   if (inject && route.request().postDataJSON()?.query?.includes('GetLiveCalcPoints')) {
    requests += 1
    await gate
    await route.fulfill({ status: 429, headers: { 'Retry-After': '37' }, json: { errors: [{ message: 'Controlled rate limit', extensions: { code: 'RATE_LIMITED' } }] } })
    return
   }
   await continueToGraphqlFixture(route)
  })
  await page.goto('/zh-CN/live/points/123?gw=32&tournamentId=3')
  const ready = page.locator('[data-live-points-ready="true"]')
  await expect(ready).toHaveAttribute('data-live-entry', '123')
  await expect(ready).toHaveAttribute('data-live-gw', '32')
  await expect(page.getByRole('region', { name: /阵型$/ })).toBeVisible()
  await expect(page.locator('html')).toHaveClass(/dark/)
  expect(await page.evaluate(() => ({ width: innerWidth, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, language: document.documentElement.lang }))).toEqual({ width: 390, timezone: 'UTC', language: 'zh-CN' })
  const refresh = page.getByRole('button', { name: '刷新', exact: true }).filter({ visible: true })
  await expect(refresh).toHaveCount(1)
  inject = true
  try {
   await refresh.click()
   await expect.poll(() => requests).toBe(1)
   await expect(refresh).toBeDisabled()
   await expect(ready).toHaveCount(0)
   // A real mouse double click on the disabled control must admit no request.
   const box = await refresh.boundingBox()
   expect(box).not.toBeNull()
   await page.mouse.dblclick(box!.x + box!.width / 2, box!.y + box!.height / 2)
   await page.clock.runFor(100)
   expect(requests).toBe(1)
  } finally { release() }
  await expect(page.getByRole('alert').filter({ hasText: '实时积分加载失败，请重试。' })).toBeVisible()
  await expect(ready).toHaveCount(0)
  await expect(refresh).toBeEnabled()
  await refresh.click()
  await page.clock.runFor(100)
  expect(requests).toBe(1)
  await expect(ready).toHaveCount(0)
  const detailRead = page.waitForResponse(response => response.request().method() === 'POST' && Boolean(response.request().postDataJSON()?.query?.includes('query PlayerLive(')))
  await page.getByRole('region', { name: /阵型$/ }).getByRole('button', { name: '查看 Player 1 的详情', exact: true }).click()
  expect((await detailRead).status()).toBe(200)
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Player 1', exact: true })).toBeVisible()
  await expect(dialog.getByText('正在加载积分明细…', { exact: true })).toHaveCount(0)
  await dialog.getByRole('button', { name: '关闭', exact: true }).click()
  expect(requests).toBe(1)
  if (switchGameweek) {
   await page.getByRole('button', { name: '上一轮', exact: true }).click()
   await expect(page.getByRole('region', { name: /阵型$/ })).toHaveCount(0)
   await expect(ready).toHaveCount(0)
   expect(requests).toBe(1)
  }
  await page.clock.fastForward(35_000)
  await refresh.click()
  await page.clock.runFor(100)
  expect(requests).toBe(1)
  inject = false
  // An intercepted click must not restart or extend the server's waiting period.
  await page.clock.fastForward(3_000)
  await expect(refresh).toBeEnabled()
  await refresh.click()
  await expect(ready).toHaveAttribute('data-live-entry', '123')
  await expect(ready).toHaveAttribute('data-live-gw', switchGameweek ? '31' : '32')
  await expect(page.getByRole('alert').filter({ hasText: '实时积分加载失败，请重试。' })).toHaveCount(0)
  await testInfo.attach('scope', { body: JSON.stringify({ locale: 'zh-CN', width: 390, theme: 'dark', timezone: 'UTC', requestsDuringHeldRefresh: requests, early429RetrySuppression: 'PASS', performance: 'NOT_RUN' }), contentType: 'application/json' })
 })
 }
})
