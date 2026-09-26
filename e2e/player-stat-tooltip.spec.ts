import { expect, test } from '@playwright/test'

for (const bootstrap of ['normal', 'delayed'] as const) {
for (const locale of ['en', 'zh-CN']) {
 test(`C08 player stat tooltip supports keyboard ${locale} ${bootstrap}`, async ({ page }, testInfo) => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Requires isolated synthetic player fixtures')
  const zh = locale === 'zh-CN'
  await page.setViewportSize({ width: 1440, height: 900 })
  let ready = false
  await page.route('**/api/vitals', async route => {
   const payload = route.request().postDataJSON()
   ready ||= (payload.samples ?? []).some((sample: { metricName: string }) => sample.metricName === 'LIVE_POINTS_READY')
   await route.fulfill({ status: 204 })
  })
  let releaseScripts!: () => void
  const scriptsHeld = new Promise<void>(resolve => { releaseScripts = resolve })
  let heldScriptCount = 0
  if (bootstrap === 'delayed') await page.route('**/_next/static/**', async route => {
   if (route.request().resourceType() === 'script') { heldScriptCount++; await scriptsHeld }
   await route.continue()
  })
  try {
  await page.goto(`${zh ? '/zh-CN' : ''}/live/points/123?gw=33`, { waitUntil: bootstrap === 'delayed' ? 'commit' : 'load' })
  const row = page.locator('div[role="button"]').filter({ has: page.getByText('Player 1', { exact: true }) }).first()
  await expect(row).toBeVisible()
  if (bootstrap === 'delayed') {
   expect(heldScriptCount).toBeGreaterThan(0)
   expect(ready).toBe(false)
   releaseScripts()
  }
  // SSR visibility does not prove tooltip event handlers have hydrated.
  await expect.poll(() => ready).toBe(true)
  const desk = page.locator('[data-live-points-ready="true"]')
  await expect(desk).toHaveAttribute('data-live-entry', '123')
  await expect(desk).toHaveAttribute('data-live-gw', '33')
  const stat = row.locator('..').locator('[aria-label]').filter({ hasText: 'MIN' }).first()
  await stat.hover()
  const tooltip = page.getByRole('tooltip')
  await expect(tooltip).toBeVisible()
  await expect(tooltip).toContainText('45')
  await page.keyboard.press('Escape')
  await expect(tooltip).toHaveCount(0)
  await page.mouse.move(0, 0)
  await row.focus()
  await page.keyboard.press('Tab')
  await expect(stat).toBeFocused()
  expect(await stat.evaluate(el => el.closest('[role="button"]'))).toBeNull()
  await expect(tooltip).toBeVisible()
  await expect(tooltip).toHaveText(await stat.getAttribute('aria-label') ?? '')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.keyboard.press('Enter')
  await page.keyboard.press('Space')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(tooltip).toHaveCount(0)
  await expect(stat).toBeFocused()
  await row.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Player 1', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(row).toBeFocused()
  await testInfo.attach('tooltip-readiness', { contentType: 'application/json', body: JSON.stringify({
   locale, bootstrap, heldScriptCount, entryId: 123, gameweek: 33,
   readyBeforeHover: ready, hoverAndKeyboardAssertions: 'PASS', performanceStatus: 'NOT_OBSERVED'
  }) })
  } finally { releaseScripts() }
 })
}

}
