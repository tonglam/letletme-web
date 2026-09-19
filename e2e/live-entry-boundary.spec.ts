import { expect, test } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Requires isolated local GraphQL fixture')
test.skip(process.env.E2E_LIVE_ENTRY_BOUNDARY !== '1', 'Run in the dedicated entry-boundary fixture process')

for (const locale of ['en', 'zh-CN']) {
 for (const width of [1440, 390]) {
 const zh = locale === 'zh-CN'
 const prefix = zh ? '/zh-CN' : ''
for (const id of ['abc', '0', '-1', '2147483648', '1e3', '0x7b', '0123', '+123']) {
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
    (r.variables.entryId ?? r.variables.id ?? null) === (Number.isNaN(Number(id)) ? null : Number(id))
  )
  expect(entryReads).toEqual([])
  expect(businessReads).toEqual([])
  await page.getByRole('link', { name: zh ? '返回首页' : 'Back to dashboard', exact: true }).click()
  await expect(page).toHaveURL(url => url.pathname === (prefix || '/') || url.pathname === `${prefix}/`)
 })
}

 test(`valid live entry preserves GW and return ${locale} ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  const target = `${prefix}/live/points/123?gw=3&tournamentId=6`
  const response = await page.goto(target)
  expect(response?.status()).toBe(200)
  expect(response?.request().redirectedFrom()).toBeNull()
  const pitch = page.getByRole('region', { name: zh ? 'E2E United 阵型' : 'E2E United formation', exact: true })
  await expect(pitch.getByRole('heading', { name: 'E2E United', exact: true })).toBeVisible()
  await expect(pitch.getByRole('button')).toHaveCount(15)
  const assertContext = async () => {
   await expect(page).toHaveURL(url => url.pathname === `${prefix}/live/points/123` && url.searchParams.get('gw') === '3' && url.searchParams.get('tournamentId') === '6')
   await expect(pitch.getByRole('heading', { name: 'E2E United', exact: true })).toBeVisible()
   await expect(pitch.getByRole('button')).toHaveCount(15)
   const starters = pitch.locator('ol[aria-label]')
   const bench = pitch.locator('ol:not([aria-label])')
   await expect(starters.getByRole('button')).toHaveCount(11)
   await expect(bench.getByRole('button')).toHaveCount(4)
   for (let player = 1; player <= 15; player += 1) {
    await expect((player <= 11 ? starters : bench).getByRole('button', { name: new RegExp(`Player ${player}\\b`) })).toBeVisible()
   }
   const captain = starters.locator('li').filter({ has: page.getByRole('button', { name: /Player 1\b/ }) })
   const vice = starters.locator('li').filter({ has: page.getByRole('button', { name: /Player 2\b/ }) })
   await expect(captain.getByRole('img', { name: zh ? '队长' : 'Captain', exact: true })).toBeVisible()
   await expect(vice.getByRole('img', { name: zh ? '副队长' : 'Vice-captain', exact: true })).toBeVisible()
   await expect(page.getByRole('link', { name: zh ? '返回赛事' : 'Back to competition', exact: true })).toHaveAttribute('href', `${prefix}/live/competitions?tournamentId=6&gw=3`)
  }
  await assertContext()
  expect((await page.reload())?.status()).toBe(200)
  await assertContext()
  // A neutral history entry exercises browser restoration without implying a
  // site-link journey or requiring access to the protected tournament route.
  await page.goto('about:blank')
  await page.goBack()
  await assertContext()
  await page.goForward()
  await expect(page).toHaveURL('about:blank')
  await page.goBack()
  await assertContext()
 })
 }
}
