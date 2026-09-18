import { expect, test } from '@playwright/test'

for (const locale of ['en', 'zh-CN'] as const) {
 for (const width of [1440, 390]) {
  for (const state of ['tied-ten', 'empty'] as const) {
   test(`GW03 board boundary ${state} ${locale} ${width}`, async ({ page, request }) => {
    test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Isolated boundary response only')
    const zh = locale === 'zh-CN'
    const response = await request.get('/api/gameweek/desk?eventId=32')
    expect(response.ok()).toBe(true)
    const desk = await response.json()
    expect(desk.eventId).toBe(32)
    expect(desk.hauls.length).toBeGreaterThan(0)
    const sample = desk.hauls[0]
    desk.hauls = state === 'empty' ? [] : [
     { ...sample, id: 701, webName: 'Boundary Alpha', totalPoints: 10 },
     { ...sample, id: 702, webName: 'Boundary Beta', totalPoints: 10 }
    ]
    let reads = 0
    await page.route('**/api/gameweek/desk?eventId=32', async route => {
     reads += 1
     await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(desk) })
    })
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`${zh ? '/zh-CN' : ''}/explore/gameweek`)
    await expect(page.getByRole('heading', { name: zh ? 'GW33 概览' : 'GW33 Overview', exact: true })).toBeVisible()
    const input = page.locator('#gameweek-jump-input')
    await input.fill('32')
    await input.press('Enter')
    await expect(page.getByRole('heading', { name: zh ? 'GW32 概览' : 'GW32 Overview', exact: true })).toBeVisible()
    await expect(input).toHaveAttribute('aria-busy', 'false')
    const board = page.locator('[data-share-fit-content="true"]').filter({ has: page.getByRole('heading', { name: zh ? '得分上双球员' : 'Players Scoring 10+', exact: true }) })
    await expect(board).toHaveCount(1)
    if (state === 'empty') {
     await expect(board.locator('tbody tr')).toHaveCount(0)
     await expect(board.getByText(zh ? '本轮还没有球员得分上双。' : 'No double-digit hauls for this gameweek yet.', { exact: true })).toBeVisible()
    } else {
     const rows = board.locator('tbody tr')
     await expect(rows).toHaveCount(2)
     await expect(rows.getByRole('button')).toHaveText(['Boundary Alpha', 'Boundary Beta'])
     for (const row of await rows.all()) await expect(row.getByRole('cell').last()).toHaveText('10')
     await expect(board.getByText('Saka', { exact: true })).toHaveCount(0)
     await expect(board.getByText('Palmer', { exact: true })).toHaveCount(0)
    }
    expect(reads).toBe(1)
   })
  }
 }
}
