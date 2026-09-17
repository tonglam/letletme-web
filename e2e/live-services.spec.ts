import { expect, test, type Route } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { resolveLiveRefreshProfile } from '../lib/live-refresh'

// The standalone server is always production-shaped, even when the test
// runner itself has no NODE_ENV. Match its profile, including the default.
const refreshProfile = resolveLiveRefreshProfile(
	process.env.NEXT_PUBLIC_LIVE_REFRESH_PROFILE,
	'production'
)
const refreshIntervalMs = refreshProfile === 'conserve' ? 120_000 : 30_000
const firstRefreshWindowMs = Math.ceil(refreshIntervalMs * 1.1) + 1_000

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
		if (/\bquery\s+GetEntry\s*\(/.test(payload.query ?? ''))
			entryOverallRequests += 1
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

test('live player detail ignores a late player response and retries after both reads fail', async ({
	page
}) => {
	test.skip(
		Boolean(process.env.PLAYWRIGHT_BASE_URL),
		'Uses the deterministic local GraphQL fixture'
	)
	await page.clock.install()

	let playerOneRequestCount = 0
	let playerTwoRequestCount = 0
	let releasePlayerOne!: () => void
	const playerOneGate = new Promise<void>(resolve => {
		releasePlayerOne = resolve
	})

	const livePayload = (playerId: number) => ({
		minutes: 45,
		goalsScored: playerId === 1 ? 1 : 0,
		assists: 0,
		cleanSheets: 0,
		goalsConceded: playerId === 1 ? 2 : 0,
		ownGoals: 0,
		penaltiesSaved: 0,
		penaltiesMissed: 0,
		yellowCards: 0,
		redCards: 0,
		saves: 0,
		defensiveContribution: 0,
		bonus: 0,
		bps: 10,
		totalPoints: playerId === 1 ? 6 : 1
	})
	const explainPayload = (playerId: number) => ({
		elementId: playerId,
		stats: {
			minutes: 45,
			goalsScored: playerId === 1 ? 1 : 0,
			assists: 0,
			cleanSheets: 0,
			goalsConceded: playerId === 1 ? 2 : 0,
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
			...(playerId === 1
				? [{ identifier: 'goals_scored', value: 1, points: 5 }]
				: [])
		]
	})

	await page.route('**/api/graphql', async route => {
		const payload = route.request().postDataJSON() as {
			query?: string
			variables?: { eventId?: number; elementId?: number; playerId?: number }
		}
		const isExplain = payload.query?.includes('EventLiveExplainPlayer') ?? false
		const isLive = payload.query?.includes('PlayerLive') ?? false
		if (payload.query?.includes('EventLiveExplainBatch')) {
			// Leave the modal without an official batch explanation so the
			// targeted reads below are exercised deliberately.
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ data: { eventLiveExplains: [] } })
			})
			return
		}
		if (!isExplain && !isLive) {
			await continueToGraphqlFixture(route)
			return
		}
		const playerId = isExplain
			? payload.variables?.elementId
			: payload.variables?.playerId
		if (playerId === 1) {
			playerOneRequestCount += 1
			// The first selection has both reads fail only after the user has
			// moved on. The second selection proves close/reopen recovery.
			if (playerOneRequestCount <= 2) {
				await playerOneGate
				await route.fulfill({
					status: 503,
					contentType: 'application/json',
					body: JSON.stringify({ errors: [{ message: 'Detail unavailable' }] })
				})
				return
			}
		}
		if (playerId === 2) playerTwoRequestCount += 1
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				data: isExplain
					? { eventLiveExplain: explainPayload(playerId ?? 2) }
					: { playerLive: livePayload(playerId ?? 2) }
			})
		})
	})

	await page.goto('/live/points/123')
	const pitch = page.getByRole('region', { name: /formation/ })
	await expect(
		pitch.getByRole('button', { name: 'View details for Player 1', exact: true })
	).toBeVisible()

	await pitch
		.getByRole('button', { name: 'View details for Player 1', exact: true })
		.click()
	await expect.poll(() => playerOneRequestCount).toBe(2)
	const firstDialog = page.getByRole('dialog')
	await expect(firstDialog).toBeVisible()
	await firstDialog.getByRole('button', { name: 'Close', exact: true }).click()
	await expect(page.getByRole('dialog')).toHaveCount(0)

	await pitch
		.getByRole('button', { name: 'View details for Player 2', exact: true })
		.click()
	await expect.poll(() => playerTwoRequestCount).toBe(2)
	const secondDialog = page.getByRole('dialog')
	await expect(secondDialog.getByRole('heading', { name: 'Player 2', exact: true })).toBeVisible()
	await expect(secondDialog.getByText('Loading breakdown…', { exact: true })).toHaveCount(0)

	// A's failed response arrives after B is already visible and must not
	// replace B's heading, loading state, or points.
	releasePlayerOne()
	await expect(secondDialog.getByRole('heading', { name: 'Player 2', exact: true })).toBeVisible()
	await expect(secondDialog.getByText('1', { exact: true }).first()).toBeVisible()

	await secondDialog.getByRole('button', { name: 'Close', exact: true }).click()
	await expect(page.getByRole('dialog')).toHaveCount(0)
	// The dependency failure installs the shared 30-second cooldown. Advance
	// the deterministic clock before exercising the explicit recovery read;
	// a manual refresh must not bypass a live server cooldown.
	await page.clock.runFor(1)
	await page.clock.fastForward(30_000)
	await pitch
		.getByRole('button', { name: 'View details for Player 1', exact: true })
		.click()
	await expect.poll(() => playerOneRequestCount).toBe(4)
	const recoveredDialog = page.getByRole('dialog')
	await expect(recoveredDialog.getByRole('heading', { name: 'Player 1', exact: true })).toBeVisible()
	await expect(recoveredDialog.getByText('Goals', { exact: true })).toBeVisible()
})

test('live points restores transfer details and distinguishes failure from empty records', async ({
	page
}) => {
	test.skip(
		Boolean(process.env.PLAYWRIGHT_BASE_URL),
		'Uses the deterministic local GraphQL fixture'
	)
	await page.clock.install()
	await page.route('**/api/auth/get-session', async route => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				session: {
					id: 'transfers-session',
					userId: 'transfers-user',
					expiresAt: '2099-01-01T00:00:00Z'
				},
				user: {
					id: 'transfers-user',
					name: 'Transfer Viewer',
					email: 'transfers@example.test',
					emailVerified: true
				}
			})
		})
	})
	let transferRequests = 0
	await page.route('**/api/graphql', async route => {
		const payload = route.request().postDataJSON() as {
			query?: string
			variables?: { entryId?: number }
		}
		if (!payload.query?.includes('GetEntryTransferHistory')) {
			await continueToGraphqlFixture(route)
			return
		}
		expect(payload.variables?.entryId).toBe(123)
		transferRequests += 1
		if (transferRequests === 1) {
			await route.fulfill({
				status: 503,
				contentType: 'application/json',
				body: JSON.stringify({
					errors: [{ message: 'Temporarily unavailable' }]
				})
			})
			return
		}
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				data: {
					entryTransferHistory:
						transferRequests === 2
							? [
									{
										eventId: 33,
										eventTransfers: 1,
										eventTransfersCost: 0,
										transfers: [
											{
												event: 33,
												elementOutWebName: 'Outgoing Player',
												elementOutTeamShortName: 'OUT',
												elementOutTypeName: 'MID',
												elementOutCost: 5.5,
												elementInWebName: 'Incoming Player',
												elementInTeamShortName: 'IN',
												elementInTypeName: 'MID',
												elementInCost: 6.2,
												time: '2026-08-04T10:00:00Z'
											}
										]
									}
								]
							: []
				}
			})
		})
	})
	await page.goto('/live/points/123')
	const section = page.getByRole('region', {
		name: /Gameweek transfers\s*GW33/
	})
	await expect(section.getByRole('alert')).toContainText(
		'Unable to load transfers'
	)
	await expect(section).not.toContainText('No synced transfer records')
	// The first 503 establishes the shared dependency cooldown. A user-visible
	// refresh waits for that server-directed window instead of bypassing it.
	await page.clock.fastForward(30_000)
	await section
		.getByRole('button', { name: 'Refresh transfers', exact: true })
		.click()
	await expect(section).toContainText('Incoming Player')
	await expect(section).toContainText('Outgoing Player')
	await expect(section).toContainText('£5.5m')
	await expect(section).toContainText('£6.2m')
	await section
		.getByRole('button', { name: 'Refresh transfers', exact: true })
		.click()
	await expect(section).toContainText(
		'No synced transfer records for this gameweek.'
	)
	await expect(section).not.toContainText('Incoming Player')
})

test('public live points prompts anonymous visitors to sign in without querying protected transfers', async ({
	page
}) => {
	test.skip(
		Boolean(process.env.PLAYWRIGHT_BASE_URL),
		'Uses the deterministic local GraphQL fixture'
	)
	let transferRequests = 0
	await page.route('**/api/graphql', async route => {
		const payload = route.request().postDataJSON() as { query?: string }
		if (payload.query?.includes('GetEntryTransferHistory'))
			transferRequests += 1
		await continueToGraphqlFixture(route)
	})
	await page.goto('/live/points/123?gw=33&tournamentId=3&from=home')
	const section = page.getByRole('region', { name: /Gameweek transfers/ })
	await expect(
		section.getByRole('link', { name: 'Sign in to view gameweek transfers' })
	).toHaveAttribute(
		'href',
		'/auth/login?next=%2Flive%2Fpoints%2F123%3Fgw%3D33%26tournamentId%3D3%26from%3Dhome'
	)
	await expect(
		section.getByRole('button', { name: 'Refresh transfers' })
	).toHaveCount(0)
	expect(transferRequests).toBe(0)
})

test('live transfers offer reauthentication when a display session is no longer authorized', async ({
	page
}) => {
	test.skip(
		Boolean(process.env.PLAYWRIGHT_BASE_URL),
		'Uses the deterministic local GraphQL fixture'
	)
	await page.route('**/api/auth/get-session', async route => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				session: {
					id: 'revoked-session',
					userId: 'revoked-user',
					expiresAt: '2099-01-01T00:00:00Z'
				},
				user: {
					id: 'revoked-user',
					name: 'Cached Viewer',
					email: 'revoked@example.test',
					emailVerified: true
				}
			})
		})
	})
	let transferRequests = 0
	await page.route('**/api/graphql', async route => {
		const payload = route.request().postDataJSON() as { query?: string }
		if (!payload.query?.includes('GetEntryTransferHistory')) {
			await continueToGraphqlFixture(route)
			return
		}
		transferRequests += 1
		await route.fulfill({
			status: 401,
			contentType: 'application/json',
			body: JSON.stringify({
				errors: [
					{
						message: 'Authentication required.',
						extensions: { code: 'UNAUTHENTICATED' }
					}
				]
			})
		})
	})
	await page.goto('/live/points/123?gw=33&tournamentId=3')
	const section = page.getByRole('region', { name: /Gameweek transfers/ })
	await expect(
		section.getByRole('link', { name: 'Sign in to view gameweek transfers' })
	).toHaveAttribute(
		'href',
		'/auth/login?next=%2Flive%2Fpoints%2F123%3Fgw%3D33%26tournamentId%3D3&reason=reauth'
	)
	await expect(
		section.getByRole('button', { name: 'Refresh transfers' })
	).toHaveCount(0)
	await expect(section.getByRole('alert')).toHaveCount(0)
	expect(transferRequests).toBe(1)
})

test('official-sync live points auto-refreshes without a polling label', async ({
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
		page.getByRole('status').filter({
			hasText:
				'Official data is updating. Live points will appear when the official data is published.'
		})
	).toBeVisible()
	await expect(page.getByText(/Next refresh in \d+s/)).toHaveCount(0)

	// The official post-deadline sync is expected lifecycle work.  It should
	// recover through the cheap refresh loop without asking the user to retry.
	if (refreshProfile === 'conserve') {
		await page.clock.runFor(100_000)
		expect(clientLivePointsRequests).toBe(1)
	}
	await page.clock.runFor(
		firstRefreshWindowMs - (refreshProfile === 'conserve' ? 100_000 : 0)
	)
	await expect.poll(() => clientLivePointsRequests).toBeGreaterThan(1)
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
	let headRequestCount = 0
	let fullRequestCount = 0
	let releaseFirstResponse: (() => void) | undefined
	const firstResponseGate = new Promise<void>(resolve => {
		releaseFirstResponse = resolve
	})

	const liveResponse = (
		score: number,
		revision: string,
		deskGeneration: number
	) => ({
		data: {
			liveMatchday: {
				availability: 'READY',
				delivery: liveDelivery('FRESH'),
				snapshot: {
					season: '2627',
					eventId: 33,
					state: 'LIVE_ACTIVE',
					revisions: {
						deskPublicationId: `e2e-matchday-${revision.slice(0, 8)}`,
						deskGeneration,
						lifecycle: revision,
						fixtureIdentity: revision,
						scoreState: revision,
						detailObservation: null,
						detailPublicationId: null,
						detailGeneration: null,
						playerDetail: null
					},
					times: {
						deskSourceCheckedAt: '2026-08-04T18:30:30.000Z',
						deskContentUpdatedAt: '2026-08-04T18:30:00.000Z',
						deskPublishedAt: '2026-08-04T18:30:00.000Z',
						deskStaleAt: '2026-08-04T18:31:07.500Z',
						detailSourceCheckedAt: null,
						detailContentUpdatedAt: null,
						detailPublishedAt: null,
						detailStaleAt: null,
						servedAt: '2026-08-04T18:30:30.000Z',
						nextRefreshAt: '2026-08-04T18:31:00.000Z'
					},
					detailDelivery: {
						state: 'PENDING',
						servedFrom: null,
						reasonCodes: ['DETAIL_NOT_PUBLISHED']
					},
					matches: [
						{
							fixtureId: 101,
							eventId: 33,
							homeTeamId: 1,
							homeTeamName: 'Arsenal',
							homeTeamShortName: 'ARS',
							awayTeamId: 2,
							awayTeamName: 'Chelsea',
							awayTeamShortName: 'CHE',
							homeScore: score,
							awayScore: 0,
							kickoffTime: '2026-08-04T19:00:00.000Z',
							minutes: 12,
							started: true,
							finished: false,
							finishedProvisional: false,
							players: []
						}
					]
				}
			}
		}
	})
	const liveHeadResponse = (
		score: number,
		revision: string,
		deskGeneration: number
	) => {
		const full = liveResponse(score, revision, deskGeneration).data
		const snapshot = full.liveMatchday.snapshot
		const {
			matches: _matches,
			revisions,
			...headSnapshot
		} = snapshot
		const {
			detailPublicationId: _detailPublicationId,
			detailGeneration: _detailGeneration,
			playerDetail: _playerDetail,
			...headRevisions
		} = revisions
		return {
			data: {
				liveMatchday: {
					...full.liveMatchday,
					snapshot: { ...headSnapshot, revisions: headRevisions }
				}
			}
		}
	}

	await page.route('**/api/live/matches**', async route => {
		fullRequestCount += 1
		if (fullRequestCount === 1) {
			await firstResponseGate
			await route.fulfill({
				status: 200,
				json: liveResponse(1, 'b'.repeat(24), 2).data
			})
			return
		}
		if (fullRequestCount === 2) {
			await route.fulfill({
				status: 503,
				json: { errors: [{ message: 'Temporary upstream failure' }] }
			})
			return
		}
		await route.fulfill({
			status: 200,
			json: liveResponse(2, 'c'.repeat(24), 3).data
		})
	})

	await page.route('**/api/graphql', async route => {
		const payload = route.request().postDataJSON() as { query?: string }
		if (payload.query?.includes('GetLiveMatchdayHead')) {
			headRequestCount += 1
			// The first freshness observation sees the newly published score. Once
			// the full response is accepted, the next observation sees a newer
			// revision and exercises the failed FULL/LKG path.
			const revision = fullRequestCount === 0 ? 'b'.repeat(24) : 'c'.repeat(24)
			const score = fullRequestCount === 0 ? 1 : 2
			await route.fulfill({
				status: 200,
				json: {
					data: liveHeadResponse(
						score,
						revision,
						fullRequestCount === 0 ? 2 : 3
					).data
				}
			})
			return
		}
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

	if (refreshProfile === 'conserve') {
		await page.clock.fastForward(100_000)
		expect(headRequestCount).toBe(0)
		expect(fullRequestCount).toBe(0)
	}
	await page.clock.fastForward(
		Math.max(90_000, firstRefreshWindowMs) -
			(refreshProfile === 'conserve' ? 100_000 : 0)
	)
	await expect.poll(() => headRequestCount).toBeGreaterThan(0)
	await expect.poll(() => fullRequestCount).toBe(1)
	expect(probeCount).toBe(0)
	releaseFirstResponse?.()
	await expect(page.getByRole('tab', { name: 'Live Now' })).toHaveAttribute(
		'aria-selected',
		'true'
	)
	await expect(page.getByText(/1\s*[–-]\s*0/)).toBeVisible()

	// A newly accepted snapshot re-arms the countdown with fresh jitter.
	await page.clock.fastForward(firstRefreshWindowMs)
	await expect.poll(() => headRequestCount).toBeGreaterThan(1)
	await expect.poll(() => fullRequestCount).toBe(2)
	expect(probeCount).toBe(0)
	await expect(
		page.getByRole('alert').filter({
			hasText: 'Latest match update failed. Showing the last available scores.'
		})
	).toBeVisible()
	await expect(page.getByText(/1\s*[–-]\s*0/)).toBeVisible()

	await context.setOffline(true)
	await expect(page.getByText(/Auto refresh in/)).toHaveCount(0)
	await page.clock.fastForward(60_000)
	expect(fullRequestCount).toBe(2)
	expect(probeCount).toBe(0)

	await context.setOffline(false)
	await expect.poll(() => headRequestCount).toBeGreaterThan(2)
	await expect.poll(() => fullRequestCount).toBe(3)
	expect(probeCount).toBe(0)
	await expect(page.getByText(/2\s*[–-]\s*0/)).toBeVisible()
})
