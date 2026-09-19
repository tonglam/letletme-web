import { expect, test, type Response } from '@playwright/test'
import en from '../messages/en.json'
import zh from '../messages/zh-CN.json'

test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Requires isolated anonymous fixture; external origins need separate release-bound evidence')

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
    const expectedLogin = new URL(`${prefix}/auth/login`, testInfo.project.use.baseURL)
    expectedLogin.searchParams.set('next', requested)
    expect(chain[1].url).toBe(expectedLogin.pathname + expectedLogin.search)
    expect(new URL(chain[0].location!, testInfo.project.use.baseURL).href).toBe(expectedLogin.href)
    const assertLoginReady = async () => {
     await expect(page).toHaveURL(expectedLogin.href)
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

for (const locale of ['en', 'zh-CN'] as const) {
 for (const width of [1440, 390]) {
  for (const [caseId, route] of [['R01', '/acceptance-missing-route'], ['R02', '/admin/data-governance']] as const) {
   test(`${caseId} anonymous hidden route terminal and history ${locale} ${width}`, async ({ page }, testInfo) => {
    const prefix = locale === 'en' ? '' : '/zh-CN'
    const t = (locale === 'en' ? en : zh).Auth
    const requested = prefix + route
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(() => localStorage.setItem('theme', 'system'))
    let writes = 0
    page.on('request', request => {
     if (new URL(request.url()).pathname.startsWith('/api/') && !['GET', 'HEAD'].includes(request.method())) writes++
    })
    await page.goto(`${prefix}/auth/forgot-password`)
    await expect(page.getByLabel(t.email, { exact: true })).toBeEnabled()
    const chain = await redirectChain(await page.goto(requested))
    expect(chain).toEqual([{ url: requested, status: 404, location: null }])
    const assertHidden = async () => {
     await expect(page).toHaveURL(url => url.pathname === requested)
     await expect(page.getByRole('heading', { name: locale === 'en' ? 'Page not found' : '找不到页面', exact: true })).toBeVisible()
     await expect(page.getByRole('link', { name: locale === 'en' ? 'Back to dashboard' : '返回首页', exact: true })).toBeVisible()
     await expect(page.getByRole('main')).not.toContainText('scheduler_obligations')
    }
    await assertHidden()
    expect((await page.reload())?.status()).toBe(404)
    await assertHidden()
    await page.goBack()
    await expect(page.getByLabel(t.email, { exact: true })).toBeEnabled()
    await expect(page).toHaveURL(url => url.pathname === `${prefix}/auth/forgot-password`)
    await page.goForward()
    await assertHidden()
    expect(writes).toBe(0)
    await testInfo.attach('hidden-route-evidence', { contentType: 'application/json', body: JSON.stringify({ caseId, stepIds: [`${caseId}.01`, `${caseId}.02`, `${caseId}.04`, `${caseId}.05`], identity: 'anonymous', environment: 'isolated-fixture', locale, viewport: { width, height: 900 }, requested, chain, terminal: 'NOT_FOUND', assertions: ['single response 404 without redirect', 'localized not-found heading and recovery link', 'reload 404', 'Back to previous form', 'Forward restores not-found', 'no API writes'], readyMs: null, performanceStatus: 'NOT_RUN', wholeCaseComplete: false }) })
   })
  }
 }
}
