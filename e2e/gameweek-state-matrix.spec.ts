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
