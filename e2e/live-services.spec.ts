import { expect, test, type Route } from '@playwright/test'

const graphqlFixtureUrl = 'http://127.0.0.1:4100/graphql'

async function fulfillFromGraphqlFixture(route: Route) {
	const response = await route.fetch({ url: graphqlFixtureUrl })
	await route.fulfill({ response })
}

test('live points enriches all fifteen picks through one bounded GraphQL root', async ({
	page
}) => {
	test.skip(
		Boolean(process.env.PLAYWRIGHT_BASE_URL),
		'Uses the deterministic local GraphQL fixture'
	)
	await page.clock.install()

	let batchPayload:
		| {
				query?: string
				variables?: { eventId?: number; elementIds?: number[] }
		  }
		| undefined
	let clientLivePointsRequests = 0
	let explainBatchRequests = 0
	let releaseExplain!: () => void
	const explainGate = new Promise<void>(resolve => {
		releaseExplain = resolve
	})
	await page.route('**/api/graphql', async route => {
		const payload = route.request().postDataJSON() as {
			query?: string
			variables?: { eventId?: number; elementIds?: number[] }
		}
		if (payload.query?.includes('EventLiveExplainBatch')) {
			explainBatchRequests += 1
			batchPayload = payload
			const elementIds = payload.variables?.elementIds ?? []
			await explainGate
			await route.fulfill({
				status: 200,
				json: {
					data: {
						eventLiveExplains: elementIds.map(elementId => ({
							elementId,
							stats: {
								minutes: 45,
								goalsScored: elementId === 1 ? 1 : 0,
								assists: 0,
								cleanSheets: 0,
								goalsConceded: elementId === 1 ? 2 : 0,
								ownGoals: 0,
								penaltiesSaved: 0,
								penaltiesMissed: 0,
								yellowCards: 0,
								redCards: 0,
								saves: 0,
								defensiveContribution: 0,
								bonus: 0
							},
							contributions: [
								{ identifier: 'minutes', value: 45, points: 1 },
								...(elementId === 1
									? [{ identifier: 'goals_scored', value: 1, points: 5 }]
									: []),
								...(elementId === 1
									? [
											{
												identifier: 'goals_conceded',
												value: 2,
												points: -1
											}
										]
									: []),
								...(elementId === 1
									? [
											{
												identifier: 'manual_refresh_explain',
												value: 1,
												points: 1
											}
										]
									: [])
							]
						}))
					}
				}
			})
			return
		}
		if (payload.query?.includes('GetLiveCalcPoints')) {
			clientLivePointsRequests += 1
		}
		await fulfillFromGraphqlFixture(route)
	})

	await page.goto('/live/points/123')

	await expect(
		page.getByRole('heading', { level: 1, name: 'Team live points' })
	).toBeVisible()
	await expect(
		page.getByRole('button', { name: /View details for Player/ })
	).toHaveCount(15)
	await expect(page.getByText('ARS', { exact: true })).toHaveCount(15)
	await expect
		.poll(() => batchPayload?.variables?.elementIds?.length ?? 0)
		.toBe(15)

	expect(batchPayload?.variables).toEqual({
		eventId: 33,
		elementIds: Array.from({ length: 15 }, (_, index) => index + 1)
	})
	expect(batchPayload?.query?.match(/eventLiveExplains\s*\(/g)).toHaveLength(1)
	expect(batchPayload?.query).not.toMatch(/eventLiveExplain\s*\(/)
	expect(batchPayload?.query).not.toMatch(/\bplayer\s*\{/)

	await page.getByRole('button', { name: 'Refresh', exact: true }).click()
	await expect.poll(() => clientLivePointsRequests).toBe(1)
	releaseExplain()

	await page
		.getByRole('button', { name: 'View details for Player 1', exact: true })
		.click()
	const detail = page.getByRole('dialog')
	await expect(
		detail.getByText('manual_refresh_explain', { exact: true })
	).toBeVisible()
	await expect(
		detail.getByText('Goals Conceded', { exact: true }).first()
	).toBeVisible()
	await expect(detail.getByText('-1', { exact: true }).first()).toBeVisible()

	await page.clock.fastForward(10 * 60 * 1000)
	await expect.poll(() => explainBatchRequests).toBeGreaterThanOrEqual(2)
})

test('live points keeps polling after the seed and first client load fail', async ({
	page
}) => {
	test.skip(
		Boolean(process.env.PLAYWRIGHT_BASE_URL),
		'Uses the deterministic local GraphQL fixture'
	)
	await page.clock.install()

	let clientLivePointsRequests = 0
	await page.route('**/api/graphql', async route => {
		const payload = route.request().postDataJSON() as { query?: string }
		if (payload.query?.includes('GetLiveCalcPoints')) {
			clientLivePointsRequests += 1
		}
		await fulfillFromGraphqlFixture(route)
	})

	await page.goto('/live/points/999')
	await expect(
		page.getByRole('heading', { level: 1, name: 'Team live points' })
	).toBeVisible()
	await expect(
		page.getByText('Live points could not be loaded. Please try again.', {
			exact: true
		})
	).toBeVisible()
	await expect(page.getByText(/Next refresh in \d+s/)).toBeVisible()

	await page.clock.runFor(30_000)
	await expect.poll(() => clientLivePointsRequests).toBe(2)
	await expect(
		page.getByRole('button', { name: /View details for Player/ })
	).toHaveCount(15)
})

test('scheduled match polling is overlap-safe, keeps last-good data, and resumes immediately', async ({
	context,
	page
}) => {
	test.skip(
		Boolean(process.env.PLAYWRIGHT_BASE_URL),
		'Uses the deterministic local GraphQL fixture'
	)

	await page.clock.install({ time: new Date('2026-08-04T18:30:00.000Z') })
	let probeCount = 0
	let heavyRequestCount = 0
	let releaseFirstResponse: (() => void) | undefined
	const firstResponseGate = new Promise<void>(resolve => {
		releaseFirstResponse = resolve
	})

	const liveResponse = (score: number, revision: string) => ({
		data: {
			liveSnapshot: {
				eventId: 33,
				revision,
				state: 'LIVE',
				publishedAt: '2026-08-04T18:30:00.000Z',
				checkedAt: '2026-08-04T18:30:30.000Z'
			},
			liveMatches: {
				notStarted: [],
				finished: [],
				playing: [
					{
						matchId: 101,
						minutes: 12,
						homeTeamId: 1,
						homeTeamName: 'Arsenal',
						homeTeamShortName: 'ARS',
						homeScore: score,
						homeTeamDataList: [],
						awayTeamId: 2,
						awayTeamName: 'Chelsea',
						awayTeamShortName: 'CHE',
						awayScore: 0,
						awayTeamDataList: [],
						kickoffTime: '2026-08-04T19:00:00.000Z',
						playStatus: 'PLAYING'
					}
				]
			}
		}
	})

	await page.route('**/api/graphql', async route => {
		const payload = route.request().postDataJSON() as { query?: string }
		if (payload.query?.includes('GetLiveSnapshot')) {
			probeCount += 1
			const revision = probeCount === 1 ? 'b'.repeat(24) : 'c'.repeat(24)
			await route.fulfill({
				status: 200,
				json: {
					data: {
						liveSnapshot: {
							eventId: 33,
							revision,
							state: 'LIVE',
							publishedAt: '2026-08-04T18:30:00.000Z',
							checkedAt: '2026-08-04T18:30:30.000Z'
						}
					}
				}
			})
			return
		}
		if (payload.query?.includes('GetEventFixtures')) {
			await route.fulfill({
				status: 200,
				json: { data: { eventFixtures: [] } }
			})
			return
		}

		heavyRequestCount += 1
		if (heavyRequestCount === 1) {
			await firstResponseGate
			await route.fulfill({
				status: 200,
				json: liveResponse(1, 'b'.repeat(24))
			})
			return
		}
		if (heavyRequestCount === 2) {
			await route.fulfill({
				status: 503,
				json: { errors: [{ message: 'Temporary upstream failure' }] }
			})
			return
		}
		await route.fulfill({ status: 200, json: liveResponse(2, 'c'.repeat(24)) })
	})

	await page.goto('/live/matches')
	await expect(
		page.getByRole('heading', { name: 'Live Matches' })
	).toBeVisible()
	await expect(page.getByRole('tab', { name: 'Not Started' })).toHaveAttribute(
		'aria-selected',
		'true'
	)
	await expect(page.getByText(/0\s*[–-]\s*0/)).toBeVisible()
	await expect(page.getByText(/Auto refresh in \d+s/)).toBeVisible()

	await page.clock.fastForward(90_000)
	await expect.poll(() => heavyRequestCount).toBe(1)
	expect(probeCount).toBe(1)
	releaseFirstResponse?.()
	await expect(page.getByRole('tab', { name: 'Live Now' })).toHaveAttribute(
		'aria-selected',
		'true'
	)
	await expect(page.getByText(/1\s*[–-]\s*0/)).toBeVisible()

	await page.clock.fastForward(30_000)
	await expect.poll(() => heavyRequestCount).toBe(2)
	expect(probeCount).toBe(2)
	await expect(
		page.getByRole('alert').filter({
			hasText: 'Latest match update failed. Showing the last available scores.'
		})
	).toBeVisible()
	await expect(page.getByText(/1\s*[–-]\s*0/)).toBeVisible()

	await context.setOffline(true)
	await expect(page.getByText(/Auto refresh in/)).toHaveCount(0)
	await page.clock.fastForward(60_000)
	expect(heavyRequestCount).toBe(2)
	expect(probeCount).toBe(2)

	await context.setOffline(false)
	await expect.poll(() => heavyRequestCount).toBe(3)
	expect(probeCount).toBe(3)
	await expect(page.getByText(/2\s*[–-]\s*0/)).toBeVisible()
})
