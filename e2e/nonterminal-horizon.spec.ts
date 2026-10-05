import { expect, test, type Request } from '@playwright/test'

test.skip(process.env.E2E_NONTERMINAL_HORIZON !== '1', 'Requires its own standalone server and cache directory')
const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
async function control(rules: unknown[] = []) {
 const response = await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules }) })
 expect(response.ok).toBe(true)
}
test.afterEach(async () => { await control() })

for (const locale of ['en', 'zh-CN'] as const) {
test.describe(`FIX03 nonterminal ${locale}`, () => {
 if (locale === 'zh-CN') test.use({ viewport: { width: 390, height: 900 }, timezoneId: 'UTC', colorScheme: 'dark' })
 test('FIX03 nonterminal 5 to 8 to 3 ignores stale results and returns to the seed without requests', async ({ page, context }, testInfo) => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Requires isolated fixture controls')
  await page.addInitScript(() => {
   const original = window.fetch.bind(window)
   window.fetch = (input, init) => String(input).includes('/api/fixtures/window?')
    ? original(input, { ...init, signal: undefined })
    : original(input, init)
  })
  if (locale === 'zh-CN') {
   testInfo.annotations.push(...['FIX03.state.01', 'FIX03.state.02'].map(description => ({ type: 'coverage-variant', description })))
   await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
   expect((await context.cookies()).filter(cookie => /session/i.test(cookie.name))).toHaveLength(0)
  }
		await control([{ operation: 'GetCoreEventContext', data: { coreEventContext: {
			season: '2627', revision: 'horizon-gw30', sourceCheckedAt: '2026-08-13T09:40:00.000Z',
			currentEventId: 30, nextEventId: 31, latestFinishedEventId: 29,
			nextDeadlineTime: '2026-08-14T17:30:00.000Z'
		} } }])
		let release = () => {}
		let started = () => {}
		let settled = () => {}
		const gate = new Promise<void>(resolve => { release = resolve })
		const pending = new Promise<void>(resolve => { started = resolve })
		const done = new Promise<void>(resolve => { settled = resolve })
		let firstRequest: Request | undefined
		let finishFirst = (_: 'finished' | 'failed') => {}
		const firstTerminal = new Promise<'finished' | 'failed'>(resolve => { finishFirst = resolve })
		page.on('requestfinished', request => { if (request === firstRequest) finishFirst('finished') })
		page.on('requestfailed', request => { if (request === firstRequest) finishFirst('failed') })
		let requests = 0
		await page.route('**/api/fixtures/window?**', async route => {
			requests += 1
			if (requests === 1) {
				firstRequest = route.request()
				started()
				await gate
			}
			try { await route.continue() } catch { /* Selection may abort the stale request. */ }
			finally { settled() }
		})
		try {
			await page.goto(locale === 'en' ? '/explore/fixtures' : '/zh-CN/explore/fixtures')
   if (locale === 'zh-CN') {
    await expect(page.locator('html')).toHaveClass(/dark/)
    expect(page.viewportSize()?.width).toBe(390)
    expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('UTC')
   }
			const five = page.getByRole('button', { name: locale === 'en' ? '5 GWs' : '5 轮', exact: true })
			const eight = page.getByRole('button', { name: locale === 'en' ? '8 GWs' : '8 轮', exact: true })
			const three = page.getByRole('button', { name: locale === 'en' ? '3 GWs' : '3 轮', exact: true })
			await expect(page.getByRole('columnheader', { name: 'GW30', exact: true })).toBeVisible()
			await expect(five).toHaveAttribute('aria-pressed', 'true')
			await eight.click()
			await pending
			await expect(five).toHaveAttribute('aria-pressed', 'true')
			await expect(eight).toHaveAttribute('aria-busy', 'true')
			await three.click()
			await expect(three).toHaveAttribute('aria-pressed', 'true')
			release()
			await done
			const terminal = await firstTerminal
			expect(terminal).toBe('finished')
			const response = await firstRequest!.response()
			expect(response?.ok()).toBe(true)
			await response!.finished()
			// Observe after the terminal browser event and a rendering opportunity.
			await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
			await expect(three).toHaveAttribute('aria-pressed', 'true')
			await expect(page.getByRole('columnheader', { name: 'GW33', exact: true })).toHaveCount(0)
			await expect(page.getByRole('columnheader', { name: 'GW37', exact: true })).toHaveCount(0)
			await five.click()
			await expect(five).toHaveAttribute('aria-pressed', 'true')
			await expect(page.getByRole('columnheader', { name: 'GW34', exact: true })).toBeVisible()
			expect(requests).toBe(1)
			await eight.click()
			await expect(eight).toHaveAttribute('aria-pressed', 'true')
			await expect(page.getByRole('columnheader', { name: 'GW37', exact: true })).toBeVisible()
			expect(requests).toBe(2)
		} finally { release() }
	})

})
}

test.describe('GW01.state.02 preseason', () => {
 test.use({ viewport: { width: 390, height: 900 }, locale: 'zh-CN', timezoneId: 'UTC', colorScheme: 'dark' })
 test('only GW1 is selectable without inventing scores or fetching another round', async ({ page, context }, testInfo) => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Never inject preseason state into a production session')
  testInfo.annotations.push({ type: 'coverage-variant', description: 'GW01.state.02' })
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
  expect((await context.cookies()).filter(cookie => /session/i.test(cookie.name))).toHaveLength(0)
  await control([{ operation: 'GetGameweekDesk', data: { gameweekDesk: {
   season: '2627', coreRevision: 'preseason-core', scoreCoreRevision: null,
   anchorEventId: 1, eventId: 1, currentEventId: null, nextEventId: 1,
   isPreseason: true, lifecycle: 'SCHEDULED', deadlineTime: '2026-08-04T17:30:00.000Z',
   publishedAt: null, sourceCheckedAt: null, overviewState: 'PENDING', boardsState: 'PENDING',
   overview: null, dreamTeam: [], hauls: []
  } } }])
  const reads: string[] = []
  page.on('request', request => {
   const url = new URL(request.url())
   if (url.pathname === '/api/gameweek/desk') reads.push(url.searchParams.get('eventId') ?? '')
  })
  await page.goto('/zh-CN/explore/gameweek')
  await expect(page.locator('html')).toHaveClass(/dark/)
  expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('UTC')
  const input = page.locator('#gameweek-jump-input')
  const assertPreseason = async () => {
   await expect(page).toHaveURL(url => url.pathname === '/zh-CN/explore/gameweek' && url.search === '')
   await expect(input).toHaveValue('1')
   await expect(input).toHaveAttribute('aria-busy', 'false')
   await expect(page.getByText('GW1 尚未开始', { exact: true })).toBeVisible()
   await expect(page.getByText('官方截止时间已经公布，但目前还没有轮次积分或球员榜单。', { exact: true })).toBeVisible()
   await expect(page.getByRole('button', { name: '上一轮', exact: true })).toBeDisabled()
   await expect(page.getByRole('button', { name: '下一轮', exact: true })).toBeDisabled()
   await expect(page.locator('[aria-labelledby="home-team-of-week-title"]')).toHaveCount(0)
   await expect(page.getByRole('heading', { name: '得分上双球员', exact: true })).toHaveCount(0)
   await expect(page.locator('[data-gameweek-overview="true"]')).not.toContainText('Saka')
  }
  await assertPreseason()
  await expect(input).toHaveAttribute('min', '1')
  await expect(input).toHaveAttribute('max', '1')
  await page.getByRole('combobox', { name: '选择轮次', exact: true }).click()
  await expect(page.getByRole('option')).toHaveText(['第 1 轮'])
  await page.getByRole('option', { name: '第 1 轮', exact: true }).click()
  await assertPreseason()
  for (const draft of ['38', '0', '']) {
   await input.fill(draft)
   await input.press('Tab')
   await assertPreseason()
  }
  await input.fill('1')
  await input.press('Enter')
  await assertPreseason()
  expect(reads).toEqual([])
  const ledger = await (await fetch(fixture)).json()
  const deskReads = ledger.requests.filter((entry: { operation: string }) => entry.operation === 'GetGameweekDesk')
  expect(deskReads).toHaveLength(1)
  await testInfo.attach('preseason-selector-coverage', { contentType: 'application/json', body: JSON.stringify({
   variantId: 'GW01.state.02', identity: 'anonymous', locale: 'zh-CN', width: 390, theme: 'dark', timezone: 'UTC',
   selectedGameweek: 1, allowedOptions: [1], browserDeskReads: reads, serverDeskReads: deskReads.length,
   scopedFunctionalStatus: 'PASS', performanceStatus: 'NOT_RUN', readyMs: null, productionStatus: 'NOT_RUN'
  }) })
 })
})

const deadlineContexts = [
 ...['en', 'zh-CN'].flatMap(locale => [1440, 390].map(width => ({ id: `HOME05.A.${locale}.${width === 390 ? 'mobile390' : 'desktop1440'}.base`, locale, width, theme: 'system', timezone: 'Australia/Perth' }))),
 { id: 'HOME05.state.01', locale: 'zh-CN', width: 390, theme: 'dark', timezone: 'UTC' }
]
for (const variant of deadlineContexts) {
 test.describe(variant.id, () => {
  test.use({ locale: variant.locale, viewport: { width: variant.width, height: 900 }, timezoneId: variant.timezone, colorScheme: variant.theme === 'dark' ? 'dark' : 'light' })
  test('HOME05 between rounds keeps the next deadline through hydration and locale switching', async ({ page, context }, testInfo) => {
   test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Synthetic lifecycle is isolated only')
   const seed = await (await fetch(fixture.replace('/__performance', '/graphql'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: 'query GetHomePublicBootstrap { homePublicBootstrap { context { revision } } }' }) })).json()
   const deadline = new Date()
   deadline.setUTCDate(deadline.getUTCDate() + 7)
   deadline.setUTCHours(23, 30, 0, 0)
   const captured = deadline.toISOString()
   Object.assign(seed.data.homePublicBootstrap.context, { currentEventId: 33, latestFinishedEventId: 33, nextEventId: 34, nextDeadlineTime: captured, revision: 'home05-between-rounds' })
   for (const match of seed.data.homePublicBootstrap.fixtures) Object.assign(match, { kickoffTime: new Date(deadline.getTime() + 3_600_000).toISOString(), started: false, finished: false, homeScore: null, awayScore: null })
   await control([{ operation: 'GetHomePublicBootstrap', data: seed.data }])
   await page.addInitScript(theme => localStorage.setItem('theme', theme), variant.theme)
   expect((await context.cookies()).filter(cookie => /session/i.test(cookie.name))).toHaveLength(0)
   const errors: string[] = []
   page.on('pageerror', error => errors.push(error.message))
   page.on('console', message => { if (message.type() === 'error' && /hydrat|did not match/i.test(message.text())) errors.push(message.text()) })
   const format = (locale: string, timeZone: string) => new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short', timeZone }).format(deadline)
   const pathname = variant.locale === 'en' ? '/' : '/zh-CN'
   const response = await page.goto(pathname)
   expect(await response!.text()).toContain(format(variant.locale, 'UTC'))
   const card = page.locator('[data-countdown-card]')
   await expect(card.locator('[data-countdown-title]')).toHaveText(variant.locale === 'en' ? 'Gameweek 34' : '第 34 轮')
   await expect(card.locator('time')).toHaveText(format(variant.locale, variant.timezone))
   await expect(page.locator('[data-home-fixtures-event]')).toHaveAttribute('data-home-fixtures-event', '34')
   await expect(page.locator('html')).toHaveClass(variant.theme === 'dark' ? /dark/ : /light/)
   expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(variant.timezone)
   const nextLocale = variant.locale === 'en' ? 'zh-CN' : 'en'
   await page.locator('[data-locale-picker] > summary').filter({ visible: true }).click()
   await page.locator(`[data-locale-link][lang="${nextLocale}"]`).filter({ visible: true }).click()
   // An explicit locale switch uses the prefixed link to update NEXT_LOCALE.
   await expect(page).toHaveURL(`/${nextLocale}`)
   await expect(card.locator('[data-countdown-title]')).toHaveText(nextLocale === 'en' ? 'Gameweek 34' : '第 34 轮')
   await expect(card.locator('time')).toHaveText(format(nextLocale, variant.timezone))
   await expect(page.locator('[data-home-fixtures-event]')).toHaveAttribute('data-home-fixtures-event', '34')
   expect(errors).toEqual([])
   await testInfo.attach('HOME05-context', { contentType: 'application/json', body: JSON.stringify({ ...variant, currentEventId: 33, latestFinishedEventId: 33, nextEventId: 34, deadline: captured, revision: 'home05-between-rounds', switchedLocale: nextLocale, assertions: ['UTC SSR', 'local hydration', 'next GW deadline', 'next GW fixtures', 'actual locale switch preserves GW'], performanceStatus: 'NOT_RUN', readyMs: null }) })
  })
 })
}


for (const locale of ['en', 'zh-CN'] as const) for (const width of [1440, 390]) {
 const variantId = `FIX03.A.${locale}.${width === 390 ? 'mobile390' : 'desktop1440'}.base`
 test.describe(`FIX03 baseline ${variantId}`, () => {
  test.use({ locale, viewport: { width, height: 900 }, timezoneId: 'Australia/Perth', colorScheme: 'light' })
  test('normal horizon changes commit exact columns and reuse completed windows', async ({ page, context }, testInfo) => {
   test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Isolated fixture only')
   await page.addInitScript(() => localStorage.setItem('theme', 'system'))
   expect((await context.cookies()).filter(cookie => /session/i.test(cookie.name))).toHaveLength(0)
   await control([{ operation: 'GetCoreEventContext', data: { coreEventContext: { season: '2627', revision: 'horizon-baseline30', sourceCheckedAt: '2026-08-13T09:40:00.000Z', currentEventId: 30, nextEventId: 31, latestFinishedEventId: 29, nextDeadlineTime: '2026-08-14T17:30:00.000Z' } } }])
   const requests: string[] = []
   page.on('request', request => { if (new URL(request.url()).pathname === '/api/fixtures/window') requests.push(request.url()) })
   await page.goto(locale === 'en' ? '/explore/fixtures' : '/zh-CN/explore/fixtures')
   await expect(page.locator('html')).toHaveClass(/light/)
   expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('system')
   expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('Australia/Perth')
   const button = (count: number) => page.getByRole('button', { name: locale === 'en' ? `${count} GWs` : `${count} 轮`, exact: true })
   const assertWindow = async (count: number) => {
    await expect(button(count)).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('columnheader', { name: /^GW\d+$/ })).toHaveCount(count)
    for (let gw = 30; gw < 30 + count; gw++) await expect(page.getByRole('columnheader', { name: `GW${gw}`, exact: true })).toBeVisible()
    await expect(page.getByRole('region', { name: locale === 'en' ? 'Team FDR' : '球队 FDR', exact: true }).locator('tbody tr')).toHaveCount(3)
   }
   await assertWindow(5)
   const before = requests.length
   await button(8).click(); await assertWindow(8)
   expect(requests.length).toBe(before + 1)
   await button(3).click(); await assertWindow(3)
   await button(5).click(); await assertWindow(5)
   await button(8).click(); await assertWindow(8)
   expect(requests.length).toBe(before + 1)
   await testInfo.attach('FIX03-baseline-context', { contentType: 'application/json', body: JSON.stringify({ variantId, identity: 'A', locale, width, theme: 'system', timezone: 'Australia/Perth', fromGw: 30, sequence: [5,8,3,5,8], windowRequests: requests.length - before, readyMs: null, performanceStatus: 'NOT_RUN', wholeVariantComplete: false }) })
  })
 })
}


test.describe('FIX03 first-round matrix directed context', () => {
 test.use({ locale: 'zh-CN', viewport: { width: 390, height: 900 }, timezoneId: 'UTC', colorScheme: 'dark' })
 test('FIX03 GW1 renders actual matrix before horizon changes', async ({ page, context }, testInfo) => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Isolated first-round context')
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
  expect((await context.cookies()).some(cookie => /session/i.test(cookie.name))).toBe(false)
  await control([{ operation: 'GetCoreEventContext', data: { coreEventContext: { season: '2627', revision: 'fix03-gw1', sourceCheckedAt: '2026-08-13T09:40:00.000Z', currentEventId: 1, nextEventId: 2, latestFinishedEventId: null, nextDeadlineTime: '2026-08-14T17:30:00.000Z' } } }])
  await page.goto('/zh-CN/explore/fixtures')
  const matrix = page.getByRole('region', { name: '球队 FDR', exact: true })
  const check = async (count: number) => {
   for (let gw = 1; gw <= count; gw++) await expect(matrix.getByRole('columnheader', { name: `GW${gw}`, exact: true })).toBeVisible()
   await expect(matrix.getByRole('columnheader', { name: 'GW0', exact: true })).toHaveCount(0)
   await expect(matrix.getByRole('columnheader', { name: `GW${count + 1}`, exact: true })).toHaveCount(0)
   await expect(matrix.locator('tbody tr')).toHaveCount(3)
   await expect(matrix).toContainText('Arsenal')
  }
  await check(5)
  await page.getByRole('button', { name: '3 轮', exact: true }).click()
  await check(3)
  await page.getByRole('button', { name: '5 轮', exact: true }).click()
  await check(5)
  await expect(page.locator('html')).toHaveClass(/dark/)
  expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('UTC')
  await testInfo.attach('FIX03-first-round-matrix', { contentType: 'application/json', body: JSON.stringify({ variantId: 'FIX03.state.03', stepId: 'FIX03.03', fromGw: 1, sequence: [5,3,5], functionalStatus: 'PASS', performanceStatus: 'NOT_RUN', readyMs: null, wholeVariantComplete: false }) })
 })
})
