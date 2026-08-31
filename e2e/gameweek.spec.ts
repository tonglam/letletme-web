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

test('failed gameweek desk keeps the previously committed gameweek', async ({
	page
}) => {
	await page.route('**/api/gameweek/desk?**', route =>
		route.fulfill({
			status: 502,
			contentType: 'application/json',
			body: JSON.stringify({
				error: 'Gameweek desk is temporarily unavailable'
			})
		})
	)
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
})

test('a late superseded desk response cannot overwrite the current selection', async ({
	page
}) => {
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
	await page.goto('/explore/gameweek')
	const input = page.locator('#gameweek-jump-input')
	await input.fill('32')
	await input.press('Enter')
	await started32
	await input.fill('31')
	await input.press('Enter')
	await expect(
		page.getByRole('heading', { name: 'GW31 Overview' })
	).toBeVisible()
	release32()
	await expect(
		page.getByRole('heading', { name: 'GW31 Overview' })
	).toBeVisible()
	await expect(
		page.getByRole('heading', { name: 'GW32 Overview' })
	).not.toBeVisible()
})
