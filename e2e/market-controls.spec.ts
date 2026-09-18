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
  })
 }
}
