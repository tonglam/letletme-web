import { expect, test } from '@playwright/test'

// Run against a fresh standalone process so a prior successful bootstrap cache
// cannot hide the deliberately malformed fixture response.
test.describe('J20 planned route-error states', () => {
 test.use({ timezoneId: 'UTC', colorScheme: 'dark', viewport: { width: 390, height: 900 } })
test('J20 route error retries into a usable player directory', async ({ page }, testInfo) => {
 test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_ROUTE_ERROR_RECOVERY !== '1', 'Run alone before successful bootstrap cache fills')
 const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
 const control = async (rules: unknown[]) => {
  expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules }) })).ok).toBe(true)
 }
 await page.addInitScript(() => { if (localStorage.getItem('theme') === null) localStorage.setItem('theme', 'dark') })
 await control([{ operation: 'GetPlayerStatsBootstrap', data: { playerStatsBootstrap: null } }])
 try {
  await page.goto('/zh-CN/acceptance-missing-route')
  await expect(page.getByRole('heading', { name: '找不到页面', exact: true })).toBeVisible()
  await page.getByRole('link', { name: '返回首页', exact: true }).click()
  await page.getByRole('contentinfo').getByRole('link', { name: '球员', exact: true }).click()
  await expect(page.getByRole('heading', { name: '无法加载此页面', exact: true })).toBeVisible()
  const beforeFailedRetry = await (await fetch(fixture)).json()
  const countBootstrap = (body: { requests: { operation: string; finishedAt: number | null }[] }) => body.requests.filter(r => r.operation === 'GetPlayerStatsBootstrap' && r.finishedAt !== null).length
  const failedResponse = page.waitForResponse(response => response.request().headers()['rsc'] === '1' && new URL(response.url()).pathname.endsWith('/explore/player-stats'))
  await page.getByRole('button', { name: '重试', exact: true }).click()
  await failedResponse
  await expect.poll(async () => countBootstrap(await (await fetch(fixture)).json())).toBeGreaterThan(countBootstrap(beforeFailedRetry))
  await expect(page.getByRole('heading', { name: '无法加载此页面', exact: true })).toHaveCount(1)
  await expect(page.getByRole('region', { name: '球员', exact: true })).toHaveCount(0)
  await expect(page.locator('html')).toHaveClass(/\bdark\b/)
  expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('UTC')
  await testInfo.attach('J20-failed-retry', { contentType: 'application/json', body: JSON.stringify({ variantId: 'J20.state.02', scenario: '500', locale: 'zh-CN', viewport: page.viewportSize(), theme: 'dark', timezone: 'UTC', functionalStatus: 'PASS', wholeVariantComplete: false, readyMs: null, eventToPaintMs: null, scope: 'Localized route error and failed Retry; not global error or asserted HTTP 500.' }) })
  await control([])
  const retryRequests: string[] = []
  page.on('request', request => { if (request.headers()['rsc'] === '1') retryRequests.push(request.url()) })
  await page.getByRole('button', { name: '重试', exact: true }).click()
  const players = page.getByRole('region', { name: '球员', exact: true })
  await expect(players).toBeVisible()
  expect(retryRequests.length).toBeGreaterThan(0)
  const retried = await (await fetch(fixture)).json()
  expect(retried.requests.some((request: { operation: string }) => request.operation === 'GetPlayerStatsBootstrap')).toBe(true)
  await players.getByRole('button', { name: /^Saka/ }).click()
  await expect(page).toHaveURL(url => url.searchParams.get('p1') === '1')
  await expect(page.getByRole('region', { name: '球员总览', exact: true })).toContainText('Saka')
  await expect(page.getByRole('heading', { name: '无法加载此页面', exact: true })).toHaveCount(0)
  await expect(page.getByRole('main')).toHaveCount(1)
  await testInfo.attach('C13-states', { body: JSON.stringify({
   caseId: 'J20',
   variantId: 'J20.state.03',
   locale: 'zh-CN', viewport: page.viewportSize(), theme: 'dark', timezone: 'UTC',
   stepIds: ['J20.05', 'J20.06', 'J20.07', 'J20.08', 'J20.09', 'J20.10'],
   state: 'route-error-to-ready',
   fixture: 'GetPlayerStatsBootstrap null after route not-found, then Try again reloads the player directory',
   assertions: ['route not-found recovery link reaches player route', 'localized route error Retry is visible; global error is not covered', 'actual Retry restores Players and Saka detail'],
   functionalStatus: 'PASS',
   performanceStatus: 'NOT_OBSERVED',
   readyMs: null,
   wholeCaseComplete: false
  }), contentType: 'application/json' })
 } finally { await control([]) }
})

})

for (const scenario of ['baseline', '404'] as const) {
for (const locale of scenario === 'baseline' ? ['en', 'zh-CN'] : ['zh-CN']) {
 for (const width of scenario === 'baseline' ? [1440, 390] : [390]) {
  const timezone = scenario === 'baseline' ? 'Australia/Perth' : 'UTC'
  const theme = scenario === 'baseline' ? 'system' : 'dark'
  test.describe(`J20 planned ${scenario} ${locale} ${width}`, () => {
   test.use({ timezoneId: timezone, colorScheme: scenario === 'baseline' ? 'light' : 'dark' })
  test(`J20 not-found recovery to player detail ${locale} ${width}px`, async ({ page }, testInfo) => {
   test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Isolated planned preference contexts only')
   await page.addInitScript(preference => { if (localStorage.getItem('theme') === null) localStorage.setItem('theme', preference) }, theme)
   const zh = locale === 'zh-CN'
   const prefix = zh ? '/zh-CN' : ''
   await page.setViewportSize({ width, height: 900 })
   const response = await page.goto(`${prefix}/acceptance-missing-route`)
   expect(response?.status()).toBe(404)
   await expect(page.getByRole('heading', { name: zh ? '找不到页面' : 'Page not found', exact: true })).toBeVisible()
   await page.getByRole('link', { name: zh ? '返回首页' : 'Back to dashboard', exact: true }).click()
   await expect(page).toHaveURL(url => url.pathname === (prefix || '/') || url.pathname === `${prefix}/`)
   const footer = page.getByRole('contentinfo')
   await footer.getByRole('link', { name: zh ? '球员' : 'Players', exact: true }).click()
   await expect(page).toHaveURL(url => url.pathname === `${prefix}/explore/player-stats`)
   const players = page.getByRole('region', { name: zh ? '球员' : 'Players', exact: true })
   await players.getByRole('button', { name: /^Saka/ }).click()
   await expect(page).toHaveURL(url => url.searchParams.get('p1') === '1')
   await expect(page.getByRole('region', { name: zh ? '球员总览' : 'Player overall', exact: true })).toContainText('Saka')
   await expect(page.getByRole('heading', { name: zh ? '找不到页面' : 'Page not found', exact: true })).toHaveCount(0)
   await expect(page.getByRole('main')).toHaveCount(1)
   await expect(page.locator('html')).toHaveClass(scenario === 'baseline' ? /\blight\b/ : /\bdark\b/)
   expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe(theme)
   expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(timezone)
   await testInfo.attach('J20-planned-context', { contentType: 'application/json', body: JSON.stringify({ variantId: scenario === 'baseline' ? `J20.A.${locale}.${width === 390 ? 'mobile390' : 'desktop1440'}.base` : 'J20.state.01', scenario, locale, viewport: page.viewportSize(), theme, timezone, stepIds: ['J20.01','J20.02','J20.03','J20.04','J20.08','J20.09','J20.10'], playerId: 1, functionalStatus: 'PASS', wholeVariantComplete: false, readyMs: null, eventToPaintMs: null, missingReason: '404 recovery only; route error, global error and timing not inferred.' }) })
  })
  })
 }
}
}
