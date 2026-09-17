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
