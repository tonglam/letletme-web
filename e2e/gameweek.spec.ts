import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

for (const locale of ['en', 'zh-CN'] as const) {
	test(`gameweek selector enumerates its range and commits first-week stepping in ${locale}`, async ({ page }) => {
		await page.setViewportSize({ width: locale === 'en' ? 1440 : 390, height: 900 })
		const requestedEvents: string[] = []
		page.on('request', request => {
			const url = new URL(request.url())
			if (url.pathname === '/api/gameweek/desk') requestedEvents.push(url.searchParams.get('eventId') ?? '')
		})
		await page.goto(locale === 'en' ? '/explore/gameweek' : '/zh-CN/explore/gameweek')
		const input = page.locator('#gameweek-jump-input')
		await expect(input).toHaveValue('33')
		await expect(input).toHaveAttribute('min', '1')
		await expect(input).toHaveAttribute('max', '33')
		const selector = page.getByRole('combobox', { name: locale === 'en' ? 'Select gameweek' : '选择轮次', exact: true })
		await selector.click()
		const expectedOptions = Array.from({ length: 33 }, (_, index) => {
			const gw = 33 - index
			return locale === 'en'
				? `Gameweek ${gw}${gw === 33 ? ' (Current)' : ''}`
				: `第 ${gw} 轮${gw === 33 ? '（当前）' : ''}`
		})
		await expect(page.getByRole('option')).toHaveText(expectedOptions)
		await page.getByRole('option', { name: expectedOptions[32], exact: true }).click()
		await expect(page.getByRole('heading', { name: locale === 'en' ? 'GW1 Overview' : 'GW1 概览', exact: true })).toBeVisible()
		await expect(input).toHaveValue('1')
		await expect(page.getByRole('button', { name: locale === 'en' ? 'Previous gameweek' : '上一轮', exact: true })).toBeDisabled()
		await page.getByRole('button', { name: locale === 'en' ? 'Next gameweek' : '下一轮', exact: true }).click()
		await expect(page.getByRole('heading', { name: locale === 'en' ? 'GW2 Overview' : 'GW2 概览', exact: true })).toBeVisible()
		await expect(input).toHaveValue('2')
		await expect(input).toHaveAttribute('aria-busy', 'false')
		expect(requestedEvents).toEqual(['1', '2'])
	})
}

for (const locale of ['en', 'zh-CN'] as const) {
	for (const width of [1440, 390]) {
		test.describe(`gameweek board rows ${locale} ${width}`, () => {
			test.use({ viewport: { width, height: 900 }, timezoneId: 'Australia/Perth' })
			test('Dream Team and 10+ boards retain independent identities and exact scores', async ({
				page, request
			}, testInfo) => {
				testInfo.annotations.push({
					type: 'coverage-variant',
					description: `GW03.A.${locale}.${width === 1440 ? 'desktop1440' : 'mobile390'}.base; partial board assertions only`
				})
				// The fixture deliberately has one Dream Team player and two hauls.
				// This proves independent boards, not a complete eleven-player formation.
				const response = await request.get('/api/gameweek/desk?eventId=33')
				expect(response.status()).toBe(200)
				const desk = await response.json()
				expect(desk.eventId).toBe(33)
				expect(desk.dreamTeam.map((player: { id: number }) => player.id)).toEqual([1])
				expect(desk.hauls.map((player: { id: number }) => player.id)).toEqual([1, 2])
				await page.goto(locale === 'en' ? '/explore/gameweek' : '/zh-CN/explore/gameweek')
				await expect(page.getByRole('heading', {
					name: locale === 'en' ? 'GW33 Overview' : 'GW33 概览', exact: true
				})).toBeVisible()
				const dreamTeam = page.locator('[aria-labelledby="home-team-of-week-title"]')
				await expect(dreamTeam).toHaveCount(1)
				await expect(dreamTeam.locator('#home-team-of-week-title')).toHaveText(
					locale === 'en' ? /^GW33\s*Dream Team$/ : /^GW33\s*梦之队$/
				)
				const pitchPlayers = dreamTeam.locator('li button')
				await expect(pitchPlayers).toHaveCount(1)
				await expect(pitchPlayers.getByText('Saka', { exact: true })).toBeVisible()
				await expect(pitchPlayers.getByText('12', { exact: true })).toBeVisible()
				await expect(dreamTeam.getByText('Palmer', { exact: true })).toHaveCount(0)
				const hauls = page.locator('[data-share-fit-content="true"]').filter({
					has: page.getByRole('heading', {
						name: locale === 'en' ? 'Players Scoring 10+' : '得分上双球员', exact: true
					})
				})
				await expect(hauls).toHaveCount(1)
				const rows = hauls.locator('tbody tr')
				await expect(rows).toHaveCount(2)
				await expect(rows.getByRole('button')).toHaveText(['Saka', 'Palmer'])
				await expect(rows.nth(0).getByRole('cell').last()).toHaveText('12')
				await expect(rows.nth(1).getByRole('cell').last()).toHaveText('11')
			})
		})
	}
}

test('gameweek desk endpoint returns compact cacheable data and rejects invalid IDs', async ({
	request
}) => {
	const response = await request.get('/api/gameweek/desk?eventId=33')
	expect(response.status()).toBe(200)
	expect(response.headers()['cache-control']).toMatch(/public/)
	expect(await response.json()).toMatchObject({
		season: '2627',
		eventId: 33,
		lifecycle: 'PROVISIONAL',
		overviewState: 'AVAILABLE',
		boardsState: 'AVAILABLE'
	})

	const invalid = await request.get('/api/gameweek/desk?eventId=39')
	expect(invalid.status()).toBe(400)
	expect(invalid.headers()['cache-control']).toBe('no-store')
})

test('gameweek switch keeps committed content, sends one GET, and reuses cache', async ({
	page
}) => {
	let requestCount = 0
	let releaseRequest: () => void = () => undefined
	let requestStarted: () => void = () => undefined
	const started = new Promise<void>(resolve => {
		requestStarted = resolve
	})
	const gate = new Promise<void>(resolve => {
		releaseRequest = resolve
	})
	await page.route('**/api/gameweek/desk?**', async route => {
		requestCount += 1
		requestStarted()
		await gate
		await route.continue()
	})
	await page.route('**/api/vitals', route =>
		route.fulfill({ status: 204, body: '' })
	)
	await page.goto('/explore/gameweek')

	const overview = page.getByRole('heading', { name: 'GW33 Overview' })
	await expect(overview).toBeVisible()
	const input = page.locator('#gameweek-jump-input')
	await input.fill('32')
	await input.press('Enter')
	await started
	await expect(overview).toBeVisible()
	expect(requestCount).toBe(1)

	releaseRequest()
	await expect(
		page.getByRole('heading', { name: 'GW32 Overview' })
	).toBeVisible()
	await input.fill('33')
	await input.press('Enter')
	await expect(overview).toBeVisible()
	await input.fill('32')
	await input.press('Enter')
	await expect(
		page.getByRole('heading', { name: 'GW32 Overview' })
	).toBeVisible()
	expect(requestCount).toBe(1)

	const accessibility = await new AxeBuilder({ page }).analyze()
	expect(accessibility.violations).toEqual([])
})

test('failed gameweek desk keeps the previously committed gameweek and recovers on retry', async ({
	page
}) => {
	let requestCount = 0
	await page.route('**/api/gameweek/desk?**', route => {
		requestCount += 1
		if (requestCount > 1) return route.continue()
		return route.fulfill({
			status: 502,
			contentType: 'application/json',
			body: JSON.stringify({
				error: 'Gameweek desk is temporarily unavailable'
			})
		})
	})
	await page.route('**/api/vitals', route =>
		route.fulfill({ status: 204, body: '' })
	)
	await page.goto('/explore/gameweek')
	const input = page.locator('#gameweek-jump-input')
	await input.fill('32')
	await input.press('Enter')
	await expect(
		page.getByText('Failed to load the selected gameweek data.')
	).toBeVisible()
	await expect(
		page.getByRole('heading', { name: 'GW33 Overview' })
	).toBeVisible()
	const recoveredResponse = page.waitForResponse(
		response =>
			response.url().includes('/api/gameweek/desk?eventId=32') &&
			response.status() === 200
	)
	await input.fill('32')
	await input.press('Enter')
	expect(await (await recoveredResponse).json()).toMatchObject({
		eventId: 32,
		overviewState: 'AVAILABLE',
		boardsState: 'AVAILABLE',
		overview: { averagePoints: 52, highestPoints: 101 }
	})
	await expect.poll(() => requestCount).toBe(2)
	await expect(
		page.getByRole('heading', { name: 'GW32 Overview' })
	).toBeVisible()
	await expect(
		page.getByText('Failed to load the selected gameweek data.')
	).not.toBeVisible()
	const overview = page.locator('[data-gameweek-overview="true"]')
	await expect(overview.getByText('52', { exact: true })).toBeVisible()
	await expect(overview.getByText('101', { exact: true })).toBeVisible()
})

for (const locale of ['en', 'zh-CN'] as const) {
	test.describe(`late desk ${locale}`, () => {
		test.use({
			viewport:
				locale === 'zh-CN'
					? { width: 390, height: 844 }
					: { width: 1440, height: 900 },
			timezoneId: locale === 'zh-CN' ? 'UTC' : 'Australia/Perth',
			colorScheme: locale === 'zh-CN' ? 'dark' : 'light'
		})
		test('a late superseded desk response cannot overwrite the current selection', async ({
			page
		}) => {
			// Model a transport that completes despite cancellation so the stale-data
			// guard, rather than AbortController alone, must protect the current desk.
			await page.addInitScript(() => {
				const originalFetch = window.fetch.bind(window)
				window.fetch = (input, init) => {
					if (
						typeof input === 'string' &&
						input === '/api/gameweek/desk?eventId=32'
					) {
						return originalFetch(input, { ...init, signal: undefined })
					}
					return originalFetch(input, init)
				}
			})
			let release32: () => void = () => undefined
			let request32Started: () => void = () => undefined
			const started32 = new Promise<void>(resolve => {
				request32Started = resolve
			})
			const gate32 = new Promise<void>(resolve => {
				release32 = resolve
			})
			await page.route('**/api/gameweek/desk?eventId=32', async route => {
				request32Started()
				await gate32
				await route.continue()
			})
			await page.route('**/api/vitals', route =>
				route.fulfill({ status: 204, body: '' })
			)
			await page.goto(
				locale === 'zh-CN' ? '/zh-CN/explore/gameweek' : '/explore/gameweek'
			)
			if (locale === 'zh-CN')
				await expect(page.locator('html')).toHaveClass(/dark/)
			const input = page.locator('#gameweek-jump-input')
			await input.fill('32')
			await input.press('Enter')
			await started32
			await expect(
				page.getByRole('heading', {
					name: locale === 'zh-CN' ? 'GW33 概览' : 'GW33 Overview'
				})
			).toBeVisible()
			await input.fill('31')
			await input.press('Enter')
			await expect(
				page.getByRole('heading', {
					name: locale === 'zh-CN' ? 'GW31 概览' : 'GW31 Overview'
				})
			).toBeVisible()
			const committedOverview = await page
				.locator('[data-gameweek-overview="true"]')
				.innerText()
			const lateResponse = page.waitForResponse(
				response =>
					response.url().includes('/api/gameweek/desk?eventId=32') &&
					response.status() === 200
			)
			release32()
			const response = await lateResponse
			expect(await response.json()).toMatchObject({ eventId: 32 })
			await response.finished()
			// Let the fetch continuation and React paint run before checking the winner.
			await page.evaluate(
				() =>
					new Promise<void>(resolve =>
						requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
					)
			)
			await expect(
				page.getByRole('heading', {
					name: locale === 'zh-CN' ? 'GW31 概览' : 'GW31 Overview'
				})
			).toBeVisible()
			await expect(
				page.getByRole('heading', {
					name: locale === 'zh-CN' ? 'GW32 概览' : 'GW32 Overview'
				})
			).not.toBeVisible()
			await expect(page.locator('[data-gameweek-overview="true"]')).toHaveText(
				committedOverview,
				{ useInnerText: true }
			)
			await expect(input).toHaveValue('31')
			await expect(
				page.getByRole('heading', {
					name: locale === 'zh-CN' ? 'GW31 梦之队' : 'GW31 Dream Team',
					exact: true
				})
			).toBeVisible()
		})
	})
}

for (const locale of ['en', 'zh-CN'] as const) {
	for (const width of [1440, 390]) {
		test(`J04 home to gameweek detail and history ${locale} ${width}px`, async ({ page }, testInfo) => {
			const zh = locale === 'zh-CN'
			const prefix = zh ? '/zh-CN' : ''
			const detailRequests: string[] = []
			await page.route('**/api/graphql', async route => {
				const body = route.request().postDataJSON()
				const explain = /query EventLiveExplainPlayer\b/.test(body.query ?? '')
				const live = /query PlayerLive\b/.test(body.query ?? '')
				if (!explain && !live) return route.continue()
				expect(body.variables).toEqual(explain ? { eventId: 33, elementId: 2 } : { eventId: 33, playerId: 2 })
				detailRequests.push(explain ? 'explain' : 'live')
				const stats = { minutes: 90, goalsScored: 1, assists: 0, cleanSheets: 1, goalsConceded: 0, ownGoals: 0, penaltiesSaved: 0, penaltiesMissed: 0, yellowCards: 0, redCards: 0, saves: 0, defensiveContribution: 0, bonus: 3, bps: 38, totalPoints: 11 }
				await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: explain ? { eventLiveExplain: { elementId: 2, selectedBy: 10, stats, contributions: [{ identifier: 'minutes', value: 90, points: 2 }, { identifier: 'goals_scored', value: 1, points: 5 }, { identifier: 'clean_sheets', value: 1, points: 1 }, { identifier: 'bonus', value: 3, points: 3 }], player: { id: 2, webName: 'Palmer', team: { id: 1, shortName: 'ARS' } } } } : { playerLive: stats } }) })
			})
			await page.setViewportSize({ width, height: 900 })
			testInfo.annotations.push({ type: 'coverage-case', description: 'J04 actual gameweek journey; comparison steps .07-.09 are inapplicable to match-detail modal; performance unmeasured' })
			await page.goto(prefix || '/')
			await expect(page.getByRole('button', { name: zh ? '最高分球员: Saka (12)' : 'Top Scorer: Saka (12)', exact: true })).toBeVisible()
			const nav = page.getByRole('navigation').first()
			const href = `${prefix}/explore/gameweek`
			if (width === 390) await nav.locator('[data-navigation-mobile] > summary').click()
			else await nav.locator('details').filter({ has: page.locator(`a[href="${href}"]`) }).locator('summary').filter({ visible: true }).click()
			const link = nav.locator(`a[href="${href}"]`).filter({ visible: true })
			await expect(link).toHaveCount(1)
			await link.click()
			await expect(page).toHaveURL(url => url.pathname === href)
			await page.getByRole('combobox', { name: zh ? '选择轮次' : 'Select gameweek', exact: true }).click()
			await page.getByRole('option', { name: zh ? '第 33 轮（当前）' : 'Gameweek 33 (Current)', exact: true }).click()
			await expect(page.getByRole('heading', { name: zh ? 'GW33 概览' : 'GW33 Overview', exact: true })).toBeVisible()
			const dream = page.locator('[aria-labelledby="home-team-of-week-title"]')
			await expect(dream.locator('li button')).toHaveCount(1)
			await expect(dream).toContainText('Saka')
			const rows = page.locator('tbody tr')
			await expect(rows.getByRole('button')).toHaveText(['Saka', 'Palmer'])
			await expect(rows.nth(0).getByRole('cell').last()).toHaveText('12')
			await expect(rows.nth(1).getByRole('cell').last()).toHaveText('11')
			const opener = rows.getByRole('button', { name: 'Palmer', exact: true })
			await opener.click()
			const dialog = page.getByRole('dialog')
			await expect(dialog).toContainText('Palmer')
			await expect(dialog.getByText(zh ? '正在加载积分明细…' : 'Loading breakdown…', { exact: true })).toHaveCount(0)
			await expect(dialog.getByRole('list')).toBeVisible()
			await expect(dialog.getByRole('list').getByRole('listitem').last()).toContainText('+11')
			expect(detailRequests.sort()).toEqual(['explain', 'live'])
			await dialog.getByRole('button', { name: zh ? '关闭' : 'Close', exact: true }).click()
			await expect(dialog).toHaveCount(0)
			await expect(opener).toBeFocused()
			await page.goBack()
			await expect(page).toHaveURL(url => url.pathname === (prefix || '/'))
			await expect(page.getByRole('button', { name: zh ? '最高分球员: Saka (12)' : 'Top Scorer: Saka (12)', exact: true })).toBeVisible()
			await page.goForward()
			await expect(page).toHaveURL(url => url.pathname === href)
			await expect(page.getByRole('heading', { name: zh ? 'GW33 概览' : 'GW33 Overview', exact: true })).toBeVisible()
		})
	}
}

test('match detail retains live statistics when explanation read fails', async ({ page }) => {
 test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Isolated partial failure injection only')
 await page.route('**/api/graphql', async route => {
  const body = route.request().postDataJSON()
  if (/query EventLiveExplainPlayer\b/.test(body.query ?? '')) {
   await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ errors: [{ message: 'Isolated explanation failure' }] }) })
  } else if (/query PlayerLive\b/.test(body.query ?? '')) {
   await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { playerLive: { minutes: 90, goalsScored: 1, assists: 0, cleanSheets: 1, goalsConceded: 0, ownGoals: 0, penaltiesSaved: 0, penaltiesMissed: 0, yellowCards: 0, redCards: 0, saves: 0, defensiveContribution: 0, bonus: 3, bps: 38, totalPoints: 11 } } }) })
  } else await route.continue()
 })
 await page.goto('/explore/gameweek')
 await page.getByRole('combobox', { name: 'Select gameweek', exact: true }).click()
 await page.getByRole('option', { name: 'Gameweek 33 (Current)', exact: true }).click()
 await expect(page.getByRole('heading', { name: 'GW33 Overview', exact: true })).toBeVisible()
 await page.locator('tbody').getByRole('button', { name: 'Palmer', exact: true }).click()
 const dialog = page.getByRole('dialog')
 await expect(dialog.getByText('Loading breakdown…', { exact: true })).toHaveCount(0)
 await expect(dialog.getByText('90', { exact: true })).toBeVisible()
 await expect(dialog.getByText('38', { exact: true })).toBeVisible()
})

test('match detail ends loading after both reads fail and retries on reopening', async ({ page }) => {
 test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Isolated partial failure injection only')
 let failReads = true
 const operations: string[] = []
 await page.route('**/api/graphql', async route => {
  const body = route.request().postDataJSON()
  const detail = /query (EventLiveExplainPlayer|PlayerLive)\b/.test(body.query ?? '')
  if (detail) operations.push(body.query.match(/query (\w+)/)[1])
  if (detail && failReads) {
   await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ errors: [{ message: 'Isolated both-read failure' }] }) })
  } else if (/query EventLiveExplainPlayer\b/.test(body.query ?? '')) {
   await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ errors: [{ message: 'Isolated explanation failure' }] }) })
  } else if (/query PlayerLive\b/.test(body.query ?? '')) {
   await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { playerLive: { minutes: 90, goalsScored: 1, assists: 0, cleanSheets: 1, goalsConceded: 0, ownGoals: 0, penaltiesSaved: 0, penaltiesMissed: 0, yellowCards: 0, redCards: 0, saves: 0, defensiveContribution: 0, bonus: 3, bps: 38, totalPoints: 11 } } }) })
  } else await route.continue()
 })
 await page.goto('/explore/gameweek')
 await page.getByRole('combobox', { name: 'Select gameweek', exact: true }).click()
 await page.getByRole('option', { name: 'Gameweek 33 (Current)', exact: true }).click()
 await expect(page.getByRole('heading', { name: 'GW33 Overview', exact: true })).toBeVisible()
 await page.locator('tbody').getByRole('button', { name: 'Palmer', exact: true }).click()
 const dialog = page.getByRole('dialog')
 await expect(dialog.getByText('Loading breakdown…', { exact: true })).toHaveCount(0)
 await expect.poll(() => operations.length).toBe(2)
 await expect(dialog.getByText('38', { exact: true })).toHaveCount(0)
 await dialog.getByRole('button', { name: 'Close', exact: true }).click()
 await expect(dialog).toHaveCount(0)
 failReads = false
 await page.locator('tbody').getByRole('button', { name: 'Palmer', exact: true }).click()
 await expect.poll(() => operations.length).toBe(4)
 await expect(dialog.getByText('90', { exact: true })).toBeVisible()
 await expect(dialog.getByText('38', { exact: true })).toBeVisible()
})

test('match detail retains explanation identity without inventing missing live statistics', async ({ page }) => {
 test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Isolated partial failure injection only')
 await page.route('**/api/graphql', async route => {
  const body = route.request().postDataJSON()
  if (/query EventLiveExplainPlayer\b/.test(body.query ?? '')) {
   await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { eventLiveExplain: { elementId: 2, selectedBy: 10, contributions: [], player: { id: 2, webName: 'Palmer verified detail', team: { id: 1, shortName: 'ARS' } } } } }) })
  } else if (/query PlayerLive\b/.test(body.query ?? '')) {
   await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ errors: [{ message: 'Isolated live failure' }] }) })
  } else await route.continue()
 })
 await page.goto('/explore/gameweek')
 await page.getByRole('combobox', { name: 'Select gameweek', exact: true }).click()
 await page.getByRole('option', { name: 'Gameweek 33 (Current)', exact: true }).click()
 await expect(page.getByRole('heading', { name: 'GW33 Overview', exact: true })).toBeVisible()
 await page.locator('tbody').getByRole('button', { name: 'Palmer', exact: true }).click()
 const dialog = page.getByRole('dialog')
 await expect(dialog.getByText('Loading breakdown…', { exact: true })).toHaveCount(0)
 await expect(dialog.getByRole('heading', { name: 'Palmer verified detail', exact: true })).toBeVisible()
 await expect(dialog.getByText('38', { exact: true })).toHaveCount(0)
 await expect(dialog.getByRole('list')).toHaveCount(0)
})

for (const reopen of [false, true]) {
 test(`match detail ignores closed late responses with reopen ${reopen}`, async ({ page }) => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Isolated race injection only')
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let held = 0
  const lateResponses: Array<Promise<unknown>> = []
  page.on('response', response => {
   if (!response.url().endsWith('/api/graphql')) return
   const body = response.request().postDataJSON()
   if ((body.variables?.elementId ?? body.variables?.playerId) === 2 && /query (EventLiveExplainPlayer|PlayerLive)\b/.test(body.query ?? '')) lateResponses.push(response.finished())
  })
  await page.route('**/api/graphql', async route => {
   const body = route.request().postDataJSON()
   const explain = /query EventLiveExplainPlayer\b/.test(body.query ?? '')
   const live = /query PlayerLive\b/.test(body.query ?? '')
   if (!explain && !live) return route.continue()
   const id = body.variables.elementId ?? body.variables.playerId
   if (id === 2) { held += 1; await gate }
   const stats = { minutes: 90, goalsScored: 1, assists: 0, cleanSheets: 1, goalsConceded: 0, ownGoals: 0, penaltiesSaved: 0, penaltiesMissed: 0, yellowCards: 0, redCards: 0, saves: 0, defensiveContribution: 0, bonus: 3, bps: id === 2 ? 38 : 42, totalPoints: 11 }
   await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: explain ? { eventLiveExplain: { elementId: id, selectedBy: 10, contributions: [], player: { id, webName: id === 2 ? 'Palmer late result' : 'Saka current result', team: { id: 1, shortName: 'ARS' } } } } : { playerLive: stats } }) })
  })
  try {
   await page.goto('/explore/gameweek')
   await page.getByRole('combobox', { name: 'Select gameweek', exact: true }).click()
   await page.getByRole('option', { name: 'Gameweek 33 (Current)', exact: true }).click()
   await expect(page.getByRole('heading', { name: 'GW33 Overview', exact: true })).toBeVisible()
   await page.locator('tbody').getByRole('button', { name: 'Palmer', exact: true }).click()
   await expect.poll(() => held).toBe(2)
   const dialog = page.getByRole('dialog')
   await dialog.getByRole('button', { name: 'Close', exact: true }).click()
   await expect(dialog).toHaveCount(0)
   if (reopen) {
    await page.locator('tbody').getByRole('button', { name: 'Saka', exact: true }).click()
    await expect(dialog.getByRole('heading', { name: 'Saka current result', exact: true })).toBeVisible()
    await expect(dialog.getByText('42', { exact: true })).toBeVisible()
   }
   release()
   await expect.poll(() => lateResponses.length).toBe(2)
   await Promise.all(lateResponses)
   await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
   if (reopen) {
    await expect(dialog.getByRole('heading', { name: 'Saka current result', exact: true })).toBeVisible()
    await expect(dialog.getByText('42', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Palmer late result', { exact: true })).toHaveCount(0)
    await expect(dialog.getByText('Loading breakdown…', { exact: true })).toHaveCount(0)
   } else await expect(dialog).toHaveCount(0)
  } finally { release() }
 })
}
