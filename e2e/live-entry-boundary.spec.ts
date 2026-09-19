import { expect, test } from '@playwright/test'

test.describe.configure({ mode: 'serial' })
test.use({ timezoneId: 'Australia/Perth', colorScheme: 'light' })
test.beforeEach(async ({ page }) => {
 await page.addInitScript(() => localStorage.setItem('theme', 'system'))
})

test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Requires isolated local GraphQL fixture')
test.skip(process.env.E2E_LIVE_ENTRY_BOUNDARY !== '1', 'Run in the dedicated entry-boundary fixture process')

for (const locale of ['en', 'zh-CN']) {
 for (const width of [1440, 390]) {
 const zh = locale === 'zh-CN'
 const prefix = zh ? '/zh-CN' : ''
for (const id of ['abc', '0', '-1', '2147483648', '1e3', '0x7b', '0123', '+123']) {
 test(`invalid live entry ${id} ${locale} ${width}px returns not-found without browser business reads`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  const businessReads: string[] = []
  page.on('request', request => {
   if (!request.url().includes('/api/graphql')) return
   const body = request.postDataJSON()
   if (/GetEntry|GetLiveCalcPoints/.test(body?.operationName ?? '')) {
    businessReads.push(body.operationName)
   }
  })
  const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
  const before = await (await fetch(fixture)).json()
  const response = await page.goto(`${prefix}/live/points/${id}?gw=3`)
  await expect(page.getByRole('heading', { name: zh ? '找不到页面' : 'Page not found', exact: true })).toBeVisible()
  // Next.js streamed notFound responses retain HTTP 200; non-streamed use 404.
  expect([200, 404]).toContain(response?.status())
  await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached()
  const after = await (await fetch(fixture)).json()
  const entryReads = after.requests.slice(before.requests.length).filter(
   (r: { operation: string; variables: { id?: number | null; entryId?: number | null } }) =>
    /^(GetEntry|GetLiveCalcPoints)$/.test(r.operation) &&
    (r.variables.entryId ?? r.variables.id ?? null) === (Number.isNaN(Number(id)) ? null : Number(id))
  )
  expect(entryReads).toEqual([])
  expect(businessReads).toEqual([])
  await page.getByRole('link', { name: zh ? '返回首页' : 'Back to dashboard', exact: true }).click()
  await expect(page).toHaveURL(url => url.pathname === (prefix || '/') || url.pathname === `${prefix}/`)
 })
}

 test(`valid live entry preserves GW and return ${locale} ${width}px`, async ({ page, context }, testInfo) => {
  await page.setViewportSize({ width, height: 900 })
  const target = `${prefix}/live/points/123?gw=3&tournamentId=6`
  const response = await page.goto(target)
  expect(response?.status()).toBe(200)
  expect(response?.request().redirectedFrom()).toBeNull()
  const pitch = page.getByRole('region', { name: zh ? 'E2E United 阵型' : 'E2E United formation', exact: true })
  await expect(pitch.getByRole('heading', { name: 'E2E United', exact: true })).toBeVisible()
  await expect(pitch.getByRole('button')).toHaveCount(15)
  const assertContext = async () => {
   await expect(page).toHaveURL(url => url.pathname === `${prefix}/live/points/123` && url.searchParams.get('gw') === '3' && url.searchParams.get('tournamentId') === '6')
   await expect(pitch.getByRole('heading', { name: 'E2E United', exact: true })).toBeVisible()
   await expect(pitch.getByRole('button')).toHaveCount(15)
   const starters = pitch.locator('ol[aria-label]')
   const bench = pitch.locator('ol:not([aria-label])')
   await expect(starters.getByRole('button')).toHaveCount(11)
   await expect(bench.getByRole('button')).toHaveCount(4)
   for (let player = 1; player <= 15; player += 1) {
    await expect((player <= 11 ? starters : bench).getByRole('button', { name: new RegExp(`Player ${player}\\b`) })).toBeVisible()
   }
   const captain = starters.locator('li').filter({ has: page.getByRole('button', { name: /Player 1\b/ }) })
   const vice = starters.locator('li').filter({ has: page.getByRole('button', { name: /Player 2\b/ }) })
   await expect(captain.getByRole('img', { name: zh ? '队长' : 'Captain', exact: true })).toBeVisible()
   await expect(vice.getByRole('img', { name: zh ? '副队长' : 'Vice-captain', exact: true })).toBeVisible()
   await expect(page.getByRole('link', { name: zh ? '返回赛事' : 'Back to competition', exact: true })).toHaveAttribute('href', `${prefix}/live/competitions?tournamentId=6&gw=3`)
  }
  await assertContext()
  const preflight = await page.evaluate(() => ({
   timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
   theme: localStorage.getItem('theme'),
   systemDark: matchMedia('(prefers-color-scheme: dark)').matches,
   renderedDark: document.documentElement.classList.contains('dark'),
   width: innerWidth,
   height: innerHeight
  }))
  expect(preflight).toEqual({ timezone: 'Australia/Perth', theme: 'system', systemDark: false, renderedDark: false, width, height: 900 })
  const hasSession = (await context.cookies()).some(cookie => /session_token/.test(cookie.name))
  expect(hasSession).toBe(false)
  await testInfo.attach('R26-variant-preflight', { body: JSON.stringify({ ...preflight, hasSession, locale, entry: 123, gw: 3, tournament: 6 }), contentType: 'application/json' })
  expect((await page.reload())?.status()).toBe(200)
  await assertContext()
  // A neutral history entry exercises browser restoration without implying a
  // site-link journey or requiring access to the protected tournament route.
  await page.goto('about:blank')
  await page.goBack()
  await assertContext()
  await page.goForward()
  await expect(page).toHaveURL('about:blank')
  await page.goBack()
  await assertContext()
 })
 }
}

for (const locale of ['en', 'zh-CN']) {
 for (const width of [1440, 390]) {
  test(`R26 anonymous home highest score click and return ${locale} ${width}px`, async ({ page }) => {
   const zh = locale === 'zh-CN'
   const prefix = zh ? '/zh-CN' : ''
   await page.setViewportSize({ width, height: 900 })
   await page.goto(prefix || '/')
   const entryLink = page.getByRole('link', { name: zh ? '最高分: 101' : 'Highest Score: 101', exact: true })
   await expect(entryLink).toHaveCount(1)
   await expect(entryLink).toBeVisible()
   await expect(entryLink).toHaveAttribute('href', `${prefix}/live/points/15702?gw=33&from=home`)
   await entryLink.click()
   await expect(page).toHaveURL(url => url.pathname === `${prefix}/live/points/15702` && url.searchParams.get('gw') === '33' && url.searchParams.get('from') === 'home' && !url.searchParams.has('tournamentId'))
   const pitch = page.getByRole('region', { name: zh ? 'E2E United 阵型' : 'E2E United formation', exact: true })
   await expect(pitch.getByRole('heading', { name: 'E2E United', exact: true })).toBeVisible()
   await expect(pitch.locator('ol[aria-label]').getByRole('button')).toHaveCount(11)
   await expect(pitch.locator('ol:not([aria-label])').getByRole('button')).toHaveCount(4)
   const back = page.getByRole('link', { name: zh ? '返回首页' : 'Back to home', exact: true })
   await expect(back).toHaveAttribute('href', prefix || '/')
   await back.click()
   await expect(page).toHaveURL(url => url.pathname === (prefix || '/'))
   await expect(entryLink).toBeVisible()
  })
 }
}

for (const locale of ['en', 'zh-CN']) {
 for (const width of [1440, 390]) {
  test(`R26 browser cache ready samples ${locale} ${width}px`, async ({ page, context }, testInfo) => {
   test.setTimeout(90_000)
   await page.setViewportSize({ width, height: 900 })
   const cdp = await context.newCDPSession(page)
   const observations: Array<{ loaderId: string; sample: { metricName: string; measurementKind?: string; result?: string; value?: number } }> = []
   cdp.on('Network.requestWillBeSent', async event => {
    if (new URL(event.request.url).pathname !== '/api/vitals') return
    const postData = event.request.postData ?? (await cdp.send('Network.getRequestPostData', { requestId: event.requestId })).postData
    const body = JSON.parse(postData)
    for (const sample of body.samples ?? []) observations.push({ loaderId: event.loaderId, sample })
   })
   const rows: Array<Record<string, unknown>> = []
   await cdp.send('Network.enable')
   try {
    for (const cacheMode of ['cold', 'warm']) {
     await cdp.send('Network.setCacheDisabled', { cacheDisabled: cacheMode === 'cold' })
     for (let sampleIndex = 1; sampleIndex <= 5; sampleIndex++) {
      const driverStart = performance.now()
      const target = `${locale === 'en' ? '' : '/zh-CN'}/live/points/123?gw=3&tournamentId=6`
      await page.goto(target)
      await expect(page).toHaveURL(new URL(target, testInfo.project.use.baseURL).href)
      const { frameTree } = await cdp.send('Page.getFrameTree')
      const loaderId = frameTree.frame.loaderId
      const ready = page.locator('[data-live-points-ready="true"][data-live-entry="123"][data-live-gw="3"][data-selected-gw="3"]')
      await expect(ready).toBeAttached()
      const pitch = page.getByRole('region', { name: locale === 'en' ? 'E2E United formation' : 'E2E United 阵型', exact: true })
      await expect(pitch).toBeVisible()
      await expect(pitch.locator('ol[aria-label]').getByRole('button')).toHaveCount(11)
      await expect(pitch.locator('ol:not([aria-label])').getByRole('button')).toHaveCount(4)
      await expect.poll(() => observations.filter(o => o.loaderId === loaderId && o.sample.metricName === 'LIVE_POINTS_READY').length).toBe(1)
      const metric = observations.find(o => o.loaderId === loaderId && o.sample.metricName === 'LIVE_POINTS_READY')!.sample
      expect(metric.result).toBe('ok')
      expect(metric.measurementKind).toBe('initial_navigation')
      expect(Number.isFinite(metric.value)).toBe(true)
      expect(metric.value).toBeGreaterThanOrEqual(0)
      rows.push({ caseId: 'R26', locale, width, cacheMode, sampleIndex, loaderId, url: page.url(), entry: 123, gw: 3, revision: await ready.getAttribute('data-live-revision'), readyMs: metric.value, eventToPaintMs: null, toolElapsedMs: performance.now() - driverStart, budgetMs: 2500, functionalStatus: 'PASS', performanceStatus: metric.value! <= 2500 ? 'PASS' : 'FAIL', scope: 'isolated fixture; existing ready marker observes commit, not paint; browser cache only' })
     }
    }
   } finally {
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: false })
    await cdp.detach()
    await testInfo.attach('R26-cache-samples', { contentType: 'application/json', body: JSON.stringify(rows) })
    await testInfo.attach('R26-metric-observations', { contentType: 'application/json', body: JSON.stringify(observations) })
   }
  })
 }
}

for (const locale of ['en', 'zh-CN']) {
 for (const width of [1440, 390]) {
  test(`S10 entry return and revision replacement ${locale} ${width}px`, async ({ page }, testInfo) => {
   const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}`
   const control = async (rules: unknown[]) => {
    const response = await fetch(`${fixture}/__performance`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rules }) })
    expect(response.ok).toBe(true)
   }
   await control([])
   const seed = await (await fetch(`${fixture}/graphql`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-LetLetMe-Contract': 'live-points-v2' }, body: JSON.stringify({ query: 'query GetLiveCalcPoints { fixture }', variables: { entryId: 123, eventId: 3 } }) })).json()
   expect(seed.data.calcLivePointsByEntry.entry).toBe(123)
   const changed = JSON.parse(JSON.stringify(seed.data).replaceAll('a'.repeat(64), 'b'.repeat(64)))
   changed.calcLivePointsByEntry.entryName = 'Updated United'
   const prefix = locale === 'en' ? '' : '/zh-CN'
   await page.setViewportSize({ width, height: 900 })
   const target = (entry: number) => `${prefix}/live/points/${entry}?gw=3&tournamentId=6`
   const assertEntry = async (entry: number, revision: string, name: string) => {
    await expect(page).toHaveURL(new URL(target(entry), testInfo.project.use.baseURL).href)
    const ready = page.locator(`[data-live-points-ready="true"][data-live-entry="${entry}"][data-live-gw="3"][data-selected-gw="3"]`)
    await expect(ready).toHaveAttribute('data-live-revision', revision)
    const pitch = page.getByRole('region', { name: `${name} ${locale === 'en' ? 'formation' : '阵型'}`, exact: true })
    await expect(pitch).toBeVisible()
    await expect(pitch.getByRole('button')).toHaveCount(15)
   }
   try {
    await page.goto(target(123))
    await assertEntry(123, 'a'.repeat(64), 'E2E United')
    await page.goto(target(456))
    await assertEntry(456, 'a'.repeat(64), 'E2E United')
    await page.goBack()
    await assertEntry(123, 'a'.repeat(64), 'E2E United')
    await control([{ operation: 'GetLiveCalcPoints', variables: { entryId: 123, eventId: 3 }, data: changed }])
    await page.reload()
    await assertEntry(123, 'b'.repeat(64), 'Updated United')
    await expect(page.getByRole('region', { name: `${'E2E United'} ${locale === 'en' ? 'formation' : '阵型'}`, exact: true })).toHaveCount(0)
    await testInfo.attach('S10-entry-revision', { contentType: 'application/json', body: JSON.stringify({ locale, width, entries: [123, 456, 123], gw: 3, revisions: ['a'.repeat(64), 'b'.repeat(64)], navigation: 'direct A/B, actual browser Back, reload after fixture revision update', functionalStatus: 'PASS', performanceStatus: 'NOT_RUN', readyMs: null }) })
   } finally {
    await control([])
   }
  })
 }
}
