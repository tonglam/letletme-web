import { expect, test } from '@playwright/test'
import type { GameweekDeskData } from '@/lib/gameweek-desk'

const variants = [
	{ id: 'GW03.state.01', scenario: 'live', lifecycle: 'PROVISIONAL' },
	{ id: 'GW03.state.02', scenario: 'settled', lifecycle: 'SETTLED' },
	{ id: 'GW03.state.03', scenario: 'empty', lifecycle: 'SETTLED' }
] as const

for (const variant of variants) {
	test.describe(variant.id, () => {
		test.use({ viewport: { width: 390, height: 900 }, locale: 'zh-CN', timezoneId: 'UTC', colorScheme: 'dark' })
		test('keeps overview, board identity and actual player controls consistent', async ({ page, request, context }, testInfo) => {
			test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Artificial board states only run in isolated fixtures')
			testInfo.annotations.push({ type: 'coverage-variant', description: variant.id })
			await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
			expect((await context.cookies()).filter(cookie => /session/i.test(cookie.name))).toHaveLength(0)
			const response = await request.get('/api/gameweek/desk?eventId=32')
			expect(response.ok()).toBe(true)
			const desk: GameweekDeskData = await response.json()
			expect(desk.eventId).toBe(32)
			expect(desk.overview).not.toBeNull()
			expect(desk.dreamTeam).toHaveLength(1)
			desk.lifecycle = variant.lifecycle
			desk.overview = { ...desk.overview!, averagePoints: null, highestPoints: 0 }
			const sample = desk.hauls[0]
			expect(sample).toBeDefined()
			desk.hauls = variant.scenario === 'empty' ? [] : Array.from({ length: 26 }, (_, index) => ({
				...sample, id: 701 + index, webName: `Boundary ${index + 1}`, totalPoints: 10
			}))
			if (variant.scenario === 'empty') desk.dreamTeam = []
			let deskReads = 0
			await page.route('**/api/gameweek/desk?eventId=32', async route => {
				deskReads += 1
				await route.fulfill({ json: desk })
			})
			// Synthetic boundary players deliberately have no official detail.
			// Assert the selected ID/GW and fallback identity, not formal scoring.
			const detailReads: Array<{ operation: string; playerId: number; eventId: number }> = []
			await page.route('**/api/graphql', async route => {
				const body = route.request().postDataJSON()
				const query = String(body.query ?? '')
				if (query.includes('query EventLiveExplainPlayer') || query.includes('query PlayerLive')) {
					const operation = query.includes('query PlayerLive') ? 'GetPlayerLive' : 'GetEventLiveExplain'
					detailReads.push({ operation, playerId: body.variables.playerId ?? body.variables.elementId, eventId: body.variables.eventId })
					await route.fulfill({ json: { data: operation === 'GetPlayerLive' ? { playerLive: null } : { eventLiveExplain: null } } })
				} else await route.continue()
			})
			const errors: string[] = []
			page.on('pageerror', error => errors.push(error.message))
			await page.goto('/zh-CN/explore/gameweek')
			await expect(page.getByRole('heading', { name: 'GW33 概览', exact: true })).toBeVisible()
			await expect(page.locator('html')).toHaveClass(/dark/)
			expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('UTC')
			const input = page.locator('#gameweek-jump-input')
			await input.fill('32')
			await input.press('Enter')
			await expect(page.getByRole('heading', { name: 'GW32 概览', exact: true })).toBeVisible()
			await expect(input).toHaveAttribute('aria-busy', 'false')
			await expect(page).toHaveURL(/\/zh-CN\/explore\/gameweek$/)
			await expect(page.getByText(variant.scenario === 'live' ? '暂定' : '已结算', { exact: true })).toBeVisible()
			const overview = page.locator('[data-gameweek-overview="true"]')
			await expect(overview.getByText('平均积分', { exact: true }).locator('..')).toContainText('等待本轮数据汇总')
			await expect(overview.getByText('经理最高得分', { exact: true }).locator('..').locator('p').last()).toHaveText('0')
			const board = page.locator('[data-share-fit-content="true"]').filter({ has: page.getByRole('heading', { name: '得分上双球员', exact: true }) })
			const rows = board.locator('tbody tr')
			if (variant.scenario === 'empty') {
				await expect(rows).toHaveCount(0)
				await expect(page.getByText('暂无梦之队数据。', { exact: true })).toBeVisible()
				await expect(board.getByText('本轮还没有球员得分上双。', { exact: true })).toBeVisible()
				await expect(page.locator('[aria-labelledby="home-team-of-week-title"]')).toHaveCount(0)
				await expect(page.getByRole('button', { name: 'Saka', exact: true })).toHaveCount(0)
			} else {
				const dream = page.locator('[aria-labelledby="home-team-of-week-title"]')
				await expect(dream.locator('#home-team-of-week-title')).toHaveText(/^GW32\s*梦之队$/)
				await expect(dream.locator('li button')).toHaveCount(1)
				await expect(dream.locator('li button')).toContainText('Saka')
				await expect(rows).toHaveCount(26)
				await expect(rows.getByRole('button')).toHaveText(desk.hauls.map(player => player.webName))
				for (const row of await rows.all()) await expect(row.getByRole('cell').last()).toHaveText('10')
				await expect(board.getByRole('link')).toHaveCount(0)
				for (const index of [0, 25]) {
					const opener = rows.nth(index).getByRole('button')
					await opener.click()
					const dialog = page.getByRole('dialog')
					await expect(dialog).toBeVisible()
					await expect(dialog).toContainText(`Boundary ${index + 1}`)
					await expect.poll(() => detailReads.filter(read => read.playerId === 701 + index).length).toBe(2)
					await expect(dialog.getByText('正在加载积分明细…', { exact: true })).toHaveCount(0)
					await page.keyboard.press('Escape')
					await expect(dialog).toHaveCount(0)
					await expect(opener).toBeFocused()
				}
				expect(detailReads.every(read => read.eventId === 32)).toBe(true)
				await expect(rows.getByRole('button')).toHaveText(desk.hauls.map(player => player.webName))
			}
			expect(deskReads).toBe(1)
			expect(errors).toEqual([])
			await testInfo.attach('GW03-state-coverage', { contentType: 'application/json', body: JSON.stringify({
				variantId: variant.id, scenario: variant.scenario, entity: 'GW32', deskReads, detailReads,
				functionalAssertions: 'PASS', readyMs: null, performanceStatus: 'NOT_RUN',
				playerLinkDisposition: 'Current board provides dialog buttons, no player-detail route links.',
				wholeVariantComplete: false
			}) })
		})
	})
}

for (const { index, scenario } of ['slow', 'error', 'out-of-order'].map((scenario, index) => ({ scenario, index }))) {
	const variantId = `GW02.state.0${index + 1}`
	test.describe(variantId, () => {
		test.use({ viewport: { width: 390, height: 900 }, locale: 'zh-CN', timezoneId: 'UTC', colorScheme: 'dark' })
		test('retains the committed desk and recovers without accepting a stale response', async ({ page, request, context }, testInfo) => {
			test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Controlled delay/failure/order is fixture-only')
			testInfo.annotations.push({ type: 'coverage-variant', description: variantId })
			expect((await context.cookies()).filter(cookie => /session/i.test(cookie.name))).toHaveLength(0)
			await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
			if (scenario === 'out-of-order') await page.addInitScript(() => {
				const originalFetch = window.fetch.bind(window)
				window.fetch = (input, init) => typeof input === 'string' && input === '/api/gameweek/desk?eventId=32'
					? originalFetch(input, { ...init, signal: undefined }) : originalFetch(input, init)
			})
			const seeded = await request.get('/api/gameweek/desk?eventId=32')
			expect(seeded.ok()).toBe(true)
			const desk: GameweekDeskData = await seeded.json()
			expect(desk).toMatchObject({ eventId: 32, overviewState: 'AVAILABLE', boardsState: 'AVAILABLE' })
			let release: () => void = () => undefined
			const gate = new Promise<void>(resolve => { release = resolve })
			let read32 = 0
			const events: number[] = []
			page.on('request', req => {
				const url = new URL(req.url())
				if (url.pathname === '/api/gameweek/desk') events.push(Number(url.searchParams.get('eventId')))
			})
			await page.route('**/api/gameweek/desk?eventId=32', async route => {
				read32 += 1
				const first = read32 === 1
				if (first) await gate
				await route.fulfill(first && scenario === 'error'
					? { status: 503, json: { error: 'controlled unavailable' } }
					: { status: 200, json: desk })
			})
			await page.goto('/zh-CN/explore/gameweek')
			await expect(page.locator('html')).toHaveClass(/dark/)
			expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('UTC')
			const input = page.locator('#gameweek-jump-input')
			const assertDesk = async (gw: number) => {
				await expect(page).toHaveURL(/\/zh-CN\/explore\/gameweek$/)
				await expect(page.getByRole('heading', { name: `GW${gw} 概览`, exact: true })).toBeVisible()
				await expect(page.getByRole('heading', { name: `GW${gw} 梦之队`, exact: true })).toBeVisible()
				await expect(input).toHaveValue(String(gw))
				await expect(input).toHaveAttribute('aria-busy', 'false')
				await expect(page.locator('tbody tr').getByRole('button')).toHaveText(['Saka', 'Palmer'])
			}
			const select = async (gw: number) => { await input.fill(String(gw)); await input.press('Enter') }
			await assertDesk(33)
			const original = await page.locator('[data-gameweek-overview="true"]').innerText()
			await select(32)
			await expect.poll(() => read32).toBe(1)
			await expect(input).toHaveAttribute('aria-busy', 'true')
			await expect(page.getByRole('heading', { name: 'GW33 概览', exact: true })).toBeVisible()
			await expect(page.getByRole('heading', { name: 'GW33 梦之队', exact: true })).toBeVisible()
			await expect(page.locator('tbody tr').getByRole('button')).toHaveText(['Saka', 'Palmer'])
			if (scenario === 'out-of-order') {
				await select(31)
				await assertDesk(31)
			}
			const late = page.waitForResponse(r => new URL(r.url()).pathname === '/api/gameweek/desk' && new URL(r.url()).searchParams.get('eventId') === '32')
			release()
			const completed = await late
			expect(completed.status()).toBe(scenario === 'error' ? 503 : 200)
			await completed.finished()
			await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
			if (scenario === 'error') {
				await assertDesk(33)
				await expect(page.getByText('所选轮次数据加载失败。', { exact: true })).toBeVisible()
				await expect(page.locator('[data-gameweek-overview="true"]')).toHaveText(original, { useInnerText: true })
			} else if (scenario === 'out-of-order') {
				await assertDesk(31)
				await expect(page.getByRole('heading', { name: 'GW32 概览', exact: true })).toHaveCount(0)
			} else await assertDesk(32)
			await select(33)
			await assertDesk(33)
			await select(32)
			await assertDesk(32)
			await expect(page.getByText('所选轮次数据加载失败。', { exact: true })).toHaveCount(0)
			expect(events).toEqual(scenario === 'slow' ? [32] : scenario === 'error' ? [32, 32] : [32, 31, 32])
			await testInfo.attach('GW02-state-coverage', { contentType: 'application/json', body: JSON.stringify({
				variantId, scenario, events, committedFinalGw: 32, functionalAssertions: 'PASS',
				performanceStatus: 'NOT_RUN', readyMs: null, wholeVariantComplete: false
			}) })
		})
	})
}
