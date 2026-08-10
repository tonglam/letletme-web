import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const statePlayer = {
	id: '10',
	name: 'State Player',
	position: 'MID',
	teamShortName: 'ARS',
	teamName: 'Arsenal'
}

const unavailableStatePlayer = {
	...statePlayer,
	id: '11',
	name: 'Unavailable Player'
}

function playerDetail(id: number, webName: string) {
	return {
		id,
		webName,
		teamShortName: 'ARS',
		elementType: 3,
		elementTypeName: 'Midfielder',
		price: 80,
		startPrice: 75,
		totalPoints: 101,
		selectedByPercent: 12.5,
		form: 5.4,
		seasonTransfersIn: 120000,
		seasonTransfersOut: 45000,
		transfersInEvent: 12000,
		transfersOutEvent: 3000,
		eventPoints: null,
		minutes: 900,
		goalsScored: 5,
		assists: 6,
		cleanSheets: 4,
		goalsConceded: 8,
		ownGoals: 0,
		penaltiesSaved: 0,
		yellowCards: 2,
		redCards: 0,
		saves: 0,
		bonus: 12,
		bps: 210,
		influence: 280,
		creativity: 350,
		threat: 410,
		ictIndex: 104,
		fixtures: []
	}
}

const availablePlayerState = {
	playerId: 10,
	playerCode: 10010,
	teamId: 1,
	position: 3,
	season: '2627',
	horizon: 2,
	asOfEventId: null,
	asOf: '2026-08-09T10:00:00.000Z',
	trend: 'UNAVAILABLE',
	confidence: 'LOW',
	fplOnly: true,
	dimensions: [
		{
			kind: 'AVAILABILITY_ROLE',
			rating: 'SECURE',
			direction: 'STABLE',
			confidence: 'MEDIUM',
			reasonCodes: ['AVAILABILITY_AVAILABLE'],
			metrics: [
				{
					code: 'ROLE_STARTS_LAST_5',
					source: 'FPL_CURRENT',
					value: 0,
					baseline: null,
					percentile: null,
					unit: 'count',
					sampleMinutes: null,
					sampleSize: 0,
					smallSample: false,
					capability: true
				}
			]
		},
		{
			kind: 'FPL_OUTPUT',
			rating: 'INSUFFICIENT',
			direction: 'UNKNOWN',
			confidence: 'LOW',
			reasonCodes: ['OUTPUT_INSUFFICIENT'],
			metrics: [
				{
					code: 'FPL_POINTS_PER_90',
					source: 'FPL_CURRENT',
					value: 6.4,
					baseline: 5.8,
					percentile: 74,
					unit: 'per90',
					sampleMinutes: 900,
					sampleSize: 20,
					smallSample: false,
					capability: true
				}
			]
		},
		{
			kind: 'REAL_WORLD_PROCESS',
			rating: 'UNAVAILABLE',
			direction: 'UNKNOWN',
			confidence: 'LOW',
			reasonCodes: ['PROCESS_UNAVAILABLE_UNDERSTAT'],
			metrics: []
		},
		{
			kind: 'HISTORICAL_RELIABILITY',
			rating: 'PROVEN',
			direction: 'STABLE',
			confidence: 'HIGH',
			reasonCodes: ['HISTORY_PROVEN'],
			metrics: [
				{
					code: 'OWN_BASELINE_PERCENTILE',
					source: 'FPL_HISTORY',
					value: 71,
					baseline: null,
					percentile: null,
					unit: 'percentile',
					sampleMinutes: null,
					sampleSize: 2,
					smallSample: false,
					capability: true
				}
			]
		},
		{
			kind: 'OUTLOOK',
			rating: 'FAVOURABLE',
			direction: 'STABLE',
			confidence: 'HIGH',
			reasonCodes: ['OUTLOOK_FAVOURABLE'],
			metrics: [
				{
					code: 'OUTLOOK_AVERAGE_FDR',
					source: 'FPL_CURRENT',
					value: 2.5,
					baseline: null,
					percentile: null,
					unit: 'fdr',
					sampleMinutes: null,
					sampleSize: 2,
					smallSample: false,
					capability: true
				}
			]
		}
	],
	ownBaseline: {
		weightedPercentile: 71,
		seasons: [
			{
				season: '2526',
				minutes: 2500,
				positionPercentile: 73,
				weight: 1,
				understatProcessPercentile: null
			}
		]
	},
	peerBaseline: { minimumMinutes: 900, cohortSize: 20, currentPercentile: 74 },
	careerTrajectory: [
		{
			season: '2526',
			minutes: 2500,
			fplPositionPercentile: 73,
			understatProcessPercentile: null,
			expectedMetricsAvailable: true
		}
	],
	outlook: {
		rating: 'FAVOURABLE',
		horizon: 2,
		averageDifficulty: 2.5,
		gameweeks: [
			{
				eventId: 1,
				bgw: false,
				dgw: false,
				averageDifficulty: 2,
				fixtures: [
					{ opponentTeamShortName: 'LEE', wasHome: true, difficulty: 2 }
				]
			},
			{
				eventId: 2,
				bgw: true,
				dgw: false,
				averageDifficulty: null,
				fixtures: []
			}
		]
	},
	coverage: {
		fplCurrent: false,
		understatCurrent: false,
		fplHistorySeasons: ['2425', '2526'],
		understatHistorySeasons: [],
		mappingStatus: 'VERIFIED',
		metricCoverage: ['FPL_POINTS_PER_90', 'OWN_BASELINE_PERCENTILE'],
		limitations: [
			'CURRENT_FPL_INSUFFICIENT',
			'UNDERSTAT_PLAYER_DATA_UNAVAILABLE',
			'REAL_WORLD_PROCESS_UNAVAILABLE',
			'TREND_WITHHELD_BACKTEST'
		],
		providers: [
			{
				provider: 'FPL',
				scope: 'CURRENT',
				season: '2627',
				asOf: '2026-08-09T10:00:00.000Z',
				stale: false,
				available: true
			},
			{
				provider: 'UNDERSTAT',
				scope: 'CURRENT',
				season: '2627',
				asOf: null,
				stale: false,
				available: false
			}
		]
	}
}

async function routePlayerStateQueries(
	page: Page,
	profile: typeof availablePlayerState | null
) {
	let playerStateRequestCount = 0
	const playerStateRequestsByPlayer = new Map<number, number>()
	await page.route('**/api/graphql', async route => {
		const body = route.request().postDataJSON() as {
			query?: string
			variables?: { playerId?: number }
		}
		if (body.query?.includes('GetTeamsForPicker')) {
			await route.fulfill({
				status: 200,
				json: {
					data: { teams: [{ id: 1, name: 'Arsenal', shortName: 'ARS' }] }
				}
			})
			return
		}
		if (body.query?.includes('GetPlayerDetail')) {
			const id = body.variables?.playerId ?? 10
			await route.fulfill({
				status: 200,
				json: {
					data: {
						playerDetail: playerDetail(
							id,
							id === 10 ? statePlayer.name : unavailableStatePlayer.name
						)
					}
				}
			})
			return
		}
		if (body.query?.includes('GetPlayerStateProfile')) {
			const playerId = body.variables?.playerId ?? 10
			playerStateRequestCount += 1
			playerStateRequestsByPlayer.set(
				playerId,
				(playerStateRequestsByPlayer.get(playerId) ?? 0) + 1
			)
			await route.fulfill({
				status: 200,
				json: {
					data: {
						playerStateProfile: profile ? { ...profile, playerId } : null
					}
				}
			})
			return
		}
		await route.continue()
	})
	return {
		playerStateRequestCount: () => playerStateRequestCount,
		playerStateRequestsFor: (playerId: number) =>
			playerStateRequestsByPlayer.get(playerId) ?? 0
	}
}

test('homepage streams its real shell and prevents CDN script rewriting', async ({
	request
}) => {
	const response = await request.get('/', { headers: { Accept: 'text/html' } })
	const cacheControl = response.headers()['cache-control']
	const html = await response.text()

	expect(response.ok()).toBe(true)
	expect(cacheControl).toContain('no-transform')
	expect(cacheControl).toContain('must-revalidate')
	expect(html).toContain('Every point. Every rival.')
	expect(html).not.toContain('data-maintenance-page="true"')
	expect(response.headers()['retry-after']).toBeUndefined()
	expect(html).not.toContain('aria-label="Loading page"')
})

test('client-only navigation controls stay unavailable until hydration', async ({
	browser
}) => {
	const page = await browser.newPage({ javaScriptEnabled: false })
	await page.setViewportSize({ width: 390, height: 844 })
	await page.goto('/')

	await expect(
		page.getByRole('button', { name: 'Open navigation menu' })
	).toBeDisabled()
	await expect(
		page.getByRole('button', { name: 'Change color theme' })
	).toBeDisabled()

	await page.close()
})

test('public home has a keyboard skip path and no detectable accessibility violations', async ({
	page
}) => {
	await page.goto('/')
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

	await page.keyboard.press('Tab')
	const skipLink = page.getByRole('link', { name: 'Skip to main content' })
	await expect(skipLink).toBeFocused()
	await page.keyboard.press('Enter')
	await expect(page.locator('#main-content')).toBeFocused()

	const accessibility = await new AxeBuilder({ page }).analyze()
	expect(accessibility.violations).toEqual([])
})

test('mobile navigation expands a group and closes after navigation', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 })
	await page.goto('/')

	await page.getByRole('button', { name: 'Open navigation menu' }).click()
	const dialog = page.getByRole('dialog')
	await expect(dialog).toBeVisible()

	const dataGroup = dialog.getByRole('button', { name: 'Data' })
	await dataGroup.click()
	await expect(dataGroup).toHaveAttribute('aria-expanded', 'true')
	await dialog.getByRole('link', { name: 'Market' }).click()

	await expect(page).toHaveURL(/\/data\/price-changes$/)
	await expect(dialog).toBeHidden()
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= window.innerWidth
		)
	).toBe(true)
})

test('Market stays accessible and usable on a 390px Simplified Chinese screen', async ({
	page
}) => {
	await page.route('**/api/auth/**', route =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: 'null'
		})
	)
	await page.route('**/api/graphql', async route => {
		const request = route.request()
		const body = request.postDataJSON() as { query?: string }
		if (body.query?.includes('playersForPicker')) {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					data: {
						playersForPicker: {
							items: [
								{
									id: 1,
									webName: 'Saka',
									position: 'MIDFIELDER',
									team: { id: 1, name: 'Arsenal', shortName: 'ARS' }
								}
							],
							nextCursor: null
						}
					}
				})
			})
			return
		}
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				data: {
					playerValueHistory: [
						{
							playerId: 1,
							changeDate: '2026-08-03T00:00:00.000Z',
							oldValue: 99,
							newValue: 100,
							changeType: 'RISE',
							transfersIn: null,
							transfersOut: null
						}
					]
				}
			})
		})
	})
	await page.setViewportSize({ width: 390, height: 844 })
	await page.goto('/zh-CN/data/price-changes')

	await expect(
		page.getByRole('heading', { level: 1, name: 'FPL 市场' })
	).toBeVisible()
	await expect(page.getByText(/自开始追踪以来/).first()).toBeVisible()

	const risers = page.getByRole('tab', { name: /上升/ })
	await risers.focus()
	await page.keyboard.press('ArrowRight')
	await expect(page.getByRole('tab', { name: /下降/ })).toHaveAttribute(
		'aria-selected',
		'true'
	)

	const lookup = page.getByRole('region', { name: '球员身价历史' })
	await lookup.getByRole('combobox', { name: '按姓名搜索球员' }).fill('Sa')
	await lookup.getByRole('button', { name: /Saka/ }).click()
	await expect(lookup.getByText('£9.9m → £10.0m')).toBeVisible()

	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= window.innerWidth
		)
	).toBe(true)
	const accessibility = await new AxeBuilder({ page }).analyze()
	expect(accessibility.violations).toEqual([])
})

test('theme choice persists across a reload', async ({ page }) => {
	await page.goto('/')
	await page.getByRole('button', { name: 'Change color theme' }).click()
	await page.getByRole('menuitemradio', { name: 'Dark' }).click()

	await expect(page.locator('html')).toHaveClass(/dark/)
	await expect
		.poll(() => page.evaluate(() => localStorage.getItem('theme')))
		.toBe('dark')
	await page.reload()
	await expect(page.locator('html')).toHaveClass(/dark/)
})

test('sign-up gives an in-app error for mismatched passwords', async ({
	page
}) => {
	await page.goto('/auth/signup')
	await page.getByLabel('Name').fill('Test Manager')
	await page.getByLabel('Email').fill('manager@example.com')
	await page.getByLabel('Password', { exact: true }).fill('long-password-one')
	await page.getByLabel('Confirm password').fill('long-password-two')
	await page.getByRole('button', { name: 'Create account' }).click()

	await expect(
		page.getByRole('alert').filter({ hasText: 'Passwords do not match' })
	).toBeVisible()
	await expect(page).toHaveURL(/\/auth\/signup$/)
})

test('malformed player history does not break the comparison screen', async ({
	page
}) => {
	await page.addInitScript(() => {
		localStorage.setItem('player-stats-recent-1', '{not-json')
		localStorage.setItem(
			'player-stats-recent-2',
			JSON.stringify({ version: 99, players: [{ id: 1 }] })
		)
	})
	await page.route('**/api/graphql', route => route.abort('connectionfailed'))
	await page.goto('/data/player-stats')

	await expect(
		page.getByRole('heading', { name: 'Player Statistics' })
	).toBeVisible()
	await expect(page.getByRole('button', { name: 'Clear recent' })).toHaveCount(
		0
	)
	await expect(
		page
			.getByRole('status')
			.filter({ hasText: 'Failed to load the team directory.' })
			.first()
	).toBeVisible()
})

test('player detail presents an honest FPL-only player-state profile', async ({
	page
}) => {
	await page.addInitScript(player => {
		localStorage.setItem(
			'player-stats-recent-1',
			JSON.stringify({ version: 1, players: [player] })
		)
	}, statePlayer)
	const queries = await routePlayerStateQueries(page, availablePlayerState)
	await page.goto('/data/player-stats')

	await page.getByRole('button', { name: /State Player/ }).click()
	await expect(
		page.getByRole('heading', { name: 'State Player', level: 2 })
	).toBeVisible()
	expect(queries.playerStateRequestCount()).toBe(0)
	await page.getByRole('tab', { name: 'State' }).click()
	await expect.poll(queries.playerStateRequestCount).toBe(1)

	await expect(page.getByText('Trend withheld', { exact: true })).toBeVisible()
	await expect(page.getByText('FPL only', { exact: true })).toBeVisible()
	await expect(page.getByText('FPL points / 90', { exact: true })).toBeVisible()
	await expect(page.getByText('LEE H', { exact: true })).toBeVisible()
	await expect(
		page.getByText(
			'Verified Understat data is not available for this player and season.'
		)
	).toBeVisible()
	await page.getByRole('tab', { name: 'Overview' }).click()
	await page.getByRole('tab', { name: 'State' }).click()
	expect(queries.playerStateRequestCount()).toBe(1)

	const accessibility = await new AxeBuilder({ page }).analyze()
	expect(accessibility.violations).toEqual([])
})

test('player detail distinguishes a valid unavailable player-state profile', async ({
	page
}) => {
	await page.addInitScript(player => {
		localStorage.setItem(
			'player-stats-recent-1',
			JSON.stringify({ version: 1, players: [player] })
		)
	}, unavailableStatePlayer)
	const queries = await routePlayerStateQueries(page, null)
	await page.goto('/data/player-stats')

	await page.getByRole('button', { name: /Unavailable Player/ }).click()
	await page.getByRole('tab', { name: 'State' }).click()

	const unavailable = page.getByRole('status').filter({
		hasText: 'No player state for Unavailable Player'
	})
	await expect(unavailable).toBeVisible()
	await expect(unavailable).toContainText(
		'valid unavailable state, not a zero score'
	)
	expect(queries.playerStateRequestCount()).toBe(1)
})

test('player comparison loads each state profile once only when State opens', async ({
	page
}) => {
	await page.addInitScript(
		players => {
			localStorage.setItem(
				'player-stats-recent-1',
				JSON.stringify({ version: 1, players: [players.first] })
			)
			localStorage.setItem(
				'player-stats-recent-2',
				JSON.stringify({ version: 1, players: [players.second] })
			)
		},
		{ first: statePlayer, second: unavailableStatePlayer }
	)
	const queries = await routePlayerStateQueries(page, availablePlayerState)
	await page.goto('/data/player-stats')

	await page
		.getByRole('region', { name: 'Player 1' })
		.getByRole('button', { name: /State Player/ })
		.click()
	await page
		.getByRole('region', { name: 'Player 2' })
		.getByRole('button', { name: /Unavailable Player/ })
		.click()
	await expect(page.getByRole('tab', { name: 'State' })).toBeVisible()
	expect(queries.playerStateRequestCount()).toBe(0)

	await page.getByRole('tab', { name: 'State' }).click()
	await expect.poll(queries.playerStateRequestCount).toBe(2)
	expect(queries.playerStateRequestsFor(10)).toBe(1)
	expect(queries.playerStateRequestsFor(11)).toBe(1)
})

test('protected tournament creation returns an unauthenticated user to sign-in safely', async ({
	page
}) => {
	await page.goto('/tournament/create')
	await expect(page).toHaveURL(/\/auth\/login\?next=%2Ftournament%2Fcreate$/)
	await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})

test('sign-in page has no detectable accessibility violations', async ({
	page
}) => {
	await page.goto('/auth/login')
	await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
	const accessibility = await new AxeBuilder({ page }).analyze()
	expect(accessibility.violations).toEqual([])
})
