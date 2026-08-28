import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('player desk endpoint returns one cacheable batch and rejects invalid input', async ({
	request
}) => {
	const response = await request.get(
		'/api/player-stats/desk?playerIds=1,2&eventId=33&horizon=5&section=overview'
	)
	expect(response.status()).toBe(200)
	expect(response.headers()['cache-control']).toBe(
		'public, s-maxage=300, stale-while-revalidate=300, no-transform'
	)
	const payload = await response.json()
	expect(payload).toMatchObject({
		eventId: 33,
		horizon: 5,
		section: 'overview',
		unavailablePlayerIds: []
	})
	expect(
		payload.entries.map((entry: { playerId: number }) => entry.playerId)
	).toEqual([1, 2])
	expect(payload.entries[0].overview).toMatchObject({
		injuryAvailability: {
			status: 'a',
			news: '',
			observedDate: '2026-08-13',
			chanceOfPlayingThisRound: 100,
			chanceOfPlayingNextRound: 100
		},
		dataAvailability: {
			isFullyAuthoritative: true,
			seasonStats: { state: 'READY' },
			market: { state: 'READY' },
			historicalTeam: { state: 'EMPTY' },
			fixtures: { state: 'READY' },
			recentGameweeks: { state: 'READY' }
		}
	})
	expect(payload.entries[0].overview).not.toHaveProperty('availability')

	const invalid = await request.get(
		'/api/player-stats/desk?playerIds=1,1&eventId=33&horizon=5&section=overview'
	)
	expect(invalid.status()).toBe(400)
	expect(invalid.headers()['cache-control']).toBe('no-store')
})

test('two-player deep link is server-seeded with zero browser desk requests', async ({
	page
}) => {
	let deskRequests = 0
	const reportedVitals: Array<Record<string, unknown>> = []
	await page.route('**/api/player-stats/desk?**', route => {
		deskRequests += 1
		return route.continue()
	})
	await page.route('**/api/vitals', route => {
		const payload = route.request().postDataJSON()
		if (payload && typeof payload === 'object') reportedVitals.push(payload)
		return route.fulfill({ status: 204, body: '' })
	})
	await page.setViewportSize({ width: 390, height: 844 })
	await page.goto('/explore/player-stats?p1=1&p2=2')

	const overall = page.getByRole('region', { name: 'Player overall' })
	await expect(overall).toContainText('Saka')
	await expect(overall).toContainText('Palmer')
	expect(deskRequests).toBe(0)
	await expect
		.poll(() =>
			reportedVitals.some(metric => metric.name === 'PLAYER_DETAIL_READY')
		)
		.toBe(true)
	await expect
		.poll(() =>
			reportedVitals.some(metric => metric.name === 'PLAYER_COMPARE_READY')
		)
		.toBe(true)
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= window.innerWidth
		)
	).toBe(true)
	const accessibility = await new AxeBuilder({ page }).analyze()
	expect(accessibility.violations).toEqual([])
})

test('selection keeps committed detail while pending and reuses the server seed', async ({
	page
}) => {
	let deskRequests = 0
	let releaseRequest: () => void = () => undefined
	let markRequestStarted: () => void = () => undefined
	const requestStarted = new Promise<void>(resolve => {
		markRequestStarted = resolve
	})
	const requestGate = new Promise<void>(resolve => {
		releaseRequest = resolve
	})

	await page.route('**/api/player-stats/desk?**', async route => {
		deskRequests += 1
		markRequestStarted()
		await requestGate
		try {
			await route.continue()
		} catch {
			// A newer cached selection is allowed to abort this generation.
		}
	})
	await page.route('**/api/vitals', route =>
		route.fulfill({ status: 204, body: '' })
	)
	await page.goto('/explore/player-stats?p1=1')

	const players = page.getByRole('region', { name: 'Players' })
	const overall = page.getByRole('region', { name: 'Player overall' })
	await expect(overall).toContainText('Saka')
	await players.getByRole('button', { name: 'Edit' }).click()
	await players.getByRole('button', { name: /^Palmer/ }).click()
	await requestStarted

	await expect(
		page.getByRole('status', { name: '' }).filter({
			hasText: 'Loading player statistics'
		})
	).toBeVisible()
	await expect(overall).toContainText('Saka')
	await expect(overall).not.toContainText('Palmer')
	expect(deskRequests).toBe(1)

	await players.getByRole('button', { name: 'Edit' }).click()
	await players.getByRole('button', { name: /^Saka/ }).click()
	await expect(page.getByText('Loading player statistics')).toHaveCount(0)
	await expect(overall).toContainText('Saka')
	releaseRequest()
	await page.waitForTimeout(100)
	await expect(overall).not.toContainText('Palmer')
	expect(deskRequests).toBe(1)
})
