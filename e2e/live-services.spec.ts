import { expect, test } from '@playwright/test'

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
				nextEvent: [],
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
	await expect(page.getByText('0 – 0')).toBeVisible()
	await expect(page.getByText(/Auto refresh in \d+s/)).toBeVisible()

	await page.clock.fastForward(90_000)
	await expect.poll(() => heavyRequestCount).toBe(1)
	expect(probeCount).toBe(1)
	releaseFirstResponse?.()
	await expect(page.getByRole('tab', { name: 'Live Now' })).toHaveAttribute(
		'aria-selected',
		'true'
	)
	await expect(page.getByText('1 – 0')).toBeVisible()

	await page.clock.fastForward(30_000)
	await expect.poll(() => heavyRequestCount).toBe(2)
	expect(probeCount).toBe(2)
	await expect(
		page.getByRole('alert').filter({
			hasText: 'Latest match update failed. Showing the last available scores.'
		})
	).toBeVisible()
	await expect(page.getByText('1 – 0')).toBeVisible()

	await context.setOffline(true)
	await expect(page.getByText(/Auto refresh in/)).toHaveCount(0)
	await page.clock.fastForward(60_000)
	expect(heavyRequestCount).toBe(2)
	expect(probeCount).toBe(2)

	await context.setOffline(false)
	await expect.poll(() => heavyRequestCount).toBe(3)
	expect(probeCount).toBe(3)
	await expect(page.getByText('2 – 0')).toBeVisible()
})
