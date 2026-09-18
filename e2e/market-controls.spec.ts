import { expect, test } from '@playwright/test'

for (const locale of ['en', 'zh-CN']) {
 for (const width of [1440, 390]) {
  test(`MKT03 position and availability controls ${locale} ${width}`, async ({ page }) => {
   const zh = locale === 'zh-CN'
   await page.setViewportSize({ width, height: 900 })
   await page.goto(`${zh ? '/zh-CN' : ''}/explore/market`)
   const board = page.locator('#market-most-selected-share')
   await expect(board.locator('li')).toHaveCount(4)
   for (const position of ['GOALKEEPER', 'DEFENDER', 'MIDFIELDER', 'FORWARD']) {
    const button = board.locator(`[data-market-position-filter="${position}"]`)
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect(board.locator('li')).toHaveCount(1)
    await expect(board.locator('li')).toContainText(`Market ${position}`)
   }
   await board.locator('[data-market-position-filter="ALL"]').click()
   await expect(board.locator('li')).toHaveCount(4)
   const disclosure = page.getByTestId('market-availability-disclosure')
   await disclosure.locator('summary').click()
   await expect(disclosure).toHaveAttribute('open', '')
   const search = page.locator('#market-availability-search')
   await expect(search).toBeVisible()
   await expect(disclosure.locator('li')).toHaveCount(6)
   await search.fill('NoSuchFixturePlayer')
   await expect(page.locator('#market-availability-search-status')).toHaveText(zh ? '没有匹配的出场状态更新。' : 'No availability updates match that name.')
   await expect(disclosure.locator('li')).toHaveCount(0)
   await disclosure.getByRole('button', { name: zh ? '清除球员搜索' : 'Clear player search', exact: true }).click()
   await expect(search).toHaveValue('')
   await expect(disclosure.locator('li')).toHaveCount(6)
   await expect(page.locator('#market-availability-search-status')).toHaveText(zh ? '输入至少 2 个字符，在全部更新中查找球员。' : 'Enter at least 2 characters to search all updates.')
   await disclosure.getByRole('link', { name: 'Palmer', exact: true }).click()
   await expect(page).toHaveURL(new RegExp(`${zh ? '/zh-CN' : ''}/explore/player-stats\\?p1=2$`))
   await expect(page.getByRole('region', { name: zh ? '球员总览' : 'Player overall', exact: true })).toContainText('Palmer')
   await page.goBack()
   await expect(page).toHaveURL(new RegExp(`${zh ? '/zh-CN' : ''}/explore/market$`))
   await expect(page.locator('#market-most-selected-share li')).toHaveCount(4)
   for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.getByRole('searchbox', { name: zh ? '按姓名搜索球员' : 'Search players by name', exact: true }).fill('Sa')
    const results = page.getByRole('list', { name: zh ? '球员搜索结果' : 'Player search results', exact: true })
    const saka = results.getByRole('listitem').filter({ has: page.getByRole('link', { name: 'Saka', exact: true }) })
    await saka.getByRole('button', { name: zh ? '历史' : 'History', exact: true }).click()
    await expect(page.getByRole('heading', { level: 3, name: 'Saka', exact: true })).toBeVisible()
    await expect(page.getByText('£9.9m → £10.0m')).toBeVisible()
    await page.getByRole('button', { name: zh ? '选择其他球员' : 'Choose another player', exact: true }).click()
    await expect(page.getByRole('heading', { level: 3, name: 'Saka', exact: true })).toHaveCount(0)
    await expect(page.getByText('£9.9m → £10.0m')).toHaveCount(0)
   }


  })
 }
}
