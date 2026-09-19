import { expect, test, type Response } from '@playwright/test'
import en from '../messages/en.json'
import zh from '../messages/zh-CN.json'

// Frozen matrix route IDs. Anonymous expectations do not stand in for owner/admin journeys.
const targets = [
 ['R12', '/competitions/6/manage'],
 ['R14', '/competitions/browse'],
 ['R15', '/competitions/create'],
 ['R23', '/live/competitions/6?gw=4'],
 ['R24', '/live/competitions?tournamentId=6&gw=4'],
 ['R27', '/live/points?gw=4'],
 ['R28', '/my-fpl/competitions?tournamentId=6&gw=4'],
 ['R29', '/my-fpl/team?gw=4'],
 ['R30', '/onboarding/bind-entry'],
 ['R32', '/profile'],
 ['R33', '/profile/sessions']
] as const

async function redirectChain(response: Response | null) {
 expect(response).not.toBeNull()
 const chain: Array<{ url: string; status: number; location: string | null }> = []
 for (let request = response!.request(); request; ) {
  const hop = await request.response()
  expect(hop).not.toBeNull()
  const url = new URL(request.url())
  chain.unshift({ url: url.pathname + url.search, status: hop!.status(), location: await hop!.headerValue('location') })
  const previous = request.redirectedFrom()
  if (!previous) break
  request = previous
 }
 return chain
}

test.use({ timezoneId: 'Australia/Perth', colorScheme: 'light' })
for (const locale of ['en', 'zh-CN'] as const) {
 for (const width of [1440, 390]) {
  const prefix = locale === 'en' ? '' : '/zh-CN'
  const t = (locale === 'en' ? en : zh).Auth
  for (const [caseId, route] of targets) {
   test(`${caseId} anonymous deep link reload back forward ${locale} ${width}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(() => localStorage.setItem('theme', 'system'))
    let writes = 0
    page.on('request', request => {
     if (new URL(request.url()).pathname.startsWith('/api/') && !['GET', 'HEAD'].includes(request.method())) writes++
    })
    await page.goto(`${prefix}/auth/forgot-password`)
    await expect(page.getByLabel(t.email, { exact: true })).toBeEnabled()
    const requested = prefix + route
    const chain = await redirectChain(await page.goto(requested))
    expect(chain[0].url).toBe(requested)
    expect(chain).toHaveLength(2)
    expect(chain[0].status).toBe(307)
    expect(chain[1].status).toBe(200)
    const assertLoginReady = async () => {
     await expect(page).toHaveURL(url => url.pathname === `${prefix}/auth/login` && url.searchParams.get('next') === requested)
     await expect(page.getByLabel(t.email, { exact: true })).toBeEnabled()
     await expect(page.getByLabel(t.password, { exact: true })).toBeEnabled()
     await expect(page.getByRole('button', { name: t.signIn, exact: true })).toBeEnabled()
    }
    await assertLoginReady()
    const reload = await page.reload()
    expect(reload?.status()).toBe(200)
    await assertLoginReady()
    await page.goBack()
    await expect(page).toHaveURL(url => url.pathname === `${prefix}/auth/forgot-password`)
    await expect(page.getByLabel(t.email, { exact: true })).toBeEnabled()
    await page.goForward()
    await assertLoginReady()
    expect(writes).toBe(0)
    expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('Australia/Perth')
    await expect(page.locator('html')).toHaveClass(/light/)
    await testInfo.attach('route-matrix-evidence', { contentType: 'application/json', body: JSON.stringify({
     caseId, stepIds: [`${caseId}.01`, `${caseId}.02`, `${caseId}.04`, `${caseId}.05`],
     environment: 'isolated-fixture', identity: 'anonymous', locale, viewport: { width, height: 900 },
     timezone: 'Australia/Perth', theme: 'system-light', requested, chain, finalUrl: page.url(),
     assertions: ['exact two-hop redirect', 'exact next including GW/entity query', 'hydrated login fields and submit ready', 'reload', 'Back to previous form', 'Forward to same protected destination login', 'no API writes'],
     readyMs: null, eventToPaintMs: null, performanceStatus: 'NOT_OBSERVED', wholeCaseComplete: false
    }) })
   })
  }
 }
}
