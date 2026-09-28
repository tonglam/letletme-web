import { expect, test } from '@playwright/test'

const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}`
const operation = 'GetEntryTransferHistory'
const history = (name = 'Seeded incoming') => ({ entryTransferHistory: [33, 32].map(eventId => ({
 eventId, eventTransfers: 1, eventTransfersCost: 0,
 transfers: [{ event: eventId, elementOutWebName: `Outgoing GW${eventId}`, elementOutTeamShortName: 'OUT', elementOutTypeName: 'MID', elementOutCost: 5.5,
 elementInWebName: `${name} GW${eventId}`, elementInTeamShortName: 'IN', elementInTypeName: 'MID', elementInCost: 6.2, time: '2026-08-04T10:00:00Z' }]
})) })
const control = async (rules: unknown[], reset = true) => {
 const response = await fetch(`${fixture}/__performance`, { method: 'POST', body: JSON.stringify({ rules, reset }) })
 expect(response.ok).toBe(true)
}
const observations = async () => (await (await fetch(`${fixture}/__performance`)).json()).requests as Array<{operation: string; finishedAt: number | null}>

test.describe('live transfer server seed', () => {
 test.describe.configure({ mode: 'serial' })
 test.beforeEach(async () => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Isolated server fixture only')
  await control([{ operation, data: history() }])
 })
 test.afterEach(async () => { if (!process.env.PLAYWRIGHT_BASE_URL) await control([]) })

 test('renders initial transfers once and reads fresh data after refresh and GW round trip', async ({ page }) => {
  let browserReads = 0
  page.on('request', request => { if (request.url().endsWith('/api/graphql') && request.postData()?.includes(operation)) browserReads++ })
  await page.goto('/live/points/123?gw=33')
  const section = page.locator('section[aria-labelledby="live-transfers-heading"]')
  // React may briefly retain both the fallback and streamed section before commit.
  // Require a unique visible section; persistent duplicates must still fail.
  await expect(section).toHaveCount(1)
  await expect(section).toBeVisible()
  await expect(section).toContainText('Seeded incoming GW33')
  await expect(section).toContainText('£5.5m')
  await expect(section).toContainText('£6.2m')
  expect(browserReads).toBe(0)
  expect((await observations()).filter(r => r.operation === operation)).toHaveLength(1)
  await control([{ operation, data: history('Refreshed incoming') }], false)
  await section.getByRole('button', { name: 'Refresh transfers', exact: true }).click()
  await expect(section).toContainText('Refreshed incoming GW33')
  expect(browserReads).toBe(1)
  await page.getByRole('button', { name: 'Previous gameweek', exact: true }).click()
  await expect(section).toContainText('Refreshed incoming GW32')
  await expect(section).not.toContainText('GW33')
  await page.getByRole('button', { name: 'Next gameweek', exact: true }).click()
  await expect(section).toContainText('Refreshed incoming GW33')
  await expect(section).not.toContainText('Seeded incoming')
  expect(browserReads).toBe(3)
 })

 test('slow transfer seed leaves the score usable and its late result cannot replace another GW', async ({ page }) => {
  await control([{ operation, delayMs: 6000, data: history('Late initial') }])
  await page.goto('/live/points/123?gw=33', { waitUntil: 'commit' })
  await expect(page.locator('[data-live-points-ready="true"][data-live-gw="33"]')).toHaveCount(1)
  const pending = (await observations()).filter(r => r.operation === operation)
  expect(pending).toHaveLength(1)
  expect(pending[0].finishedAt).toBeNull()
  const section = page.locator('section[aria-labelledby="live-transfers-heading"]')
  await expect(section.getByRole('status')).toBeVisible()
  await control([{ operation, data: history('Current') }], false)
  await page.getByRole('button', { name: 'Previous gameweek', exact: true }).click()
  await expect(section).toContainText('Current GW32')
  await expect.poll(async () => (await observations()).filter(r => r.operation === operation && r.finishedAt !== null).length, { timeout: 10000 }).toBe(2)
  await expect(section).toContainText('Current GW32')
  await expect(section).not.toContainText('Late initial')
 })

 for (const failure of ['upstream', 'malformed'] as const) {
 test(`server ${failure} failure stays distinct from empty and recovers only on explicit retry`, async ({ page }) => {
  await control([failure === 'upstream' ? { operation, error: true, httpStatus: 503 } : { operation, data: {} }])
  let browserReads = 0
  page.on('request', request => { if (request.url().endsWith('/api/graphql') && request.postData()?.includes(operation)) browserReads++ })
  await page.goto('/live/points/123?gw=33')
  const section = page.locator('section[aria-labelledby="live-transfers-heading"]')
  await expect(section.getByRole('alert')).toBeVisible()
  await expect(page.locator('[data-live-points-ready="true"]')).toHaveCount(1)
  expect(browserReads).toBe(0)
  await control([{ operation, data: { entryTransferHistory: [] } }], false)
  await section.getByRole('button', { name: 'Refresh transfers', exact: true }).click()
  await expect(section).toContainText('No synced transfer records for this gameweek.')
  await expect(section.getByRole('alert')).toHaveCount(0)
  expect(browserReads).toBe(1)
 })
 }
})
