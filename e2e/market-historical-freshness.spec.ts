import { expect, test } from '@playwright/test'

test.describe.configure({ mode: 'serial' })
for (const locale of ['zh-CN', 'en']) {
test(`historical ownership age does not imply latest acquisition delay ${locale}`,  async ({ page }) => {
 test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Isolated fixture control only')
 const origin = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}`
 try {
  const zh = locale === 'zh-CN'
  for (const date of ['2026-08-02', '2026-08-03']) {
   const seed = await (await fetch(`${origin}/graphql`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: 'query GetMarketOwnershipDay($date: Date) { marketOwnershipDay(date: $date) { date } }', variables: { date } }) })).json()
   seed.data.marketOwnershipDay.coverage.stale = true
   if (date === '2026-08-02') {
    seed.data.marketOwnershipDay.coverage.status = 'PARTIAL'
    seed.data.marketOwnershipDay.coverage.complete = false
    seed.data.marketOwnershipDay.coverage.missingDates = ['2026-08-01']
   }
   expect((await fetch(`${origin}/__performance`, { method: 'POST', body: JSON.stringify({ rules: [{ operation: 'GetMarketOwnershipDay', variables: { date }, data: seed.data }] }) })).ok).toBe(true)
   await page.goto(`${zh ? '/zh-CN' : ''}/explore/market?period=DAILY&date=${date}`)
   const ownership = page.getByRole('region', { name: zh ? '持有率变化' : 'Ownership change', exact: true })
   await expect(ownership).toContainText('Saka')
   const warning = ownership.getByText(zh ? '最新采集有所延迟，当前显示上一次完整快照。' : 'The latest capture is delayed. Showing the last complete snapshot.', { exact: true })
   if (date === '2026-08-02') {
    await expect(warning).toHaveCount(0)
    await expect(ownership).toContainText(zh ? '缺失快照' : 'Missing snapshots')
   }
   else await expect(warning).toBeVisible()
  }
 } finally {
  await fetch(`${origin}/__performance`, { method: 'POST', body: JSON.stringify({ rules: [] }) })
 }
})
}
