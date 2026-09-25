import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { GET_PLAYER_STATS_BOOTSTRAP } from '../lib/graphql/operations/players'

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
	const expectedRouteReadyNames = [
		'PLAYER_COMPARE_PAINT',
		'PLAYER_COMPARE_READY',
		'PLAYER_DETAIL_PAINT',
		'PLAYER_DETAIL_READY',
		'PLAYER_DIRECTORY_PAINT',
		'PLAYER_DIRECTORY_READY'
	]
	const playerStatsRouteReady = () =>
		routeReadySamples(reportedVitals).filter(
			sample => sample.metric === 'route_ready_ms' && sample.surface === 'player_stats'
		)
	await expect
		.poll(() =>
			Array.from(
				new Set(playerStatsRouteReady().map(sample => sample.metricName))
			).sort()
		)
		.toEqual(expectedRouteReadyNames)
	const routeReady = playerStatsRouteReady()
	expect(routeReady.map(sample => sample.metricName)).toEqual(
		expect.arrayContaining(expectedRouteReadyNames)
	)
	expect(routeReady.every(sample => sample.measurementKind === 'initial_navigation')).toBe(
		true
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
}, testInfo) => {
	let deskRequests = 0
	let heldRequest: import('@playwright/test').Request | undefined
	let heldRequestSettled = false
	const observeSettlement = (request: import('@playwright/test').Request) => {
		if (request === heldRequest) heldRequestSettled = true
	}
	page.on('requestfinished', observeSettlement)
	page.on('requestfailed', observeSettlement)
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
		heldRequest = route.request()
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
	await players.getByRole('button', { name: /^Palmer/ }).and(page.locator('[data-player-stats-directory-result="true"]')).click()
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
	await expect.poll(() => heldRequestSettled).toBe(true)
	await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
	await expect(page).toHaveURL(url => url.searchParams.get('p1') === '1')
	await expect(page.getByText('Loading player statistics')).toHaveCount(0)
	await expect(overall).not.toContainText('Palmer')
	expect(deskRequests).toBe(1)
	await testInfo.attach('C13-states', { body: JSON.stringify({
		caseId: 'C13',
		stepIds: ['C13.01'],
		state: 'loading-to-ready',
		fixture: 'held /api/player-stats/desk response while selecting Palmer, then released after returning to Saka',
		assertions: ['loading status visible while committed Saka remains', 'new selection is usable after settlement', 'no stranded loading state'],
		functionalStatus: 'PASS',
		performanceStatus: 'NOT_OBSERVED',
		readyMs: null,
		wholeCaseComplete: false
	}), contentType: 'application/json' })
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

	for (const locale of ['en', 'zh-CN'] as const) {
		for (const compare of [false, true]) {
			test(`recovers all detail sections from an unavailable directory seed ${locale} ${compare ? 'compare' : 'single'}`, async ({ page }, testInfo) => {
				await page.setViewportSize({ width: compare ? 390 : 1440, height: 900 })
				await control()
				const initialPlayerId = runPlayerId(compare ? 8 : 7)
				const bootstrap = await (await fetch(fixture.replace('/__performance', '/graphql'), {
					method: 'POST', headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ query: GET_PLAYER_STATS_BOOTSTRAP })
				})).json()
				bootstrap.data.playerStatsBootstrap.statsContext.status = 'UNAVAILABLE'
				await control([
					{ operation: 'GetPlayerStatsBootstrap', data: bootstrap.data },
					{ operation: 'GetPlayerStatsDeskOverview', error: true }
				])
				await page.goto(`/${locale}/explore/player-stats?p1=${initialPlayerId}${compare ? '&p2=2' : ''}`)
				const retry = page.getByRole('button', { name: locale === 'en' ? 'Retry' : '重试', exact: true })
				await expect(retry).toHaveCount(1)
				await expect(retry).toBeVisible()
				await control()
				await retry.click()
				const profile = page.locator('#ps-profile')
				const state = page.locator('#ps-state')
				await expect(profile).toBeVisible()
				await expect(state).toBeVisible()
				const unavailable = locale === 'en' ? 'Season total temporarily unavailable' : '赛季总分暂时不可用'
				await expect(profile).not.toContainText(unavailable)
				await expect(state).not.toContainText(unavailable)
				await expect(page.getByRole('button', { name: locale === 'en' ? 'Recent GWs' : '近期轮次', exact: true })).toBeVisible()
				await expect(page.getByRole('button', { name: locale === 'en' ? 'Process' : '比赛过程', exact: true })).toBeVisible()
				await expect(page).toHaveURL(new RegExp(`p1=${initialPlayerId}${compare ? '&p2=2' : ''}`))
				await testInfo.attach('C13-states', { body: JSON.stringify({
					caseId: 'C13',
					stepIds: ['C13.01'],
					state: 'unavailable-to-ready',
					fixture: 'GetPlayerStatsBootstrap statsContext UNAVAILABLE + GetPlayerStatsDeskOverview error, then cleared before Retry',
					assertions: ['unavailable Retry visible', 'actual Retry click recovers profile/state/process controls', 'URL and selected player preserved'],
					locale,
					viewport: { width: compare ? 390 : 1440, height: 900 },
					functionalStatus: 'PASS',
					performanceStatus: 'NOT_OBSERVED',
					readyMs: null,
					wholeCaseComplete: false
				}), contentType: 'application/json' })
			})
		}
	}

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
		await players.getByRole('button', { name: /^Palmer/ }).and(page.locator('[data-player-stats-directory-result="true"]')).click()
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
		await expect.poll(async () => (await (await fetch(fixture)).json()).requests.find((row: { operation: string; variables: { playerIds?: number[] }; finishedAt?: number | null }) => row.operation === 'GetPlayerStatsDeskOverview' && row.variables.playerIds?.includes(initialPlayerId))?.finishedAt).toBeTruthy()
		await page.waitForLoadState('load')
		await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
		await expect(page.getByRole('region', { name: 'Player overall' })).toContainText('Palmer')
		await expect(page.getByRole('region', { name: 'Player overall' })).not.toContainText('Saka')
		await expect(page).not.toHaveURL(/p2=/)
	})
})

for (const width of [1440, 390]) {
	test(`local comparison survives leaving and browser history at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 })
		await page.goto('/explore/player-stats?p1=1')
		const overall = page.getByRole('region', { name: 'Player overall' })
		await expect(overall).toContainText('Saka')
		await page.getByRole('button', { name: 'Add comparison', exact: true }).click()
		await page.getByRole('region', { name: 'Players', exact: true })
			.getByRole('button', { name: /^Palmer/ }).and(page.locator('[data-player-stats-directory-result="true"]')).click()
		await expect(page).toHaveURL(/p1=1&p2=2/)
		await expect(overall).toContainText('Palmer')
		const comparisonUrl = page.url()
		await page.getByRole('link', { name: 'Squad fixture plan on Fixtures', exact: true }).click()
		await expect(page).toHaveURL(/\/explore\/fixtures#my-squad$/)
		await expect(page.locator('#my-squad')).toBeVisible()
		await page.goBack()
		await expect(page).toHaveURL(comparisonUrl)
		await expect(overall).toContainText('Saka')
		await expect(overall).toContainText('Palmer')
		await page.goForward()
		await expect(page).toHaveURL(/\/explore\/fixtures#my-squad$/)
		await expect(page.locator('#my-squad')).toBeVisible()
	})
}

for (const recovery of ['retry', 'remove'] as const) {
	test(`history restoration ${recovery} preserves the latest comparison intent`, async ({ page }) => {
		await page.goto('/explore/player-stats?p1=1')
		const overall = page.getByRole('region', { name: 'Player overall' })
		await expect(overall).toContainText('Saka')
		await page.getByRole('button', { name: 'Add comparison', exact: true }).click()
		await page.getByRole('region', { name: 'Players', exact: true })
			.getByRole('button', { name: /^Palmer/ }).and(page.locator('[data-player-stats-directory-result="true"]')).click()
		await expect(overall).toContainText('Palmer')
		await expect(page).toHaveURL(/p1=1&p2=2/)
		await page.getByRole('link', { name: 'Squad fixture plan on Fixtures', exact: true }).click()
		await expect(page).toHaveURL(/\/explore\/fixtures#my-squad$/)
		// Expire only the isolated browser's five-minute desk cache.
		await page.clock.setFixedTime(new Date(Date.now() + 6 * 60 * 1000))
		let requests = 0
		let release = () => {}
		const held = new Promise<void>(resolve => { release = resolve })
		let settled = false
		await page.route('**/api/player-stats/desk?**', async route => {
			if (!new URL(route.request().url()).searchParams.get('playerIds')?.split(',').includes('2')) {
				return route.continue()
			}
			requests++
			if (requests > 1) {
				const response = await route.fetch()
				const body = await response.json()
				for (const entry of body.entries ?? []) {
					if (entry.playerId === 2 && entry.overview) entry.overview.selectedByPercent = 61.2
				}
				return route.fulfill({ response, json: body })
			}
			if (recovery === 'retry') return route.fulfill({ status: 503, body: '{}' })
			await held
			try { await route.continue() } catch { /* Removed selection cancels the request. */ }
			settled = true
		})
		try {
			await page.goBack()
			await expect.poll(() => requests).toBe(1)
			if (recovery === 'retry') {
				await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible()
				await expect(page).toHaveURL(/p1=1&p2=2/)
				await page.getByRole('button', { name: 'Retry', exact: true }).click()
				await expect(overall).toContainText('Palmer')
				await expect(overall).toContainText('Saka')
				await expect(overall).toContainText('61.2%')
				expect(requests).toBe(2)
			} else {
				await page.getByRole('button', { name: 'Remove', exact: true }).click()
				release()
				await expect.poll(() => settled).toBe(true)
				await expect(page).not.toHaveURL(/p2=/)
				await expect(overall).toContainText('Saka')
				await expect(overall).not.toContainText('Palmer')
				expect(requests).toBe(1)
			}
		} finally {
			release()
		}
	})
}

test('clearing a shared pending history restore updates the URL before the response', async ({ page }) => {
 await page.goto('/explore/player-stats?p1=1')
 const players = page.getByRole('region', { name: 'Players', exact: true })
 const overall = page.getByRole('region', { name: 'Player overall' })
 await expect(overall).toContainText('Saka')
 await players.getByRole('button', { name: 'Edit', exact: true }).click()
 await players.getByRole('button', { name: /^Palmer/ }).and(page.locator('[data-player-stats-directory-result="true"]')).click()
 await expect(overall).toContainText('Palmer')
 await page.getByRole('button', { name: 'Add comparison', exact: true }).click()
 await players.getByRole('button', { name: /^Saka/ }).click()
 await expect(page).toHaveURL(/p1=2&p2=1/)
 await page.getByRole('link', { name: 'Squad fixture plan on Fixtures', exact: true }).click()
 await expect(page).toHaveURL(/fixtures#my-squad$/)
 await page.clock.setFixedTime(new Date(Date.now() + 6 * 60 * 1000))
 let release = () => {}
 const held = new Promise<void>(resolve => { release = resolve })
 let requests = 0
 await page.route('**/api/player-stats/desk?**', async route => {
  requests++
  await held
  try { await route.continue() } catch { /* Navigation may cancel the shared request. */ }
 })
 try {
  await page.goBack()
  await expect.poll(() => requests).toBe(1)
  await page.getByRole('button', { name: 'Remove', exact: true }).click()
  await expect(page).toHaveURL(url => url.searchParams.get('p1') === '2' && !url.searchParams.has('p2'))
 } finally { release() }
})


test.describe('process evidence availability', () => {
 for (const locale of ['en', 'zh-CN'] as const) {
  for (const width of [1440, 390]) {
   for (const scenario of ['empty-single', 'empty-both', 'valid-single', 'valid-second', 'unverified-first'] as const) {
    test(`${scenario} ${locale} ${width}px`, async ({ page }, testInfo) => {
     test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Response replacement is isolated-only')
     const zh = locale === 'zh-CN'
     const compare = !scenario.endsWith('single')
     let processResponses = 0
     await page.setViewportSize({ width, height: 900 })
     await page.route('**/api/player-stats/desk?**', async route => {
      if (new URL(route.request().url()).searchParams.get('section') !== 'process') return route.continue()
      const response = await route.fetch()
      expect(response.ok()).toBe(true)
      const body = await response.json()
      for (const entry of body.entries) {
       const dimension = entry.state.dimensions.find((item: { kind: string }) => item.kind === 'REAL_WORLD_PROCESS')
       expect(dimension.metrics).toHaveLength(1)
       const empty = scenario.startsWith('empty') || (scenario === 'valid-second' && entry.playerId === 1)
       if (empty) dimension.metrics = []
       if (scenario === 'unverified-first' && entry.playerId === 1) dimension.metrics[0].value = 9.99
       entry.state.coverage.sources = [{ provider: 'UNDERSTAT', scope: 'CURRENT', dataStatus: 'AVAILABLE', mappingStatus: scenario === 'unverified-first' && entry.playerId === 1 ? 'UNVERIFIED' : 'VERIFIED', seasons: ['2627'] }]
      }
      processResponses += 1
      await route.fulfill({ response, json: body })
     })
     await page.goto(`${zh ? '/zh-CN' : ''}/explore/player-stats?p1=1${compare ? '&p2=2' : ''}`)
     const overall = page.getByRole('region', { name: zh ? '球员总览' : 'Player overall', exact: true })
     await expect(overall).toContainText('Saka')
     if (compare) await expect(overall).toContainText('Palmer')
     await page.getByRole('button', { name: zh ? '比赛过程' : 'Process', exact: true }).click()
     const section = page.locator('#ps-process')
     await expect(section).toBeVisible()
     await expect.poll(() => processResponses).toBeGreaterThan(0)
     if (scenario.startsWith('empty')) {
      await expect(section).toContainText(zh ? '暂无已验证的当前 Understat 比赛过程，不生成过程判断。' : 'Verified current Understat process is unavailable; no process claim is made.')
     } else {
      await expect(section).toContainText('0.31')
      await expect(section).not.toContainText('9.99')
     }
     await expect(page).toHaveURL(url => url.searchParams.get('p1') === '1' && url.hash === '#ps-process')
     if (scenario.startsWith('empty')) await testInfo.attach('C13-states', { body: JSON.stringify({
			caseId: 'C13',
			stepIds: ['C13.01'],
			state: 'empty',
			fixture: `REAL_WORLD_PROCESS dimension metrics emptied for ${scenario}`,
			assertions: ['process section remains usable', 'explicit verified-data-unavailable empty message visible', 'no fabricated process judgement'],
			locale,
			viewport: { width, height: 900 },
			functionalStatus: 'PASS',
			performanceStatus: 'NOT_OBSERVED',
			readyMs: null,
			wholeCaseComplete: false
	 }), contentType: 'application/json' })
    })
   }
  }
 }
})

for (const locale of ['en', 'zh-CN']) {
 for (const width of [1440, 390]) {
  test(`PS05 failed selection reselection and cached return ${locale} ${width}`, async ({ page }) => {
   const zh = locale === 'zh-CN'
   await page.setViewportSize({ width, height: 900 })
   let requests = 0
   await page.route('**/api/player-stats/desk?**', async route => {
    const query = new URL(route.request().url()).searchParams
    if (query.get('playerIds') !== '2' || query.get('section') !== 'overview') return route.continue()
    requests++
    if (requests === 1) return route.fulfill({ status: 503, body: '{}' })
    return route.continue()
   })
   await page.goto(`${zh ? '/zh-CN' : ''}/explore/player-stats?p1=1`)
   const overall = page.getByRole('region', { name: zh ? '球员总览' : 'Player overall', exact: true })
   const players = page.getByRole('region', { name: zh ? '球员' : 'Players', exact: true })
   const choose = async (name: string) => {
    await players.getByRole('button', { name: zh ? '编辑' : 'Edit', exact: true }).click()
    await players.getByRole('button', { name: new RegExp(`^${name} MID`) }).click()
   }
   await expect(overall).toContainText('Saka')
   await choose('Palmer')
   await expect(page.getByRole('alert').filter({ hasText: zh ? '球员数据加载失败' : 'Failed to load player data.' })).toBeVisible()
   await expect(overall).toContainText('Saka')
   expect(requests).toBe(1)
   await choose('Palmer')
   await expect(overall).toContainText('Palmer')
   expect(requests).toBe(2)
   await choose('Saka')
   await expect(overall).toContainText('Saka')
   await expect(overall).not.toContainText('Palmer')
   await choose('Palmer')
   await expect(overall).toContainText('Palmer')
   await expect(overall).not.toContainText('Saka')
   expect(requests).toBe(2)
  })
 }
}

for (const sectionName of ['recent', 'process'] as const) {
test(`single ${sectionName} section selection keeps one in-flight request`, async ({ page }) => {
 test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Delayed response is isolated-only')
 let sectionRequests = 0
 await page.route('**/api/player-stats/desk?**', async route => {
  if (new URL(route.request().url()).searchParams.get('section') !== sectionName) return route.continue()
  sectionRequests++
  const response = await route.fetch()
  await new Promise(resolve => setTimeout(resolve, 300))
  await route.fulfill({ response })
 })
 await page.goto('/explore/player-stats?p1=1')
 await expect(page.getByRole('region', { name: 'Player overall', exact: true })).toContainText('Saka')
 await page.getByRole('button', { name: sectionName === 'recent' ? 'Recent GWs' : 'Process', exact: true }).click()
 const section = page.locator(`#ps-${sectionName}`)
 await expect(section).toBeVisible()
 if (sectionName === 'recent') await expect(section.locator('tbody tr')).not.toHaveCount(0)
 else {
  await expect(section).toContainText('7.20')
  await expect(section).toContainText('Verified current Understat process is unavailable; no process claim is made.')
 }
 expect(sectionRequests).toBe(1)
})

}
