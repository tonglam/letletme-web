import { expect, test } from '@playwright/test'

test.use({ timezoneId: 'Australia/Perth' })
// All cases share the same isolated fixture server, including the original test.
test.describe.configure({ mode: 'serial' })

test('live match kickoff uses UTC on the server and browser local time after hydration', async ({
	page
}) => {
	test.skip(
		Boolean(process.env.PLAYWRIGHT_BASE_URL),
		'Uses the deterministic local GraphQL fixture'
	)
	test.skip(
		process.env.E2E_LIVE_HYDRATION !== '1',
		'Runs only through the dedicated hydration fixture command'
	)

	const reactHydrationErrors: string[] = []
	const isHydrationError = (message: string) =>
		/hydration|react(?:\.dev\/errors\/418)|minified react error #418/i.test(
			message
		)

	page.on('console', message => {
		if (message.type() === 'error' && isHydrationError(message.text())) {
			reactHydrationErrors.push(message.text())
		}
	})
	page.on('pageerror', error => {
		if (isHydrationError(error.message))
			reactHydrationErrors.push(error.message)
	})

	const response = await page.goto('/live/matches')
	expect(response?.status()).toBe(200)
	const serverHtml = await response?.text()
	expect(serverHtml).toContain('August 4, 2026 at 19:00')

	await expect(
		page.getByRole('heading', { level: 1, name: 'Live Matches' })
	).toBeVisible()
	await expect(page.getByText('Arsenal', { exact: true })).toBeVisible()
	await expect(page.getByText('Chelsea', { exact: true })).toBeVisible()
	await expect(page.getByText(/2\s*[–-]\s*0/)).toBeVisible()
	await expect(page.getByText(/45.*live/)).toBeVisible()
	await expect(page.getByText('August 5, 2026 at 03:00')).toBeVisible()
	expect(page.url()).toMatch(/\/live\/matches$/)
	expect(reactHydrationErrors).toEqual([])
})

// Fixture controls are shared within this isolated server; keep these cases serial.
test.describe('J09 match status and player navigation', () => {
	test.describe.configure({ mode: 'serial' })
	test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_LIVE_HYDRATION !== '1', 'Uses only the dedicated local live fixture')
	const origin = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}`
	test.afterEach(async () => {
		const response = await fetch(`${origin}/__performance`, { method: 'POST', body: JSON.stringify({ rules: [] }) })
		expect(response.ok).toBe(true)
	})
	for (const locale of ['en', 'zh-CN']) {
		for (const width of [1440, 390]) {
			test(`J09 status cards and team tabs ${locale} ${width}px`, async ({ page }, testInfo) => {
				const zh = locale === 'zh-CN'
				const prefix = zh ? '/zh-CN' : ''
				const seedResponse = await fetch(`${origin}/graphql`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-letletme-contract': 'live-points-v2' }, body: JSON.stringify({ query: 'query GetLiveMatchday { liveMatchday { availability } }', variables: { eventId: 33 } }) })
				const seed = await seedResponse.json()
				const snapshot = seed.data.liveMatchday.snapshot
				const first = snapshot.matches[0]
				const player = (id: number, webName: string, teamId: number) => ({ id, webName, teamId, position: 'MIDFIELDER', price: 100, totalPoints: 2, stats: [{ identifier: 'minutes', value: 90 }] })
				snapshot.matches = [
					{ ...first, players: [player(1, 'Saka', first.homeTeamId), player(2, 'Palmer', first.awayTeamId)] },
					{ ...first, fixtureId: 102, homeTeamId: 3, homeTeamName: 'Everton', homeTeamShortName: 'EVE', awayTeamId: 4, awayTeamName: 'Liverpool', awayTeamShortName: 'LIV', players: [] },
					{ ...first, fixtureId: 103, started: false, minutes: 0, homeScore: null, awayScore: null, players: [] },
					{ ...first, fixtureId: 104, started: true, finished: true, finishedProvisional: true, minutes: 90, players: [] }
				]
				const configured = await fetch(`${origin}/__performance`, { method: 'POST', body: JSON.stringify({ rules: [{ operation: 'GetLiveMatchdayV3', data: seed.data }] }) })
				expect(configured.ok).toBe(true)
				await page.setViewportSize({ width, height: 900 })
				await page.goto(prefix || '/')
				await expect(page).toHaveURL(url => url.pathname === (prefix || '/'))
				await expect(page.locator('[data-home-audience-hint="public"]')).toHaveCount(1)
				const homeMatches = page.locator('[data-home-matches]')
				await expect(homeMatches).toHaveAttribute('data-home-fixtures-event', '33')
				await expect(homeMatches.getByText('GW33', { exact: true })).toBeVisible()
				await expect(homeMatches.locator('[aria-busy="true"]')).toHaveCount(0)
				await expect(page.locator('[data-countdown-card="dark"]')).toContainText(zh ? '第 34 轮' : 'Gameweek 34')
				const href = `${prefix}/live/matches`
				const nav = page.getByRole('navigation').first()
				if (width === 390) await nav.locator('[data-navigation-mobile] > summary').click()
				else await nav.locator('details').filter({ has: page.locator(`a[href="${href}"]`) }).locator('summary').filter({ visible: true }).click()
				const link = nav.locator(`a[href="${href}"]`).filter({ visible: true })
				await expect(link).toHaveCount(1)
				await link.click()
				await expect(page).toHaveURL(url => url.pathname === href)
				for (const [value, ids] of [['live', ['101', '102']], ['not-started', ['103']], ['finished', ['104']]] as const) {
					await page.locator(`[role="tab"][aria-controls$="content-${value}"]`).click()
					await expect(page.locator('[data-live-match-card="true"]')).toHaveCount(ids.length)
					for (const id of ids) await expect(page.locator(`[data-match-id="${id}"]`)).toBeVisible()
				}
				await page.locator('[role="tab"][aria-controls$="content-live"]').click()
				const card = page.locator('[data-match-id="101"]')
				await expect(card.getByRole('tab')).toHaveCount(0)
				const expand = card.locator('button[aria-expanded]')
				await expand.click()
				await expect(expand).toHaveAttribute('aria-expanded', 'true')
				await expect(card.getByRole('tab')).toHaveText(['Arsenal', 'Chelsea'])
				await testInfo.attach('J09-card-control-inventory', {
					contentType: 'application/json',
					body: JSON.stringify({ matchId: 101, locale, width, collapsedTabs: [], expandedTabs: await card.getByRole('tab').allTextContents(), playerControl: 'button', absentPlannedControls: ['J09.07 independent match tab', 'J09.09 independent player tab'], scope: 'this MatchCard implementation and fixture state only' })
				})
				await card.getByRole('tab', { name: 'Arsenal', exact: true }).click()
				await expect(card.getByRole('button', { name: /Saka/ })).toBeVisible()
				await card.getByRole('tab', { name: 'Chelsea', exact: true }).click()
				await expect(card.getByRole('button', { name: /Palmer/ })).toBeVisible()
				await expect(card.getByRole('button', { name: /Saka/ })).toHaveCount(0)
				const detailRequests: string[] = []
				await page.route('**/api/graphql', async route => {
					const body = route.request().postDataJSON()
					const explain = /query EventLiveExplainPlayer\b/.test(body.query ?? '')
					const live = /query PlayerLive\b/.test(body.query ?? '')
					if (!explain && !live) return route.continue()
					expect(body.variables).toEqual(explain ? { eventId: 33, elementId: 2 } : { eventId: 33, playerId: 2 })
					detailRequests.push(explain ? 'explain' : 'live')
					const stats = { minutes: 90, goalsScored: 0, assists: 0, cleanSheets: 0, goalsConceded: 2, ownGoals: 0, penaltiesSaved: 0, penaltiesMissed: 0, yellowCards: 0, redCards: 0, saves: 0, defensiveContribution: 0, bonus: 0, bps: 8, totalPoints: 2 }
					await route.fulfill({ status: 200, json: { data: explain ? { eventLiveExplain: { elementId: 2, selectedBy: 20, stats, contributions: [{ identifier: 'minutes', value: 90, points: 2 }], player: { id: 2, webName: 'Palmer', team: { id: first.awayTeamId, shortName: 'CHE' } } } } : { playerLive: stats } } })
				})
				const opener = card.getByRole('button', { name: /Palmer/ })
				await opener.click()
				const dialog = page.getByRole('dialog')
				await expect(dialog).toContainText('Palmer')
				await expect(dialog.getByRole('list')).toBeVisible()
				await expect(dialog.getByRole('list').getByRole('listitem').last()).toContainText('+2')
				expect(detailRequests.sort()).toEqual(['explain', 'live'])
				await dialog.getByRole('button', { name: zh ? '关闭' : 'Close', exact: true }).click()
				await expect(dialog).toHaveCount(0)
				await expect(opener).toBeFocused()
				const next = page.locator('[data-match-id="102"]')
				await card.getByRole('button', { name: zh ? '下一场比赛' : 'Next match', exact: true }).click()
				await expect(next).toBeInViewport()
				await expect(next).toContainText('Everton')
				await expect(next).toContainText('Liverpool')
				await next.getByRole('button', { name: zh ? '上一场比赛' : 'Previous match', exact: true }).click()
				await expect(card).toBeInViewport()
				await expect(card).toContainText('Arsenal')
				await expect(card).toContainText('Chelsea')
				await expect(page).toHaveURL(url => url.pathname === href)

			})
		}
	}
})
