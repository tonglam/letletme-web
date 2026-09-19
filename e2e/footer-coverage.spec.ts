import { expect, test } from '@playwright/test'
import { menuItems } from '../components/layout/config'

for (const dark of [false, true]) {
test.describe(dark ? 'UTC dark state' : 'Perth baseline', () => {
test.use({ timezoneId: dark ? 'UTC' : 'Australia/Perth', colorScheme: dark ? 'dark' : 'light' })
for (const locale of dark ? ['zh-CN'] : ['en', 'zh-CN']) {
 for (const width of dark ? [390] : [1440, 390]) {
  test(`C11 anonymous footer links and QR ${locale} ${width}px`, async ({ page }, testInfo) => {
   test.setTimeout(90_000)
   const prefix = locale === 'zh-CN' ? '/zh-CN' : ''
   await page.setViewportSize({ width, height: 900 })
   await page.addInitScript(theme => localStorage.setItem('theme', theme), dark ? 'dark' : 'system')
   const expected = menuItems.flatMap(group => group.items.map(item => prefix + item.href))
   const observed: Array<{ href: string; finalUrl: string }> = []
   for (const href of expected) {
    await page.goto(`${prefix}/explore/player-stats`)
    expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(dark ? 'UTC' : 'Australia/Perth')
    await expect(page.locator('html')).toHaveClass(dark ? /dark/ : /light/)
    const footer = page.getByRole('contentinfo')
    expect(await footer.locator('nav a').evaluateAll(links => links.map(link => link.getAttribute('href')))).toEqual(expected)
    const link = footer.locator(`nav a[href="${href}"]`)
    await expect(link).toHaveCount(1)
    await link.click()
    const protectedPaths = ['/live/points', '/live/competitions', '/my-fpl/team', '/my-fpl/competitions', '/competitions/browse', '/competitions/create']
    const protectedTarget = protectedPaths.includes(href.slice(prefix.length))
    await expect(page).toHaveURL(url => protectedTarget
     ? url.pathname === `${prefix}/auth/login` && url.searchParams.get('next') === href
     : url.pathname === href)
    await expect(page.getByRole('main')).toBeVisible()
    observed.push({ href, finalUrl: page.url() })
   }
   const footer = page.getByRole('contentinfo')
   const external = footer.locator('a[href^="https://"]')
   await expect(external).toHaveCount(1)
   await expect(external).toHaveAttribute('href', 'https://beian.miit.gov.cn/')
   await expect(external).toHaveAttribute('target', '_blank')
   await expect(external).toHaveAttribute('rel', 'noopener noreferrer')
   const disclosure = footer.locator('details[data-mini-program-popover]')
   const trigger = disclosure.locator(':scope > summary')
   await trigger.click()
   const panel = disclosure.getByRole('group')
   await expect(panel).toBeVisible()
   const image = panel.locator('img').filter({ visible: true })
   await expect(image).toHaveCount(1)
   await expect.poll(() => image.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
   const bounds = await panel.boundingBox()
   expect(bounds).not.toBeNull()
   expect(bounds!.x).toBeGreaterThanOrEqual(0)
   expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
   await trigger.click()
   await expect(panel).toBeHidden()
   await testInfo.attach('footer-click-targets', { body: JSON.stringify(observed), contentType: 'application/json' })
  })
 }
}

})
}
