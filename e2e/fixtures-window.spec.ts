import { expect, test } from '@playwright/test'

for (const locale of ['en', 'zh-CN'] as const) {
	for (const width of [1440, 390]) {
		test.describe(`fixture row identity ${locale} ${width}`, () => {
			test.use({ viewport: { width, height: 900 }, timezoneId: 'Australia/Perth' })
			test('DGW and BGW belong to the correct team and gameweek cells', async ({ page }) => {
				await page.goto(locale === 'en' ? '/explore/fixtures' : '/zh-CN/explore/fixtures')
				const matrix = page.getByRole('region', {
					name: locale === 'en' ? 'Team FDR' : '球队 FDR', exact: true
				})
				await expect(matrix.locator('tbody tr')).toHaveCount(3)
				const headers = await matrix.getByRole('columnheader').allTextContents()
				const gw33 = headers.findIndex(text => text.trim() === 'GW33')
				const gw34 = headers.findIndex(text => text.trim() === 'GW34')
				expect(gw33).toBeGreaterThanOrEqual(0)
				expect(gw34).toBeGreaterThan(gw33)
				// Resolve columns from their actual GW headings, not a fixed offset.
				const arsenal = matrix.locator('#fdr-team-1')
				const arsenal33 = arsenal.locator(':scope > td, :scope > th').nth(gw33)
				await expect(arsenal33.locator('[title]')).toHaveCount(2)
				await expect(arsenal33.getByText(locale === 'en' ? 'DGW' : '双赛轮', { exact: true })).toBeVisible()
				await expect(arsenal33.getByTitle('GW33 · CHE (H) · FDR 2', { exact: true })).toHaveText('CHEH · FDR 2')
				await expect(arsenal33.getByTitle('GW33 · EVE (A) · FDR 2', { exact: true })).toHaveText('EVEA · FDR 2')
				const arsenal34 = arsenal.locator(':scope > td, :scope > th').nth(gw34)
				await expect(arsenal34).toHaveText(locale === 'en' ? 'BGW' : '空白轮')
				await expect(arsenal34.locator('[title]')).toHaveCount(0)
				for (const [teamId, expected33, expected34] of [
					[2, 'GW33 · ARS (A) · FDR 4', 'GW34 · EVE (H) · FDR 2'],
					[3, 'GW33 · ARS (H) · FDR 4', 'GW34 · CHE (A) · FDR 3']
				] as const) {
					const row = matrix.locator(`#fdr-team-${teamId}`)
					for (const [index, title] of [[gw33, expected33], [gw34, expected34]] as const) {
						const cell = row.locator(':scope > td, :scope > th').nth(index)
						await expect(cell.locator('[title]')).toHaveCount(1)
						await expect(cell.getByTitle(title, { exact: true })).toBeVisible()
						await expect(cell.getByText(locale === 'en' ? 'DGW' : '双赛轮', { exact: true })).toHaveCount(0)
					}
				}
			})
		})
	}
}

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

	const interactionMetrics = () => routeReadySamples(reportedVitals).filter(sample => sample.metricName === 'FIXTURES_WINDOW_READY' && sample.measurementKind === 'interaction')
	await expect.poll(() => routeReadySamples(reportedVitals).filter(sample => sample.metricName === 'FIXTURES_WINDOW_READY').length).toBe(1)
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
			routeReadySamples(reportedVitals).some(
				sample =>
					sample.metric === 'route_ready_ms' && sample.surface === 'fixtures'
			)
		)
		.toBe(true)
	const windowMetric = routeReadySamples(reportedVitals).find(
		sample =>
			sample.metric === 'route_ready_ms' && sample.surface === 'fixtures'
	)
	expect(windowMetric?.result).toBe('ok')
	expect(windowMetric?.samplingProbability).toBe(1)
	expect(windowMetric?.value).toEqual(expect.any(Number))
	await expect.poll(() => interactionMetrics().length).toBe(1)
	expect(interactionMetrics()[0].result).toBe('ok')
	expect(interactionMetrics()[0].interactionId).toEqual(expect.any(String))

	await fiveGws.click()
	await expect(fiveGws).toHaveAttribute('aria-pressed', 'true')
	await expect.poll(() => interactionMetrics().length).toBe(2)
	await sixGws.click()
	await expect(sixGws).toHaveAttribute('aria-pressed', 'true')
	await expect.poll(() => interactionMetrics().length).toBe(3)
	expect(new Set(interactionMetrics().map(sample => sample.interactionId)).size).toBe(3)
	expect(requestCount).toBe(1)
})

for (const locale of ['en', 'zh-CN'] as const) {
	for (const width of [1440, 390]) {
		test.describe(`unknown fixture cells ${locale} ${width}`, () => {
			test.use({ viewport: { width, height: 900 }, timezoneId: 'Australia/Perth' })
			test('partial fixture window preserves each team and marks unknown cells unavailable', async ({ page }) => {
				let windowRequests = 0
				await page.route('**/api/fixtures/window?**', route => {
					windowRequests += 1
					const url = new URL(route.request().url())
					expect(url.searchParams.get('fromGw')).toBe('38')
					return route.fulfill({
						status: 200,
						contentType: 'application/json',
						headers: { 'Cache-Control': 'no-store' },
						body: JSON.stringify({ fromGw: 38, toGw: 38, fixturesByEvent: {}, unknownEventIds: [38] })
					})
				})
				await page.goto(locale === 'en' ? '/explore/fixtures' : '/zh-CN/explore/fixtures')
				const matrix = page.getByRole('region', {
					name: locale === 'en' ? 'Team FDR' : '球队 FDR', exact: true
				})
				const originalGw33 = await matrix.locator('#fdr-team-1 [title^="GW33 ·"]').allTextContents()
				expect(originalGw33).toHaveLength(2)
				const sixGws = page.getByRole('button', { name: locale === 'en' ? '6 GWs' : '6 轮', exact: true })
				await sixGws.click()
				await expect(sixGws).toHaveAttribute('aria-pressed', 'true')
				await expect(sixGws).toHaveAttribute('aria-busy', 'false')
				const headers = await matrix.getByRole('columnheader').allTextContents()
				const gw38 = headers.findIndex(header => header.trim() === 'GW38')
				expect(gw38).toBeGreaterThan(-1)
				await expect(matrix.locator('tbody tr')).toHaveCount(3)
				for (const teamId of [1, 2, 3]) {
					const cell = matrix.locator(`#fdr-team-${teamId}`).locator(':scope > td, :scope > th').nth(gw38)
					await expect(cell).toHaveText(locale === 'en' ? 'Unavailable' : '暂不可用')
					await expect(cell.locator('[title]')).toHaveCount(0)
				}
				await expect(matrix.locator('#fdr-team-1 [title^="GW33 ·"]')).toHaveText(originalGw33)
				expect(windowRequests).toBe(1)
			})
		})
	}
}

test('failed terminal fixture window keeps the committed horizon and can be retried', async ({
	page
}) => {
	let requestCount = 0
	await page.route('**/api/vitals', route =>
		route.fulfill({ status: 204, body: '' })
	)
	await page.route('**/api/fixtures/window?**', route => {
		requestCount += 1
		if (requestCount > 1) return route.continue()
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

	const recoveredResponse = page.waitForResponse(response => response.url().includes('/api/fixtures/window?fromGw=38') && response.status() === 200)
	await sixGws.click()
	expect(await (await recoveredResponse).json()).toMatchObject({ fromGw: 38, toGw: 38, unknownEventIds: [] })
	await expect.poll(() => requestCount).toBe(2)
	await expect(sixGws).toHaveAttribute('aria-pressed', 'true')
	await expect(sixGws).toHaveAttribute('aria-busy', 'false')
	await expect(page.getByRole('columnheader', { name: 'GW38', exact: true })).toBeVisible()
	await expect(page.getByText('Could not load fixtures for this horizon.')).not.toBeVisible()
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

for (const width of [390, 1440]) {
	for (const closeMethod of ['button', 'escape'] as const) {
		test(`team fixture dialog restores its current trigger after ${closeMethod} at ${width}px`, async ({ page }) => {
			await page.setViewportSize({ width, height: 900 })
			await page.goto('/explore/fixtures')
			for (const team of ['Arsenal', 'Chelsea']) {
				const trigger = page.getByRole('button', { name: `View ${team}'s full-season fixtures`, exact: true })
				await trigger.click()
				const dialog = page.getByRole('dialog')
				await expect(dialog).toBeVisible()
				await expect(dialog.getByRole('heading', { name: new RegExp(team) })).toBeVisible()
				if (closeMethod === 'button') {
					await dialog.getByRole('button', { name: 'Close', exact: true }).click()
				} else {
					await page.keyboard.press('Escape')
				}
				await expect(dialog).not.toBeVisible()
				await expect(trigger).toBeFocused()
				await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
			}
		})
	}
}
