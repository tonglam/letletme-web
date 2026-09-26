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

const graphqlFixtureUrl = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/graphql`

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

for (const detailTiming of ['after-batch', 'before-batch'] as const) {
test(`live points enriches all fifteen picks through one bounded GraphQL root ${detailTiming}`, async ({
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
	let targetedRequests = 0
	let releaseTargeted!: () => void
	const targetedGate = new Promise<void>(resolve => { releaseTargeted = resolve })
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
		if (payload.query?.includes('EventLiveExplainPlayer') || payload.query?.includes('PlayerLive')) {
			targetedRequests += 1
			if (detailTiming === 'before-batch') await targetedGate
			const isExplain = payload.query?.includes('EventLiveExplainPlayer')
			await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: isExplain
				? { eventLiveExplain: { elementId: 1, stats: { minutes: 45 }, contributions: [{ identifier: 'stale_targeted_payload', value: 1, points: 99 }] } }
				: { playerLive: { minutes: 45, goalsScored: 0, assists: 0, cleanSheets: 0, goalsConceded: 0, ownGoals: 0, penaltiesSaved: 0, penaltiesMissed: 0, yellowCards: 0, redCards: 0, saves: 0, defensiveContribution: 0, bonus: 0, bps: 0, totalPoints: 99 } }
			}) })
			return
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
	const openPlayerOne = () => pitch.getByRole('button', { name: 'View details for Player 1', exact: true }).click()
	if (detailTiming === 'before-batch') {
		await openPlayerOne()
		await expect.poll(() => targetedRequests).toBe(2)
		await expect(page.getByRole('dialog').getByText('Loading breakdown…', { exact: true })).toBeVisible()
	}
	const batchFinished = page.waitForEvent('requestfinished', request =>
		request.url().endsWith('/api/graphql') && Boolean(request.postDataJSON()?.query?.includes('EventLiveExplainBatch')))
	releaseExplain()
	await batchFinished
	if (detailTiming === 'after-batch') {
		await page.clock.runFor(50)
		await openPlayerOne()
	}
	const detail = page.getByRole('dialog')
	await expect(
		detail.getByText('manual_refresh_explain', { exact: true })
	).toBeVisible()
	await expect(
		detail.getByText('Goals Conceded', { exact: true }).first()
	).toBeVisible()
	await expect(detail.getByText('-1', { exact: true }).first()).toBeVisible()
	if (detailTiming === 'before-batch') {
		// The new batch source is visibly applied while old targeted reads remain pending.
		await expect(detail.getByText('Loading breakdown…', { exact: true })).toHaveCount(0)
		const lateResponses = Promise.all(['EventLiveExplainPlayer', 'PlayerLive'].map(operation =>
			page.waitForResponse(response => response.url().endsWith('/api/graphql') &&
				Boolean(response.request().postDataJSON()?.query?.includes(operation)))))
		releaseTargeted()
		for (const response of await lateResponses) await response.finished()
		await page.clock.runFor(50)
		await expect(detail.getByText('manual_refresh_explain', { exact: true })).toBeVisible()
		await expect(detail.getByText('stale_targeted_payload', { exact: true })).toHaveCount(0)
		await expect(detail.getByText('99', { exact: true })).toHaveCount(0)
		await expect(detail.getByText('Loading breakdown…', { exact: true })).toHaveCount(0)
		expect(targetedRequests).toBe(2)
	}


	if (detailTiming === 'after-batch') expect(targetedRequests).toBe(0)
	await page.clock.fastForward(10 * 60 * 1000)
	// The deterministic fixture is outside the live window.  A scheduled or
	// otherwise unconfirmed round must not re-arm the explanation poll.
	expect(explainBatchRequests).toBe(1)
})
}

for (const outcome of ['failed', 'succeeded', 'explain-failed', 'live-failed', 'explain-mismatch'] as const) {
for (const lateTarget of ['other-player', 'closed', 'same-player', 'other-gameweek'] as const) {
test(`live player detail settles ${outcome} late responses with ${lateTarget} selected`, async ({
	page
}) => {
	test.skip(
		Boolean(process.env.PLAYWRIGHT_BASE_URL),
		'Uses the deterministic local GraphQL fixture'
	)
	await page.clock.install()
	const hasFailure = outcome === 'failed' || outcome === 'explain-failed' || outcome === 'live-failed'
	const failsOperation = (isExplain: boolean) => outcome === 'failed' ||
		(outcome === 'explain-failed' && isExplain) || (outcome === 'live-failed' && !isExplain)

	const detailEvents: number[] = []
	const batchEvents: number[] = []
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
			batchEvents.push(payload.variables?.eventId ?? -1)
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
		detailEvents.push(payload.variables?.eventId ?? -1)
		const playerId = isExplain
			? payload.variables?.elementId
			: payload.variables?.playerId
		if (playerId === 1) {
			playerOneRequestCount += 1
			// Hold both reads from the first selection until the asserted UI
			// state is reached, then settle with the selected outcome.
			if (playerOneRequestCount <= 2) {
				await playerOneGate
				if (failsOperation(isExplain)) {
				await route.fulfill({
					status: 503,
					contentType: 'application/json',
					body: JSON.stringify({ errors: [{ message: 'Detail unavailable' }] })
				})
				return
				}
			}
		}
		if (playerId === 2) playerTwoRequestCount += 1
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				data: isExplain
					? { eventLiveExplain: { ...explainPayload(playerId ?? 2), ...(lateTarget === 'other-gameweek' && payload.variables?.eventId === 33 ? { contributions: [{ identifier: 'old_gw_payload', value: 1, points: 99 }] } : {}), ...(outcome === 'explain-mismatch' && playerId === 1 && playerOneRequestCount <= 2 ? { contributions: [{ identifier: 'minutes', value: 45, points: 99 }] } : {}) } }
					: { playerLive: { ...livePayload(playerId ?? 2), ...(lateTarget === 'other-gameweek' && payload.variables?.eventId === 33 ? { totalPoints: 99 } : {}) } }
			})
		})
	})

	const settlePlayerOne = async () => {
		const lateResponses = Promise.all(['EventLiveExplainPlayer', 'PlayerLive'].map(operation =>
			page.waitForResponse(response => {
				if (!response.url().endsWith('/api/graphql')) return false
				const body = response.request().postDataJSON() as { query?: string; variables?: { elementId?: number; playerId?: number } }
				return Boolean(body.query?.includes(operation)) &&
					(body.variables?.elementId ?? body.variables?.playerId) === 1 && response.status() === (failsOperation(operation === 'EventLiveExplainPlayer') ? 503 : 200)
			})
		))
		releasePlayerOne()
		for (const response of await lateResponses) await response.finished()
		if (outcome === 'failed') {
			await expect.poll(() => page.evaluate(() =>
				Number(sessionStorage.getItem('letletme:dependency-cooldown-until-v1') || 0)
			)).toBeGreaterThan(0)
		}
		await page.clock.runFor(50)
	}

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
	if (lateTarget === 'same-player') {
		await settlePlayerOne()
		await expect(firstDialog.getByRole('heading', { name: 'Player 1', exact: true })).toBeVisible()
		await expect(firstDialog.getByText('Loading breakdown…', { exact: true })).toHaveCount(0)
		expect(playerOneRequestCount).toBe(2)
		if (outcome === 'succeeded' || outcome === 'live-failed') {
			await expect(firstDialog.getByText('Estimated', { exact: true })).toHaveCount(0)
			await expect(firstDialog.getByText('Goals', { exact: true })).toBeVisible()
		} else if (outcome === 'explain-failed' || outcome === 'explain-mismatch') {
			await expect(firstDialog.getByText('Estimated', { exact: true })).toBeVisible()
		}
		// Closing deliberately clears the hook cache; reopening issues fresh reads.
		await firstDialog.getByRole('button', { name: 'Close', exact: true }).click()
		await expect(page.getByRole('dialog')).toHaveCount(0)
		if (hasFailure) await page.clock.fastForward(61_000)
		await pitch.getByRole('button', { name: 'View details for Player 1', exact: true }).click()
		await expect.poll(() => playerOneRequestCount).toBe(4)
		await expect(page.getByRole('dialog').getByText('Goals', { exact: true })).toBeVisible()
		await expect(page.getByRole('dialog').getByText('Loading breakdown…', { exact: true })).toHaveCount(0)
		return
	}
	await firstDialog.getByRole('button', { name: 'Close', exact: true }).click()
	await expect(page.getByRole('dialog')).toHaveCount(0)
	if (lateTarget === 'other-gameweek') {
		await page.getByRole('button', { name: 'Previous gameweek', exact: true }).click()
		// The GW32 batch is issued only after the live payload is accepted and
		// the old pitch is replaced; pair it with visible current-round controls.
		await expect.poll(() => batchEvents.includes(32)).toBe(true)
		await page.clock.runFor(50)
		await expect(page.getByRole('combobox').first()).toContainText('Gameweek 32')
		await expect(page.getByRole('button', { name: 'Previous gameweek', exact: true })).toBeEnabled()
		await pitch.getByRole('button', { name: 'View details for Player 1', exact: true }).click()
		await expect.poll(() => playerOneRequestCount).toBe(4)
		const currentDialog = page.getByRole('dialog')
		await expect(currentDialog.getByRole('heading', { name: 'Player 1', exact: true })).toBeVisible()
		await expect(currentDialog.getByText('Loading breakdown…', { exact: true })).toHaveCount(0)
		await expect(currentDialog.getByText('Goals', { exact: true })).toBeVisible()
		expect(detailEvents).toEqual([33, 33, 32, 32])
		await settlePlayerOne()
		await expect(currentDialog.getByText('old_gw_payload', { exact: true })).toHaveCount(0)
		await expect(currentDialog.getByText('99', { exact: true })).toHaveCount(0)
		await expect(currentDialog.getByText('Loading breakdown…', { exact: true })).toHaveCount(0)
		await expect(currentDialog.getByText('Goals', { exact: true })).toBeVisible()
		expect(playerOneRequestCount).toBe(4)
		return
	}
	if (lateTarget === 'closed') {
		await settlePlayerOne()
		await expect(page.getByRole('dialog')).toHaveCount(0)
		await expect(pitch).toBeVisible()
		expect(playerOneRequestCount).toBe(2)
		expect(playerTwoRequestCount).toBe(0)
		if (hasFailure) await page.clock.fastForward(61_000)
		await pitch.getByRole('button', { name: 'View details for Player 1', exact: true }).click()
		await expect.poll(() => playerOneRequestCount).toBe(4)
		const reopened = page.getByRole('dialog')
		await expect(reopened.getByText('Goals', { exact: true })).toBeVisible()
		await expect(reopened.getByText('Loading breakdown…', { exact: true })).toHaveCount(0)
		await expect(reopened.getByText('99', { exact: true })).toHaveCount(0)
		return
	}

	await pitch
		.getByRole('button', { name: 'View details for Player 2', exact: true })
		.click()
	await expect.poll(() => playerTwoRequestCount).toBe(2)
	const secondDialog = page.getByRole('dialog')
	await expect(secondDialog.getByRole('heading', { name: 'Player 2', exact: true })).toBeVisible()
	await expect(secondDialog.getByText('Loading breakdown…', { exact: true })).toHaveCount(0)

	// A's response arrives after B is already visible and must not
	// replace B's heading, loading state, or points.
	await settlePlayerOne()
	await expect(secondDialog.getByRole('heading', { name: 'Player 2', exact: true })).toBeVisible()
	await expect(secondDialog.getByText('Loading breakdown…', { exact: true })).toHaveCount(0)
	await expect(secondDialog.getByText('1', { exact: true }).first()).toBeVisible()
	expect(playerTwoRequestCount).toBe(2)

	await secondDialog.getByRole('button', { name: 'Close', exact: true }).click()
	await expect(page.getByRole('dialog')).toHaveCount(0)
	if (hasFailure) {
	// Dependency failures can extend the shared cooldown up to 60 seconds.
	// Advance the deterministic clock before exercising the explicit
	// recovery read; a manual refresh must not bypass a live server cooldown.
	// Partial success can legitimately clear shared cooldown; do not assert order-dependent storage.
	await page.clock.fastForward(61_000)
	}
	await pitch
		.getByRole('button', { name: 'View details for Player 1', exact: true })
		.click()
	await expect.poll(() => playerOneRequestCount).toBe(4)
	const recoveredDialog = page.getByRole('dialog')
	await expect(recoveredDialog.getByRole('heading', { name: 'Player 1', exact: true })).toBeVisible()
	await expect(recoveredDialog.getByText('Goals', { exact: true })).toBeVisible()
})
}
}

for (const locale of ['en', 'zh-CN'] as const) {
for (const width of [1440, 390]) {
	test(`live player details cover every position and restore opener focus in ${locale} at ${width}px`, async ({ page }) => {
		test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Uses the deterministic local GraphQL fixture')
		const chinese = locale === 'zh-CN'
		await page.setViewportSize({ width, height: 900 })
		const batchReady = page.waitForEvent('requestfinished', request =>
			request.method() === 'POST' &&
			Boolean(request.postDataJSON()?.query?.includes('EventLiveExplainBatch')))
		await page.goto(`/${locale}/live/points/123`)
		await batchReady
		const pitch = page.getByRole('region', { name: chinese ? /阵型/ : /formation/ })
		await expect(pitch.getByRole('button', { name: chinese ? /查看 Player/ : /View details for Player/ })).toHaveCount(15)
		const captainLabel = chinese ? '队长' : 'Captain'
		const viceLabel = chinese ? '副队长' : 'Vice-captain'
		const captain = pitch.getByRole('button', { name: chinese ? '查看 Player 1 的详情' : 'View details for Player 1', exact: true })
		const vice = pitch.getByRole('button', { name: chinese ? '查看 Player 2 的详情' : 'View details for Player 2', exact: true })
		await expect(pitch.getByRole('img', { name: captainLabel, exact: true })).toHaveCount(1)
		await expect(pitch.getByRole('img', { name: viceLabel, exact: true })).toHaveCount(1)
		await expect(captain.getByRole('img', { name: captainLabel, exact: true })).toBeVisible()
		await expect(vice.getByRole('img', { name: viceLabel, exact: true })).toBeVisible()
		await expect(captain.getByRole('img', { name: viceLabel, exact: true })).toHaveCount(0)
		await expect(vice.getByRole('img', { name: captainLabel, exact: true })).toHaveCount(0)
		for (const [id, position] of [[1, 'GKP'], [3, 'DEF'], [8, 'MID'], [13, 'FWD']] as const) {
			const opener = pitch.getByRole('button', { name: chinese ? `查看 Player ${id} 的详情` : `View details for Player ${id}`, exact: true })
			await opener.click()
			const dialog = page.getByRole('dialog')
			await expect(dialog).toHaveCount(1)
			await expect(dialog.getByRole('heading', { name: `Player ${id}`, exact: true })).toBeVisible()
			await expect(dialog.getByText(position, { exact: true })).toBeVisible()
			await expect(dialog.getByText(chinese ? '正在加载积分明细…' : 'Loading breakdown…', { exact: true })).toHaveCount(0)
			await expect(dialog.getByText(chinese ? '估算' : 'Estimated', { exact: true })).toHaveCount(0)
			await expect(dialog.getByText(chinese ? '（45 分钟）' : '(45 min)', { exact: true })).toBeVisible()
			await dialog.getByRole('button', { name: chinese ? '关闭' : 'Close', exact: true }).click()
			await expect(page.getByRole('dialog')).toHaveCount(0)
			await expect(opener).toBeFocused()
		}
	})
}

}

test('live points restores transfer details and distinguishes failure from empty records', async ({
	page
}, testInfo) => {
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
	let emptyTransfers = false
	const liveGameweeks: number[] = []
	await page.route('**/api/graphql', async route => {
		const payload = route.request().postDataJSON() as {
			query?: string
			variables?: { entryId?: number; eventId?: number }
		}
		if (payload.query?.includes('GetLiveCalcPoints')) liveGameweeks.push(payload.variables?.eventId ?? -1)
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
						!emptyTransfers
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
	await page.getByRole('button', { name: 'Previous gameweek', exact: true }).click()
	const previousSection = page.getByRole('region', { name: /Gameweek transfers\s*GW32/ })
	await expect.poll(() => liveGameweeks.includes(32)).toBe(true)
	await expect(previousSection).toContainText('No synced transfer records for this gameweek.')
	await expect(previousSection.getByRole('alert')).toHaveCount(0)
	await expect(previousSection).not.toContainText('Incoming Player')
	await expect(previousSection).not.toContainText('Outgoing Player')
	await expect(section).toHaveCount(0)
	await page.getByRole('button', { name: 'Next gameweek', exact: true }).click()
	await expect.poll(() => liveGameweeks.includes(33)).toBe(true)
	await expect(section).toContainText('Incoming Player')
	await expect(section).toContainText('Outgoing Player')
	await expect(previousSection).toHaveCount(0)
	emptyTransfers = true
	await section
		.getByRole('button', { name: 'Refresh transfers', exact: true })
		.click()
	await expect(section).toContainText(
		'No synced transfer records for this gameweek.'
	)
	await expect(section).not.toContainText('Incoming Player')
	await testInfo.attach('S06-S07-transfer-states', {
		contentType: 'application/json',
		body: JSON.stringify({
			caseIds: ['S06', 'S07'],
			stepIds: ['S06.01', 'S07.01'],
			states: [
				'optional transfer read returns GraphQL error/503, primary live points shell remains usable',
				'optional transfer read recovers to records, then confirmed empty records without an error alert'
			],
			assertions: [
				'primary Live Points content is not replaced by an optional transfer failure',
				'failure and confirmed empty transfer records remain distinct',
				'retry is bounded to explicit user action and does not create a request storm'
			],
			coveredFaults: ['GraphQL errors', 'HTTP 503', 'successful empty records'],
			missingFaults: ['offline transport', 'timeout', 'HTTP 500', 'HTTP 502', 'malformed payload'],
			businessWrites: [],
			functionalStatus: 'PASS',
			performanceStatus: 'NOT_OBSERVED',
			readyMs: null,
			eventToPaintMs: null,
			wholeCaseComplete: false,
			missingReason: 'Only the transfer subsection fault matrix is covered here; the complete cross-route S06/S07 matrix and controlled timing remain open.'
		})
	})
})

for (const locale of ['en', 'zh-CN'] as const) {
	for (const width of [1440, 390]) {
		test(`public live points displays transfer details for anonymous visitors ${locale} ${width}px`, async ({
			page
		}) => {
			test.skip(
				Boolean(process.env.PLAYWRIGHT_BASE_URL),
				'Uses the deterministic local GraphQL fixture'
			)
			await page.setViewportSize({ width, height: 900 })
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
				transferRequests += 1
				expect(payload.variables?.entryId).toBe(123)
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						data: {
							entryTransferHistory: [
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
						}
					})
				})
			})
			await page.goto(`${locale === 'en' ? '' : '/zh-CN'}/live/points/123?gw=33&tournamentId=3&from=home`)
			const section = page.getByRole('region', { name: locale === 'en' ? /Gameweek transfers/ : /本周转会/ })
			await expect(section).toContainText('Incoming Player')
			await expect(section).toContainText('Outgoing Player')
			await expect(section).toContainText('£5.5m')
			await expect(section).toContainText('£6.2m')
			await expect(
				section.getByRole('button', { name: locale === 'en' ? 'Refresh transfers' : '刷新转会', exact: true })
			).toBeVisible()
			await expect.poll(() => section.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
			expect(transferRequests).toBe(1)
		})
	}
}

test('public live transfers expose request failures and allow retry without a login gate', async ({
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
	await expect(section.getByRole('alert')).toBeVisible()
	await expect(section.getByRole('link')).toHaveCount(0)
	await section.getByRole('button', { name: 'Refresh transfers', exact: true }).click()
	await expect.poll(() => transferRequests).toBe(2)
	await expect(section.getByRole('alert')).toBeVisible()

	expect(transferRequests).toBe(2)
})

test('official-sync live points auto-refreshes without a polling label', async ({
	page
}, testInfo) => {
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
	// The entry route performs one browser-side anchor reconciliation after
	// the server seed fails. Let that initial recovery settle before measuring
	// the separate official-sync refresh cadence.
	await page.waitForLoadState('networkidle')
	const initialClientLivePointsRequests = clientLivePointsRequests
	expect(initialClientLivePointsRequests).toBeGreaterThan(0)

	// The official post-deadline sync is expected lifecycle work. It should
	// recover through the cheap refresh loop without asking the user to retry.
	if (refreshProfile === 'conserve') {
		await page.clock.runFor(100_000)
		expect(clientLivePointsRequests).toBe(initialClientLivePointsRequests)
	}
	// Stop advancing as soon as polling dispatches. A single large jump can
	// fire the fetch's 15s timeout before Chromium processes the response.
	let advancedMs = refreshProfile === 'conserve' ? 100_000 : 0
	while (
		clientLivePointsRequests <= initialClientLivePointsRequests &&
		advancedMs < firstRefreshWindowMs
	) {
		const stepMs = Math.min(1_000, firstRefreshWindowMs - advancedMs)
		await page.clock.runFor(stepMs)
		advancedMs += stepMs
	}
	await expect.poll(() => clientLivePointsRequests).toBeGreaterThan(initialClientLivePointsRequests)
	// Dispatch is not readiness. Let queued client work run while waiting for
	// the actual recovered team within the existing assertion timeout.
	const pitch = page.getByRole('region', { name: /formation/ })
	await expect.poll(async () => {
		await page.clock.runFor(50)
		return pitch.getByRole('heading', { level: 2, name: 'E2E United' }).isVisible()
	}).toBe(true)
	await expect(
		pitch.getByRole('heading', { level: 2, name: 'E2E United' })
	).toBeVisible()
	await expect(
		pitch.getByRole('button', { name: /View details for Player/ })
	).toHaveCount(15)
	await expect(page.locator('[data-live-points-ready="true"]')).toHaveAttribute(
		'data-live-revision',
		'recovery-revision'
	)
	await testInfo.attach('S04-revision-recovery', {
		contentType: 'application/json',
		body: JSON.stringify({
			caseId: 'S04',
			stepIds: ['S04.01'],
			initial: { windowState: 'PRE_DEADLINE', dataAvailability: 'UNAVAILABLE', scoreCoreRevision: 'a'.repeat(64) },
			recovery: { response: 'READY', scoreCoreRevision: 'recovery-revision', entry: 999, picks: 15 },
			assertions: [
				'official updating status is shown without a false empty score',
				'new revision is accepted only after the refresh response is ready',
				'final formation contains all 15 players'
			],
			businessWrites: [],
			functionalStatus: 'PASS',
			performanceStatus: 'NOT_OBSERVED',
			readyMs: null,
			eventToPaintMs: null,
			wholeCaseComplete: false,
			missingReason: 'S04 revision recovery is covered for the Live Points refresh path; OFFICIAL_UPDATING/SETTLING permutations and full cross-route matrix remain open.'
		})
	})
})

test('scheduled match polling is overlap-safe, keeps last-good data, and resumes immediately', async ({
	context,
	page
}, testInfo) => {
	test.skip(
		Boolean(process.env.PLAYWRIGHT_BASE_URL),
		'Uses the deterministic local GraphQL fixture'
	)

	await page.clock.install({ time: new Date('2026-08-04T18:30:00.000Z') })
	let probeCount = 0
	let headRequestCount = 0
	let fullRequestCount = 0
	let secondFullResponseCompleted = false
	let releaseRecoveryHeadResponses!: () => void
	let recoveryHeadResponsesReleased = false
	const recoveryHeadResponseGate = new Promise<void>(resolve => {
		releaseRecoveryHeadResponses = () => {
			recoveryHeadResponsesReleased = true
			resolve()
		}
	})
	let releaseThirdFullResponse!: () => void
	const thirdFullResponseGate = new Promise<void>(resolve => {
		releaseThirdFullResponse = resolve
	})
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
			secondFullResponseCompleted = true
			// Prevent the already-due scheduled cycle from starting between the
			// failed response and the page's error state commit.
			await context.setOffline(true)
			return
		}
		if (fullRequestCount === 4) {
			await route.fulfill({
				status: 500,
				json: { errors: [{ message: 'Fixture HTTP 500' }] }
			})
			return
		}
		if (fullRequestCount === 5) {
			await route.fulfill({
				status: 502,
				json: { errors: [{ message: 'Fixture HTTP 502' }] }
			})
			return
		}
		if (fullRequestCount === 6) {
			await route.fulfill({
				status: 200,
				json: { errors: [{ message: 'Fixture GraphQL error payload' }] }
			})
			return
		}
		if (fullRequestCount === 7) {
			await route.fulfill({
				status: 200,
				json: { liveMatchday: { availability: 'READY' } }
			})
			return
		}
		if (fullRequestCount === 3) {
			// Keep a clock jump or a slow CI worker from allowing the first
			// post-failure success to clear the failure state before it is
			// asserted. The recovery path releases this response explicitly.
			await thirdFullResponseGate
		}
		await route.fulfill({
			status: 200,
			json: liveResponse(
				fullRequestCount >= 8 ? 3 : 2,
				fullRequestCount >= 8 ? 'i'.repeat(24) : 'c'.repeat(24),
				fullRequestCount >= 8 ? 9 : 3
			).data
		})
	})

	await page.route('**/api/graphql', async route => {
		const payload = route.request().postDataJSON() as { query?: string }
		if (payload.query?.includes('GetLiveMatchdayHead')) {
			headRequestCount += 1
			// A head request may already be in flight when the failed FULL response
			// commits. Hold recovery observations until the timeout/LKG assertions
			// finish; otherwise a slow worker can start FULL and clear the failure
			// alert before the test observes the intended state.
			if (headRequestCount >= 3 && !recoveryHeadResponsesReleased) {
				await recoveryHeadResponseGate
			}
			// The first freshness observation sees the newly published score. Once
			// the full response is accepted, the next observation sees a newer
			// revision and exercises the failed FULL/LKG path.
			const revision = fullRequestCount === 0
				? 'b'.repeat(24)
				: String.fromCharCode(99 + Math.min(fullRequestCount - 1, 6)).repeat(24)
			const score = fullRequestCount >= 3 ? 3 : fullRequestCount >= 1 ? 2 : 1
			const headBody = {
				data: liveHeadResponse(
					score,
					revision,
					fullRequestCount === 0 ? 2 : 3
				).data
			}
			await route.fulfill({ status: 200, json: headBody }).catch(() => {})
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
	await expect.poll(() => secondFullResponseCompleted).toBe(true)
	await page.clock.runFor(0)
	await expect(
		page.getByRole('button', { name: 'Refresh matches', exact: true })
	).toBeEnabled()
	await expect(
		page.getByRole('alert').filter({
			hasText: 'Latest match update failed. Showing the last available scores.'
		})
	).toBeVisible()
	await expect(page.getByText(/1\s*[–-]\s*0/)).toBeVisible()

	await expect(page.getByText(/Auto refresh in/)).toHaveCount(0)
	await page.clock.fastForward(60_000)
	expect(fullRequestCount).toBe(2)
	expect(probeCount).toBe(0)

	await context.setOffline(false)
	await expect.poll(() => headRequestCount).toBeGreaterThan(2)
	await page.clock.runFor(16_000)
	await expect(
		page.getByRole('alert').filter({
			hasText: 'Latest match update failed. Showing the last available scores.'
		})
	).toBeVisible()
	await expect(page.getByText(/1\s*[–-]\s*0/)).toBeVisible()
	expect(fullRequestCount).toBe(2)
	releaseRecoveryHeadResponses()
	await page.clock.runFor(0)
	await context.setOffline(true)
	await page.clock.runFor(100)
	await context.setOffline(false)
	releaseThirdFullResponse()
	await expect.poll(() => fullRequestCount).toBe(3)
	expect(probeCount).toBe(0)
	await expect(page.getByText(/2\s*[–-]\s*0/)).toBeVisible()

	const additionalFaults = [
		{ label: 'HTTP 500', nextFullRequest: 4 },
		{ label: 'HTTP 502', nextFullRequest: 5 },
		{ label: 'GraphQL 200 with errors', nextFullRequest: 6 },
		{ label: 'malformed payload', nextFullRequest: 7 }
	] as const
	for (const fault of additionalFaults) {
		// A failed refresh deliberately does not manufacture a countdown. Use the
		// visible refresh control to admit exactly one next revision.
		await page.getByRole('button', { name: 'Refresh matches', exact: true }).click()
		await expect.poll(() => fullRequestCount).toBe(fault.nextFullRequest)
		await expect(
			page.getByRole('alert').filter({
				hasText: 'Latest match update failed. Showing the last available scores.'
			})
		).toBeVisible()
		await expect(page.getByText(/2\s*[–-]\s*0/)).toBeVisible()
		await expect(page.getByText(/0\s*[–-]\s*0/)).toHaveCount(0)
	}
	await page.getByRole('button', { name: 'Refresh matches', exact: true }).click()
	await expect.poll(() => fullRequestCount).toBe(8)
	await expect(page.getByText(/3\s*[–-]\s*0/)).toBeVisible()
	await testInfo.attach('S05-S07-live-recovery', {
		contentType: 'application/json',
		body: JSON.stringify({
			caseIds: ['S05', 'S07'],
			stepIds: ['S05.01', 'S07.01'],
			states: [
				'fresh revision b accepted',
				'HTTP 503 retains last-good score and exposes a visible failure alert',
				'offline transport pauses polling without replacing last-good content',
				'network recovery accepts revision c and resumes immediately',
				'HTTP 500, HTTP 502, GraphQL 200 errors and malformed payload each retain last-good score',
				'visible refresh admits a newer revision after each injected fault',
				'client GraphQL HEAD timeout retains last-good score before recovery'
			],
			assertions: [
				'event and revision remain bound while last-good data is shown',
				'failure does not become a zero score',
				'overlap-safe polling avoids duplicate full reads',
				'network recovery renders the newer score',
				'HTTP 500, HTTP 502, GraphQL errors and malformed payload surface the same bounded failure state',
				'HEAD timeout is classified as a failure and never renders a fabricated zero score'
			],
			coveredFaults: ['HTTP 503', 'offline transport', 'client GraphQL HEAD timeout', 'HTTP 500', 'HTTP 502', 'GraphQL 200 with errors', 'malformed payload', 'new revision'],
			missingFaults: ['full snapshot timeout-at-source-deadline'],
			businessWrites: [],
			functionalStatus: 'PASS',
			performanceStatus: 'NOT_OBSERVED',
			readyMs: null,
			eventToPaintMs: null,
			wholeCaseComplete: false,
			missingReason: 'Client GraphQL HEAD timeout is now executed through the real 15s timer; full snapshot timeout-at-source-deadline, explicit stale/degraded age display and full cross-route S07 variants remain open.'
		})
	})
})

test('full match snapshot source timeout keeps last-good data and recovers', async ({
	page
}, testInfo) => {
	test.skip(
		Boolean(process.env.PLAYWRIGHT_BASE_URL),
		'Uses the deterministic local GraphQL fixture'
	)
	test.skip(
		test.info().config.workers !== 1,
		'Global fixture controls require a dedicated single-worker run'
	)

	const controls = graphqlFixtureUrl.replace('/graphql', '/__performance')
	try {
		await page.goto('/live/matches')
		await expect(
			page.getByRole('heading', { name: 'Live Matches', exact: true })
		).toBeVisible()
		await expect(page.getByText(/0\s*[–-]\s*0/)).toBeVisible()

		const before = await (await fetch(controls)).json() as {
			requests: Array<{
				operation: string
				startedAt: number
				finishedAt: number | null
				abortedAt: number | null
			}>
		}
		await expect.poll(() =>
			before.requests.filter(request => request.operation === 'GetLiveMatchdayV3').length
		).toBeGreaterThan(0)
		await expect(
			page.getByRole('button', { name: 'Refresh matches', exact: true })
		).toBeVisible()

		await expect(
			(await fetch(controls, {
				method: 'POST',
				body: JSON.stringify({
					rules: [{ operation: 'GetLiveMatchdayV3', delayMs: 16_000 }]
				})
			})).ok
		).toBe(true)

		const timeoutResponse = page.waitForResponse(response => {
			const url = new URL(response.url())
			return url.pathname === '/api/live/matches' && response.status() === 504
		})
		await page.getByRole('button', { name: 'Refresh matches', exact: true }).click()
		const response = await timeoutResponse
		expect(response.status()).toBe(504)
		await expect(
			page.getByRole('alert').filter({
				hasText: 'Latest match update failed. Showing the last available scores.'
			})
		).toBeVisible()
		await expect(page.getByText(/0\s*[–-]\s*0/)).toBeVisible()
		await expect(page.getByText(/1\s*[–-]\s*0/)).toHaveCount(0)

		let sourceTimeout: {
			operation: string
			startedAt: number
			finishedAt: number | null
			abortedAt: number | null
		} | undefined
		await expect.poll(async () => {
			const afterTimeout = await (await fetch(controls)).json() as {
				requests: Array<{
					operation: string
					startedAt: number
					finishedAt: number | null
					abortedAt: number | null
				}>
			}
			sourceTimeout = afterTimeout.requests
				.filter(request => request.operation === 'GetLiveMatchdayV3')
				.at(-1)
			return sourceTimeout?.abortedAt ?? null
		}, { timeout: 5000 }).not.toBeNull()
		expect(sourceTimeout).toBeDefined()
		const sourceTimeoutElapsedMs = sourceTimeout?.abortedAt && sourceTimeout.startedAt
			? sourceTimeout.abortedAt - sourceTimeout.startedAt
			: null
		expect(sourceTimeoutElapsedMs).toBeGreaterThanOrEqual(14_000)

		await expect(
			(await fetch(controls, {
				method: 'POST',
				body: JSON.stringify({ rules: [] })
			})).ok
		).toBe(true)
		const recoveredResponse = page.waitForResponse(response => {
			const url = new URL(response.url())
			return url.pathname === '/api/live/matches' && response.status() === 200
		})
		await page.getByRole('button', { name: 'Refresh matches', exact: true }).click()
		expect((await recoveredResponse).status()).toBe(200)
		await expect(page.getByText(/0\s*[–-]\s*0/)).toBeVisible()
		await testInfo.attach('S05-S07-full-snapshot-timeout', {
			contentType: 'application/json',
			body: JSON.stringify({
				caseIds: ['S05', 'S07'],
				stepIds: ['S05.01', 'S07.01'],
				state: 'full snapshot source deadline returns HTTP 504 and retains last-good content',
				assertions: [
					'GetLiveMatchdayV3 is delayed beyond the server 15s GraphQL deadline',
					'API returns HTTP 504 for the source timeout',
					'last-good score remains visible and no fabricated score is rendered',
					'clearing the delay allows an explicit refresh to recover'
				],
				coveredFaults: ['full snapshot timeout-at-source-deadline'],
				observedSourceTimeout: sourceTimeout,
				sourceTimeoutElapsedMs,
				missingFaults: ['explicit stale/degraded age display', 'full cross-route S07 variants'],
				businessWrites: [],
				functionalStatus: 'PASS',
				performanceStatus: 'NOT_OBSERVED',
				readyMs: null,
				eventToPaintMs: null,
				wholeCaseComplete: false,
				missingReason: 'The source deadline timeout is now executed through the real server GraphQL 15s timer; normal performance timing, age-display variants and full cross-route coverage remain open.'
			})
		})
	} finally {
		await fetch(controls, {
			method: 'POST',
			body: JSON.stringify({ rules: [] })
		}).catch(() => {})
	}
})

test('stale and degraded match publications show a timestamped delay notice', async ({
	page
}, testInfo) => {
	test.skip(
		Boolean(process.env.PLAYWRIGHT_BASE_URL),
		'Uses the deterministic local GraphQL fixture'
	)
	test.skip(
		test.info().config.workers !== 1,
		'Global fixture controls require a dedicated single-worker run'
	)

	const controls = graphqlFixtureUrl.replace('/graphql', '/__performance')
	const response = await fetch(graphqlFixtureUrl, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'X-LetLetMe-Contract': 'live-matches-v3'
		},
		body: JSON.stringify({
			query: 'query GetLiveMatchdayV3 { __typename }',
			variables: { eventId: null }
		})
	})
	expect(response.ok).toBe(true)
	const seed = (await response.json()).data as {
		liveMatchday: {
			delivery: { state: string; servedFrom: string | null; reasonCodes: string[] }
			snapshot: unknown
			availability: string
		}
	}
	const observations: Array<{
		state: 'STALE' | 'DEGRADED'
		text: string
		timezoneLabel: boolean
	}> = []
	try {
		await page.setViewportSize({ width: 390, height: 900 })
		for (const state of ['STALE', 'DEGRADED'] as const) {
			const payload = structuredClone(seed)
			payload.liveMatchday.delivery = {
				state,
				servedFrom: state === 'STALE' ? 'REDIS_PREVIOUS' : 'PROCESS_LKG',
				reasonCodes: ['ISOLATED_DELAY']
			}
			await expect(
				(await fetch(controls, {
					method: 'POST',
					body: JSON.stringify({
						rules: [{ operation: 'GetLiveMatchdayV3', variables: { eventId: null }, data: payload }]
					})
				})).ok
			).toBe(true)
			await page.goto('/live/matches')
			const notice = page.getByRole('status').filter({
				hasText: 'Official scores are delayed'
			})
			await expect(notice).toBeVisible()
			await expect.poll(() => notice.innerText(), { timeout: 5000 }).toMatch(/\([^()]+\)$/)
			const text = await notice.innerText()
			expect(text).toMatch(/Official scores are delayed/)
			expect(text).toMatch(/\([^()]+\)$/)
			await expect.poll(
				() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
				{ timeout: 5000 }
			).toBe(true)
			observations.push({ state, text, timezoneLabel: /\([^()]+\)$/.test(text) })
			await expect(page.locator('[data-letletme-contract="live_matches"]')).toHaveAttribute(
				'data-status',
				'STALE'
			)
		}
		const timezoneCdp = await page.context().newCDPSession(page)
		await timezoneCdp.send('Emulation.setTimezoneOverride', {
			timezoneId: 'America/North_Dakota/New_Salem'
		})
		const freshPayload = structuredClone(seed)
		freshPayload.liveMatchday.delivery = {
			state: 'FRESH',
			servedFrom: 'REDIS_CURRENT',
			reasonCodes: []
		}
		await expect(
			(await fetch(controls, {
				method: 'POST',
				body: JSON.stringify({
					rules: [{ operation: 'GetLiveMatchdayV3', variables: { eventId: null }, data: freshPayload }]
				})
			})).ok
		).toBe(true)
		await page.goto('/live/matches')
		const freshTimestamp = page.locator('time[role="status"]')
		await expect(freshTimestamp).toBeVisible()
		const resolvedTimeZone = await page.evaluate(
			() => Intl.DateTimeFormat().resolvedOptions().timeZone
		)
		await expect(freshTimestamp).toContainText(`(${resolvedTimeZone})`)
		await expect.poll(
			() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
			{ timeout: 5000 }
		).toBe(true)
		await testInfo.attach('S05-S07-stale-degraded-age', {
			contentType: 'application/json',
			body: JSON.stringify({
				caseIds: ['S05', 'S07'],
				stepIds: ['S05.01', 'S07.01'],
				states: observations,
				freshTimestamp: {
					text: await freshTimestamp.innerText(),
					timezone: resolvedTimeZone,
					viewportWidth: 390,
					noHorizontalOverflow: true
				},
				assertions: [
					'STALE and DEGRADED publications remain visible as stale data',
					'delay notice includes the last complete snapshot time',
					'displayed local time includes an explicit timezone label',
					'fresh update timestamp wraps within the 390px viewport with an explicit timezone label',
					'contract marker remains STALE for both degraded delivery states'
				],
				coveredStates: ['STALE', 'DEGRADED'],
				missingStates: ['production natural stale/degraded observation', 'full cross-route S07 variants'],
				businessWrites: [],
				functionalStatus: 'PASS',
				performanceStatus: 'NOT_OBSERVED',
				readyMs: null,
				eventToPaintMs: null,
				wholeCaseComplete: false,
				missingReason: 'Both isolated delivery states are rendered with a timestamp and timezone; production natural occurrence, normal timing and full route/variant coverage remain open.'
			})
		})
	} finally {
		await fetch(controls, {
			method: 'POST',
			body: JSON.stringify({ rules: [] })
		}).catch(() => {})
	}
})

test('match requests are cancelled when actual navigation unmounts the page', async ({ page }) => {
 test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Uses isolated fault injection')
 await page.clock.install({ time: new Date('2026-08-04T18:00:00.000Z') })
 let releaseResponse: (() => void) | undefined
 const responseGate = new Promise<void>(resolve => { releaseResponse = resolve })
 const failed: string[] = []
 page.on('requestfailed', request => {
  if (new URL(request.url()).pathname === '/api/live/matches') failed.push(request.failure()?.errorText ?? 'unknown')
 })
 await page.route('**/api/live/matches?*', async route => {
  await responseGate
  await route.fulfill({ status: 503, json: { error: 'Delayed isolated response' } }).catch(() => {})
 })
 try {
  await page.goto('/live/matches')
  await expect(page.getByRole('heading', { name: 'Live Matches', exact: true })).toBeVisible()
  const requestStarted = page.waitForRequest(request => new URL(request.url()).pathname === '/api/live/matches')
  await page.getByRole('button', { name: 'Refresh matches', exact: true }).filter({ visible: true }).click()
  await requestStarted
  await page.getByRole('contentinfo').getByRole('link', { name: 'Market', exact: true }).click()
  await expect(page).toHaveURL(/\/explore\/market$/)
  await expect(page.getByRole('heading', { name: 'Live Matches', exact: true })).toHaveCount(0)
  await expect.poll(() => failed.length).toBe(1)
  expect(failed[0]).toMatch(/abort|cancel/i)
  releaseResponse?.()
  await expect(page).toHaveURL(/\/explore\/market$/)
  await page.unroute('**/api/live/matches?*')
  await page.goBack()
  await expect(page).toHaveURL(/\/live\/matches$/)
  await expect(page.getByRole('heading', { name: 'Live Matches', exact: true })).toBeVisible()
  const refreshed = page.waitForResponse(response => new URL(response.url()).pathname === '/api/live/matches')
  await page.getByRole('button', { name: 'Refresh matches', exact: true }).filter({ visible: true }).click()
  const response = await refreshed
  expect(response.status()).toBe(200)
  const snapshot = (await response.json()).liveMatchday.snapshot
  expect(snapshot.eventId).toBe(33)
  await expect(page.getByRole('button', { name: 'Refresh matches', exact: true }).filter({ visible: true })).toBeEnabled()
  await expect(page.getByText(/0\s*[–-]\s*0/)).toBeVisible()

 } finally {
  releaseResponse?.()
 }
})

test('match head requests are cancelled when actual navigation unmounts the page', async ({ page }) => {
 test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Uses isolated fault injection')
 await page.clock.install({ time: new Date('2026-08-04T18:30:00.000Z') })
 let releaseResponse: (() => void) | undefined
 const responseGate = new Promise<void>(resolve => { releaseResponse = resolve })
 const failed: string[] = []
 page.on('requestfailed', request => {
  if (new URL(request.url()).pathname === '/api/graphql' && Boolean(request.postData()?.includes('GetLiveMatchdayHead'))) failed.push(request.failure()?.errorText ?? 'unknown')
 })
 await page.route('**/api/graphql', async route => {
  if (!route.request().postData()?.includes('GetLiveMatchdayHead')) { await route.continue(); return }
  await responseGate
  await route.fulfill({ status: 503, json: { error: 'Delayed isolated response' } }).catch(() => {})
 })
 try {
  await page.goto('/live/matches')
  await expect(page.getByRole('heading', { name: 'Live Matches', exact: true })).toBeVisible()
  const requestStarted = page.waitForRequest(request => new URL(request.url()).pathname === '/api/graphql' && Boolean(request.postData()?.includes('GetLiveMatchdayHead')))
  await page.clock.fastForward(Math.max(90_000, firstRefreshWindowMs))
  await requestStarted
  await page.getByRole('contentinfo').getByRole('link', { name: 'Market', exact: true }).click()
  await expect(page).toHaveURL(/\/explore\/market$/)
  await expect(page.getByRole('heading', { name: 'Live Matches', exact: true })).toHaveCount(0)
  await expect.poll(() => failed.length).toBe(1)
  expect(failed[0]).toMatch(/abort|cancel/i)
  releaseResponse?.()
  await expect(page).toHaveURL(/\/explore\/market$/)
  await page.unroute('**/api/graphql')
  await page.goBack()
  await expect(page).toHaveURL(/\/live\/matches$/)
  await expect(page.getByRole('heading', { name: 'Live Matches', exact: true })).toBeVisible()
  const refreshed = page.waitForResponse(response => new URL(response.url()).pathname === '/api/live/matches')
  await page.getByRole('button', { name: 'Refresh matches', exact: true }).filter({ visible: true }).click()
  const response = await refreshed
  expect(response.status()).toBe(200)
  const snapshot = (await response.json()).liveMatchday.snapshot
  expect(snapshot.eventId).toBe(33)
  await expect(page.getByRole('button', { name: 'Refresh matches', exact: true }).filter({ visible: true })).toBeEnabled()
  await expect(page.getByText(/0\s*[–-]\s*0/)).toBeVisible()

 } finally {
  releaseResponse?.()
 }
})

for (const update of ['score', 'detail-only'] as const) {
test(`identical match HEAD revisions do not trigger FULL reads (${update})`, async ({ page }, testInfo) => {
 test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Uses isolated fixture reads')
 const metricSamples: { metricName: string; measurementKind: string; result: string }[] = []
 await page.route('**/api/vitals', async route => {
  metricSamples.push(...(route.request().postDataJSON().samples ?? []))
  await route.fulfill({ status: 204, body: '' })
 })
 await page.clock.install({ time: new Date('2026-08-04T18:30:00.000Z') })
 let headCount = 0
 let fullCount = 0
 page.on('request', request => {
  if (new URL(request.url()).pathname === '/api/live/matches') fullCount += 1
 })
 const seedResponse = await fetch(graphqlFixtureUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'query GetLiveMatchdayV3 { liveMatchday { availability } }', variables: { eventId: 33 } }) })
 const seed = await seedResponse.json()
 expect(seed.errors).toBeUndefined()
 expect(seed.data.liveMatchday.snapshot.eventId).toBe(33)
 const snapshot = seed.data.liveMatchday.snapshot
 const { matches: _matches, ...headSnapshot } = snapshot
 const revisions = { ...headSnapshot.revisions }
 for (const key of ['detailPublicationId', 'detailGeneration', 'playerDetail']) delete revisions[key]
 await page.route('**/api/graphql', async route => {
  if (!route.request().postData()?.includes('GetLiveMatchdayHead')) { await route.continue(); return }
  headCount += 1
  await route.fulfill({ status: 200, json: { data: { liveMatchday: { ...seed.data.liveMatchday, snapshot: { ...headSnapshot, revisions } } } } })
 })
 await page.goto('/live/matches')
 await expect(page.getByRole('heading', { name: 'Live Matches', exact: true })).toBeVisible()
 await expect(page.getByText(/0\s*[–-]\s*0/)).toBeVisible()
 expect(fullCount).toBe(0)
 for (let index = 0; index < 3; index += 1) {
  const before = headCount
  await page.clock.fastForward(Math.max(90_000, firstRefreshWindowMs))
  await expect.poll(() => headCount).toBeGreaterThan(before)
  await expect(page.getByText(/0\s*[–-]\s*0/)).toBeVisible()
  expect(fullCount).toBe(0)
 }
 await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
  document.dispatchEvent(new Event('visibilitychange'))
 })
 const beforeHidden = headCount
 await page.clock.fastForward(firstRefreshWindowMs * 3)
 expect(headCount).toBe(beforeHidden)
 expect(fullCount).toBe(0)
 await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
  document.dispatchEvent(new Event('visibilitychange'))
 })
 await page.clock.fastForward(firstRefreshWindowMs)
 await expect.poll(() => headCount).toBeGreaterThan(beforeHidden)
 expect(fullCount).toBe(0)
 await expect(page.getByText(/0\s*[–-]\s*0/)).toBeVisible()
 await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
  document.dispatchEvent(new Event('visibilitychange'))
 })
 const beforeChangedHidden = headCount
 const changed = structuredClone(seed.data)
 if (update === 'score') {
  changed.liveMatchday.snapshot.revisions.deskGeneration += 1
  changed.liveMatchday.snapshot.revisions.deskPublicationId = 'e2e-match-resume-new-publication'
  changed.liveMatchday.snapshot.revisions.scoreState = 'b'.repeat(24)
  changed.liveMatchday.snapshot.matches[0].homeScore = 1
 } else {
  changed.liveMatchday.snapshot.revisions.detailObservation = 'e'.repeat(24)
  changed.liveMatchday.snapshot.revisions.detailPublicationId = 'e2e-detail-only'
  changed.liveMatchday.snapshot.revisions.detailGeneration = 2
  changed.liveMatchday.snapshot.revisions.playerDetail = 'e'.repeat(24)
  changed.liveMatchday.snapshot.detailDelivery = { state: 'FRESH', servedFrom: 'REDIS_CURRENT', reasonCodes: [] }
  for (const field of ['detailSourceCheckedAt', 'detailContentUpdatedAt', 'detailPublishedAt', 'detailStaleAt']) {
   changed.liveMatchday.snapshot.times[field] = '2026-08-04T18:30:00.000Z'
  }
  Object.assign(headSnapshot.times, changed.liveMatchday.snapshot.times)
  headSnapshot.detailDelivery = { state: 'PENDING', servedFrom: 'REDIS_CURRENT', reasonCodes: [] }

 }
 Object.assign(revisions, changed.liveMatchday.snapshot.revisions)
 for (const key of ['detailPublicationId', 'detailGeneration', 'playerDetail']) delete revisions[key]
 await page.route('**/api/live/matches?*', route => route.fulfill({ status: 200, json: changed }))
 await page.clock.fastForward(firstRefreshWindowMs * 2)
 expect(headCount).toBe(beforeChangedHidden)
 expect(fullCount).toBe(0)
 await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
  document.dispatchEvent(new Event('visibilitychange'))
 })
 await page.clock.fastForward(firstRefreshWindowMs)
 await expect.poll(() => headCount).toBeGreaterThan(beforeChangedHidden)
 await expect(page.getByText(update === 'score' ? /1\s*[–-]\s*0/ : /0\s*[–-]\s*0/)).toBeVisible()
 await expect.poll(() => fullCount).toBe(1)
 await page.clock.fastForward(2_000)
 await testInfo.attach('simulated-resume-metrics', { body: JSON.stringify(metricSamples), contentType: 'application/json' })
 if (firstRefreshWindowMs < 60_000) {
  await expect.poll(() => metricSamples.some(sample => sample.metricName === 'LIVE_MATCHDAY_READY' && sample.measurementKind === 'background_resume' && sample.result === 'ok')).toBe(true)
 } else {
  // The simulated conserve interval outlives the resume clock; expired
  // starts must not produce a valid latency sample.
  await expect.poll(() => metricSamples.filter(sample => sample.metricName === 'LIVE_MATCHDAY_READY').length).toBeGreaterThan(1)
  expect(metricSamples.filter(sample => sample.metricName === 'LIVE_MATCHDAY_READY' && sample.result === 'ok')).toEqual([])
 }
 await page.clock.fastForward(firstRefreshWindowMs)
 expect(fullCount).toBe(1)
 const reportedBeforePolling = metricSamples.length
 changed.liveMatchday.snapshot.revisions.deskGeneration += 1
 changed.liveMatchday.snapshot.revisions.deskPublicationId = 'e2e-match-ordinary-poll'
 changed.liveMatchday.snapshot.revisions.scoreState = 'c'.repeat(24)
 changed.liveMatchday.snapshot.matches[0].homeScore = 2
 Object.assign(revisions, changed.liveMatchday.snapshot.revisions)
 for (const key of ['detailPublicationId', 'detailGeneration', 'playerDetail']) delete revisions[key]
 await page.clock.fastForward(firstRefreshWindowMs)
 await expect(page.getByText(/2\s*[–-]\s*0/)).toBeVisible()
 expect(fullCount).toBe(2)
 await page.clock.fastForward(2_000)
 expect(metricSamples.slice(reportedBeforePolling).filter(sample => sample.metricName === 'LIVE_MATCHDAY_READY' && sample.result === 'ok')).toEqual([])
})

}

test('unavailable match publication remains explicit and recovers on refresh', async ({ page }) => {
 test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Uses isolated publication fixture')
 test.skip(test.info().config.workers !== 1, 'Global fixture controls require a dedicated single-worker run')
 const controls = graphqlFixtureUrl.replace('/graphql', '/__performance')
 const unavailable = { liveMatchday: { availability: 'UNAVAILABLE', delivery: { state: 'UNAVAILABLE', servedFrom: null, reasonCodes: ['DESK_UNAVAILABLE'] }, snapshot: null } }
 try {
  expect((await fetch(controls, { method: 'POST', body: JSON.stringify({ rules: [{ operation: 'GetLiveMatchdayV3', data: unavailable }] }) })).ok).toBe(true)
  await page.goto('/live/matches')
  await expect(page.getByRole('heading', { name: 'Live Matches', exact: true })).toBeVisible()
  await expect(page.locator('[data-letletme-contract="live_matches"]')).toHaveAttribute('data-status', 'UNAVAILABLE')
  await expect(page.getByRole('status').filter({ hasText: 'Official data is updating. Matches will appear when the official data is published.' })).toBeVisible()
  await expect(page.locator('[data-live-match-card="true"]')).toHaveCount(0)
  expect((await fetch(controls, { method: 'POST', body: JSON.stringify({ rules: [] }) })).ok).toBe(true)
  const refreshed = page.waitForResponse(response => new URL(response.url()).pathname === '/api/live/matches')
  await page.getByRole('button', { name: 'Refresh matches', exact: true }).filter({ visible: true }).click()
  const response = await refreshed
  expect(response.status()).toBe(200)
  expect((await response.json()).liveMatchday.snapshot.eventId).toBe(33)
  await expect(page.locator('[data-live-match-card="true"]')).toHaveCount(1)
  await expect(page.getByText(/0\s*[–-]\s*0/)).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Official data is updating.' })).toHaveCount(0)
 } finally {
  await fetch(controls, { method: 'POST', body: JSON.stringify({ rules: [] }) })
 }
})

for (const navigation of ['initial_navigation', 'in_page_navigation']) {
 test(`readiness does not reuse ${navigation} clock for a new match snapshot`, async ({ page }, testInfo) => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Isolated fixture only')
  const samples: { metricName: string; measurementKind: string; result: string }[] = []
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.route('**/api/vitals', async route => {
   samples.push(...(route.request().postDataJSON().samples ?? []))
   await route.fulfill({ status: 204, body: '' })
  })
  if (navigation === 'initial_navigation') await page.goto('/live/matches')
  else {
   await page.goto('/explore/market')
   await expect.poll(() => samples.some(s => s.metricName === 'MARKET_CONTENT_READY' && s.result === 'ok')).toBe(true)
   await page.getByRole('navigation', { name: 'Footer', exact: true }).getByRole('link', { name: 'Live Matches', exact: true }).click()
  }
  await expect(page).toHaveURL(url => url.pathname === '/live/matches')
  await expect(page.getByText(/0\s*[–-]\s*0/)).toBeVisible()
  try {
   await expect.poll(() => samples.some(s => s.metricName === 'LIVE_MATCHDAY_READY' && s.measurementKind === navigation && s.result === 'ok')).toBe(true)
  } finally {
   await testInfo.attach('navigation-classification', { body: JSON.stringify(samples), contentType: 'application/json' })
  }
  const response = await fetch(graphqlFixtureUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'query GetLiveMatchdayV3 { liveMatchday { availability } }', variables: { eventId: 33 } }) })
  const seed = await response.json()
  seed.data.liveMatchday.snapshot.revisions.deskGeneration += 1
  seed.data.liveMatchday.snapshot.revisions.deskPublicationId = 'e2e-new-visible-snapshot'
  seed.data.liveMatchday.snapshot.revisions.scoreState = 'd'.repeat(24)
  seed.data.liveMatchday.snapshot.matches[0].homeScore = 3
  await page.route('**/api/live/matches{,?*}', route => route.fulfill({ status: 200, json: seed.data }))
  const before = samples.length
  await page.getByRole('button', { name: 'Refresh matches', exact: true }).click()
  await expect(page.getByText(/3\s*[–-]\s*0/)).toBeVisible()
  // Allow the existing metrics batch timer to flush a wrongly emitted sample.
  await page.waitForTimeout(1500)
  expect(samples.slice(before).filter(s => s.metricName === 'LIVE_MATCHDAY_READY' && s.result === 'ok')).toEqual([])
  await testInfo.attach('real-clock-samples', { body: JSON.stringify(samples), contentType: 'application/json' })
 })
}

test('switching to the current gameweek clears the previous squad before the context probe completes', async ({ page }, testInfo) => {
	test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Uses the isolated GraphQL fixture')
	const readySamples: { metricName: string; measurementKind: string; result: string; value: number }[] = []
	await page.route('**/api/vitals', async route => {
		readySamples.push(...(route.request().postDataJSON().samples ?? []))
		await route.fulfill({ status: 204, body: '' })
	})
	let holdContext = false
	let contextWaiting = false
	let releaseContext!: () => void
	const contextGate = new Promise<void>(resolve => { releaseContext = resolve })
	let holdRefresh = false
	let refreshWaiting = false
	let releaseRefresh!: () => void
	const refreshGate = new Promise<void>(resolve => { releaseRefresh = resolve })
	await page.route('**/api/graphql', async route => {
		const payload = route.request().postDataJSON() as { query?: string }
		if (holdRefresh && payload.query?.includes('GetLiveCalcPoints')) {
			refreshWaiting = true
			await refreshGate
		}
		if (holdContext && payload.query?.includes('GetLiveContext')) {
			contextWaiting = true
			await contextGate
		}
		await continueToGraphqlFixture(route)
	})
	await page.goto('/live/points/123?gw=32&tournamentId=3')
	const pitch = page.getByRole('region', { name: /formation/ })
	await expect(pitch).toBeVisible()
	await expect(page.getByRole('combobox').first()).toContainText('Gameweek 32')
	const readyMarker = page.locator('[data-live-points-ready="true"]')
	await expect(readyMarker).toHaveAttribute('data-live-entry', '123')
	await expect(readyMarker).toHaveAttribute('data-live-gw', '32')
	await expect.poll(() => readySamples.filter(s => s.metricName === 'LIVE_POINTS_READY' && s.result === 'ok').length).toBe(1)
	expect(readySamples.find(s => s.metricName === 'LIVE_POINTS_READY')?.measurementKind).toBe('initial_navigation')
	holdContext = true
	try {
		await page.getByRole('button', { name: 'Next gameweek', exact: true }).click()
		await expect.poll(() => contextWaiting).toBe(true)
		// The old squad must not remain actionable under the new GW selector,
		// even while the prerequisite lifecycle read has not returned.
		await expect(pitch).toHaveCount(0)
		await expect(readyMarker).toHaveCount(0)
		expect(readySamples.filter(s => s.metricName === 'LIVE_POINTS_READY' && s.result === 'ok')).toHaveLength(1)
		await expect(page.getByRole('button', { name: 'View details for Player 1', exact: true })).toHaveCount(0)
	} finally {
		holdContext = false
		releaseContext()
	}
	await expect(pitch).toBeVisible()
	await expect(page.getByRole('combobox').first()).toContainText('Gameweek 33')
	await expect(page.getByRole('link', { name: 'Back to competition', exact: true })).toHaveAttribute('href', /tournamentId=3&gw=33/)
	await expect(readyMarker).toHaveAttribute('data-live-gw', '33')
	await expect(readyMarker).toHaveAttribute('data-live-entry', '123')
	await expect.poll(() => readySamples.filter(s => s.metricName === 'LIVE_POINTS_READY' && s.result === 'ok').length).toBe(2)
	expect(readySamples.filter(s => s.metricName === 'LIVE_POINTS_READY').map(s => s.measurementKind)).toEqual(['initial_navigation', 'interaction'])
	// A refresh has its own pending state, but is not another navigation.
	holdRefresh = true
	try {
		await page.getByRole('button', { name: 'Refresh', exact: true }).click()
		await expect.poll(() => refreshWaiting).toBe(true)
		await expect(readyMarker).toHaveCount(0)
		await expect(pitch).toBeVisible()
	} finally {
		holdRefresh = false
		releaseRefresh()
	}
	await expect(readyMarker).toHaveAttribute('data-live-gw', '33')
	await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled()
	// Allow the refreshed render and its effects to settle before checking duplicates.
	await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
	expect(readySamples.filter(s => s.metricName === 'LIVE_POINTS_READY')).toHaveLength(2)
	await testInfo.attach('live-points-ready-samples', { body: JSON.stringify(readySamples), contentType: 'application/json' })
})

test('abandoned gameweek readiness does not leak into a later visit', async ({ page }) => {
 test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Uses isolated fixture')
 const samples: { metricName: string; measurementKind: string; result: string }[] = []
 await page.route('**/api/vitals', async route => {
  samples.push(...(route.request().postDataJSON().samples ?? []))
  await route.fulfill({ status: 204, body: '' })
 })
 let hold = false
 let waiting = false
 let release!: () => void
 const gate = new Promise<void>(resolve => { release = resolve })
 await page.route('**/api/graphql', async route => {
  if (hold && route.request().postDataJSON()?.query?.includes('GetLiveContext')) {
   waiting = true
   await gate
  }
  await continueToGraphqlFixture(route)
 })
 await page.goto('/live/points/123?gw=33&tournamentId=3')
 await expect(page.locator('[data-live-points-ready="true"]')).toHaveAttribute('data-live-gw', '33')
 await page.getByRole('button', { name: 'Previous gameweek', exact: true }).click()
 await expect(page.locator('[data-live-points-ready="true"]')).toHaveAttribute('data-live-gw', '32')
 hold = true
 try {
  await page.getByRole('button', { name: 'Next gameweek', exact: true }).click()
  await expect.poll(() => waiting).toBe(true)
  await page.getByRole('contentinfo').getByRole('link', { name: 'Live Matches', exact: true }).click()
  await expect(page).toHaveURL(url => url.pathname === '/live/matches')
 } finally {
  hold = false
  release()
 }
 const previousSamples = samples.filter(s => s.metricName === 'LIVE_POINTS_READY').length
 await page.goBack()
 await expect(page.locator('[data-live-points-ready="true"]')).toHaveAttribute('data-live-gw', '33')
 await expect.poll(() => samples.filter(s => s.metricName === 'LIVE_POINTS_READY').length).toBe(previousSamples + 1)
 expect(samples.filter(s => s.metricName === 'LIVE_POINTS_READY').at(-1)).toMatchObject({ measurementKind: 'in_page_navigation', result: 'ok' })
})

for (const failureMode of ['request-error', 'no-picks', 'pending-exhausted', 'refresh-error'] as const) {
test(`manual recovery after failed gameweek starts a fresh readiness clock (${failureMode})`, async ({ page }) => {
 test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Isolated fault injection')
 await page.clock.install()
 const samples: { metricName: string; measurementKind: string; result: string; value: number }[] = []
 await page.route('**/api/vitals', async route => {
  samples.push(...(route.request().postDataJSON().samples ?? []))
  await route.fulfill({ status: 204, body: '' })
 })
 let fail = false
 let failedReads = 0
 await page.route('**/api/graphql', async route => {
  const payload = route.request().postDataJSON()
  if (payload.query?.includes('GetEntryTransferHistory')) {
   await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { entryTransferHistory: [] } })
   })
   return
  }
  const recoveryClicked = fail && payload.query?.includes('GetLiveCalcPoints')
   ? await page.evaluate(() => document.documentElement.dataset.fixtureRecoveryClicked === 'true')
   : false
  if (fail && !recoveryClicked && payload.query?.includes('GetLiveCalcPoints')) {
   failedReads += 1
   if ((failureMode === 'request-error' || failureMode === 'refresh-error')) {
    await route.fulfill({ status: 200, json: { errors: [{ message: 'Controlled load failure' }] } })
   } else {
    const response = await route.fetch({ url: graphqlFixtureUrl })
    const body = await response.json()
    body.data.calcLivePointsByEntry.pickList = []
    body.data.calcLivePointsByEntry.availability = failureMode === 'no-picks' ? 'NO_PICKS' : 'PENDING'
    await route.fulfill({ response, json: body })
   }
   return
  }
  await continueToGraphqlFixture(route)
 })
 await page.goto('/live/points/123?gw=32&tournamentId=3')
 await expect(page.locator('[data-live-points-ready="true"]')).toHaveAttribute('data-live-gw', '32')
 fail = true
 await page.getByRole('button', { name: failureMode === 'refresh-error' ? 'Refresh' : 'Previous gameweek', exact: true }).click()
 if (failureMode === 'pending-exhausted') {
  for (let elapsed = 0; failedReads < 5 && elapsed < 35_000; elapsed += 500) await page.clock.runFor(500)
  await expect.poll(() => failedReads).toBe(5)
 }
 if ((failureMode === 'request-error' || failureMode === 'refresh-error')) {
  await expect(page.getByRole('alert').filter({ hasText: 'Live points could not be loaded. Please try again.' })).toBeVisible()
 } else {
  await expect(page.getByRole('status').filter({ hasText: 'No live data is available for this team.' })).toBeVisible()
 }
 await expect(page.locator('[data-live-points-ready="true"]')).toHaveCount(0)
 // Simulate user dwell on the terminal error; this is not a latency benchmark.
 await page.clock.fastForward(60_000)
	// Keep background reads failing during Playwright's actionability wait.
	// Only the actual DOM click releases the fixture, before React handles it.
	await page.evaluate(() => {
		document.addEventListener('click', function releaseRecovery(event) {
			const button = event.target instanceof Element ? event.target.closest('button') : null
			if (button?.textContent?.trim() !== 'Refresh') return
			document.documentElement.dataset.fixtureRecoveryClicked = 'true'
			document.removeEventListener('click', releaseRecovery, true)
		}, true)
	})
	await expect(page.locator('html')).not.toHaveAttribute('data-fixture-recovery-clicked', 'true')
	if (failureMode === 'request-error' || failureMode === 'refresh-error') {
		const beforeClick = await page.evaluate(async () => {
			const response = await fetch('/api/graphql', {
				method: 'POST', headers: { 'content-type': 'application/json', 'x-letletme-contract': 'live-points-v2' },
				body: JSON.stringify({ query: 'query GetLiveCalcPoints { calcLivePointsByEntry(eventId: 31, entryId: 123) { event } }' })
			})
			return response.json()
		})
		expect(beforeClick.errors).toEqual([{ message: 'Controlled load failure' }])
	}
	await page.getByRole('button', { name: 'Refresh', exact: true }).click()
	await expect(page.locator('html')).toHaveAttribute('data-fixture-recovery-clicked', 'true')
	await expect(page.locator('[data-live-points-ready="true"]')).toHaveAttribute('data-live-gw', failureMode === 'refresh-error' ? '32' : '31')
	// The marker reports through a keepalive beacon after the ready DOM state
	// commits. Drain a short controlled clock window before observing that
	// asynchronous evidence; a busy worker must not turn a ready state into a
	// false timing failure.
	await expect.poll(
		async () => {
			// The ready marker schedules a paint/beacon task after the DOM state
			// commits. Keep advancing the controlled clock while the worker is
			// under load so a late effect cannot wait forever on fake time.
			await page.clock.runFor(50)
			return samples.filter(
				s =>
					s.metricName === 'LIVE_POINTS_READY' &&
					s.measurementKind === 'interaction'
			).length
		},
		{ timeout: 5000 }
	).toBe(1)
	const recoverySamples = samples.filter(s => s.metricName === 'LIVE_POINTS_READY' && s.measurementKind === 'interaction')
	await expect(recoverySamples).toHaveLength(1)
	const recovery = recoverySamples[0]
 expect(recovery.result).toBe('ok')
 expect(recovery.value).toBeLessThan(60_000)
})
}

test('automatic gameweek rollover does not emit another navigation readiness sample', async ({ page }) => {
 test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Isolated lifecycle fixture')
 await page.clock.install()
 const samples: { metricName: string; measurementKind: string; result: string }[] = []
 await page.route('**/api/vitals', async route => {
  samples.push(...(route.request().postDataJSON().samples ?? []))
  await route.fulfill({ status: 204, body: '' })
 })
 let rollover = false
 let probes = 0
 await page.route('**/api/graphql', async route => {
  const payload = route.request().postDataJSON()
  if (rollover && payload.query?.includes('GetLiveContext')) {
   probes += 1
   const response = await route.fetch({ url: graphqlFixtureUrl })
   const body = await response.json()
   Object.assign(body.data.liveContext, { anchorEventId: 34, latestFinalizedEventId: 33, state: 'LIVE_ACTIVE', windowState: 'LIVE_ACTIVE', producerState: 'LIVE_ACTIVE', dataAvailability: 'FRESH', delivery: liveDelivery('FRESH') })
   await route.fulfill({ response, json: body })
   return
  }
  await continueToGraphqlFixture(route)
 })
 await page.goto('/live/points/123')
 await expect(page.locator('[data-live-points-ready="true"]')).toHaveAttribute('data-live-gw', '33')
 await expect.poll(async () => {
  await page.clock.runFor(50)
  return samples.filter(s => s.metricName === 'LIVE_POINTS_READY').length
 }).toBe(1)
 rollover = true
 for (let elapsed = 0; probes === 0 && elapsed < firstRefreshWindowMs; elapsed += 1000) await page.clock.runFor(1000)
 await expect.poll(() => probes).toBeGreaterThan(0)
 await expect.poll(async () => {
  await page.clock.runFor(50)
  return page.locator('[data-live-points-ready="true"]').getAttribute('data-live-gw')
 }).toBe('34')
 await page.clock.runFor(50)
 expect(samples.filter(s => s.metricName === 'LIVE_POINTS_READY')).toHaveLength(1)
 const refreshed = page.waitForResponse(response => response.request().method() === 'POST' && response.request().postDataJSON()?.query?.includes('GetLiveCalcPoints'))
 await page.getByRole('button', { name: 'Refresh', exact: true }).click()
 await refreshed
 await expect.poll(async () => {
  await page.clock.runFor(50)
  return page.locator('[data-live-points-ready="true"]').getAttribute('data-live-gw')
 }).toBe('34')
 await page.clock.runFor(50)
 expect(samples.filter(s => s.metricName === 'LIVE_POINTS_READY')).toHaveLength(1)
})

// Original coverage matrix: S18.directed.01/.02. Fault injection stays local.
test.describe('S18 refresh admission in the planned mobile environment', () => {
 test.use({ timezoneId: 'UTC', colorScheme: 'dark', viewport: { width: 390, height: 900 } })
 test('zh-CN refresh is single-flight and recovers after a 429 response', async ({ page }, testInfo) => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Isolated fixture fault injection only')
  await page.clock.install()
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
  let inject = false
  let requests = 0
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/graphql', async route => {
   if (inject && route.request().postDataJSON()?.query?.includes('GetLiveCalcPoints')) {
    requests += 1
    await gate
    await route.fulfill({ status: 429, headers: { 'Retry-After': '37' }, json: { errors: [{ message: 'Controlled rate limit', extensions: { code: 'RATE_LIMITED' } }] } })
    return
   }
   await continueToGraphqlFixture(route)
  })
  await page.goto('/zh-CN/live/points/123?gw=32&tournamentId=3')
  const ready = page.locator('[data-live-points-ready="true"]')
  await expect(ready).toHaveAttribute('data-live-entry', '123')
  await expect(ready).toHaveAttribute('data-live-gw', '32')
  await expect(page.locator('html')).toHaveClass(/dark/)
  expect(await page.evaluate(() => ({ width: innerWidth, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, language: document.documentElement.lang }))).toEqual({ width: 390, timezone: 'UTC', language: 'zh-CN' })
  const refresh = page.getByRole('button', { name: '刷新', exact: true }).filter({ visible: true })
  await expect(refresh).toHaveCount(1)
  inject = true
  try {
   await refresh.click()
   await expect.poll(() => requests).toBe(1)
   await expect(refresh).toBeDisabled()
   await expect(ready).toHaveCount(0)
   // A real mouse double click on the disabled control must admit no request.
   const box = await refresh.boundingBox()
   expect(box).not.toBeNull()
   await page.mouse.dblclick(box!.x + box!.width / 2, box!.y + box!.height / 2)
   await page.clock.runFor(100)
   expect(requests).toBe(1)
  } finally { release() }
  await expect(page.getByRole('alert').filter({ hasText: '实时积分加载失败，请重试。' })).toBeVisible()
  await expect(ready).toHaveCount(0)
  inject = false
  // Recovery is intentionally after Retry-After; this does not prove early retry suppression.
  await page.clock.fastForward(38_000)
  await expect(refresh).toBeEnabled()
  await refresh.click()
  await expect(ready).toHaveAttribute('data-live-entry', '123')
  await expect(ready).toHaveAttribute('data-live-gw', '32')
  await expect(page.getByRole('alert').filter({ hasText: '实时积分加载失败，请重试。' })).toHaveCount(0)
  await testInfo.attach('scope', { body: JSON.stringify({ locale: 'zh-CN', width: 390, theme: 'dark', timezone: 'UTC', requestsDuringHeldRefresh: requests, early429RetrySuppression: 'NOT_RUN', performance: 'NOT_RUN' }), contentType: 'application/json' })
 })
})
