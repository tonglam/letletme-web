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

for (const locale of ['en', 'zh-CN'] as const) {
test.describe(`FIX03 terminal ${locale}`, () => {
 if (locale === 'zh-CN') test.use({ viewport: { width: 390, height: 900 }, timezoneId: 'UTC', colorScheme: 'dark' })
 test('terminal horizon switch keeps 5 GWs committed, sends one GET, then reuses memory cache', async ({
	page, context, request
}, testInfo) => {
 test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Requires isolated terminal fixture')
 if (locale === 'zh-CN') {
  testInfo.annotations.push({ type: 'coverage-variant', description: 'FIX03.state.03' })
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
  expect((await context.cookies()).filter(cookie => /session/i.test(cookie.name))).toHaveLength(0)
  const first = await request.get('/api/fixtures/window?fromGw=1&count=1')
  expect(first.ok()).toBe(true)
  expect(await first.json()).toMatchObject({ fromGw: 1, toGw: 1, unknownEventIds: [], fixturesByEvent: { '1': [{ id: 1001, eventId: 1, finished: true, homeScore: 2, awayScore: 1 }] } })
  const overflow = await request.get('/api/fixtures/window?fromGw=38&count=2')
  expect(overflow.status()).toBe(400)
 }
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
  const url = new URL(route.request().url())
  expect(url.searchParams.get('fromGw')).toBe('38')
  expect(url.searchParams.get('count')).toBe('1')
		markRequestStarted()
		await requestGate
		await route.continue()
	})
	await page.route('**/api/vitals', route => {
		const payload = route.request().postDataJSON()
		if (payload && typeof payload === 'object') reportedVitals.push(payload)
		return route.fulfill({ status: 204, body: '' })
	})
	await page.goto(locale === 'en' ? '/explore/fixtures' : '/zh-CN/explore/fixtures')
 if (locale === 'zh-CN') {
  await expect(page.locator('html')).toHaveClass(/dark/)
  expect(page.viewportSize()?.width).toBe(390)
  expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('UTC')
 }

	const interactionMetrics = () => routeReadySamples(reportedVitals).filter(sample => sample.metricName === 'FIXTURES_WINDOW_READY' && sample.measurementKind === 'interaction')
	await expect.poll(() => routeReadySamples(reportedVitals).filter(sample => sample.metricName === 'FIXTURES_WINDOW_READY').length).toBe(1)
	const fiveGws = page.getByRole('button', { name: locale === 'en' ? '5 GWs' : '5 轮' })
	const sixGws = page.getByRole('button', { name: locale === 'en' ? '6 GWs' : '6 轮' })
	await sixGws.click()
	await requestStarted
	await expect(fiveGws).toHaveAttribute('aria-pressed', 'true')
	await expect(sixGws).toHaveAttribute('aria-busy', 'true')
	await expect(page.getByText(locale === 'en' ? 'Loading more gameweeks…' : '正在加载更多轮次…')).toBeVisible()
	await expect(page.getByRole('columnheader', { name: 'GW38' })).toHaveCount(0)

	await sixGws.click()
	expect(requestCount).toBe(1)
	releaseRequest()
	await expect(sixGws).toHaveAttribute('aria-pressed', 'true')
	await expect(sixGws).toHaveAttribute('aria-busy', 'false')
	await expect(page.getByRole('columnheader', { name: 'GW38' })).toBeVisible()
 await expect(page.getByRole('columnheader', { name: 'GW39', exact: true })).toHaveCount(0)
 await expect(page.locator('#fdr-team-2').getByTitle('GW38 · EVE (H) · FDR 2', { exact: true })).toBeVisible()
 await expect(page.locator('#fdr-team-3').getByTitle('GW38 · CHE (A) · FDR 3', { exact: true })).toBeVisible()
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

})
}

for (const context of [
 ...(['en', 'zh-CN'] as const).flatMap(locale => [1440, 390].map(width => ({ locale, width, timezone: 'Australia/Perth', theme: 'system' as const, variantId: `S20.UNRESOLVED_ROLE.${locale}.${width === 1440 ? 'desktop1440' : 'mobile390'}.base` }))),
 { locale: 'zh-CN' as const, width: 390, timezone: 'UTC', theme: 'dark' as const, variantId: 'S20.directed.02' }
]) {
 const { locale, width, timezone, theme, variantId } = context
		test.describe(`${variantId} unknown fixture cells ${locale} ${width}`, () => {
			test.use({ viewport: { width, height: 900 }, timezoneId: timezone, colorScheme: theme === 'dark' ? 'dark' : 'light' })
			test('partial fixture window preserves each team and marks unknown cells unavailable', async ({ page }, testInfo) => {
                await page.addInitScript(theme => localStorage.setItem('theme', theme), theme)
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
                const gw34 = headers.findIndex(header => header.trim() === 'GW34')
                expect(gw34).toBeGreaterThan(-1)
                await expect(matrix.locator('#fdr-team-1').locator(':scope > td, :scope > th').nth(gw34)).toHaveText(locale === 'en' ? 'BGW' : '空白轮')
                expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(timezone)
                await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /light/)
                await testInfo.attach('S20-unknown-vs-BGW', { contentType: 'application/json', body: JSON.stringify({ caseId: 'S20', stepId: 'S20.01', variantId, locale, width, theme, timezone, identity: 'A anonymous', environment: 'isolated-fixture', assertion: 'All three GW38 cells are unavailable; the confirmed Arsenal GW34 blank remains BGW; prior GW33 fixtures remain intact', currentBehavior: 'unknown-distinct-from-BGW', targetOracle: 'unknown-distinct-from-BGW', contractGap: false, windowRequests, functionalStatus: 'PASS', performanceStatus: 'NOT_RUN', readyMs: null, wholeVariantComplete: false, scope: 'FDR window presentation with controlled unknown response; not all empty/missing states' }) })
			})
		})
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

for (const locale of ['en', 'zh-CN'] as const) {
	for (const width of [1440, 390]) {
		test.describe(`candidate position filter ${locale} ${width}`, () => {
			test.use({ viewport: { width, height: 900 } })
			test('position filters preserve candidate identity and restore all results', async ({ page }) => {
				await page.goto(locale === 'en' ? '/explore/fixtures' : '/zh-CN/explore/fixtures')
				const actions = page.locator('[data-ssr-stream-content="fixtures-actions"]')
				const rows = actions.locator('li')
				await expect(rows.first()).toBeVisible()
				const baseline = await rows.evaluateAll(items => items.map(item => ({
					position: item.firstElementChild?.textContent?.trim(),
					href: item.querySelector('a')?.getAttribute('href')
				})))
				expect(baseline.length).toBeGreaterThan(0)
				expect(baseline.every(item => item.href && item.position)).toBe(true)
				for (const position of ['GKP', 'DEF', 'MID', 'FWD']) {
					const button = actions.getByRole('button', { name: position, exact: true })
					await button.click()
					await expect(button).toHaveAttribute('aria-pressed', 'true')
					const expected = baseline.filter(item => item.position === position)
					await expect(rows).toHaveCount(expected.length)
					expect(await rows.locator('a').evaluateAll(links => links.map(link => link.getAttribute('href')))).toEqual(expected.map(item => item.href))
				}
				await actions.getByRole('button', { name: locale === 'en' ? 'All' : '全部', exact: true }).click()
				await expect(rows).toHaveCount(baseline.length)
				expect(await rows.locator('a').evaluateAll(links => links.map(link => link.getAttribute('href')))).toEqual(baseline.map(item => item.href))
			})
		})
	}
}

const dialogContexts = [
	...(['en', 'zh-CN'] as const).flatMap(locale =>
		[1440, 390].map(width => ({ locale, width, scenario: 'baseline', timezoneId: 'Australia/Perth', colorScheme: 'light' as const }))
	),
	...['ready', 'empty', 'error'].map(scenario => ({ locale: 'zh-CN' as const, width: 390, scenario, timezoneId: 'UTC', colorScheme: 'dark' as const }))
]
for (const context of dialogContexts) {
	test.describe(`FIX02 planned dialog ${context.locale} ${context.width} ${context.scenario}`, () => {
		test.use({ viewport: { width: context.width, height: 900 }, timezoneId: context.timezoneId, colorScheme: context.colorScheme })
		test('loads the selected team schedule and restores focus after recovery and close', async ({ page }) => {
			const zh = context.locale === 'zh-CN'
			await page.goto(zh ? '/zh-CN/explore/fixtures' : '/explore/fixtures')
			expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(context.timezoneId)
			if (context.colorScheme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/)
			const matrixRows = page.locator('tr[id^="fdr-team-"]')
			const rowOrder = await matrixRows.evaluateAll(rows => rows.map(row => row.id))
			expect(rowOrder.length).toBeGreaterThan(0)
			let fail = context.scenario === 'error'
			const windows: number[] = []
			await page.route('**/api/fixtures/window?**', async route => {
				const url = new URL(route.request().url())
				const fromGw = Number(url.searchParams.get('fromGw'))
				const count = Number(url.searchParams.get('count'))
				windows.push(fromGw)
				if (fail) return route.fulfill({ status: 503, json: { error: 'isolated schedule failure' } })
				if (context.scenario === 'empty') {
					return route.fulfill({ json: {
						fromGw, toGw: fromGw + count - 1, unknownEventIds: [],
						fixturesByEvent: Object.fromEntries(Array.from({ length: count }, (_, offset) => [String(fromGw + offset), []]))
					} })
				}
				await route.continue()
			})
			const trigger = page.getByRole('button', { name: zh ? '查看 Arsenal 的整个赛季赛程' : "View Arsenal's full-season fixtures", exact: true })
			await trigger.click()
			const dialog = page.getByRole('dialog')
			await expect(dialog.getByRole('heading', { name: /Arsenal/ })).toBeVisible()
			if (fail) {
				await expect(dialog.getByRole('alert')).toHaveText('GW1–GW38 赛程暂时无法加载，请重试。重试')
				expect(windows.slice().sort((a, b) => a - b)).toEqual([1, 6, 11, 16, 21, 26, 31, 36])
				await expect(dialog.getByText('2–1', { exact: true })).toHaveCount(0)
				fail = false
				await dialog.getByRole('button', { name: '重试', exact: true }).click()
			}
			await expect(dialog.getByRole('status')).toHaveCount(0)
			await expect(dialog.getByRole('alert')).toHaveCount(0)
			await expect(dialog.getByText('GW1', { exact: true })).toBeVisible()
			await expect(dialog.getByText('GW38', { exact: true })).toBeAttached()
			if (context.scenario === 'empty') {
				await expect(dialog.getByText('空白轮', { exact: true })).toHaveCount(38)
				await expect(dialog.getByText('2–1', { exact: true })).toHaveCount(0)
			} else {
				await expect(dialog.getByText('2–1', { exact: true })).toBeVisible()
			}
			await dialog.getByText('GW38', { exact: true }).scrollIntoViewIfNeeded()
			await expect(dialog.getByText('GW38', { exact: true })).toBeVisible()
			const expectedRequests = context.scenario === 'error' ? 16 : 8
			expect(windows).toHaveLength(expectedRequests)
			expect(windows.slice(0, 8).sort((a, b) => a - b)).toEqual([1, 6, 11, 16, 21, 26, 31, 36])
			await page.keyboard.press('Escape')
			await expect(dialog).toHaveCount(0)
			await expect(trigger).toBeFocused()
			expect(await matrixRows.evaluateAll(rows => rows.map(row => row.id))).toEqual(rowOrder)
			await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
			await trigger.click()
			await expect(dialog.getByText('GW38', { exact: true })).toBeAttached()
			expect(windows).toHaveLength(expectedRequests)
			expect(windows.slice(0, 8).sort((a, b) => a - b)).toEqual([1, 6, 11, 16, 21, 26, 31, 36])
			await page.keyboard.press('Escape')
			await expect(trigger).toBeFocused()
		})
	})
}
