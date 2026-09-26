import { expect, test, type Request } from '@playwright/test'

test.skip(process.env.E2E_NONTERMINAL_HORIZON !== '1', 'Requires its own standalone server and cache directory')
const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
async function control(rules: unknown[] = []) {
 const response = await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules }) })
 expect(response.ok).toBe(true)
}
test.afterEach(async () => { await control() })

	test('FIX03 nonterminal 5 to 8 to 3 ignores stale results and returns to the seed without requests', async ({ page }) => {
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
			await page.goto('/explore/fixtures')
			const five = page.getByRole('button', { name: '5 GWs', exact: true })
			const eight = page.getByRole('button', { name: '8 GWs', exact: true })
			const three = page.getByRole('button', { name: '3 GWs', exact: true })
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
			if (terminal === 'failed') {
				expect(firstRequest?.failure()?.errorText).toMatch(/aborted|cancelled/i)
			} else {
				const response = await firstRequest!.response()
				expect(response?.ok()).toBe(true)
				await response!.finished()
			}
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
