import { expect, test } from '@playwright/test'

test('public fixture window endpoint returns one cacheable compact window', async ({
	request
}) => {
	const response = await request.get('/api/fixtures/window?fromGw=33&count=5')
	expect(response.status()).toBe(200)
	expect(response.headers()['cache-control']).toBe(
		'public, s-maxage=300, stale-while-revalidate=300, no-transform'
	)
	const payload = await response.json()
	expect(payload).toMatchObject({
		fromGw: 33,
		toGw: 37,
		unknownEventIds: []
	})
	expect(Object.keys(payload.fixturesByEvent)).toEqual([
		'33',
		'34',
		'35',
		'36',
		'37'
	])
	expect(payload.fixturesByEvent['33'][0]).toEqual({
		id: 3301,
		eventId: 33,
		finished: false,
		started: false,
		homeTeam: { id: 1, name: 'Arsenal', shortName: 'ARS' },
		awayTeam: { id: 2, name: 'Chelsea', shortName: 'CHE' },
		homeScore: null,
		awayScore: null,
		homeTeamDifficulty: 2,
		awayTeamDifficulty: 4
	})

	const invalid = await request.get('/api/fixtures/window?fromGw=38&count=2')
	expect(invalid.status()).toBe(400)
	expect(invalid.headers()['cache-control']).toBe('no-store')
})

test('team FDR opens the full-season schedule with finished scores', async ({
	page
}) => {
	let fixtureWindowRequestCount = 0
	await page.route('**/api/fixtures/window?**', async route => {
		fixtureWindowRequestCount += 1
		await route.continue()
	})

	await page.goto('/explore/fixtures')

	const teamFdr = page.getByRole('region', { name: 'Team FDR' })
	await expect(
		teamFdr.getByRole('button', { name: 'Text', exact: true })
	).toHaveCount(0)

	await page
		.getByRole('button', { name: "View Arsenal's full-season fixtures" })
		.click()

	const dialog = page.getByRole('dialog')
	await expect(dialog).toBeVisible()
	await expect(dialog.getByRole('heading', { name: /Arsenal/ })).toBeVisible()
	await expect(dialog).toContainText('GW1')
	await expect(dialog).toContainText('2–1')
	await expect(dialog).toContainText('Finished')
	await expect(dialog).toContainText('GW38')
	await expect(
		dialog.getByRole('button', { name: 'Image', exact: true })
	).toBeVisible()
	await expect(
		dialog.getByText('Official fixtures and scores across GW1–GW38')
	).toHaveCount(0)
	await expect(
		dialog.getByText(
			'Finished matches show scores · upcoming matches show opponent and FDR'
		)
	).toHaveCount(0)
	await expect.poll(() => fixtureWindowRequestCount).toBe(8)
})

test('team FDR search filters and highlights the matching team', async ({
	page
}) => {
	await page.goto('/explore/fixtures')

	const teamFdr = page.getByRole('region', { name: 'Team FDR' })
	const search = teamFdr.getByRole('searchbox', { name: 'Search teams' })

	await search.fill('Arsenal')
	await expect(teamFdr.locator('tbody tr')).toHaveCount(1)
	await expect(teamFdr.locator('tbody tr')).toHaveAttribute(
		'data-team-search-match',
		'true'
	)
	await expect(teamFdr.locator('tbody tr mark')).toHaveText('Arsenal')
	await expect(teamFdr.getByText('1 team found')).toBeVisible()

	await search.fill('ARS')
	await expect(teamFdr.locator('tbody tr')).toHaveCount(1)
	await expect(teamFdr.locator('tbody tr mark')).toHaveText('Ars')

	await search.fill('not a club')
	await expect(teamFdr.locator('tbody tr')).toHaveCount(0)
	await expect(teamFdr.getByText('No teams match your search.')).toBeVisible()

	await teamFdr.getByRole('button', { name: 'Clear team search' }).click()
	await expect(teamFdr.locator('tbody tr')).toHaveCount(3)
})

test('terminal horizon switch keeps 5 GWs committed, sends one GET, then reuses memory cache', async ({
	page
}) => {
	let requestCount = 0
	const reportedVitals: Array<Record<string, unknown>> = []
	let releaseRequest: () => void = () => undefined
	let markRequestStarted: () => void = () => undefined
	const requestStarted = new Promise<void>(resolve => {
		markRequestStarted = resolve
	})
	const requestGate = new Promise<void>(resolve => {
		releaseRequest = resolve
	})

	await page.route('**/api/fixtures/window?**', async route => {
		requestCount += 1
		markRequestStarted()
		await requestGate
		await route.continue()
	})
	await page.route('**/api/vitals', route => {
		const payload = route.request().postDataJSON()
		if (payload && typeof payload === 'object') reportedVitals.push(payload)
		return route.fulfill({ status: 204, body: '' })
	})
	await page.goto('/explore/fixtures')

	const fiveGws = page.getByRole('button', { name: '5 GWs' })
	const sixGws = page.getByRole('button', { name: '6 GWs' })
	await sixGws.click()
	await requestStarted
	await expect(fiveGws).toHaveAttribute('aria-pressed', 'true')
	await expect(sixGws).toHaveAttribute('aria-busy', 'true')
	await expect(page.getByText('Loading more gameweeks…')).toBeVisible()
	await expect(page.getByRole('columnheader', { name: 'GW38' })).toHaveCount(0)

	await sixGws.click()
	expect(requestCount).toBe(1)
	releaseRequest()
	await expect(sixGws).toHaveAttribute('aria-pressed', 'true')
	await expect(sixGws).toHaveAttribute('aria-busy', 'false')
	await expect(page.getByRole('columnheader', { name: 'GW38' })).toBeVisible()
	await expect
		.poll(() =>
			reportedVitals.some(metric => metric.name === 'FIXTURES_WINDOW_READY')
		)
		.toBe(true)
	const windowMetric = reportedVitals.find(
		metric => metric.name === 'FIXTURES_WINDOW_READY'
	)
	expect(windowMetric?.page).toBe('/explore/fixtures')
	expect(windowMetric?.value).toEqual(expect.any(Number))
	expect(['good', 'needs-improvement', 'poor']).toContain(windowMetric?.rating)

	await fiveGws.click()
	await expect(fiveGws).toHaveAttribute('aria-pressed', 'true')
	await sixGws.click()
	await expect(sixGws).toHaveAttribute('aria-pressed', 'true')
	expect(requestCount).toBe(1)
})

test('partial fixture window commits unavailable cells instead of BGWs', async ({
	page
}) => {
	await page.route('**/api/fixtures/window?**', route =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			headers: { 'Cache-Control': 'no-store' },
			body: JSON.stringify({
				fromGw: 38,
				toGw: 38,
				fixturesByEvent: {},
				unknownEventIds: [38]
			})
		})
	)
	await page.route('**/api/vitals', route =>
		route.fulfill({ status: 204, body: '' })
	)
	await page.goto('/explore/fixtures')
	await page.getByRole('button', { name: '6 GWs' }).click()
	await expect(page.getByRole('button', { name: '6 GWs' })).toHaveAttribute(
		'aria-pressed',
		'true'
	)

	const table = page.getByRole('table')
	const headers = await table.locator('thead th').allTextContents()
	const gw38Column = headers.findIndex(header => header.trim() === 'GW38')
	expect(gw38Column).toBeGreaterThan(-1)
	const firstRowCells = table.locator('tbody tr').first().locator('th, td')
	await expect(firstRowCells.nth(gw38Column)).toContainText('Unavailable')
	await expect(firstRowCells.nth(gw38Column)).not.toContainText('BGW')
})

test('failed terminal fixture window keeps the committed horizon and can be retried', async ({
	page
}) => {
	let requestCount = 0
	await page.route('**/api/vitals', route =>
		route.fulfill({ status: 204, body: '' })
	)
	await page.route('**/api/fixtures/window?**', route => {
		requestCount += 1
		return route.fulfill({
			status: 502,
			contentType: 'application/json',
			body: JSON.stringify({
				error: 'Fixture window is temporarily unavailable'
			})
		})
	})
	await page.goto('/explore/fixtures')

	const fiveGws = page.getByRole('button', { name: '5 GWs' })
	const sixGws = page.getByRole('button', { name: '6 GWs' })
	await sixGws.click()
	await expect(
		page.getByText('Could not load fixtures for this horizon.')
	).toBeVisible()
	await expect(fiveGws).toHaveAttribute('aria-pressed', 'true')
	await expect(sixGws).toHaveAttribute('aria-busy', 'false')

	await sixGws.click()
	await expect.poll(() => requestCount).toBe(2)
})

test('switching back during a request cancels stale horizon intent', async ({
	page
}) => {
	let requestCount = 0
	let releaseFirst: () => void = () => undefined
	let markFirstStarted: () => void = () => undefined
	const firstStarted = new Promise<void>(resolve => {
		markFirstStarted = resolve
	})
	const firstGate = new Promise<void>(resolve => {
		releaseFirst = resolve
	})

	await page.route('**/api/fixtures/window?**', async route => {
		requestCount += 1
		if (requestCount === 1) {
			markFirstStarted()
			await firstGate
		}
		try {
			await route.continue()
		} catch {
			// The first route is expected to be aborted by the 3-GW selection.
		}
	})
	await page.route('**/api/vitals', route =>
		route.fulfill({ status: 204, body: '' })
	)
	await page.goto('/explore/fixtures')
	await page.getByRole('button', { name: '6 GWs' }).click()
	await firstStarted
	await page.getByRole('button', { name: '3 GWs' }).click()
	await expect(page.getByRole('button', { name: '3 GWs' })).toHaveAttribute(
		'aria-pressed',
		'true'
	)
	releaseFirst()

	await page.getByRole('button', { name: '6 GWs' }).click()
	await expect(page.getByRole('button', { name: '6 GWs' })).toHaveAttribute(
		'aria-pressed',
		'true'
	)
	expect(requestCount).toBe(2)
})
