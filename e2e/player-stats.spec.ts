import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

function routeReadySamples(payloads: Array<Record<string, unknown>>) {
	return payloads.flatMap(payload => {
		const samples = payload.samples
		return Array.isArray(samples)
			? samples.filter(
					(sample): sample is Record<string, unknown> =>
						Boolean(sample) && typeof sample === 'object'
				)
			: []
	})
}

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
			routeReadySamples(reportedVitals).filter(
				sample =>
					sample.metric === 'route_ready_ms' &&
					sample.surface === 'player_stats'
			)
		)
		.toHaveLength(2)
	const routeReady = routeReadySamples(reportedVitals).filter(
		sample =>
			sample.metric === 'route_ready_ms' && sample.surface === 'player_stats'
	)
	expect(new Set(routeReady.map(sample => sample.metricName))).toEqual(
		new Set(['PLAYER_DIRECTORY_READY', 'PLAYER_DIRECTORY_PAINT'])
	)
	expect(routeReady).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
			metricName: 'PLAYER_DIRECTORY_READY',
			measurementKind: 'initial_navigation'
		}),
		expect.objectContaining({
			metricName: 'PLAYER_DIRECTORY_PAINT',
			measurementKind: 'initial_navigation'
		})
	])
	)
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
	test.skip(process.env.E2E_SSR_REMEDIATION !== '1', 'Run the fixture-control suite separately with one worker')
	test.describe.configure({ mode: 'serial' })
	const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
	const runPlayerId = (offset: number): number =>
		100_000 + (Date.now() % 1_000_000) * 10 + offset
	async function control(rules: unknown[] = []) {
		expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules }) })).ok).toBe(true)
	}
	test.afterEach(async () => { await control() })

	test('directory is interactive before a slow initial overview, and a new choice wins', async ({ page }, testInfo) => {
		const initialPlayerId = runPlayerId(1)
		await control([{ operation: 'GetPlayerStatsDeskOverview', variables: { playerIds: [initialPlayerId] }, delayMs: 3500 }])
		const browserRequests: string[] = []
		page.on('request', request => { if (request.url().includes('/api/player-stats/desk?')) browserRequests.push(request.url()) })
		await page.goto(`/explore/player-stats?p1=${initialPlayerId}`, { waitUntil: 'commit' })
		const players = page.getByRole('region', { name: 'Players', exact: true })
		await expect(players).toBeVisible()
		const initial = (await (await fetch(fixture)).json()).requests.find((row: { operation: string; variables: { playerIds?: number[] } }) => row.operation === 'GetPlayerStatsDeskOverview' && row.variables.playerIds?.[0] === initialPlayerId)
		expect(initial?.finishedAt).toBeNull()
		await players.getByRole('button', { name: /^Palmer/ }).click()
		await expect(page.getByRole('region', { name: 'Player overall' })).toContainText('Palmer')
		await expect(page).toHaveURL(/p1=2/)
		await expect.poll(async () => (await (await fetch(fixture)).json()).requests.find((row: { variables: { playerIds?: number[] } }) => row.variables.playerIds?.[0] === initialPlayerId)?.finishedAt).toBeTruthy()
		await expect(page.getByRole('region', { name: 'Player overall' })).not.toContainText('Saka')
		await expect(page).toHaveURL(/p1=2/)
		expect(browserRequests.filter(url => new URL(url).searchParams.get('playerIds') === String(initialPlayerId))).toHaveLength(0)
		await testInfo.attach('detail-stream-requests', { body: JSON.stringify((await (await fetch(fixture)).json()), null, 2), contentType: 'application/json' })
	})

	test('serves real overview HTML in a later response chunk without browser JavaScript', async ({ browser, baseURL }, testInfo) => {
		const initialPlayerId = runPlayerId(2)
		await control([{ operation: 'GetPlayerStatsDeskOverview', variables: { playerIds: [initialPlayerId] }, delayMs: 1800 }])
		const start = Date.now()
		const response = await fetch(`${baseURL}/explore/player-stats?p1=${initialPlayerId}`)
		expect(response.status).toBe(200)
		const reader = response.body!.getReader()
		const decoder = new TextDecoder()
		let html = '', directoryMs: number | null = null, detailMs: number | null = null, fragmentAnchorMs: number | null = null
		const chunks: Array<{ ms: number; bytes: number }> = []
		for (;;) {
			const { done, value } = await reader.read()
			if (done) break
			html += decoder.decode(value, { stream: true })
			const ms = Date.now() - start
			chunks.push({ ms, bytes: value.length })
			if (directoryMs == null && html.includes('aria-label="Players"')) directoryMs = ms
			if (detailMs == null && html.includes('data-player-stats-ssr-detail="true"')) detailMs = ms
			if (fragmentAnchorMs == null && html.includes('data-player-stats-noscript-section="history"')) fragmentAnchorMs = ms
		}
		expect(directoryMs).not.toBeNull()
		expect(detailMs).not.toBeNull()
		expect(fragmentAnchorMs).not.toBeNull()
		expect(fragmentAnchorMs!).toBeLessThan(detailMs!)
		expect(detailMs! - directoryMs!).toBeGreaterThan(1000)
		expect(html).toContain('aria-label="Player overall"')
		const noJsContext = await browser.newContext({ javaScriptEnabled: false })
		const noJsPage = await noJsContext.newPage()
		try {
			await noJsPage.goto(`${baseURL}/explore/player-stats?p1=1`)
			const noJsDetail = noJsPage.locator('[data-player-stats-noscript-result="true"] [aria-label="Player overall"]')
			await expect(noJsDetail).toBeVisible()
			await expect(noJsDetail).toContainText('Saka')
			const noJsFallback = noJsPage.locator('[data-player-stats-ssr-fallback]')
			expect(await noJsFallback.count()).toBeGreaterThan(0)
			for (const fallback of await noJsFallback.all()) {
				await expect(fallback).toBeHidden()
			}
			await noJsPage.goto(`${baseURL}/explore/player-stats?p1=${initialPlayerId}#ps-history`)
			const noJsFragmentAnchor = noJsPage.locator('[data-player-stats-noscript-section="history"]')
			await expect(noJsFragmentAnchor).toBeVisible()
			const fragmentPosition = await noJsPage.evaluate(() => ({
				top: document.querySelector('[data-player-stats-noscript-section="history"]')?.getBoundingClientRect().top ?? null
			}))
			expect(fragmentPosition.top).not.toBeNull()
			expect(fragmentPosition.top!).toBeLessThan(220)
		} finally {
			await noJsContext.close()
		}
		await testInfo.attach('ssr-stream-timing', { body: JSON.stringify({ directoryMs, detailMs, chunks }, null, 2), contentType: 'application/json' })
	})

	test('a failed deep link settles once and offers an explicit retry', async ({ page }) => {
		const initialPlayerId = runPlayerId(3)
		await control([{ operation: 'GetPlayerStatsDeskOverview', variables: { playerIds: [initialPlayerId] }, error: true }])
		let browserRequests = 0
		page.on('request', request => { if (request.url().includes('/api/player-stats/desk?')) browserRequests++ })
		await page.goto(`/explore/player-stats?p1=${initialPlayerId}`)
		const retry = page.getByRole('button', { name: 'Retry', exact: true })
		await expect(retry).toBeVisible()
		expect(browserRequests).toBe(0)
		await control()
		await retry.click()
		await expect(page.getByRole('region', { name: 'Player overall' })).toContainText('Saka')
		expect(browserRequests).toBe(1)
	})

	test('shows a truthful no-script terminal for a failed deep link', async ({ browser, baseURL }) => {
		await control([{ operation: 'GetPlayerStatsDeskOverview', variables: { playerIds: [1] }, error: true }])
		const noJsContext = await browser.newContext({ javaScriptEnabled: false })
		const noJsPage = await noJsContext.newPage()
		try {
			await noJsPage.goto(`${baseURL}/explore/player-stats?p1=1`)
			const terminal = noJsPage.locator('[data-player-stats-noscript-result="true"]')
			const retry = noJsPage.getByRole('link', { name: 'Retry', exact: true })
			await expect(terminal).toBeVisible()
			await expect(retry).toBeVisible()
			const noJsFallback = noJsPage.locator('[data-player-stats-ssr-fallback]')
			expect(await noJsFallback.count()).toBeGreaterThan(0)
			for (const fallback of await noJsFallback.all()) {
				await expect(fallback).toBeHidden()
			}
		} finally {
			await noJsContext.close()
		}
	})

	test('clearing a comparison before its seed arrives keeps p2 cleared', async ({ page }) => {
		const initialPlayerId = runPlayerId(4)
		await control([{ operation: 'GetPlayerStatsDeskOverview', variables: { playerIds: [initialPlayerId] }, delayMs: 2500 }])
		await page.goto(`/explore/player-stats?p1=2&p2=${initialPlayerId}`, { waitUntil: 'commit' })
		await page.getByRole('button', { name: 'Remove', exact: true }).click()
		await expect(page).not.toHaveURL(/p2=/)
		await expect(page.getByRole('region', { name: 'Player overall' })).toContainText('Palmer')
		await expect(page.getByRole('region', { name: 'Player overall' })).not.toContainText('Saka')
		await expect(page).not.toHaveURL(/p2=/)
	})
})
