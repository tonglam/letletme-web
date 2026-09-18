import { expect, test } from '@playwright/test'

test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Requires isolated local GraphQL fixture')
test.skip(process.env.E2E_LIVE_ENTRY_BOUNDARY !== '1', 'Run in the dedicated entry-boundary fixture process')

for (const locale of ['en', 'zh-CN']) {
 for (const width of [1440, 390]) {
 const zh = locale === 'zh-CN'
 const prefix = zh ? '/zh-CN' : ''
for (const id of ['abc', '0', '-1', '2147483648']) {
 test(`invalid live entry ${id} ${locale} ${width}px returns not-found without browser business reads`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  const businessReads: string[] = []
  page.on('request', request => {
   if (!request.url().includes('/api/graphql')) return
   const body = request.postDataJSON()
   if (/GetEntry|GetLiveCalcPoints/.test(body?.operationName ?? '')) {
    businessReads.push(body.operationName)
   }
  })
  const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
  const before = await (await fetch(fixture)).json()
  const response = await page.goto(`${prefix}/live/points/${id}?gw=3`)
  await expect(page.getByRole('heading', { name: zh ? '找不到页面' : 'Page not found', exact: true })).toBeVisible()
  // Next.js streamed notFound responses retain HTTP 200; non-streamed use 404.
  expect([200, 404]).toContain(response?.status())
  await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached()
  const after = await (await fetch(fixture)).json()
  const entryReads = after.requests.slice(before.requests.length).filter(
   (r: { operation: string; variables: { id?: number | null; entryId?: number | null } }) =>
    /^(GetEntry|GetLiveCalcPoints)$/.test(r.operation) &&
    [null, 0, -1, 2147483648].includes(r.variables.entryId ?? r.variables.id ?? null)
  )
  expect(entryReads).toEqual([])
  expect(businessReads).toEqual([])
  await page.getByRole('link', { name: zh ? '返回首页' : 'Back to dashboard', exact: true }).click()
  await expect(page).toHaveURL(url => url.pathname === (prefix || '/') || url.pathname === `${prefix}/`)
 })
}

 test(`valid live entry preserves GW and return ${locale} ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  await page.goto(`${prefix}/live/points/123?gw=3&tournamentId=6`)
  const pitch = page.getByRole('region', { name: zh ? 'E2E United 阵型' : 'E2E United formation', exact: true })
  await expect(pitch.getByRole('heading', { name: 'E2E United', exact: true })).toBeVisible()
  await expect(pitch.getByRole('button')).toHaveCount(15)
  await expect(page.getByRole('link', { name: zh ? '返回赛事' : 'Back to competition', exact: true })).toHaveAttribute('href', `${prefix}/live/competitions?tournamentId=6&gw=3`)
 })
 }
}
