import { expect, test, type Route } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const graphqlFixtureUrl = 'http://127.0.0.1:4100/graphql'

const liveRevisionVector = (revision: string) => ({
	publicationId: `e2e-live-${revision.slice(0, 8)}`,
	generation: 1,
	lifecycle: revision,
	fixtureIdentity: revision,
	scoreCore: revision,
	displayStats: revision,
	explain: revision,
	picksBase: revision,
	officialAdjustment: null,
	previousTotals: null,
	finalResult: null,
	rules: revision,
	algorithm: 'live-points-v2-algorithm-1',
	input: revision
})

const liveTimes = (
	sourceCheckedAt = '2026-08-04T18:00:30.000Z',
	publishedAt = '2026-08-04T18:00:00.000Z'
) => ({
	sourceCheckedAt,
	contentUpdatedAt: publishedAt,
	publishedAt,
	checkpointedAt: null,
	servedAt: sourceCheckedAt,
	staleAt: sourceCheckedAt,
	nextRefreshAt: '2026-08-04T18:01:00.000Z'
})

const liveDelivery = (state: 'FRESH' | 'UNAVAILABLE') => ({
	state,
	servedFrom: 'REDIS_CURRENT',
	reasonCodes: []
})

const liveSnapshot = (revision = 'a'.repeat(64)) => ({
	season: '2627',
	eventId: 33,
	state: 'LIVE_ACTIVE',
	revisions: liveRevisionVector(revision),
	times: liveTimes(),
	delivery: liveDelivery('FRESH')
})

const liveScore = (eventPoints: number, revision: string) => ({
	eventPoints,
	netEventPoints: eventPoints,
	totalPoints: 1234,
	totalScope: 'OVERALL',
	transferCost: 0,
	source: 'FPL_EVENT_LIVE',
	calculationMode: 'PROJECTED_AUTOSUBS',
	revisions: liveRevisionVector(revision),
	times: liveTimes(),
	delivery: liveDelivery('FRESH')
})

// Let the browser continue to the deterministic fixture server.  Keeping the
// response on the normal browser network path avoids coupling Playwright's
// fake clock to a route handler that buffers a second request with route.fetch.
async function continueToGraphqlFixture(route: Route) {
	await route.continue({ url: graphqlFixtureUrl })
}

test('live points enriches all fifteen picks through one bounded GraphQL root', async ({
	page
}) => {
	test.skip(
		Boolean(process.env.PLAYWRIGHT_BASE_URL),
		'Uses the deterministic local GraphQL fixture'
	)
	await page.setViewportSize({ width: 390, height: 844 })
	await page.clock.install()

	let batchPayload:
		| {
				query?: string
				variables?: { eventId?: number; elementIds?: number[] }
		  }
		| undefined
	let clientLivePointsRequests = 0
	let entryOverallRequests = 0
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
			const recoveryResponse = {
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
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(recoveryResponse)
			})
			return
		}
		if (payload.query?.includes('GetLiveCalcPoints')) {
			clientLivePointsRequests += 1
		}
		if (payload.query?.includes('GetEntry')) entryOverallRequests += 1
		await continueToGraphqlFixture(route)
	})

	await page.goto('/live/points/123')

	await expect(
		page.getByRole('heading', { level: 1, name: 'Live Points' })
	).toBeVisible()
	const pitch = page.getByRole('region', { name: /formation/ })
	await expect(
		pitch.getByRole('button', { name: /View details for Player/ })
	).toHaveCount(15)
	const accessibility = await new AxeBuilder({ page })
		.include('section[aria-label$=" formation"]')
		.analyze()
	expect(accessibility.violations).toEqual([])
	expect(entryOverallRequests).toBe(0)
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= window.innerWidth
		)
	).toBe(true)
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
	pitch
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
	// The deterministic fixture is outside the live window.  A scheduled or
	// otherwise unconfirmed round must not re-arm the explanation poll.
	expect(explainBatchRequests).toBe(1)
})

test('scheduled live points does not show a polling label and recovers manually', async ({
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
			if (clientLivePointsRequests === 1) {
				await route.fulfill({
					status: 200,
					json: { errors: [{ message: 'Temporary live points failure' }] }
				})
				return
			}
			const pickList = Array.from({ length: 15 }, (_, index) => ({
				element: index + 1,
				elementType: index < 2 ? 1 : index < 7 ? 2 : index < 12 ? 3 : 4,
				position: index + 1,
				webName: `Player ${index + 1}`,
				teamName: 'Arsenal',
				teamShortName: 'ARS',
				minutes: 45,
				goalsScored: index === 0 ? 1 : 0,
				assists: 0,
				cleanSheets: 0,
				goalsConceded: index === 0 ? 2 : 0,
				defensiveContribution: 0,
				ownGoals: 0,
				penaltiesSaved: 0,
				penaltiesMissed: 0,
				yellowCards: 0,
				redCards: 0,
				saves: 0,
				bonus: 0,
				bps: 10,
				totalPoints: index === 0 ? 6 : 1,
				starts: index < 11,
				isGwStarted: true,
				isGwFinished: false,
				isPlayed: true,
				isCaptain: index === 0,
				isViceCaptain: index === 1,
				expectedGoals: null,
				expectedAssists: null,
				expectedGoalInvolvements: null,
				expectedGoalsConceded: null,
				inDreamTeam: false
			}))
			const recoveryResponse = {
				data: {
					calcLivePointsByEntry: {
						availability: 'READY',
						delivery: liveDelivery('FRESH'),
						snapshot: liveSnapshot('recovery-revision'),
						entry: 999,
						event: 33,
						entryName: 'E2E United',
						playerName: 'Test Manager',
						chip: null,
						score: liveScore(22, 'recovery-revision'),
						rank: null,
						provisional: true,
						region: null,
						startedEvent: 1,
						value: 100,
						bank: 0,
						teamValue: 100,
						totalTransfers: 0,
						lastValue: 100,
						playedCaptain: 1,
						activeCaptain: { id: 1, name: 'Player 1', points: 6 },
						captainName: 'Player 1',
						played: 11,
						toPlay: 0,
						pickList
					}
				}
			}
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(recoveryResponse)
			})
			return
		}
		if (payload.query?.includes('GetLiveContext')) {
			await route.fulfill({
				status: 200,
				json: {
					data: {
						coreEventContext: {
							season: '2627',
							revision: 'e2e-core-v1',
							sourceCheckedAt: '2026-08-04T18:00:30.000Z',
							currentEventId: 33,
							nextEventId: 34,
							nextDeadlineTime: '2026-08-11T17:30:00.000Z',
							latestFinishedEventId: 32
						},
						liveContext: {
							season: '2627',
							eventId: 33,
							nextEventId: 34,
							anchorEventId: 33,
							latestFinalizedEventId: 32,
							scoreCoreRevision: 'a'.repeat(64),
							state: 'PICKS_PROBE',
							windowState: 'PRE_DEADLINE',
							producerState: 'PICKS_PROBE',
							anchorMode: 'CURRENT',
							dataAvailability: 'UNAVAILABLE',
							nextRefreshAt: '2026-08-04T18:35:00.000Z',
							publishedAt: '2026-08-04T18:00:00.000Z',
							sourceCheckedAt: '2026-08-04T18:00:30.000Z',
							source: 'REDIS_CURRENT',
							revisions: liveRevisionVector('a'.repeat(64)),
							times: liveTimes(),
							delivery: liveDelivery('UNAVAILABLE'),
							stale: false
						}
					}
				}
			})
			return
		}
		await continueToGraphqlFixture(route)
	})

	await page.goto('/live/points/999')
	await expect(
		page.getByRole('heading', { level: 1, name: 'Live Points' })
	).toBeVisible()
	await expect(
		page.getByText('Live points could not be loaded. Please try again.', {
			exact: true
		})
	).toBeVisible()
	await expect(page.getByText(/Next refresh in \d+s/)).toHaveCount(0)

	// A scheduled round is intentionally not auto-refreshed.  The user can
	// still request a fresh snapshot explicitly when the round becomes live.
	await page.clock.runFor(30_000)
	await expect.poll(() => clientLivePointsRequests).toBe(1)
	await page.getByRole('button', { name: 'Refresh', exact: true }).click()
	await expect.poll(() => clientLivePointsRequests).toBe(2)
	// Flush the React update queued by the second network response while the
	// browser fake clock is installed.
	await page.clock.runFor(1)
	const pitch = page.getByRole('region', { name: /formation/ })
	await expect(
		pitch.getByRole('heading', { level: 2, name: 'E2E United' })
	).toBeVisible()
	await expect(
		pitch.getByRole('button', { name: /View details for Player/ })
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
			liveMatchdayDesk: {
				season: '2627',
				eventId: 33,
				scoreCoreRevision: revision,
				state: 'LIVE_ACTIVE',
				windowState: 'LIVE_ACTIVE',
				dataAvailability: 'FRESH',
				sourceCheckedAt: '2026-08-04T18:30:30.000Z',
				publishedAt: '2026-08-04T18:30:00.000Z',
				source: 'REDIS_CURRENT',
				stale: false,
				nextRefreshAt: '2026-08-04T18:31:00.000Z',
				revisions: liveRevisionVector(revision),
				times: liveTimes(
					'2026-08-04T18:30:30.000Z',
					'2026-08-04T18:30:00.000Z'
				),
				delivery: liveDelivery('FRESH'),
				matches: [
					{
						fixtureId: 101,
						eventId: 33,
						homeTeamId: 1,
						homeTeamName: 'Arsenal',
						homeScore: score,
						awayTeamId: 2,
						awayTeamName: 'Chelsea',
						awayScore: 0,
						kickoffTime: '2026-08-04T19:00:00.000Z',
						minutes: 12,
						started: true,
						finished: false
					}
				],
				nextFixtures: [],
				highlights: []
			}
		}
	})

	await page.route('**/api/live/matches**', async route => {
		heavyRequestCount += 1
		if (heavyRequestCount === 1) {
			await firstResponseGate
			await route.fulfill({
				status: 200,
				json: liveResponse(1, 'b'.repeat(24)).data
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
		await route.fulfill({
			status: 200,
			json: liveResponse(2, 'c'.repeat(24)).data
		})
	})

	await page.route('**/api/graphql', async route => {
		const payload = route.request().postDataJSON() as { query?: string }
		if (payload.query?.includes('GetLiveContext')) {
			probeCount += 1
			const revision = probeCount === 1 ? 'b'.repeat(24) : 'c'.repeat(24)
			await route.fulfill({
				status: 200,
				json: {
					data: {
						coreEventContext: {
							season: '2627',
							revision: 'e2e-core-v1',
							sourceCheckedAt: '2026-08-04T18:30:30.000Z',
							currentEventId: 33,
							nextEventId: 34,
							nextDeadlineTime: '2026-08-11T17:30:00.000Z',
							latestFinishedEventId: 32
						},
						liveContext: {
							season: '2627',
							coreRevision: 'e2e-core-v1',
							eventId: 33,
							nextEventId: 34,
							anchorEventId: 33,
							latestFinalizedEventId: 32,
							scoreCoreRevision: revision,
							state: 'LIVE_ACTIVE',
							windowState: 'LIVE_ACTIVE',
							producerState: 'LIVE_ACTIVE',
							anchorMode: 'CURRENT',
							dataAvailability: 'FRESH',
							nextRefreshAt: '2026-08-04T18:31:00.000Z',
							sourceCheckedAt: '2026-08-04T18:30:30.000Z',
							publishedAt: '2026-08-04T18:30:00.000Z',
							source: 'REDIS',
							revisions: liveRevisionVector(revision),
							times: liveTimes(
								'2026-08-04T18:30:30.000Z',
								'2026-08-04T18:30:00.000Z'
							),
							delivery: liveDelivery('FRESH'),
							stale: false
						}
					}
				}
			})
			return
		}
		if (payload.query?.includes('GetLiveMatchdayDesk')) {
			// The desk is the only heavy request after a changed context revision.
		}

		await continueToGraphqlFixture(route)
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
	await expect(page.getByText(/Auto refresh in \d+s/)).toHaveCount(0)

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
