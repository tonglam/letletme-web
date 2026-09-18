import { expect, test } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

for (const fails of [true, false]) {
test(`market full readiness waits for streamed dependencies without blocking the shell (${fails ? 'failure' : 'success'})`, async ({ page }, testInfo) => {
 test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Requires isolated fixture-control run')
 const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
 type Request = { operation: string; variables: { period?: string }; finishedAt: number | null }
 const relevant = (r: Request) => r.operation === 'GetPriceChangeBoard' || (r.operation === 'GetMarketOwnershipOverview' && r.variables.period === 'GAMEWEEK')
 let atReady: Request[] = []
 let observed = false
 let priceRevision: string | null = null
 await page.route('**/api/vitals', async route => {
  const body = route.request().postDataJSON()
  if (body.samples?.some((s: { metricName: string }) => s.metricName === 'MARKET_CONTENT_READY')) {
   const data = await (await fetch(fixture)).json()
   atReady = data.requests.filter(relevant)
   priceRevision = await page.locator('[data-price-change-revision]').getAttribute('data-price-change-revision')
   observed = true
  }
  await route.fulfill({ status: 204, body: '' })
 })
 try {
  const seed = await (await fetch(fixture.replace('/__performance', '/graphql'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: 'query GetPriceChangeBoard { priceChangeBoard { revision } }' }) })).json()
  seed.data.priceChangeBoard.latestEvent = { outcome: 'NO_CHANGE', observedAt: '2026-08-03T09:40:00.000Z', deadline: '2026-08-03T09:00:00.000Z', changeDate: '2026-08-03', changes: [] }
  expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [
   { operation: 'GetPriceChangeBoard', delayMs: 2500, ...(fails ? { error: true } : { data: seed.data }) },
   { operation: 'GetMarketOwnershipOverview', variables: { period: 'GAMEWEEK' }, delayMs: 3500, error: fails }
  ] }) })).ok).toBe(true)
  await page.goto('/explore/market', { waitUntil: 'commit' })
  await expect(page.locator('#market-most-selected-share')).toBeVisible()
  const before = (await (await fetch(fixture)).json()).requests.filter(relevant) as Request[]
  expect(before).toHaveLength(2)
  expect(before.every(r => r.finishedAt === null), 'Main content must stream while dependencies are pending').toBe(true)
  expect(observed).toBe(false)
  await expect.poll(() => observed).toBe(true)
  await testInfo.attach('market-ready-streams', { body: JSON.stringify({ before, atReady, priceRevision }), contentType: 'application/json' })
  expect(atReady, 'Both producers must execute; cached responses do not prove this scenario').toHaveLength(2)
  expect(atReady.every(r => r.finishedAt !== null)).toBe(true)
  expect(priceRevision, 'The price section must commit the observed board before reporting readiness').toBe(fails ? 'fallback' : 'price-changes-7')
  expect(priceRevision).not.toBeNull()
 } finally {
  await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
 }
})
}
