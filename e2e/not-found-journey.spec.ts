import { expect, test } from '@playwright/test'

// Run against a fresh standalone process so a prior successful bootstrap cache
// cannot hide the deliberately malformed fixture response.
test('J20 route error retries into a usable player directory', async ({ page }) => {
 test.skip(process.env.E2E_ROUTE_ERROR_RECOVERY !== '1', 'Run alone before successful bootstrap cache fills')
 const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
 const control = async (rules: unknown[]) => {
  expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules }) })).ok).toBe(true)
 }
 await control([{ operation: 'GetPlayerStatsBootstrap', data: { playerStatsBootstrap: null } }])
 try {
  await page.goto('/acceptance-missing-route')
  await expect(page.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Back to dashboard', exact: true }).click()
  await page.getByRole('contentinfo').getByRole('link', { name: 'Players', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'This page could not be loaded', exact: true })).toBeVisible()
  await control([])
  const retryRequests: string[] = []
  page.on('request', request => { if (request.headers()['rsc'] === '1') retryRequests.push(request.url()) })
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  const players = page.getByRole('region', { name: 'Players', exact: true })
  await expect(players).toBeVisible()
  expect(retryRequests.length).toBeGreaterThan(0)
  const retried = await (await fetch(fixture)).json()
  expect(retried.requests.some((request: { operation: string }) => request.operation === 'GetPlayerStatsBootstrap')).toBe(true)
  await players.getByRole('button', { name: /^Saka/ }).click()
  await expect(page).toHaveURL(url => url.searchParams.get('p1') === '1')
  await expect(page.getByRole('region', { name: 'Player overall', exact: true })).toContainText('Saka')
 } finally { await control([]) }
})

for (const locale of ['en', 'zh-CN']) {
 for (const width of [1440, 390]) {
  test(`J20 not-found recovery to player detail ${locale} ${width}px`, async ({ page }) => {
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
  })
 }
}
