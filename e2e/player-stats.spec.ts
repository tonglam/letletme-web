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

test.describe('SSR detail stream', () => {
	test.use({ trace: 'on' })
	test.skip(process.env.E2E_SSR_REMEDIATION !== '1', 'Run the fixture-control suite separately with one worker')
	test.describe.configure({ mode: 'serial' })
	const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
	async function control(rules: unknown[] = []) {
		expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules }) })).ok).toBe(true)
	}
	test.afterEach(async () => { await control() })

	test('directory is interactive before a slow initial overview, and a new choice wins', async ({ page }, testInfo) => {
		await control([{ operation: 'GetPlayerStatsDeskOverview', variables: { playerIds: [401] }, delayMs: 3500 }])
		const browserRequests: string[] = []
		page.on('request', request => { if (request.url().includes('/api/player-stats/desk?')) browserRequests.push(request.url()) })
		await page.goto('/explore/player-stats?p1=401', { waitUntil: 'commit' })
		const players = page.getByRole('region', { name: 'Players', exact: true })
		await expect(players).toBeVisible()
		const initial = (await (await fetch(fixture)).json()).requests.find((row: { operation: string; variables: { playerIds?: number[] } }) => row.operation === 'GetPlayerStatsDeskOverview' && row.variables.playerIds?.[0] === 401)
		expect(initial?.finishedAt).toBeNull()
		await players.getByRole('button', { name: /^Palmer/ }).click()
		await expect(page.getByRole('region', { name: 'Player overall' })).toContainText('Palmer')
		await expect(page).toHaveURL(/p1=2/)
		await expect.poll(async () => (await (await fetch(fixture)).json()).requests.find((row: { variables: { playerIds?: number[] } }) => row.variables.playerIds?.[0] === 401)?.finishedAt).toBeTruthy()
		await expect(page.getByRole('region', { name: 'Player overall' })).not.toContainText('Saka')
		await expect(page).toHaveURL(/p1=2/)
		expect(browserRequests.filter(url => new URL(url).searchParams.get('playerIds') === '401')).toHaveLength(0)
		await testInfo.attach('detail-stream-requests', { body: JSON.stringify((await (await fetch(fixture)).json()), null, 2), contentType: 'application/json' })
	})

	test('serves real overview HTML in a later response chunk without browser JavaScript', async ({ baseURL }, testInfo) => {
		await control([{ operation: 'GetPlayerStatsDeskOverview', variables: { playerIds: [402] }, delayMs: 1800 }])
		const start = Date.now()
		const response = await fetch(`${baseURL}/explore/player-stats?p1=402`)
		expect(response.status).toBe(200)
		const reader = response.body!.getReader()
		const decoder = new TextDecoder()
		let html = '', directoryMs: number | null = null, detailMs: number | null = null
		const chunks: Array<{ ms: number; bytes: number }> = []
		for (;;) {
			const { done, value } = await reader.read()
			if (done) break
			html += decoder.decode(value, { stream: true })
			const ms = Date.now() - start
			chunks.push({ ms, bytes: value.length })
			if (directoryMs == null && html.includes('aria-label="Players"')) directoryMs = ms
			if (detailMs == null && html.includes('aria-label="Player overall"')) detailMs = ms
		}
		expect(directoryMs).not.toBeNull()
		expect(detailMs).not.toBeNull()
		expect(detailMs! - directoryMs!).toBeGreaterThan(1000)
		expect(html).toContain('aria-label="Player overall"')
		await testInfo.attach('ssr-stream-timing', { body: JSON.stringify({ directoryMs, detailMs, chunks }, null, 2), contentType: 'application/json' })
	})

	test('a failed deep link settles once and offers an explicit retry', async ({ page }) => {
		await control([{ operation: 'GetPlayerStatsDeskOverview', variables: { playerIds: [403] }, error: true }])
		let browserRequests = 0
		page.on('request', request => { if (request.url().includes('/api/player-stats/desk?')) browserRequests++ })
		await page.goto('/explore/player-stats?p1=403')
		const retry = page.getByRole('button', { name: 'Retry', exact: true })
		await expect(retry).toBeVisible()
		expect(browserRequests).toBe(0)
		await control()
		await retry.click()
		await expect(page.getByRole('region', { name: 'Player overall' })).toContainText('Saka')
		expect(browserRequests).toBe(1)
	})

	test('clearing a comparison before its seed arrives keeps p2 cleared', async ({ page }) => {
		await control([{ operation: 'GetPlayerStatsDeskOverview', variables: { playerIds: [404] }, delayMs: 2500 }])
		await page.goto('/explore/player-stats?p1=2&p2=404', { waitUntil: 'commit' })
		await page.getByRole('button', { name: 'Remove', exact: true }).click()
		await expect(page).not.toHaveURL(/p2=/)
		await expect(page.getByRole('region', { name: 'Player overall' })).toContainText('Palmer')
		await expect(page.getByRole('region', { name: 'Player overall' })).not.toContainText('Saka')
		await expect(page).not.toHaveURL(/p2=/)
	})
})
