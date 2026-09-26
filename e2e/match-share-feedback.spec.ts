import { expect, test } from '@playwright/test'
for (const locale of ['en', 'zh-CN']) for (const width of [1440, 390]) {
 test(`MATCH01.05 share observation ${locale} ${width}`, async ({ page }) => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_LIVE_HYDRATION !== '1', 'Isolated fixture only')
  const zh = locale === 'zh-CN'
  await page.setViewportSize({ width, height: 900 })
  await page.addInitScript(() => {
   Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
   Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { document.documentElement.dataset.fixtureMatchCopy = text } } })
  })
  await page.goto(`${zh ? '/zh-CN' : ''}/live/matches`)
  const card = page.locator('[data-live-match-card="true"]').filter({ has: page.getByText('Arsenal', { exact: true }) })
  await expect(card).toHaveCount(1)
  await expect(card.getByText('Chelsea', { exact: true })).toBeVisible()
  const text = card.getByRole('button', { name: zh ? '文字' : 'Text', exact: true })
  const image = card.getByRole('button', { name: zh ? '图片' : 'Image', exact: true })
  await expect(text).toBeVisible()
  await expect(image).toBeVisible()
  await text.click()
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.fixtureMatchCopy)).toContain(`${zh ? '/zh-CN' : ''}/live/matches`)
  const copied = await page.evaluate(() => document.documentElement.dataset.fixtureMatchCopy)
  expect(copied).toMatch(/Arsenal|ARS/)
  expect(copied).toMatch(/Chelsea|CHE/)
  expect(copied).toMatch(/2.*0/)
  await expect(page.getByText(zh ? '文字已复制' : 'Text copied', { exact: true })).toBeVisible()
 })
}
