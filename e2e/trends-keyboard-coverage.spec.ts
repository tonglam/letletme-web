import { expect, test } from '@playwright/test'

for (const dark of [false, true]) {
test.describe(dark ? 'UTC dark state' : 'Perth baseline', () => {
test.use({ timezoneId: dark ? 'UTC' : 'Australia/Perth', colorScheme: dark ? 'dark' : 'light' })
for (const locale of dark ? ['zh-CN'] : ['en', 'zh-CN']) {
 for (const width of dark ? [390] : [1440, 390]) {
  test(`C06 trends tabs keyboard ${locale} ${width}px`, async ({ page }) => {
   const zh = locale === 'zh-CN'
   await page.setViewportSize({ width, height: 900 })
   await page.addInitScript(theme => localStorage.setItem('theme', theme), dark ? 'dark' : 'system')
   await page.goto(`${zh ? '/zh-CN' : ''}/explore/selections`)
   expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(dark ? 'UTC' : 'Australia/Perth')
   await expect(page.locator('html')).toHaveClass(dark ? /dark/ : /light/)
   const cohort = page.getByRole('combobox', { name: zh ? '当前联赛' : 'Active league', exact: true })
   await cohort.selectOption('competition:777')
   await page.getByRole('combobox', { name: zh ? '观察轮次' : 'Gameweek', exact: true }).selectOption('33')
   await expect(cohort).toHaveAttribute('aria-busy', 'false')
   const names = zh ? ['持有率', '队长选择', '转会'] : ['Ownership', 'Captaincy', 'Transfers']
   await expect(page.getByRole('tab')).toHaveText(names)
   const queryRequests: string[] = []
   page.on('request', request => {
    if (request.url().includes('/api/trends/') || request.url().includes('/api/graphql')) queryRequests.push(request.url())
   })
   const assertPanel = async (index: number) => {
    const tab = page.getByRole('tab', { name: names[index], exact: true })
    await expect(tab).toHaveAttribute('aria-selected', 'true')
    await expect(tab).toBeFocused()
    const panel = page.getByRole('tabpanel')
    await expect(panel).toHaveCount(1)
    await expect(panel).toHaveAttribute('aria-labelledby', (await tab.getAttribute('id'))!)
    await expect(panel.getByRole('heading', { name: names[index], exact: true, level: 2 })).toBeVisible()
    await expect(panel.getByRole('listitem')).toHaveCount(index === 2 ? 1 : 2)
    for (const row of await panel.getByRole('listitem').all()) {
     await expect(row.getByRole('link', { name: 'Saka', exact: true })).toBeVisible()
     await expect(row.getByText('72%', { exact: true })).toBeVisible()
    }
   }
   for (let index = 0; index < names.length; index++) {
    await page.getByRole('tab', { name: names[index], exact: true }).click()
    await assertPanel(index)
   }
   for (const [key, index] of [['Home', 0], ['ArrowRight', 1], ['End', 2], ['ArrowRight', 0], ['ArrowLeft', 2], ['Home', 0]] as const) {
    await page.getByRole('tab', { selected: true }).press(key)
    await assertPanel(index)
   }
   expect(queryRequests).toEqual([])
  })
 }
}

})
}
