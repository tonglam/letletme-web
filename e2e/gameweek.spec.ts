import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

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
