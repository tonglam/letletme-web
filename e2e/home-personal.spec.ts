import { managedTournament } from './fixtures/managed-tournament'
import { officialH2HFixture } from './fixtures/official-h2h'
import { createHmac, randomUUID } from 'node:crypto'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import postgres from 'postgres'
import { managerReview, managerGameweek } from './fixtures/manager-review'
import { GET_LIVE_POINTS } from '../lib/graphql/operations/live'

const authSecret = 'playwright-better-auth-secret-at-least-32-bytes'

async function createSession(
	options: {
		entryId?: number
		userId?: string
	} = {}
): Promise<{ cookie: string; userId: string; entryId: number | null; cleanup: () => Promise<void> }> {
	const directDatabaseUrl = process.env.E2E_DIRECT_DATABASE_URL
	if (!directDatabaseUrl) throw new Error('E2E_DIRECT_DATABASE_URL is required')
	const sql = postgres(directDatabaseUrl, { max: 1, prepare: false })
	const suffix = randomUUID()
	const userId = options.userId ?? `home-e2e-user-${suffix}`
	const sessionId = `home-e2e-session-${suffix}`
	const token = `home-e2e-token-${suffix}`
	const entryId =
		options.entryId === 909090
			? options.entryId
			: options.entryId
				? 1_000_000 +
					(Number.parseInt(suffix.replaceAll('-', '').slice(0, 8), 16) %
						1_000_000_000)
				: null
	const verifiedAt = entryId ? new Date() : null

	await sql`
		INSERT INTO bauth."user" (
			id,
			name,
			email,
			email_verified,
			fpl_entry_id,
			fpl_entry_verified_at,
			fpl_team_name,
			fpl_manager_name
		)
		VALUES (
			${userId},
			'E2E Manager',
			${`${suffix}@home.e2e.test`},
			true,
			${entryId},
			${verifiedAt},
			${entryId ? 'E2E United' : null},
			${entryId ? 'Test Manager' : null}
		)
	`
	await sql`
		INSERT INTO bauth.session (id, expires_at, token, user_id)
		VALUES (${sessionId}, ${new Date(Date.now() + 60 * 60 * 1_000)}, ${token}, ${userId})
	`

	const signature = createHmac('sha256', authSecret)
		.update(token)
		.digest('base64')
	const cookieValue = encodeURIComponent(`${token}.${signature}`)
	return {
		cookie: `__Secure-letletme.session_token=${cookieValue}`,
		userId,
		entryId,
		cleanup: async () => {
			try {
				await sql`DELETE FROM bauth.session WHERE id = ${sessionId}`
				await sql`DELETE FROM bauth."user" WHERE id = ${userId}`
			} finally {
				await sql.end()
			}
		}
	}
}

async function addSessionCookie(page: Page, cookie: string): Promise<void> {
	const separator = cookie.indexOf('=')
	await page.context().addCookies([
		{
			name: cookie.slice(0, separator),
			value: cookie.slice(separator + 1),
			domain: 'localhost',
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'Lax'
		}
	])
}

test('guest Home renders without reserving or hydrating personal content', async ({
	page
}) => {
	const browserSessionRequests: string[] = []
	page.on('request', request => {
		if (request.url().includes('/api/auth/get-session')) {
			browserSessionRequests.push(request.url())
		}
	})
	const response = await page.goto('/')
	expect(response?.headers()['cache-control']).toContain('public')
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
	await expect(page.locator('[data-home-audience-hint="public"]')).toHaveCount(
		1
	)
	await expect(page.locator('[data-home-personal-ready]')).toHaveCount(0)
	expect(browserSessionRequests).toEqual([])
})

test('an invalid session cookie degrades to the public Home instead of 500', async ({
	page
}) => {
	await addSessionCookie(
		page,
		'__Secure-letletme.session_token=invalid-cookie-signature'
	)
	const response = await page.goto('/')
	expect(response?.status()).toBe(200)
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
	await expect(page.locator('[data-home-personal-ready]')).toHaveCount(0)
})

test('a verified session without an FPL binding gets the existing bind prompt', async ({
	page
}) => {
	const session = await createSession()
	try {
		await addSessionCookie(page, session.cookie)
		const response = await page.goto('/')
		expect(response?.headers()['cache-control']).toContain('private')
		await expect(
			page
				.locator('#main-content')
				.getByText('Link your FPL team', { exact: true })
		).toBeVisible()
		await expect(
			page.locator('#main-content [data-home-personal-ready]')
		).toHaveCount(0)
	} finally {
		await session.cleanup()
	}
})

test('a bound user receives the complete compact Team Desk in one commit', async ({
	page
}) => {
	const session = await createSession({ entryId: 15702 })
	try {
		await addSessionCookie(page, session.cookie)
		await page.goto('/')
		const main = page.locator('#main-content')
		await expect(main.getByText('E2E United')).toBeVisible()
		await expect(main.getByRole('img', { name: 'Australia' })).toBeVisible()
		await expect(main.getByText('1,234')).toBeVisible()
		await expect(main.getByText('Auto-subs projected')).toHaveCount(0)
		await expect(main.getByText('Official result')).toHaveCount(0)
		await expect(main.getByText('Rank updating')).toHaveCount(0)
		await expect(main.getByText('Updating', { exact: true })).toHaveCount(0)
		await expect(main.getByText('E2E Classic')).toBeVisible()
		const classicTab = main.getByRole('tab', { name: /Classic/ })
		const h2hTab = main.getByRole('tab', { name: /H2H/ })
		const cupsTab = main.getByRole('tab', { name: /Cups/ })
		await expect(classicTab).toBeVisible()
		await expect(h2hTab).toBeVisible()
		await expect(cupsTab).toHaveCount(0)
		await expect(classicTab).toHaveAttribute('aria-selected', 'true')
		await h2hTab.click()
		await expect(h2hTab).toHaveAttribute('aria-selected', 'true')
		await expect(main.getByText('E2E H2H', { exact: true })).toBeVisible()
		const currentMatchup = main.locator('[data-home-h2h-matchup="2071743"]')
		await expect(currentMatchup.getByText('Future Xu')).toBeVisible()
		await expect(currentMatchup.getByText('让让群の一美')).toBeVisible()
		await expect(currentMatchup.getByText('炸群高手 磊磊酱')).toBeVisible()
		await expect(currentMatchup.getByText('Tong言无忌')).toBeVisible()
		await expect(currentMatchup.getByText('24', { exact: true })).toBeVisible()
		await expect(currentMatchup.getByText('43', { exact: true })).toBeVisible()
		await expect(
			main.getByRole('link', {
				name: /E2E H2H.*GW1.*Live.*Future Xu.*让让群の一美.*24.*43.*炸群高手 磊磊酱.*Tong言无忌/
			})
		).toHaveAttribute('href', '/live/competitions/6?gw=1')
		await expect(main.locator('[data-home-personal-ready]')).toBeVisible()
		await expect(main.locator('[data-home-league-ranks-ready]')).toBeVisible()
		await classicTab.click()
		await expect(classicTab).toHaveAttribute('aria-selected', 'true')
		await page.evaluate(() => {
			if (document.activeElement instanceof HTMLElement) {
				document.activeElement.blur()
			}
		})
		await page.mouse.move(0, 0)
		await page.waitForTimeout(7_200)
		await expect(h2hTab).toHaveAttribute('aria-selected', 'true')
		await expect(main.getByText('#12')).toBeVisible()
		await classicTab.click()
		await expect(classicTab).toHaveAttribute('aria-selected', 'true')
		const personalDesk = main.locator('[data-home-personal-ready]')
		await expect(personalDesk.getByText(/teams?$/i)).toHaveCount(0)
		await expect(personalDesk.getByText(/^\d+ leagues?$/i)).toHaveCount(0)
		await expect(main.getByText('E2E League 8', { exact: true })).toBeVisible()
		await expect(
			main.locator('[data-home-league-visibility="public"]')
		).toHaveCount(5)
		await expect(
			main.locator('[data-home-league-visibility="private"]')
		).toHaveCount(3)
		await expect(
			main.getByRole('link', { name: /E2E League 2/ })
		).toHaveAttribute('href', '/my-fpl/competitions?tournamentId=77')
		await expect(main.locator('summary')).toHaveCount(0)
	} finally {
		await session.cleanup()
	}
})

test('a bound squad opens a selectable gameweek range and preserves the terminal share pitch', async ({
	page
}) => {
	const session = await createSession({ entryId: 15702 })
	const fixtureWindowRequests: string[] = []
	page.on('request', request => {
		if (request.url().includes('/api/fixtures/window?')) {
			fixtureWindowRequests.push(request.url())
		}
	})
	try {
		await addSessionCookie(page, session.cookie)
		await page.goto('/explore/fixtures')

		await expect(page.locator('[data-page-fdr-legend="true"]')).toHaveCount(1)
		await page.locator('#my-squad summary').click()
		const pitch = page.locator('[data-schedule-pitch="true"]:visible')
		await expect(pitch).toBeVisible()
		const initialRequestCount = fixtureWindowRequests.length
		await pitch.getByRole('button').first().click()

		const dialog = page.getByRole('dialog')
		await expect(dialog).toBeVisible()
		await expect(dialog.locator('#my-squad-fixture-range-from')).toBeVisible()
		await expect(dialog.locator('#my-squad-fixture-range-to')).toBeVisible()
		await dialog.locator('#my-squad-fixture-range-from').selectOption('1')
		await dialog.locator('#my-squad-fixture-range-to').selectOption('38')
		const schedule = dialog.locator('ol')
		await expect(schedule.getByText('GW1', { exact: true })).toBeVisible()
		await expect(schedule.getByText('GW38', { exact: true })).toBeVisible()
		await expect(dialog.getByText('2–1', { exact: true })).toBeVisible()
		await expect(dialog.getByText('Finished', { exact: true })).toHaveCount(0)
		await expect(dialog.getByRole('button', { name: 'Image' })).toBeVisible()
		await expect
			.poll(() => fixtureWindowRequests.length)
			.toBe(initialRequestCount + 8)

		await dialog.getByRole('button', { name: 'Close' }).click()
		await expect(dialog).toHaveCount(0)

		const sixGws = page.getByRole('button', { name: '6 GWs' })
		await sixGws.click()
		await expect(sixGws).toHaveAttribute('aria-pressed', 'true')
		// The fixture seed is anchored at GW33, so the terminal horizon exposes
		// the exact six remaining gameweeks through the season boundary (GW38).
		await expect(pitch.locator('[role="listitem"]')).toHaveCount(
			15 * Math.min(6, 39 - 33)
		)
		await expect(
			pitch.locator('[data-share-preserve-width="true"]')
		).toHaveClass(/aspect-\[/)
		await expect(
			page.locator('#my-squad').getByRole('button', { name: 'Image' })
		).toBeVisible()
	} finally {
		await session.cleanup()
	}
})

test('the server-rendered signed navigation logs out through a same-origin POST', async ({
	page
}) => {
	const session = await createSession({ entryId: 15702 })
	try {
		await addSessionCookie(page, session.cookie)
		await page.goto('/')
		const navigation = page.getByRole('navigation')
		await navigation.getByText('E2E Manager', { exact: true }).first().click()
		const logoutResponsePromise = page.waitForResponse(
			response =>
				response.url().endsWith('/api/session/logout') &&
				response.request().method() === 'POST'
		)
		await navigation.getByRole('button', { name: 'Sign out' }).click()
		const logoutResponse = await logoutResponsePromise
		expect(logoutResponse.status()).toBe(204)
		await expect(page).toHaveURL(url => url.pathname === '/')
		expect(
			(await page.context().cookies()).some(
				cookie => cookie.name === '__Secure-letletme.session_token'
			)
		).toBe(false)
		await expect(
			navigation.getByRole('link', { name: 'Login' }).first()
		).toBeVisible()
		await expect(page.locator('[data-home-personal-ready]')).toHaveCount(0)
	} finally {
		await session.cleanup()
	}
})

test('the no-JavaScript sign-out fallback preserves the Chinese locale', async ({
	browser
}, testInfo) => {
	const session = await createSession({ entryId: 15702 })
	const context = await browser.newContext({
		baseURL: testInfo.project.use.baseURL,
		javaScriptEnabled: false
	})
	const page = await context.newPage()
	try {
		await addSessionCookie(page, session.cookie)
		await page.goto('/zh-CN')
		const navigation = page.getByRole('navigation')
		// Streamed account content requires JavaScript; the pending slot retains a native logout form.
		await navigation.getByRole('button', { name: '退出登录' }).click()

		await expect(page).toHaveURL(url => url.pathname === '/zh-CN')
		expect(
			(await context.cookies()).some(
				cookie => cookie.name === '__Secure-letletme.session_token'
			)
		).toBe(false)
	} finally {
		await context.close()
		await session.cleanup()
	}
})

test('the signed account disclosure closes on profile navigation', async ({
	page
}) => {
	const session = await createSession({ entryId: 15702 })
	try {
		await addSessionCookie(page, session.cookie)
		await page.goto('/')
		const navigation = page.getByRole('navigation')
		const accountDisclosure = navigation
			.locator('details[data-navigation-disclosure]')
			.filter({ hasText: 'E2E Manager' })
			.first()
		await accountDisclosure.locator(':scope > summary').click()
		await expect(accountDisclosure).toHaveAttribute('open', '')
		await accountDisclosure
			.getByRole('link', { name: 'Profile settings', exact: true })
			.click()

		await expect(page).toHaveURL(/\/profile$/)
		await expect(accountDisclosure).not.toHaveAttribute('open', '')
	} finally {
		await session.cleanup()
	}
})

test('a failed navbar sign-out stays in the app with a visible error', async ({
	page
}) => {
	const session = await createSession({ entryId: 15702 })
	try {
		await addSessionCookie(page, session.cookie)
		await page.route('**/api/session/logout', route =>
			route.fulfill({
				status: 502,
				contentType: 'application/json',
				body: JSON.stringify({ error: 'Sign out failed' })
			})
		)
		await page.goto('/')
		const navigation = page.getByRole('navigation')
		await navigation.getByText('E2E Manager', { exact: true }).first().click()
		await navigation.getByRole('button', { name: 'Sign out' }).click()

		await expect(page).toHaveURL(url => url.pathname === '/')
		await expect(
			navigation.getByRole('alert').filter({ hasText: 'Could not sign out' })
		).toBeVisible()
		expect(
			(await page.context().cookies()).some(
				cookie => cookie.name === '__Secure-letletme.session_token'
			)
		).toBe(true)
	} finally {
		await session.cleanup()
	}
})

test('personal GraphQL failures preserve the Home shell and unavailable states', async ({
	page
}) => {
	const session = await createSession({ entryId: 909090 })
	try {
		await addSessionCookie(page, session.cookie)
		const response = await page.goto('/')
		expect(response?.status()).toBe(200)
		const main = page.locator('#main-content')
		await expect(
			main.getByText('Team data is temporarily unavailable.')
		).toBeVisible()
		await expect(main.getByRole('button', { name: 'Try again' })).toBeVisible()
	} finally {
		await session.cleanup()
	}
})

test('Home league ranks never start an H2H polling request', async ({
	page
}) => {
	const session = await createSession({ entryId: 15702 })
	const clientGraphqlOperations: string[] = []
	page.on('request', request => {
		if (!request.url().includes('/api/graphql')) return
		clientGraphqlOperations.push(request.postData() ?? '')
	})
	try {
		await page.clock.install()
		await addSessionCookie(page, session.cookie)
		await page.goto('/')
		await expect(page.locator('[data-home-league-ranks-ready]')).toBeVisible()
		await page.clock.fastForward(61_000)
		expect(
			clientGraphqlOperations.some(operation =>
				operation.includes('tournamentOfficialH2H')
			)
		).toBe(false)
	} finally {
		await session.cleanup()
	}
})

test('Home fixture switching uses one GET and returns to the RSC seed from memory', async ({
	page
}) => {
	await page.goto('/')
	const fixtureRequests: string[] = []
	page.on('request', request => {
		if (request.url().includes('/api/home/fixtures?')) {
			fixtureRequests.push(request.url())
		}
	})
	const matches = page.locator('[data-home-matches]')
	await expect(matches).toHaveAttribute('data-home-fixtures-event', '33')
	await expect(matches.getByText('GW33', { exact: true })).toBeVisible()
	const nextResponse = page.waitForResponse(response =>
		response.url().includes('/api/home/fixtures?eventId=34')
	)
	await matches.getByRole('button', { name: 'Next gameweek' }).click()
	expect((await nextResponse).status()).toBe(200)
	await expect(matches).toHaveAttribute('data-home-fixtures-event', '34')
	await expect(matches.getByText('GW34', { exact: true })).toBeVisible()

	await matches.getByRole('button', { name: 'Previous gameweek' }).click()
	await expect(matches).toHaveAttribute('data-home-fixtures-event', '33')
	await expect(matches.getByText('GW33', { exact: true })).toBeVisible()
	await page.waitForTimeout(100)
	expect(fixtureRequests).toHaveLength(1)
})

test('English and Chinese Home stay accessible without mobile overflow', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 })
	for (const path of ['/', '/zh-CN']) {
		await page.goto(path)
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
		await expect(page).toHaveTitle(/LetLetMe/)
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= window.innerWidth
			)
		).toBe(true)
	}
	const accessibility = await new AxeBuilder({ page }).analyze()
	expect(accessibility.violations).toEqual([])
})

test('Home handles twenty concurrent guest requests', async ({ request }) => {
	const responses = await Promise.all(
		Array.from({ length: 20 }, (_, index) =>
			request.get(`/?concurrency=${index}`, {
				headers: { Accept: 'text/html' }
			})
		)
	)
	expect(responses.map(response => response.status())).toEqual(
		Array.from({ length: 20 }, () => 200)
	)
})

test('get-session exposes privacy-safe stage timings', async ({ request }) => {
	const response = await request.get('/api/auth/get-session')
	expect(response.status()).toBe(200)
	const serverTiming = response.headers()['server-timing'] ?? ''
	expect(serverTiming).toContain('auth_handler;dur=')
	expect(serverTiming).toContain('auth_session;dur=')
	expect(serverTiming).toContain('auth_database;dur=')
	expect(serverTiming).toContain('auth_total;dur=')
})

// These scenarios change the isolated GraphQL fixture and must run with one worker.
test.describe('SSR remediation', () => {
	test.skip(process.env.E2E_SSR_REMEDIATION !== '1', 'Run the fixture-control suite separately with one worker')
	test.describe.configure({ mode: 'serial' })
	const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
	type Observation = { operation: string; variables: Record<string, unknown>; startedAt: number; finishedAt: number | null; abortedAt: number | null }
	async function control(rules: unknown[] = [], reset = true) {
		const response = await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules, reset }) })
		expect(response.ok).toBe(true)
	}
	async function observations(): Promise<Observation[]> {
		return (await (await fetch(fixture)).json()).requests
	}
	test.afterEach(async () => { await control() })

	for (const pathname of ['/explore/fixtures', '/explore/price-predictions']) {
		test(`${pathname} keeps the public table interactive during the total squad budget`, async ({ page }, testInfo) => {
			const session = await createSession({ entryId: 15702 })
			await control([
				{ operation: 'GetEntryHistory', delayMs: 3500 },
				{ operation: 'GetEntryEventResult', delayMs: 3500 },
				{ operation: 'GetFixturePlanningSignals', delayMs: 4500 },
				{ operation: 'GetFixturePlanningOwnershipGameweek', delayMs: 4500 }
			])
			try {
				await addSessionCookie(page, session.cookie)
				await page.goto(pathname, { waitUntil: 'commit' })
				const squad = page.locator('#my-squad')
				await expect(squad).toBeVisible()
				await expect(squad).not.toHaveAttribute('open', '')
				await squad.locator('summary').click()
				await expect(squad).toContainText('Loading your squad')
				if (pathname.includes('fixtures')) {
					await page.getByRole('button', { name: 'Hardest first', exact: true }).click()
					await expect(page.getByRole('button', { name: 'Hardest first', exact: true })).toHaveAttribute('aria-pressed', 'true')
				} else {
					await page.locator('#price-change-search').fill('Saka')
					await expect(page.locator('#price-change-search')).toHaveValue('Saka')
				}
				const before = await observations()
				expect(before.find(row => row.operation === 'GetEntryHistory')?.finishedAt).toBeNull()
				await expect(squad.getByRole('button', { name: 'Refresh and retry' })).toBeVisible({ timeout: 6500 })
				await expect(squad).toHaveAttribute('open', '')
				if (pathname.includes('fixtures')) await expect(page.getByRole('button', { name: 'Hardest first', exact: true })).toHaveAttribute('aria-pressed', 'true')
				else await expect(page.locator('#price-change-search')).toHaveValue('Saka')
				await expect.poll(async () => (await observations()).find(row => row.operation === 'GetEntryEventResult')?.abortedAt).toBeTruthy()
				const after = await observations()
				expect(after.filter(row => row.operation === 'GetEntryEventResult')).toHaveLength(1)
				const history = after.find(row => row.operation === 'GetEntryHistory')!
				const event = after.find(row => row.operation === 'GetEntryEventResult')!
				expect(event.abortedAt! - history.startedAt).toBeLessThan(5600)
				await testInfo.attach('squad-request-timeline', { body: JSON.stringify(after, null, 2), contentType: 'application/json' })
				await page.screenshot({ path: testInfo.outputPath('public-ready-squad-timeout.png'), fullPage: true })
			} finally { await session.cleanup() }
		})

		test(`${pathname} preserves filtering and expansion after a successful late seed`, async ({ page }) => {
			const session = await createSession({ entryId: 15702 })
			await control([{ operation: 'GetEntryHistory', delayMs: 2000 }])
			try {
				await addSessionCookie(page, session.cookie)
				await page.goto(`${pathname}#my-squad`, { waitUntil: 'commit' })
				await expect(page.locator('#my-squad')).toHaveAttribute('open', '')
				await expect(page.locator('#my-squad')).toContainText('Loading your squad')
				if (pathname.includes('fixtures')) await page.getByRole('button', { name: 'Hardest first', exact: true }).click()
				else await page.locator('#price-change-search').fill('Saka')
				await expect(page.locator('#my-squad')).not.toContainText('Loading your squad', { timeout: 5000 })
				const squad = page.locator('#my-squad')
				await expect(squad).toHaveAttribute('open', '')
				if (pathname.includes('fixtures')) {
					const players = squad.getByRole('button', { name: /^View Player \d+'s fixture details;/ })
					await expect(players).toHaveCount(15)
					for (let id = 1; id <= 15; id += 1) {
						await expect(squad.getByRole('button', { name: new RegExp(`^View Player ${id}'s fixture details;`) })).toBeVisible()
					}
					await expect(page.getByRole('button', { name: 'Hardest first', exact: true })).toHaveAttribute('aria-pressed', 'true')
				}
				else {
					const visiblePlayers = squad.locator('a[href*="/player-stats?p1="]:visible')
					await expect(visiblePlayers).toHaveCount(2)
					expect(await visiblePlayers.evaluateAll(links => links.map(link =>
						Number(new URL((link as HTMLAnchorElement).href).searchParams.get('p1'))
					).sort((a, b) => a - b))).toEqual([1, 2])
					await expect(squad.locator('li:visible')).toHaveCount(15)
					for (let id = 3; id <= 15; id += 1) {
						await expect(squad.getByText(`Player ${id}`, { exact: true })).toBeVisible()
					}
					await expect(page.locator('#price-change-search')).toHaveValue('Saka')
					const results = page.locator('table:visible tbody tr')
					await expect(results).toHaveCount(1)
					await expect(results.getByRole('link', { name: 'Saka', exact: true })).toHaveAttribute('href', /\/player-stats\?p1=1$/)
				}
			} finally { await session.cleanup() }
		})
	}

	for (const scenario of ['history', 'identity-pagination']) {
		test(`the total budget stops subsequent ${scenario} requests`, async ({ page }, testInfo) => {
			const session = await createSession({ entryId: 15702 })
			const historyRule = { operation: 'GetEntryHistory', data: { entryHistory: { results: [33, 32, 31, 30, 29, 28].map(eventId => ({ eventId })), history: [] } } }
			const rules = scenario === 'history' ? [historyRule, { operation: 'GetEntryEventResult', delayMs: 1400, error: true }] : [
				historyRule,
				{ operation: 'GetEntryEventResult', data: { entryEventResult: { eventPicks: [{ element: null, webName: 'Unknown Player', teamShortName: 'ARS', elementTypeName: 'MIDFIELDER', position: 1, multiplier: 1, isCaptain: false, isViceCaptain: false }] } } },
				{ operation: 'GetPlayersForPicker', delayMs: 1400, data: { players: Array.from({ length: 200 }, (_, id) => ({ id: id + 1, webName: `Directory ${id}`, team: { shortName: 'ARS' } })) } }
			]
			await control(rules)
			try {
				await addSessionCookie(page, session.cookie)
				await page.goto('/explore/price-predictions#my-squad', { waitUntil: 'commit' })
				await expect(page.locator('#my-squad').getByRole('button', { name: 'Refresh and retry' })).toBeVisible({ timeout: 6500 })
				const operation = scenario === 'history' ? 'GetEntryEventResult' : 'GetPlayersForPicker'
				await expect.poll(async () => (await observations()).filter(row => row.operation === operation).at(-1)?.abortedAt).toBeTruthy()
				const rows = (await observations()).filter(row => row.operation === operation)
				const keys = rows.map(row => row.variables[scenario === 'history' ? 'eventId' : 'offset'])
				expect(keys).toEqual(scenario === 'history' ? [33, 32, 31, 30] : [0, 200, 400, 600])
				await new Promise(resolve => setTimeout(resolve, 150))
				expect((await observations()).filter(row => row.operation === operation)).toHaveLength(rows.length)
				await testInfo.attach(`${scenario}-deadline`, { body: JSON.stringify(rows, null, 2), contentType: 'application/json' })
			} finally { await session.cleanup() }
		})
	}

	test('anonymous, unbound and invalid sessions do not issue squad history queries', async ({ page }) => {
		const session = await createSession()
		try {
			for (const cookie of [null, session.cookie, '__Secure-letletme.session_token=invalid-signature']) {
				await page.context().clearCookies()
				if (cookie) await addSessionCookie(page, cookie)
				await control()
				await page.goto('/explore/price-predictions#my-squad')
				await expect(page.locator('#my-squad')).not.toContainText('Loading your squad')
				expect((await observations()).filter(row => row.operation === 'GetEntryHistory')).toEqual([])
			}
		} finally { await session.cleanup() }
	})

	test('slow display session leaves the same theme, language and mobile menu nodes usable', async ({ page }) => {
		const session = await createSession({ entryId: 15702 })
		const sql = postgres(process.env.E2E_DIRECT_DATABASE_URL!, { max: 1, prepare: false })
		let unlock!: () => void
		let locked!: () => void
		const acquired = new Promise<void>(resolve => { locked = resolve })
		const gate = new Promise<void>(resolve => { unlock = resolve })
		const transaction = sql.begin(async tx => {
			await tx`LOCK TABLE bauth.session IN ACCESS EXCLUSIVE MODE`
			locked()
			await gate
		})
		try {
			await acquired
			await addSessionCookie(page, session.cookie)
			await page.setViewportSize({ width: 390, height: 844 })
			await page.goto('/explore/fixtures', { waitUntil: 'commit' })
			const theme = page.locator('[data-theme-picker]')
			await expect(theme).not.toHaveAttribute('inert', '', { timeout: 3000 })
			await page.evaluate(() => {
				for (const selector of ['[data-theme-picker]', '[data-locale-picker]', '[data-navigation-mobile]']) document.querySelector(selector)!.setAttribute('data-original-node', 'true')
			})
			await theme.locator('summary').click()
			await theme.locator('[data-theme-choice="dark"]').click()
			await expect(page.locator('html')).toHaveClass(/dark/)
			await page.locator('[data-navigation-mobile] > summary').click()
			await expect(page.locator('[data-navigation-mobile]')).toHaveAttribute('open', '')
			unlock()
			await transaction
			await expect(page.locator('[data-navigation-mobile]')).toContainText('E2E Manager')
			await expect(page.locator('[data-original-node="true"]')).toHaveCount(3)
			await theme.locator('summary').click()
			await theme.locator('[data-theme-choice="light"]').click()
			await expect(page.locator('html')).not.toHaveClass(/dark/)
		} finally { unlock(); await transaction; await sql.end(); await session.cleanup() }
	})

	test('MINE Trends never shares cache entries between two verified users', async ({ request }) => {
		const sessions = await Promise.all([createSession({ entryId: 15702 }), createSession({ entryId: 31056 })])
		await control()
		try {
			for (const session of sessions) {
				for (let visit = 0; visit < 2; visit++) {
					const response = await request.get('/explore/selections?cohort=competition:778&gw=21', { headers: { Cookie: session.cookie } })
					expect(response.status()).toBe(200)
				}
			}
			const rows = await observations()
			expect(rows.filter(row => row.operation === 'TrendCohortSnapshot' && row.variables.access === 'MINE' && row.variables.eventId === 21)).toHaveLength(4)
			expect(rows.filter(row => row.operation === 'TrendCohorts' && row.variables.access === 'MINE')).toHaveLength(4)
		} finally { await Promise.all(sessions.map(session => session.cleanup())) }
	})

	test('PUBLIC Trends reuses actual upstream reads across signature times and coalesces cold parameters', async ({ request }, testInfo) => {
		await control([{ operation: 'TrendCohortSnapshot', variables: { eventId: 17 }, delayMs: 1000 }])
		const url = '/explore/selections?cohort=competition:777&gw=17'
		const responses = await Promise.all([request.get(url), request.get(url), request.get(url)])
		for (const response of responses) expect(response.status()).toBe(200)
		let reads = (await observations()).filter(row => row.operation === 'TrendCohortSnapshot' && row.variables.eventId === 17)
		expect(reads).toHaveLength(1)
		await new Promise(resolve => setTimeout(resolve, 1100))
		await request.get(url)
		reads = (await observations()).filter(row => row.operation === 'TrendCohortSnapshot' && row.variables.eventId === 17)
		expect(reads).toHaveLength(1)
		await request.get('/explore/selections?cohort=competition:777&gw=18')
		expect((await observations()).filter(row => row.operation === 'TrendCohortSnapshot' && row.variables.eventId === 18)).toHaveLength(1)
		await control([{ operation: 'TrendCohortSnapshot', variables: { eventId: 19 }, error: true }], false)
		await request.get('/explore/selections?gw=19')
		await control([], false)
		await request.get('/explore/selections?gw=19')
		expect((await observations()).filter(row => row.operation === 'TrendCohortSnapshot' && row.variables.eventId === 19)).toHaveLength(2)
		await testInfo.attach('trends-cache-reads', { body: JSON.stringify(await observations(), null, 2), contentType: 'application/json' })
	})
})

test('canonical competition board and compatibility redirect preserve the committed selection', async ({ page }) => {
	test.skip(
		process.env.E2E_LIVE_HYDRATION !== '1',
		'Uses the deterministic live competition fixture'
	)
	const session = await createSession({ entryId: 15702 })
	try {
		await addSessionCookie(page, session.cookie)
		// Next can deliver this redirect in a streamed HTML response (HTTP 200).
		// Verify the browser destination and committed board, not just the status.
		await page.goto('/live/competitions/6?gw=1&created=1')
		await expect(page).toHaveURL(/\/live\/competitions\?/)
		const target = new URL(page.url())
		expect(target.pathname).toBe('/live/competitions')
		expect(target.searchParams.get('tournamentId')).toBe('6')
		expect(target.searchParams.get('gw')).toBe('1')
		expect(target.searchParams.get('created')).toBe('1')
		const board = page.locator('[data-competition-perf-ready="detail"][data-competition-tournament-id="6"][data-competition-gameweek="1"]')
		await expect(board).toBeVisible()
		await expect(board.getByRole('list')).toBeVisible()
		await expect(board.getByRole('link', { name: 'E2E United Test Manager' }).first()).toBeVisible()
		await expect(page.getByRole('heading', { name: /Sign in/ })).toHaveCount(0)
	} finally { await session.cleanup() }
})

test('live points reloads a repeated entry without stranding the loading state', async ({ page }) => {
	test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Uses the deterministic local GraphQL fixture')
	const session = await createSession({ entryId: 15702 })
	const entryRequests: number[] = []
	let releaseRefresh!: () => void
	const refreshGate = new Promise<void>(resolve => {
		releaseRefresh = resolve
	})
	await page.route('**/api/graphql', async route => {
		const payload = route.request().postDataJSON() as {
			query?: string
			variables?: { entryId?: number }
		}
		if (payload.query?.includes('GetLiveCalcPoints')) {
			entryRequests.push(payload.variables?.entryId ?? 0)
			if (entryRequests.length === 2) await refreshGate
		}
		await route.continue()
	})
	try {
		await addSessionCookie(page, session.cookie)
		await page.goto('/live/points')
		const entryInput = page.getByRole('spinbutton', { name: 'FPL entry ID', exact: true })
		const submit = page.getByRole('button', { name: 'View Live Points', exact: true })
		const pitch = page.getByRole('region', { name: /formation/ })
		const players = pitch.getByRole('button', { name: /View details for Player/ })
		await entryInput.fill('123')
		await submit.click()
		await expect(players).toHaveCount(15)
		await expect.poll(() => entryRequests).toEqual([123])
		await submit.click()
		await expect.poll(() => entryRequests).toEqual([123, 123])
		// Another submission must reuse the in-flight request without invalidating it.
		await submit.click()
		await expect(pitch).toBeVisible()
		const refreshed = page.waitForResponse(response =>
			response.url().endsWith('/api/graphql') &&
			response.request().postData()?.includes('GetLiveCalcPoints') === true
		)
		releaseRefresh()
		expect((await refreshed).status()).toBe(200)
		await expect(page.getByText(/Loading live points for entry/)).toHaveCount(0)
		await expect(players).toHaveCount(15)
		expect(entryRequests).toEqual([123, 123])
		await entryInput.fill('456')
		await submit.click()
		await expect.poll(() => entryRequests).toEqual([123, 123, 456])
		await expect(page.getByText(/Loading live points for entry/)).toHaveCount(0)
		await expect(players).toHaveCount(15)
	} finally {
		releaseRefresh()
		await session.cleanup()
	}
})

for (const recoveryMode of ['none', 'retry-button', 'tab-reentry', 'partial-ssr-seed', 'failed-ssr-seed', 'search-empty', 'gw-route', 'live-journey', 'live-journey-pinned', 'live-journey-index-retry', 'live-journey-sort'] as const) {
for (const locale of recoveryMode === 'none' || recoveryMode === 'search-empty' || recoveryMode === 'gw-route' || recoveryMode.startsWith('live-journey') ? ['en', 'zh-CN'] : ['en']) {
const routePath = locale === 'zh-CN' ? '/zh-CN/my-fpl/competitions' : '/my-fpl/competitions'
const fixturesPath = locale === 'zh-CN' ? '/zh-CN/explore/fixtures' : '/explore/fixtures'
const partialSsrSeed = recoveryMode === 'partial-ssr-seed' || recoveryMode === 'failed-ssr-seed'
const failFirstSections = (recoveryMode === 'retry-button' || recoveryMode === 'tab-reentry')
test(`SSR remediation tournament season sections load on demand without a false missing-publication state [${locale}]${recoveryMode !== 'none' ? ` and recover via ${recoveryMode}` : ''}`, async ({ page }) => {
	test.skip(process.env.E2E_SSR_REMEDIATION !== '1', 'Uses serial isolated fixture controls')
	const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
	const session = await createSession({ entryId: 123 })
	const phase = { phaseId: 'points-1', format: 'POINTS', startEventId: 1, endEventId: 4, state: 'READY', revision: '1', semanticSha256: 'a'.repeat(64), settledAt: '2026-09-15T00:00:00Z', publishedAt: '2026-09-15T01:00:00Z', correctedAt: null }
	const points = {
		headlineMetric: 'GROSS_POINTS', grossPointsTotal: 75, grossPointsAverage: 75, netPointsTotal: 71,
		seasonGrossPointsTotal: 300, seasonGrossPointsAverage: 300, seasonNetPointsTotal: 296,
		nextCursor: null, hasNextPage: false,
		rows: [{ entryId: 123, entryName: 'Season Fixture United', playerName: 'Fixture Manager', applicable: true, groupId: null, rank: 1, previousRank: 2, grossPoints: 75, transferCost: 4, netPoints: 71, tournamentScore: 300, seasonGrossPoints: 300, seasonNetPoints: 296, eventRank: 1, overallPoints: 300, overallRank: 100 }]
	}
	const pageInfo = { hasNextPage: false, endCursor: null }
	const reviewTournamentId = recoveryMode.startsWith('live-journey') ? 6 : 77
	const scope = { ...phase, tournamentId: reviewTournamentId, eventId: 4, rowCount: 1, expectedSubjectCount: 1, readySubjectCount: 1, notApplicableSubjectCount: 0 }
	const rules = [
		{ operation: 'GetMyTournamentReviewCatalog', data: { myTournamentReviewCatalog: { state: 'READY', asOf: phase.publishedAt, viewerEntryId: 123, adminReadAll: recoveryMode === 'search-empty', pageInfo, edges: [{ cursor: '77', node: { tournamentId: reviewTournamentId, name: 'Fixture Review Cup', creator: 'Fixture', leagueId: 77, leagueType: 'CLASSIC', totalTeamNum: 1, latestFinalizedEventId: 4, previousReadyEventId: 3, setupStatus: 'READY', latestFinalizedScope: { ...scope, repairState: 'NONE' }, phaseSummaries: [phase], state: 'READY' } }] } } },
		{ operation: 'GetMyTournamentSeasonReview', data: { myTournamentSeasonReview: { state: 'READY', tournamentId: reviewTournamentId, throughEventId: 4, latestFinalizedEventId: 4, phases: [phase] } } },
		{ operation: 'GetMyTournamentGameweekReview', data: { myTournamentGameweekReview: { state: 'READY', scope, payload: { format: 'POINTS', points } } } },
		...['POINTS_STANDINGS', 'POINTS_TRAJECTORIES'].map(section => ({ operation: 'GetMyTournamentSeasonReviewSection', variables: { section }, data: { myTournamentSeasonReviewSection: { ...phase, tournamentId: reviewTournamentId, throughEventId: 4, section, points, h2h: null, knockout: null, pageInfo } } }))
	]
	let releaseSections!: () => void
	const gate = new Promise<void>(resolve => { releaseSections = resolve })
	let sectionRequests = 0
	let viewNavigationRequests = 0
	try {
		expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules }) })).ok).toBe(true)
		await addSessionCookie(page, session.cookie)
		await page.route('**/api/graphql', async route => {
			const payload = route.request().postDataJSON()
			if (!payload.query?.includes('GetMyTournamentSeasonReviewSection')) return route.continue()
			sectionRequests += 1
			expect(payload.variables).toMatchObject({ tournamentId: 77, throughEventId: 4, phaseId: phase.phaseId, revision: '1', semanticSha256: phase.semanticSha256 })
			await gate
			if (failFirstSections && sectionRequests <= 2) {
				await route.fulfill({ status: 503, headers: { 'retry-after': '0' }, json: { errors: [{ message: 'Section temporarily unavailable' }] } })
				return
			}
			await route.continue()
		})
		if (recoveryMode.startsWith('live-journey')) {
			let comparisonBoardRevision = 'e2e-competition-score-v1'
			await page.setViewportSize(locale === 'zh-CN' ? { width: 390, height: 844 } : { width: 1440, height: 900 })
			if (recoveryMode === 'live-journey-sort') {
				await page.route('**/api/live/competitions/6/board', async route => {
					const response = await route.fetch()
					const body = await response.json()
					const board = body.entryLiveCompetitionBoard
					const low = { ...board.rows[0], entry: 201, entryName: 'Low Sort Team', teamValue: 900, overallRank: 10, transferCost: 0, score: { ...board.rows[0].score, eventPoints: 10, netEventPoints: 10, totalPoints: 100 } }
					const high = { ...low, entry: 202, entryName: 'High Sort Team', teamValue: 1000, overallRank: 20, transferCost: 4, score: { ...low.score, eventPoints: 20, netEventPoints: 16, totalPoints: 200 } }
					board.rows = route.request().postDataJSON().input.direction === 'ASC' ? [low, high] : [high, low]
					board.viewerRow = null
					board.totalEntries = board.filteredEntries = 2
					await route.fulfill({ response, json: body })
				})
			}
			if (recoveryMode === 'live-journey-pinned') {
				await page.route('**/api/live/competitions/6/board', async route => {
					const response = await route.fetch()
					const body = await response.json()
					const board = body.entryLiveCompetitionBoard
					board.head.contentRevision = comparisonBoardRevision
					board.head.publication.revisions.scoreCore = comparisonBoardRevision
					board.rows[0].score.revisions.scoreCore = comparisonBoardRevision
					board.rows[0].score.eventPoints = comparisonBoardRevision.endsWith('-v2') ? 77 : 52
					board.rows[0].score.netEventPoints = board.rows[0].score.eventPoints
					board.rows[0].overallRank = comparisonBoardRevision.endsWith('-v2') ? 777 : 333
					board.rows[0].chip = comparisonBoardRevision.endsWith('-v2') ? 'BENCH_BOOST' : 'NONE'
					board.rows[0].played = comparisonBoardRevision.endsWith('-v2') ? 7 : 3
					board.viewerRow = { ...board.rows[0], entry: 123, entryName: 'Pinned Viewer United', liveRank: 90 }
					board.totalEntries = 2
					board.filteredEntries = 2
					board.pageInfo = { hasNextPage: true, endCursor: 'pinned-fixture-page-1' }
					await route.fulfill({ response, json: body })
				})
			}
			const unavailableRules = [
				{ operation: 'GetMyTournamentGameweekReview', data: { myTournamentGameweekReview: { state: 'UNAVAILABLE', scope: null, payload: null } } },
				...rules
			]
			expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: unavailableRules }) })).ok).toBe(true)
			await page.goto(`${routePath}?tournamentId=6&view=gameweek&gw=4`)
			const live = page.getByRole('link', { name: locale === 'zh-CN' ? '未结算数据请前往 Live' : 'Open Live for unsettled data', exact: true })
			await expect(live).toBeVisible()
			const prefix = locale === 'zh-CN' ? '/zh-CN' : ''
			await expect(live).toHaveAttribute('href', `${prefix}/live/competitions?tournamentId=6&gw=4`)
			let indexRequests = 0
			if (recoveryMode === 'live-journey-index-retry') {
				await page.route('**/api/live/competitions/6/selection-index?*', async route => {
					indexRequests += 1
					if (indexRequests === 1) await route.fulfill({ status: 503, json: { error: 'DEPENDENCY_UNAVAILABLE' } })
					else await route.continue()
				})
			}
			const selectionResponse = page.waitForResponse(response =>
				response.url().includes('/api/live/competitions/6/selection-index?') && response.status() === 200)
			await live.click()
			if (recoveryMode === 'live-journey-index-retry') {
				await expect(page.getByRole('link', { name: /E2E United/ }).filter({ visible: true })).toBeVisible()
				if (locale === 'zh-CN') await page.getByRole('button', { name: '更多筛选', exact: true }).click()
				const warning = page.getByRole('alert').filter({ hasText: locale === 'zh-CN' ? '筛选选项暂时不可用' : 'Filter options are temporarily unavailable' })
				await expect(warning).toBeVisible()
				expect(indexRequests).toBe(1)
				await warning.locator('..').getByRole('button', { name: locale === 'zh-CN' ? '刷新' : 'Refresh', exact: true }).click()
				await expect(warning).toHaveCount(0)
				await expect.poll(() => indexRequests).toBe(2)
			}
			const selection = await (await selectionResponse).json()
			expect(selection.tournamentSelectionIndex).toMatchObject({
				tournamentId: 6, eventId: 4, scoreCoreRevision: 'e2e-competition-score-v1',
				rows: [{ playerId: 1, playerName: 'Saka', captainCount: 1 }]
			})
			await expect(page).toHaveURL(url => url.pathname === `${prefix}/live/competitions` && url.searchParams.get('tournamentId') === '6' && url.searchParams.get('gw') === '4')
			if (recoveryMode === 'live-journey-sort') {
				const columns = [
					['TOTAL_POINTS', 'Total Pts', '总积分'], ['OVERALL_RANK', 'OR', '总排名'],
					['TEAM_VALUE', 'TV', '阵容身价'], ['TRANSFER_COST', 'Cost', '扣分'], ['EVENT_POINTS', 'GW Pts', '本轮积分']
				]
				for (const [sort, en, zh] of columns) {
					const responseFor = (direction?: string) => page.waitForResponse(response => {
						if (!response.url().endsWith('/api/live/competitions/6/board')) return false
						const input = response.request().postDataJSON()?.input
						return input?.sort === sort && (!direction || input.direction === direction)
					})
					const changed = responseFor()
					await page.getByRole('combobox', { name: locale === 'zh-CN' ? '积分榜排序方式' : 'Sort competition standings', exact: true }).click()
					await page.getByRole('option', { name: locale === 'zh-CN' ? zh : en, exact: true }).click()
					const first = await changed
					expect(first.status()).toBe(200)
					const direction = first.request().postDataJSON().input.direction
					const links = page.getByRole('link', { name: /(?:Low|High) Sort Team/ }).filter({ visible: true })
					await expect(links).toHaveText(direction === 'ASC' ? [/Low Sort Team/, /High Sort Team/] : [/High Sort Team/, /Low Sort Team/])
					const flipped = responseFor(direction === 'ASC' ? 'DESC' : 'ASC')
					await page.getByRole('button', { name: locale === 'zh-CN' ? (direction === 'ASC' ? '升序' : '降序') : (direction === 'ASC' ? 'Asc' : 'Desc'), exact: true }).click()
					expect((await flipped).status()).toBe(200)
					await expect(links).toHaveText(direction === 'ASC' ? [/High Sort Team/, /Low Sort Team/] : [/Low Sort Team/, /High Sort Team/])
				}
				return
			}
			const team = page.getByRole('link', { name: /E2E United/ }).filter({ visible: true })
			await expect(team).toHaveCount(1)
			await expect(team).toBeVisible()
			if (recoveryMode === 'live-journey' || recoveryMode === 'live-journey-index-retry') {
				if (locale === 'zh-CN' && recoveryMode !== 'live-journey-index-retry') await page.getByRole('button', { name: '更多筛选', exact: true }).click()
				const captain = page.getByRole('combobox', { name: locale === 'zh-CN' ? '按队长筛选积分榜' : 'Filter standings by captain', exact: true })
				await expect(captain).toBeEnabled()
				await captain.click()
				const filtered = page.waitForResponse(response => response.url().endsWith('/api/live/competitions/6/board') && response.request().postDataJSON()?.input?.captainPlayerIds?.includes(1))
				await page.getByRole('option', { name: 'Saka · MID · ARS', exact: true }).click()
				const filteredResponse = await filtered
				expect(filteredResponse.status()).toBe(200)
				expect((await filteredResponse.json()).entryLiveCompetitionBoard).toMatchObject({ filteredEntries: 1, rows: [{ entry: 15702, captainId: 1 }] })
				const cleared = page.waitForResponse(response => response.url().endsWith('/api/live/competitions/6/board') && response.request().postDataJSON()?.input?.captainPlayerIds?.length === 0)
				await page.getByRole('button', { name: locale === 'zh-CN' ? '移除队长 Saka' : 'Remove captain Saka', exact: true }).click()
				expect((await cleared).status()).toBe(200)
				const chip = page.getByRole('button', { name: locale === 'zh-CN' ? 'BB' : 'Bench Boost', exact: true })
				const empty = page.waitForResponse(response => response.url().endsWith('/api/live/competitions/6/board') && response.request().postDataJSON()?.input?.chips?.includes('BENCH_BOOST'))
				await chip.click()
				const emptyResponse = await empty
				expect(emptyResponse.status()).toBe(200)
				expect((await emptyResponse.json()).entryLiveCompetitionBoard).toMatchObject({ filteredEntries: 0, rows: [] })
				await expect(page.getByText(locale === 'zh-CN' ? '匹配 0/1（0%）' : 'Matched 0 / 1 (0%)', { exact: true }).filter({ visible: true })).toHaveCount(2)
				await expect(page.getByText(locale === 'zh-CN' ? '没有球队符合搜索条件。' : 'No teams match your search criteria.', { exact: true }).filter({ visible: true })).toBeVisible()
				const restored = page.waitForResponse(response => response.url().endsWith('/api/live/competitions/6/board') && response.request().postDataJSON()?.input?.chips?.length === 0)
				await chip.click()
				expect((await restored).status()).toBe(200)
				if (locale === 'zh-CN') await page.keyboard.press('Escape')
				await expect(team).toBeVisible()
			}
			if (recoveryMode === 'live-journey-pinned') {
				await expect(page.getByRole('link', { name: /Pinned Viewer United/ }).filter({ visible: true })).toHaveCount(1)
				await page.getByRole('button', { name: locale === 'zh-CN' ? '对比' : 'Compare', exact: true }).click()
				const selectionPrompt = page.getByText(locale === 'zh-CN' ? '勾选 2 支队伍' : 'Select 2 teams', { exact: true })
				const oneMorePrompt = page.getByText(locale === 'zh-CN' ? '再选 1 支球队' : 'Select 1 more to compare', { exact: true })
				const selectionOpener = page.getByRole('button', { name: locale === 'zh-CN' ? '对比（2）' : 'Compare (2)', exact: true })
				const firstSelection = page.getByRole('checkbox', { name: locale === 'zh-CN' ? '选择 E2E United 进行对比' : 'Select E2E United for comparison', exact: true }).filter({ visible: true })
				await expect(selectionPrompt).toBeVisible()
				await expect(selectionOpener).toHaveCount(0)
				await firstSelection.check()
				await expect(oneMorePrompt).toBeVisible()
				await expect(selectionPrompt).toHaveCount(0)
				await expect(selectionOpener).toHaveCount(0)
				await expect(page.getByRole('dialog')).toHaveCount(0)
				await firstSelection.uncheck()
				await expect(selectionPrompt).toBeVisible()
				await expect(oneMorePrompt).toHaveCount(0)
				await firstSelection.check()
				await page.getByRole('checkbox', { name: locale === 'zh-CN' ? '选择 Pinned Viewer United 进行对比' : 'Select Pinned Viewer United for comparison', exact: true }).filter({ visible: true }).check()
				const compareOpener = page.getByRole('button', { name: locale === 'zh-CN' ? '对比（2）' : 'Compare (2)', exact: true })
				const detailResponse = page.waitForResponse(response => {
					const url = new URL(response.url())
					return url.pathname === '/api/live/competitions/6/compare'
				}, { timeout: 5_000 })
				await compareOpener.click()
				const response = await detailResponse
				expect(response.status()).toBe(200)
				const requestUrl = new URL(response.url())
				expect(requestUrl.searchParams.get('eventId')).toBe('4')
				expect(requestUrl.searchParams.get('scoreCoreRevision')).toBe('e2e-competition-score-v1')
				expect(requestUrl.searchParams.get('entryIds')?.split(',').sort()).toEqual(['123', '15702'])
				const body = await response.json()
				expect(body.tournamentEntrySquads).toMatchObject({ tournamentId: 6, eventId: 4, scoreCoreRevision: 'e2e-competition-score-v1' })
				expect(body.tournamentEntrySquads.entries.map((entry: { entry: number }) => entry.entry).sort()).toEqual([123, 15702])
				for (const entry of body.tournamentEntrySquads.entries) {
					expect(entry.pickList).toHaveLength(15)
					for (const pick of entry.pickList) {
						expect(pick.elementType).toBeUndefined()
						expect(pick.elementTypeName).toMatch(/^(GOALKEEPER|DEFENDER|MIDFIELDER|FORWARD)$/)
					}
				}
				const comparison = page.getByRole('dialog')
				await expect(comparison.getByRole('heading')).toContainText('E2E United')
				await expect(comparison.getByRole('heading')).toContainText('Pinned Viewer United')
				for (let playerId = 1; playerId <= 15; playerId += 1) {
					await expect(comparison.getByText(new RegExp(`^(?:\\([CV]\\) )?Player ${playerId}(?: \\([CV]\\))?$`))).toHaveCount(2)
				}
				await expect(comparison.locator('.animate-pulse')).toHaveCount(0)
				for (const [label, count] of [['GKP', 2], ['DEF', 5], ['MID', 4], ['SUB', 4]] as const) {
					await expect(comparison.getByText(label, { exact: true })).toHaveCount(count)
				}
				for (const totalScope of ['UNKNOWN', 'OVERALL'] as const) {
					await comparison.press('Escape')
					await page.route('**/api/live/competitions/6/compare?*', async route => {
						const response = await route.fetch()
						const payload = await response.json()
						for (const entry of payload.tournamentEntrySquads.entries) {
							entry.score.totalScope = totalScope
							entry.score.totalPoints = 98765
						}
						await route.fulfill({ response, json: payload })
					})
					await compareOpener.click()
					await expect(comparison.getByText('Player 15', { exact: true })).toHaveCount(2)
					const totalRow = comparison.getByText(locale === 'zh-CN' ? '总积分' : 'Total Pts', { exact: true }).locator('..')
					await expect(totalRow.getByText(totalScope === 'UNKNOWN' ? '—' : '98765', { exact: true })).toHaveCount(2)
					if (totalScope === 'UNKNOWN') await expect(totalRow.getByText('98765', { exact: true })).toHaveCount(0)
					await page.unroute('**/api/live/competitions/6/compare?*')
				}
				for (const pointState of ['null', 'missing', 'zero'] as const) {
					await comparison.press('Escape')
					await page.route('**/api/live/competitions/6/compare?*', async route => {
						const response = await route.fetch()
						const payload = await response.json()
						for (const entry of payload.tournamentEntrySquads.entries) {
							const pick = entry.pickList.find((pick: { position: number }) => pick.position === 15)
							pick.totalPoints = entry.entry === 15702 ? (pointState === 'zero' ? 0 : null) : 5
							if (entry.entry === 15702 && pointState === 'missing') delete pick.totalPoints
						}
						await route.fulfill({ response, json: payload })
					})
					await compareOpener.click()
					await expect(comparison.getByText('Player 15', { exact: true })).toHaveCount(2)
					const playerRow = comparison.getByText('Player 15', { exact: true }).first().locator('../..')
					const points = playerRow.locator('span.font-mono.w-6')
					await expect(points).toHaveText([pointState === 'zero' ? '0' : '—', '5'])
					await expect(points.filter({ hasText: /^5$/ })).toHaveClass(pointState === 'zero' ? /text-primary-ink/ : /text-muted-foreground/)
					await page.unroute('**/api/live/competitions/6/compare?*')
				}
				for (const fault of ['partial', 'duplicate-position', 'invalid-position', 'unavailable', 'revision', 'entry', 'gone'] as const) {
					await comparison.press('Escape')
					await expect(comparison).toHaveCount(0)
					let attempts = 0
					await page.route('**/api/live/competitions/6/compare?*', async route => {
						attempts += 1
						if (attempts > 1) return route.continue()
						if (fault === 'unavailable' || fault === 'gone') {
							await route.fulfill({ status: fault === 'gone' ? 409 : 503, json: { error: fault === 'gone' ? 'LIVE_SCORE_REVISION_GONE' : 'DEPENDENCY_UNAVAILABLE' } })
							return
						}
						const response = await route.fetch()
						const body = await response.json()
						if (fault === 'partial') body.tournamentEntrySquads.entries[0].pickList = body.tournamentEntrySquads.entries[0].pickList.slice(0, 14)
						else if (fault === 'duplicate-position') body.tournamentEntrySquads.entries[0].pickList[14].position = 1
						else if (fault === 'invalid-position') body.tournamentEntrySquads.entries[0].pickList[14].position = 16
						else if (fault === 'revision') body.tournamentEntrySquads.scoreCoreRevision = 'wrong-revision'
						else body.tournamentEntrySquads.entries[0].entry = 99999
						await route.fulfill({ response, json: body })
					})
					try {
						const refreshedBoard = fault === 'gone' ? page.waitForResponse(response => response.url().endsWith('/api/live/competitions/6/board')) : null
						await compareOpener.click()
						if (refreshedBoard) {
							const refreshed = await refreshedBoard
							expect(refreshed.status()).toBe(200)
							expect(refreshed.request().postDataJSON().eventId).toBe(4)
						}
						const error = comparison.getByRole('alert')
						await expect(error).toContainText(locale === 'zh-CN' ? '两边阵容加载失败' : 'The two squads could not be loaded')
						await expect(comparison.locator('.animate-pulse')).toHaveCount(0)
						await expect(comparison.getByText(/Player 15/)).toHaveCount(0)
						expect(attempts).toBe(1)
						await error.getByRole('button', { name: locale === 'zh-CN' ? '刷新' : 'Refresh', exact: true }).click()
						await expect(comparison.getByText('Player 15', { exact: true })).toHaveCount(2)
						await expect(error).toHaveCount(0)
						expect(attempts).toBe(2)
					} finally {
						await page.unroute('**/api/live/competitions/6/compare?*')
					}
				}
				await comparison.press('Escape')
				await expect(comparison).toHaveCount(0)
				let releaseOld!: () => void
				let markStarted!: () => void
				let markSettled!: () => void
				const held = new Promise<void>(resolve => { releaseOld = resolve })
				const started = new Promise<void>(resolve => { markStarted = resolve })
				const settled = new Promise<void>(resolve => { markSettled = resolve })
				let detailAttempts = 0
				await page.route('**/api/live/competitions/6/compare?*', async route => {
					detailAttempts += 1
					if (detailAttempts > 1) return route.continue()
					try {
						const response = await route.fetch()
						const body = await response.json()
						for (const entry of body.tournamentEntrySquads.entries) {
							for (const pick of entry.pickList) pick.webName = 'Late obsolete player'
						}
						markStarted()
						await held
						await route.fulfill({ response, json: body })
					} finally { markSettled() }
				})
				try {
					await compareOpener.click()
					await started
					await expect(comparison.locator('.animate-pulse')).toHaveCount(30)
					await comparison.press('Escape')
					await expect(comparison).toHaveCount(0)
					await compareOpener.click()
					await expect(comparison.getByText('Player 15', { exact: true })).toHaveCount(2)
					expect(detailAttempts).toBe(2)
					releaseOld()
					await settled
					await expect(comparison).toBeVisible()
					await expect(comparison.getByText('Late obsolete player', { exact: true })).toHaveCount(0)
					await expect(comparison.getByText('Player 15', { exact: true })).toHaveCount(2)
					await expect(comparison.locator('.animate-pulse')).toHaveCount(0)
				} finally {
					releaseOld()
					await page.unroute('**/api/live/competitions/6/compare?*')
				}
				await comparison.press('Escape')
				await expect(comparison).toHaveCount(0)
				const observedRevisions: string[] = []
				await page.route('**/api/live/competitions/6/compare?*', async route => {
					const revision = new URL(route.request().url()).searchParams.get('scoreCoreRevision')!
					observedRevisions.push(revision)
					if (revision === 'e2e-competition-score-v1') {
						comparisonBoardRevision = 'e2e-competition-score-v2'
						await route.fulfill({ status: 409, json: { error: 'LIVE_SCORE_REVISION_GONE' } })
					} else await route.continue()
				})
				try {
					await compareOpener.click()
					await expect(comparison.getByText('77', { exact: true })).toHaveCount(4)
					await expect(comparison.getByText('777', { exact: true })).toHaveCount(2)
					await expect(comparison.getByText('333', { exact: true })).toHaveCount(0)
					await expect(comparison.getByText('BB', { exact: true })).toHaveCount(2)
					await expect(comparison.getByText('7/15', { exact: true })).toHaveCount(2)
					await expect(comparison.getByText('3/11', { exact: true })).toHaveCount(0)
					await expect(comparison.getByText('52', { exact: true })).toHaveCount(0)
					await expect(comparison.getByText('Player 15', { exact: true })).toHaveCount(2)
					await expect(comparison.getByRole('alert')).toHaveCount(0)
					expect(observedRevisions).toEqual(['e2e-competition-score-v1', 'e2e-competition-score-v2'])
				} finally {
					await page.unroute('**/api/live/competitions/6/compare?*')
				}
				await page.getByRole('dialog').press('Escape')
				await expect(page.getByRole('dialog')).toHaveCount(0)
				await expect(compareOpener).toBeFocused()
				await compareOpener.press('Enter')
				await expect(page.getByRole('dialog')).toBeVisible()
				await page.getByRole('dialog').getByRole('button', { name: locale === 'zh-CN' ? '关闭' : 'Close', exact: true }).click()
				await expect(page.getByRole('dialog')).toHaveCount(0)
				await expect(compareOpener).toBeFocused()
				await page.getByRole('button', { name: locale === 'zh-CN' ? '取消' : 'Cancel', exact: true }).click()
			}
			const gameweekNavigations: string[] = []
			const recordGameweekNavigation = (request: import('@playwright/test').Request) => {
				if (new URL(request.url()).pathname === `${prefix}/live/competitions` && request.headers().rsc === '1') gameweekNavigations.push(request.url())
			}
			page.on('request', recordGameweekNavigation)
			await page.getByRole('button', { name: locale === 'zh-CN' ? '上一轮' : 'Previous gameweek', exact: true }).click()
			await expect(page).toHaveURL(url => url.pathname === `${prefix}/live/competitions` && url.searchParams.get('tournamentId') === '6' && url.searchParams.get('gw') === '3')
			await expect(team).toHaveAttribute('href', `${prefix}/live/points/15702?tournamentId=6&gw=3`)
			expect(gameweekNavigations).toEqual([])
			page.off('request', recordGameweekNavigation)
			if (recoveryMode === 'live-journey-pinned') {
				await page.getByRole('button', { name: locale === 'zh-CN' ? '对比' : 'Compare', exact: true }).click()
				for (const teamName of ['E2E United', 'Pinned Viewer United']) {
					await page.getByRole('checkbox', { name: locale === 'zh-CN' ? `选择 ${teamName} 进行对比` : `Select ${teamName} for comparison`, exact: true }).filter({ visible: true }).check()
				}
				const gw3Response = page.waitForResponse(response => new URL(response.url()).pathname === '/api/live/competitions/6/compare')
				await page.getByRole('button', { name: locale === 'zh-CN' ? '对比（2）' : 'Compare (2)', exact: true }).click()
				const response = await gw3Response
				expect(new URL(response.url()).searchParams.get('eventId')).toBe('3')
				expect(response.status()).toBe(200)
				expect((await response.json()).tournamentEntrySquads).toMatchObject({ tournamentId: 6, eventId: 3, scoreCoreRevision: 'e2e-competition-score-v2' })
				await expect(page.getByRole('dialog').getByText('Player 15', { exact: true })).toHaveCount(2)
				await page.getByRole('dialog').press('Escape')
				await expect(page.getByRole('dialog')).toHaveCount(0)
			}
			await page.reload()
			await expect(team).toHaveAttribute('href', `${prefix}/live/points/15702?tournamentId=6&gw=3`)
			await page.getByRole('button', { name: locale === 'zh-CN' ? '下一轮' : 'Next gameweek', exact: true }).click()
			await expect(page).toHaveURL(url => url.searchParams.get('tournamentId') === '6' && url.searchParams.get('gw') === '4')
			await expect(team).toHaveAttribute('href', `${prefix}/live/points/15702?tournamentId=6&gw=4`)
			await team.click()
			await expect(page).toHaveURL(url => url.pathname === `${prefix}/live/points/15702` && url.searchParams.get('gw') === '4' && url.searchParams.get('tournamentId') === '6')
			const pitch = page.getByRole('region', { name: locale === 'zh-CN' ? /阵型/ : /formation/ })
			await expect(pitch.getByRole('button', { name: locale === 'zh-CN' ? /查看 Player/ : /View details for Player/ })).toHaveCount(15)
			for (const playerId of [1, 12]) {
				const opener = pitch.getByRole('button', { name: locale === 'zh-CN' ? `查看 Player ${playerId} 的详情` : `View details for Player ${playerId}`, exact: true })
				// Model browsers where pointer activation does not focus the button.
				await opener.evaluate(element => element.addEventListener('mousedown', event => event.preventDefault(), { once: true }))
				await opener.click()
				const dialog = page.getByRole('dialog')
				await expect(dialog.getByRole('heading', { name: `Player ${playerId}`, exact: true })).toBeVisible()
				await expect(dialog.getByText(locale === 'zh-CN' ? '正在加载积分明细…' : 'Loading breakdown…', { exact: true })).toHaveCount(0)
				await dialog.getByRole('button', { name: locale === 'zh-CN' ? '关闭' : 'Close', exact: true }).click()
				await expect(dialog).toHaveCount(0)
				await expect(opener).toBeFocused()
				await opener.press('Enter')
				await expect(dialog.getByRole('heading', { name: `Player ${playerId}`, exact: true })).toBeVisible()
				await page.keyboard.press('Escape')
				await expect(dialog).toHaveCount(0)
				await expect(opener).toBeFocused()
				const row = page.getByRole('button', { name: locale === 'zh-CN' ? `查看 Player ${playerId} 的详情` : `View details for Player ${playerId}`, exact: true }).and(page.locator('div[role="button"]'))
				await expect(row).toHaveCount(1)
				await row.click()
				await expect(dialog.getByRole('heading', { name: `Player ${playerId}`, exact: true })).toBeVisible()
				await dialog.getByRole('button', { name: locale === 'zh-CN' ? '关闭' : 'Close', exact: true }).click()
				await expect(dialog).toHaveCount(0)
				await expect(row).toBeFocused()
				await row.press('Enter')
				await expect(dialog).toBeVisible()
				await page.keyboard.press('Escape')
				await expect(dialog).toHaveCount(0)
				await expect(row).toBeFocused()
			}
			await page.getByRole('link', { name: locale === 'zh-CN' ? '返回赛事' : 'Back to competition', exact: true }).click()
			await expect(page).toHaveURL(url => url.pathname === `${prefix}/live/competitions` && url.searchParams.get('tournamentId') === '6' && url.searchParams.get('gw') === '4')
			await expect(team).toBeVisible()
			await page.goBack()
			await expect(page).toHaveURL(url => url.pathname === `${prefix}/live/points/15702` && url.searchParams.get('tournamentId') === '6' && url.searchParams.get('gw') === '4')
			await expect(pitch.getByRole('button', { name: locale === 'zh-CN' ? /查看 Player/ : /View details for Player/ })).toHaveCount(15)
			await page.goForward()
			await expect(team).toBeVisible()

			return
		}
		if (recoveryMode === 'gw-route') {
			const historicalPoints = { ...points, grossPointsTotal: 33, netPointsTotal: 29,
				rows: points.rows.map(row => ({ ...row, entryName: 'GW3 Fixture United', grossPoints: 33, netPoints: 29 })) }
			const historicalPhase = { ...phase, endEventId: 3, revision: '3', semanticSha256: 'b'.repeat(64) }
			const historicalRules = [
				{ operation: 'GetMyTournamentGameweekReview', variables: { eventId: 3 }, data: { myTournamentGameweekReview: { state: 'READY', scope: { ...scope, eventId: 3, revision: '3', semanticSha256: historicalPhase.semanticSha256 }, payload: { format: 'POINTS', points: historicalPoints } } } },
				{ operation: 'GetMyTournamentSeasonReview', variables: { throughEventId: 3 }, data: { myTournamentSeasonReview: { state: 'READY', tournamentId: 77, throughEventId: 3, latestFinalizedEventId: 3, phases: [historicalPhase] } } },
				...rules
			]
			expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: historicalRules }) })).ok).toBe(true)
			await page.goto(`${routePath}?tournamentId=77&view=gameweek&gw=4`)
			await expect(page.getByRole('cell', { name: /Season Fixture United/ })).toBeVisible()
			let releaseNavigation!: () => void
			const navigationGate = new Promise<void>(resolve => { releaseNavigation = resolve })
			let gwRscRequests = 0
			await page.route(url => url.pathname === routePath && url.searchParams.has('_rsc') && url.searchParams.get('gw') === '3', async route => {
				gwRscRequests += 1
				await navigationGate
				await route.continue()
			})
			try {
				await page.getByRole('combobox').nth(1).selectOption('3')
				await expect(page.getByRole('cell', { name: /GW3 Fixture United/ })).toBeVisible()
				await expect(page).toHaveURL(url => url.searchParams.get('gw') === '3', { timeout: 1500 })
				expect(gwRscRequests).toBe(0)
			} finally {
				releaseNavigation()
				await page.unrouteAll({ behavior: 'wait' })
			}
			await page.getByRole('contentinfo').getByRole('link', { name: locale === 'zh-CN' ? '赛程' : 'Fixtures', exact: true }).click()
			await expect(page).toHaveURL(url => url.pathname === fixturesPath)
			await page.goBack()
			await expect(page).toHaveURL(url => url.searchParams.get('gw') === '3')
			await expect(page.getByRole('combobox').nth(1)).toHaveValue('3')
			await expect(page.getByRole('cell', { name: /GW3 Fixture United/ })).toBeVisible()
			await expect(page.getByRole('cell', { name: /Season Fixture United/ })).toHaveCount(0)
			await page.goForward()
			await expect(page).toHaveURL(url => url.pathname === fixturesPath)
			await page.goBack()
			await expect(page.getByRole('combobox').nth(1)).toHaveValue('3')
			await expect(page.getByRole('cell', { name: /GW3 Fixture United/ })).toBeVisible()
			await page.reload()
			await expect(page.getByRole('cell', { name: /GW3 Fixture United/ })).toBeVisible()
			await page.getByRole('combobox').nth(1).selectOption('4')
			await expect(page.getByRole('cell', { name: /Season Fixture United/ })).toBeVisible()
			let releaseSlowGw!: () => void
			const slowGw = new Promise<void>(resolve => { releaseSlowGw = resolve })
			await page.route('**/api/graphql', async route => {
				const payload = route.request().postDataJSON()
				if (payload.query?.includes('GetMyTournamentGameweekReview') && payload.variables.eventId === 3) await slowGw
				await route.continue()
			})
			const isSlowGw = (request: import('@playwright/test').Request) => request.url().endsWith('/api/graphql') && request.postDataJSON()?.query?.includes('GetMyTournamentGameweekReview') && request.postDataJSON()?.variables.eventId === 3
			const slowStarted = page.waitForRequest(isSlowGw)
			const slowFinished = page.waitForEvent('requestfinished', { predicate: isSlowGw })
			try {
				await page.getByRole('combobox').nth(1).selectOption('3')
				await slowStarted
				await page.getByRole('combobox').nth(1).selectOption('4')
				await expect(page.getByRole('cell', { name: /Season Fixture United/ })).toBeVisible()
				releaseSlowGw()
				await slowFinished
				await expect(page).toHaveURL(url => url.searchParams.get('gw') === '4')
				await expect(page.getByRole('combobox').nth(1)).toHaveValue('4')
				await expect(page.getByRole('cell', { name: /GW3 Fixture United/ })).toHaveCount(0)
				await expect(page.getByRole('cell', { name: /Season Fixture United/ })).toBeVisible()
			} finally {
				releaseSlowGw()
				await page.unrouteAll({ behavior: 'wait' })
			}
			return
		}
		if (recoveryMode === 'search-empty') {
			await page.setViewportSize(locale === 'zh-CN' ? { width: 390, height: 844 } : { width: 1440, height: 900 })
			await page.goto(`${routePath}?tournamentId=77&view=gameweek&gw=4`)
			await expect(page.getByRole('cell', { name: /Season Fixture United/ })).toBeVisible()
			await page.getByRole('textbox', { name: locale === 'zh-CN' ? '搜索赛事' : 'Search tournaments', exact: true }).fill('Fixture')
			await page.getByRole('button', { name: locale === 'zh-CN' ? '搜索' : 'Search', exact: true }).click()
			await expect(page.getByRole('button', { name: locale === 'zh-CN' ? '清除搜索' : 'Clear search', exact: true })).toBeVisible()
			await expect(page.getByRole('cell', { name: /Season Fixture United/ })).toBeVisible()
			await page.getByRole('combobox').first().selectOption('')
			await expect(page.getByRole('status')).toHaveText(locale === 'zh-CN' ? '选择赛事' : 'Select tournament')
			await expect(page.getByRole('combobox').first().locator('option[value="77"]')).toHaveCount(1)
			await page.getByRole('combobox').first().selectOption('77')
			await expect(page.getByRole('cell', { name: /Season Fixture United/ })).toBeVisible()
			const emptyRule = { operation: 'GetMyTournamentReviewCatalog', variables: { search: 'no-match' }, data: { myTournamentReviewCatalog: { state: 'READY', asOf: phase.publishedAt, viewerEntryId: 123, adminReadAll: true, pageInfo, edges: [] } } }
			expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [emptyRule, ...rules] }) })).ok).toBe(true)
			await page.getByRole('textbox', { name: locale === 'zh-CN' ? '搜索赛事' : 'Search tournaments', exact: true }).fill('no-match')
			await page.getByRole('button', { name: locale === 'zh-CN' ? '搜索' : 'Search', exact: true }).click()
			await expect(page.getByRole('status')).toHaveText(locale === 'zh-CN' ? '没有赛事符合搜索条件。请修改或清除搜索。' : 'No tournaments match your search. Change or clear the search.')
			await expect(page.getByText(locale === 'zh-CN' ? '此 FPL 账户尚未关联 LetLetMe 赛事。' : 'No LetLetMe tournaments are linked to this FPL entry.', { exact: true })).toHaveCount(0)
			await expect(page.getByText(locale === 'zh-CN' ? '该赛事暂未提供已结算复盘。未结算数据请前往 Live 查看。' : 'This tournament does not yet have a finalized review. Open Live for unsettled results.', { exact: true })).toHaveCount(0)
			await page.getByRole('button', { name: locale === 'zh-CN' ? '清除搜索' : 'Clear search', exact: true }).click()
			await expect(page.getByRole('cell', { name: /Season Fixture United/ })).toBeVisible()
			await expect(page.getByRole('textbox', { name: locale === 'zh-CN' ? '搜索赛事' : 'Search tournaments', exact: true })).toHaveValue('')
			return
		}
		if (partialSsrSeed) {
			const partialRules = rules.map(rule => 'variables' in rule && rule.variables?.section === 'POINTS_TRAJECTORIES'
				? recoveryMode === 'failed-ssr-seed'
					? { operation: rule.operation, variables: rule.variables, error: true }
					: { ...rule, data: { myTournamentSeasonReviewSection: { ...phase, state: 'DEGRADED', tournamentId: 77, throughEventId: 4, section: 'POINTS_TRAJECTORIES', points: null, h2h: null, knockout: null, pageInfo } } }
				: rule)
			expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: partialRules }) })).ok).toBe(true)
			await page.goto(`${routePath}?tournamentId=77&gw=4`)
			const retry = page.getByRole('button', { name: 'Retry this phase', exact: true })
			await expect(retry).toBeVisible()
			await expect(page.getByRole('cell', { name: /Season Fixture United/ })).toBeVisible()
			await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
			expect(sectionRequests).toBe(0)
			const seeded = await (await fetch(fixture)).json()
			expect(seeded.requests.filter((item: { operation: string }) => item.operation === 'GetMyTournamentSeasonReviewSection')).toHaveLength(2)
			expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules }) })).ok).toBe(true)
			releaseSections()
			await retry.click()
			await expect.poll(() => sectionRequests).toBe(2)
			await expect(retry).toHaveCount(0)
			await expect(page.getByRole('cell', { name: /Season Fixture United/ })).toBeVisible()
			return
		}
		await page.goto(`${routePath}?tournamentId=77&view=gameweek&gw=4`)
		await expect(page.getByRole('cell', { name: /Season Fixture United/ })).toBeVisible()
		const observations = await (await fetch(fixture)).json()
		expect(observations.requests.filter((item: { operation: string }) => item.operation === 'GetMyTournamentSeasonReviewSection')).toHaveLength(0)
		page.on('request', request => {
			const url = new URL(request.url())
			if (url.pathname === routePath && url.searchParams.has('_rsc')) viewNavigationRequests += 1
		})
		const season = page.getByRole('tab', { name: locale === 'zh-CN' ? '赛季' : 'Season', exact: true })
		const gameweek = page.getByRole('tab', { name: locale === 'zh-CN' ? '轮次' : 'Gameweek', exact: true })
		await season.click()
		await expect.poll(() => sectionRequests).toBe(2)
		expect(viewNavigationRequests).toBe(0)
		await expect(page.getByText(locale === 'zh-CN' ? '已结算发布缺少对应赛制数据。' : 'The finalized publication has no format payload.', { exact: true })).toHaveCount(0)
		await gameweek.click()
		await expect(page.getByRole('cell', { name: /Season Fixture United/ })).toBeVisible()
		await season.click()
		expect(sectionRequests).toBe(2)
		releaseSections()
		if (failFirstSections) {
			await expect(page.getByText('Tournament review is temporarily unavailable. Please try again.', { exact: true })).toBeVisible()
			await expect(page.getByRole('button', { name: 'Retry this phase', exact: true })).toBeVisible()
			if (recoveryMode === 'retry-button') {
				await page.getByRole('button', { name: 'Retry this phase', exact: true }).click()
			} else {
				await gameweek.click()
				await expect(page.getByRole('cell', { name: /Season Fixture United/ })).toBeVisible()
				await season.click()
			}
			await expect.poll(() => sectionRequests).toBe(4)
		}
		await expect(page.getByRole('cell', { name: /Season Fixture United/ })).toBeVisible()
		await gameweek.click()
		await season.click()
		await expect(page.getByRole('cell', { name: /Season Fixture United/ })).toBeVisible()
		expect(sectionRequests).toBe(failFirstSections ? 4 : 2)
		await expect(page).toHaveURL(url =>
			url.pathname === routePath &&
			url.searchParams.get('tournamentId') === '77' &&
			url.searchParams.get('view') === null &&
			url.searchParams.get('gw') === '4'
		)
		expect(viewNavigationRequests).toBe(0)
		await page.reload()
		await expect(season).toHaveAttribute('aria-selected', 'true')
		await expect(page.getByRole('cell', { name: /Season Fixture United/ })).toBeVisible()
		expect(sectionRequests).toBe(failFirstSections ? 4 : 2)
		await expect(page.getByText(locale === 'zh-CN' ? '已结算发布缺少对应赛制数据。' : 'The finalized publication has no format payload.', { exact: true })).toHaveCount(0)
		await gameweek.click()
		await expect(gameweek).toHaveAttribute('aria-selected', 'true')
		await page.getByRole('contentinfo').getByRole('link', { name: locale === 'zh-CN' ? '赛程' : 'Fixtures', exact: true }).click()
		await expect(page).toHaveURL(url => url.pathname === fixturesPath)
		await page.goBack()
		await expect(gameweek).toHaveAttribute('aria-selected', 'true')
		await expect(page.getByRole('cell', { name: /Season Fixture United/ })).toBeVisible()
		await expect(page).toHaveURL(url => url.pathname === routePath && url.searchParams.get('tournamentId') === '77' && url.searchParams.get('gw') === '4' && url.searchParams.get('view') === 'gameweek')
		await page.goForward()
		await expect(page).toHaveURL(url => url.pathname === fixturesPath)
		await page.goBack()
		await page.reload()
		await expect(gameweek).toHaveAttribute('aria-selected', 'true')
		await season.click()
		await expect(season).toHaveAttribute('aria-selected', 'true')
		await expect(page.getByRole('cell', { name: /Season Fixture United/ })).toBeVisible()
		await page.getByRole('contentinfo').getByRole('link', { name: locale === 'zh-CN' ? '赛程' : 'Fixtures', exact: true }).click()
		await expect(page).toHaveURL(url => url.pathname === fixturesPath)
		await page.goBack()
		await expect(season).toHaveAttribute('aria-selected', 'true')
		await expect(page).toHaveURL(url => url.pathname === routePath && !url.searchParams.has('view'))
		await expect(page.getByRole('cell', { name: /Season Fixture United/ })).toBeVisible()
	} finally {
		releaseSections()
		await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
		await session.cleanup()
	}
})

}

}


for (const locale of ['en', 'zh-CN']) {
	test(`personal league carousel covers navigation pause focus and full list [${locale}]`, async ({ page }) => {
		test.skip(process.env.E2E_SSR_REMEDIATION !== '1', 'Uses isolated fixture controls')
		const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
		const session = await createSession({ entryId: 15702 })
		const zh = locale === 'zh-CN'
		const leagues = Array.from({ length: 13 }, (_, i) => ({
			key: `${i === 12 ? 'h2h' : 'classic'}:${400 + i}`, name: `Carousel League ${i + 1}`,
			leagueType: i === 12 ? 'H2H' : 'CLASSIC', visibility: 'PUBLIC', rank: i + 1,
			rankState: 'READY', rankCheckedAt: '2026-09-16T00:00:00Z', movement: { direction: 'FLAT', places: 0 },
			tournamentId: null, h2hMatchup: null
		}))
		const desk = { state: 'READY', entryName: 'Carousel United', playerName: 'Fixture Manager', region: 'Australia', overallPoints: 1234, pointsState: 'FINAL', pointsCheckedAt: '2026-09-16T00:00:00Z', overallRank: 56789, rankState: 'READY', rankCheckedAt: '2026-09-16T00:00:00Z', teamValue: 1005, bank: 15, leagueRanks: leagues, sourceCheckedAt: '2026-09-16T00:00:00Z' }
		try {
			expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [{ operation: 'GetHomePersonalDesk', data: { homePersonalDesk: desk } }] }) })).ok).toBe(true)
			await page.setViewportSize(zh ? { width: 390, height: 844 } : { width: 1440, height: 900 })
			await page.clock.install()
			await addSessionCookie(page, session.cookie)
			await page.goto(zh ? '/zh-CN' : '/')
			const carousel = page.locator('[data-home-carousel="personal-league"]')
			const classic = carousel.getByRole('tab', { name: zh ? /积分联赛/ : /Classic/ })
			const h2h = carousel.getByRole('tab', { name: zh ? /对战联赛/ : /H2H/ })
			const heading = page.getByRole('heading', { level: 1 })
			await expect(classic).toHaveAttribute('aria-selected', 'true')
			await carousel.getByRole('button', { name: zh ? '下一个联赛分类' : 'Next league group', exact: true }).click()
			await expect(h2h).toHaveAttribute('aria-selected', 'true')
			await expect(carousel.getByText('Carousel League 13', { exact: true })).toBeVisible()
			await carousel.getByRole('button', { name: zh ? '上一个联赛分类' : 'Previous league group', exact: true }).click()
			await expect(classic).toHaveAttribute('aria-selected', 'true')
			await carousel.getByRole('button', { name: zh ? '暂停自动切换联赛分类' : 'Pause automatic league rotation', exact: true }).click()
			await heading.click()
			await page.clock.fastForward(14_100)
			await expect(classic).toHaveAttribute('aria-selected', 'true')
			await carousel.getByRole('button', { name: zh ? '继续自动切换联赛分类' : 'Resume automatic league rotation', exact: true }).click()
			await heading.click()
			await page.clock.fastForward(7_100)
			await expect(h2h).toHaveAttribute('aria-selected', 'true')
			await classic.click()
			await heading.click()
			await carousel.hover()
			await page.clock.fastForward(7_100)
			await expect(classic).toHaveAttribute('aria-selected', 'true')
			await page.mouse.move(0, 0)
			await page.clock.fastForward(7_100)
			await expect(h2h).toHaveAttribute('aria-selected', 'true')
			await classic.click()
			await classic.press('ArrowRight')
			await expect(h2h).toBeFocused()
			await page.mouse.move(0, 0)
			await page.clock.fastForward(7_100)
			await expect(h2h).toHaveAttribute('aria-selected', 'true')
			await classic.click()
			await carousel.getByRole('button', { name: zh ? '查看全部 12 个' : 'View all 12', exact: true }).click()
			const dialog = page.getByRole('dialog')
			await expect(dialog).toBeVisible()
			await expect(dialog.getByText('Carousel League 12', { exact: true })).toBeVisible()
			await expect(dialog.getByText(/^Carousel League \d+$/)).toHaveCount(12)
			await page.clock.fastForward(7_100)
			await expect(dialog.getByRole('heading', { name: zh ? '积分联赛' : 'Classic', exact: true })).toBeVisible()
			await dialog.getByRole('button', { name: zh ? '关闭' : 'Close', exact: true }).click()
			await expect(dialog).toHaveCount(0)
			await expect(carousel.getByRole('button', { name: zh ? '查看全部 12 个' : 'View all 12', exact: true })).toBeFocused()
			await carousel.getByRole('button', { name: zh ? '查看全部 12 个' : 'View all 12', exact: true }).click()
			await expect(dialog).toBeVisible()
			await page.keyboard.press('Escape')
			await expect(dialog).toHaveCount(0)
			await expect(carousel.getByRole('button', { name: zh ? '查看全部 12 个' : 'View all 12', exact: true })).toBeFocused()
		} finally {
			await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
			await session.cleanup()
		}
	})
}

for (const width of [1440, 390]) {
 for (const failure of [false, true]) {
 test(`canonical competition board sort and pagination preserve request scope at ${width}px${failure ? ' with next-page failure recovery' : ''}`, async ({ page }) => {
  test.skip(process.env.E2E_SSR_REMEDIATION !== '1', 'Uses isolated board fixtures')
  const session = await createSession({ entryId: 123 })
  const inputs: Array<{ sort?: string; direction?: string; after?: string | null }> = []
  let failedNextPage = 0
  let boardRevision = 'e2e-competition-score-v1'
  let contentVersion = 1
  const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
  try {
   const liveSeed = await (await fetch(fixture.replace('/__performance', '/graphql'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'query GetLiveContext { __typename }' }) })).json()
   expect(liveSeed.errors).toBeUndefined()
   Object.assign(liveSeed.data.coreEventContext, { currentEventId: 4, nextEventId: 5, latestFinishedEventId: 3 })
   Object.assign(liveSeed.data.liveContext, { eventId: 4, nextEventId: 5, anchorEventId: 4, latestFinalizedEventId: 3 })
   expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [{ operation: 'GetLiveContext', data: liveSeed.data }, { operation: 'GetEntryTournaments', data: { entryTournaments: [6, 7].map(id => ({ ...managedTournament, id, name: `Coverage League ${id}`, adminEntryId: 15702 })) } }] }) })).ok).toBe(true)
   await page.setViewportSize({ width, height: 900 })
   await addSessionCookie(page, session.cookie)
   await page.route('**/api/live/competitions/6/board', async route => {
    const payload = route.request().postDataJSON()
    expect(payload.eventId).toBe(4)
    const input = payload.input ?? {}
    inputs.push(input)
    if (failure && input.after && failedNextPage < 2) {
     failedNextPage += 1
     await route.fulfill({ status: 503, headers: { 'retry-after': '1' }, json: { error: 'DEPENDENCY_UNAVAILABLE' } })
     return
    }
    const response = await route.fetch()
    expect(response.ok()).toBe(true)
    const body = await response.json()
    const board = body.entryLiveCompetitionBoard
    board.head.contentRevision = `${boardRevision}-content-${contentVersion}`
    board.head.publication.revisions.scoreCore = boardRevision
    board.rows[0].score.revisions.scoreCore = boardRevision
    const template = board.rows[0]
    const rows = [
     { ...template, entry: 15702, entryName: 'Alpha Coverage', score: { ...template.score, eventPoints: 30, totalPoints: 100 } },
     { ...template, entry: 15703, entryName: 'Beta Coverage', score: { ...template.score, eventPoints: 20, totalPoints: 300 } },
     { ...template, entry: 15704, entryName: 'Gamma Coverage', chip: 'TRIPLE_CAPTAIN', played: 9, overallRank: 999, score: { ...template.score, eventPoints: 10, totalPoints: 200 } }
    ]
    if (input.sort === 'TOTAL_POINTS') rows.sort((a, b) => input.direction === 'ASC' ? a.score.totalPoints - b.score.totalPoints : b.score.totalPoints - a.score.totalPoints)
    const after = input.after != null
    if (after) expect(input.after).toBe('coverage-page-2')
    board.rows = after ? rows.slice(2) : rows.slice(0, 2)
    board.viewerRow = null
    board.totalEntries = 3
    board.filteredEntries = 3
    board.pageInfo = { hasNextPage: !after, endCursor: after ? null : 'coverage-page-2' }
    await route.fulfill({ response, json: body })
   })
   await page.clock.install()
   await page.goto('/live/competitions?tournamentId=6&gw=4')
   const teams = page.getByRole('link', { name: /(?:Alpha|Beta|Gamma) Coverage/ }).filter({ visible: true })
   await expect(teams).toHaveCount(2)
   await expect(teams.nth(0)).toContainText('Alpha Coverage')
   await page.getByRole('button', { name: 'Compare', exact: true }).click()
   const selectedAlpha = page.getByRole('checkbox', { name: 'Select Alpha Coverage for comparison', exact: true }).filter({ visible: true })
   await selectedAlpha.check()
   if (failure) await page.clock.pauseAt(new Date(Date.now() + 1_000))
   await page.getByRole('button', { name: 'Show 1 more', exact: true }).click()
   if (failure) {
    await expect.poll(() => failedNextPage).toBe(1)
    await expect.poll(() => page.evaluate(() => Number(sessionStorage.getItem('letletme:dependency-cooldown-until-v1')) > Date.now())).toBe(true)
    await page.clock.runFor(1_100)
    const warning = page.getByText('Refresh failed. The last available standings are still shown.', { exact: true })
    await expect(warning).toBeVisible()
    await expect(teams).toHaveText([/Alpha Coverage/, /Beta Coverage/])
    await test.info().attach('pagination-retry-clock', { body: JSON.stringify(await page.evaluate(() => ({ now: Date.now(), cooldownUntil: sessionStorage.getItem('letletme:dependency-cooldown-until-v1'), failureAt: sessionStorage.getItem('letletme:dependency-cooldown-failure-at-v1') }))), contentType: 'application/json' })
    expect(inputs.filter(input => input.after === 'coverage-page-2')).toHaveLength(2)
    // Advance the same browser clock used by Retry-After and the cooldown fence.
    await page.clock.runFor(1_100)
    await page.clock.resume()
    await page.getByRole('button', { name: 'Show 1 more', exact: true }).click()
    await expect(warning).toHaveCount(0)
    expect(inputs.filter(input => input.after === 'coverage-page-2')).toHaveLength(3)
   }
   await expect(teams).toHaveCount(3)
   await expect(teams.nth(2)).toContainText('Gamma Coverage')
   expect(inputs.at(-1)).toMatchObject({ after: 'coverage-page-2' })
   await expect(selectedAlpha).toBeChecked()
   await page.getByRole('checkbox', { name: 'Select Gamma Coverage for comparison', exact: true }).filter({ visible: true }).check()
   await expect(page.getByRole('checkbox', { name: 'Select Beta Coverage for comparison', exact: true }).filter({ visible: true })).toBeDisabled()
   let comparisonAttempts = 0
   await page.route('**/api/live/competitions/6/compare?*', async route => {
    comparisonAttempts += 1
    if (comparisonAttempts === 1) {
     await route.fulfill({ status: 409, json: { error: 'LIVE_SCORE_REVISION_GONE' } })
    } else {
     const response = await route.fetch()
     const body = await response.json()
     const gamma = body.tournamentEntrySquads.entries.find((entry: { entry: number }) => entry.entry === 15704)
     gamma.entryName = contentVersion === 3 ? 'Live Updated Gamma' : 'Rank Updated Gamma'
     gamma.rank = { overallRank: contentVersion === 3 ? 555 : 777 }
     await route.fulfill({ response, json: body })
    }
   })
   const refreshedBoard = page.waitForResponse(response => new URL(response.url()).pathname === '/api/live/competitions/6/board' && !response.request().postDataJSON()?.input?.after)
   await page.getByRole('button', { name: 'Compare (2)', exact: true }).click()
   expect((await refreshedBoard).status()).toBe(200)
   await expect(page.getByRole('dialog')).toBeVisible()
   await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible()
   expect(comparisonAttempts).toBe(1)
   const compared = page.waitForResponse(response => response.url().includes('/api/live/competitions/6/compare?'))
   await page.getByRole('dialog').getByRole('button', { name: 'Refresh', exact: true }).click()
   const comparisonResponse = await compared
   expect(comparisonAttempts).toBe(2)
   expect(comparisonResponse.status()).toBe(200)
   const comparisonUrl = new URL(comparisonResponse.url())
   expect(comparisonUrl.searchParams.get('entryIds')?.split(',').sort()).toEqual(['15702', '15704'])
   expect(comparisonUrl.searchParams.get('eventId')).toBe('4')
   const sheet = page.getByRole('dialog')
   await expect(sheet.getByRole('heading')).toContainText('Alpha Coverage')
   await expect(sheet.getByRole('heading')).toContainText('Gamma Coverage')
   expect(comparisonUrl.searchParams.get('scoreCoreRevision')).toBe('e2e-competition-score-v1')
   await expect(sheet.getByText('Player 15', { exact: true })).toHaveCount(2)
   await expect(sheet.getByText('999', { exact: true })).toHaveCount(1)
   await expect(sheet.getByText('TC', { exact: true })).toHaveCount(1)
   await expect(sheet.getByText('9/11', { exact: true })).toHaveCount(1)
   await page.route('**/api/live/competitions/6/head', async route => {
    const response = await route.fetch()
    const payload = await response.json()
    const head = payload.leagueLiveHead ?? payload
    head.contentRevision = `${boardRevision}-content-${contentVersion}`
    await route.fulfill({ response, json: payload })
   })
   contentVersion = 3
   const automaticBoard = page.waitForResponse(response => new URL(response.url()).pathname === '/api/live/competitions/6/board')
   await page.clock.fastForward(140_000)
   expect((await automaticBoard).status()).toBe(200)
   await expect(sheet).toBeVisible()
   await expect(sheet.getByRole('heading')).toContainText('Live Updated Gamma')
   await expect(sheet.getByText('555', { exact: true })).toHaveCount(1)
   await expect(sheet.getByText('999', { exact: true })).toHaveCount(0)
   await expect(sheet.getByText('TC', { exact: true })).toHaveCount(0)
   await expect(sheet.getByText('9/11', { exact: true })).toHaveCount(0)
   await page.unroute('**/api/live/competitions/6/head')

   await sheet.press('Escape')
   await expect(sheet).toHaveCount(0)
   await page.unroute('**/api/live/competitions/6/compare?*')
   const revisions: string[] = []
   await page.route('**/api/live/competitions/6/compare?*', async route => {
    const revision = new URL(route.request().url()).searchParams.get('scoreCoreRevision')!
    revisions.push(revision)
    if (revision.endsWith('-v1')) {
     boardRevision = 'e2e-competition-score-v2'
     await route.fulfill({ status: 409, json: { error: 'LIVE_SCORE_REVISION_GONE' } })
    } else {
     const response = await route.fetch()
     const body = await response.json()
     body.tournamentEntrySquads.entries.find((entry: { entry: number }) => entry.entry === 15704).entryName = 'Updated Gamma'
     await route.fulfill({ response, json: body })
    }
   })
   await page.getByRole('button', { name: 'Compare (2)', exact: true }).click()
   await expect(sheet.getByRole('heading')).toContainText('Updated Gamma')
   await expect(sheet.getByRole('heading')).not.toContainText('Gamma Coverage')
   await expect(sheet.getByText('77', { exact: true })).toHaveCount(4)
   await expect(sheet.getByText('TC', { exact: true })).toHaveCount(0)
   await expect(sheet.getByText('9/11', { exact: true })).toHaveCount(0)
   await expect(sheet.getByText('999', { exact: true })).toHaveCount(0)
   await expect(sheet.getByText('Player 15', { exact: true })).toHaveCount(2)
   await expect(sheet.getByRole('alert')).toHaveCount(0)
   expect(revisions).toEqual(['e2e-competition-score-v1', 'e2e-competition-score-v2'])
   await sheet.press('Escape')
   await expect(sheet).toHaveCount(0)
   await page.getByRole('button', { name: 'Cancel', exact: true }).click()
   await page.getByRole('combobox', { name: 'Sort competition standings', exact: true }).click()
   await page.getByRole('option', { name: 'Total Pts', exact: true }).click()
   await expect(teams).toHaveCount(2)
   await expect(teams.nth(0)).toContainText('Beta Coverage')
   await expect(teams.nth(1)).toContainText('Gamma Coverage')
   expect(inputs.at(-1)).toMatchObject({ sort: 'TOTAL_POINTS', direction: 'DESC' })
   expect(inputs.at(-1)?.after ?? null).toBeNull()
   await page.getByRole('button', { name: 'Desc', exact: true }).click()
   await expect(teams.nth(0)).toContainText('Alpha Coverage')
   await expect(teams.nth(1)).toContainText('Gamma Coverage')
   expect(inputs.at(-1)).toMatchObject({ sort: 'TOTAL_POINTS', direction: 'ASC' })
   await expect(page).toHaveURL(url => url.searchParams.get('tournamentId') === '6' && url.searchParams.get('gw') === '4')
   await page.getByRole('button', { name: 'Compare', exact: true }).click()
   await page.getByRole('checkbox', { name: 'Select Gamma Coverage for comparison', exact: true }).filter({ visible: true }).check()
   await expect(page.getByText('Select 1 more to compare', { exact: true })).toBeVisible()
   await page.getByRole('button', { name: 'Classic', exact: true }).click()
   const switched = page.waitForResponse(response => new URL(response.url()).pathname === '/api/live/competitions/7/board')
   await page.getByRole('menuitem', { name: 'Coverage League 7', exact: true }).click()
   const switchedResponse = await switched
   expect(switchedResponse.status()).toBe(200)
   expect((await switchedResponse.json()).entryLiveCompetitionBoard.head).toMatchObject({ tournamentId: 7, eventId: 4 })
   await expect(page).toHaveURL(url => url.searchParams.get('tournamentId') === '7' && url.searchParams.get('gw') === '4')
   await expect(page.getByRole('link', { name: /E2E United/ }).filter({ visible: true })).toHaveCount(1)
   await expect(page.getByRole('button', { name: 'Compare', exact: true })).toBeVisible()
   await expect(page.getByText('Select 1 more to compare', { exact: true })).toHaveCount(0)
   await page.getByRole('button', { name: 'Compare', exact: true }).click()
   await expect(page.getByText('Select 2 teams', { exact: true })).toBeVisible()
   await expect(page.getByRole('checkbox', { name: 'Select E2E United for comparison', exact: true }).filter({ visible: true })).not.toBeChecked()
  } finally {
   await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
   await session.cleanup()
  }
 })
}
}

for (const locale of ['en', 'zh-CN']) {
	for (const width of [1440, 390]) {
		test(`J14 isolated bound profile and session journey ${locale} ${width}px`, async ({ page }) => {
			test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Requires isolated server FPL fixture')
			const zh = locale === 'zh-CN'
			const prefix = zh ? '/zh-CN' : ''
			const session = await createSession({ entryId: 15702 })
			const sql = postgres(process.env.E2E_DIRECT_DATABASE_URL!, { max: 1, prepare: false })
			const otherSessionId = `j14-other-${randomUUID()}`
			const writes: string[] = []
			page.on('request', request => {
				if (request.url().includes('/api/auth/') && request.method() !== 'GET') writes.push(new URL(request.url()).pathname)
			})
			try {
				await sql`INSERT INTO bauth.session (id, expires_at, token, user_id, user_agent) VALUES (${otherSessionId}, ${new Date(Date.now() + 3600000)}, ${randomUUID()}, ${session.userId}, 'Mozilla/5.0 (Windows NT 10.0) Firefox/130.0')`
				await addSessionCookie(page, session.cookie)
				await page.setViewportSize({ width, height: 900 })
				await page.goto(`${prefix}/explore/gameweek`)
				const nav = page.getByRole('navigation').first()
				const profileHref = `${prefix}/profile`
				if (width === 390) await nav.locator('[data-navigation-mobile] > summary').click()
				else await nav.locator('details').filter({ has: page.locator(`a[href="${profileHref}"]`) }).locator('summary').filter({ visible: true }).click()
				const profileLink = nav.locator(`a[href="${profileHref}"]`).filter({ visible: true })
				await expect(profileLink).toHaveCount(1)
				await profileLink.click()
				await expect(page).toHaveURL(url => url.pathname === profileHref)
				await expect(nav.locator('details[open]')).toHaveCount(0)
				const main = page.locator('#main-content')
				await expect(main).toContainText('E2E Synced United')
				await expect(main).toContainText('Fixture Manager')
				await expect(main).toContainText('E2E United')
				const [identity] = await sql`SELECT fpl_team_name, fpl_manager_name FROM bauth."user" WHERE id=${session.userId}`
				expect(identity).toEqual({ fpl_team_name: 'E2E Synced United', fpl_manager_name: 'Fixture Manager' })
				await main.locator(`a[href="${prefix}/profile/sessions"]`).click()
				await expect(page).toHaveURL(url => url.pathname === `${prefix}/profile/sessions`)
				await expect(main.getByText(zh ? '当前设备' : 'This device', { exact: true })).toBeVisible()
				await expect(main.getByText(zh ? '当前设备' : 'This device', { exact: true })).toHaveCount(1)
				await expect(main.getByText(/Firefox.*Windows/)).toBeVisible()
				await main.locator(`a[href="${profileHref}"]`).click()
				await expect(main).toContainText('E2E Synced United')
				await main.locator(`a[href="${prefix}/auth/forgot-password"]`).click()
				await expect(page).toHaveURL(url => url.pathname === `${prefix}/auth/forgot-password`)
				await main.getByLabel(zh ? '邮箱' : 'Email', { exact: true }).fill('j14@example.test')
				await main.getByRole('link', { name: zh ? '返回登录' : 'Back to login', exact: true }).click()
				await expect(page).toHaveURL(url => url.pathname === `${prefix}/auth/login`)
				expect(writes).toEqual([])
				await sql`UPDATE bauth.session SET expires_at=${new Date(Date.now() - 60000)} WHERE user_id=${session.userId}`
				for (const protectedPath of ['/profile', '/profile/sessions']) {
					await page.goto(`${prefix}${protectedPath}`)
					await expect(page).toHaveURL(url => url.pathname === `${prefix}/auth/login` && url.searchParams.get('next') === `${prefix}${protectedPath}`)
					await expect(main).not.toContainText('E2E Synced United')
					await expect(main.getByLabel(zh ? '邮箱' : 'Email', { exact: true })).toBeVisible()
				}
				expect(writes).toEqual([])
			} finally {
				await sql`DELETE FROM bauth.session WHERE id=${otherSessionId}`
				await sql`DELETE FROM bauth.fpl_entry_name_history WHERE user_id=${session.userId}`
				await sql.end()
				await session.cleanup()
			}
		})
	}
}

for (const locale of ['en', 'zh-CN'] as const) {
 for (const width of [1440, 390]) {
  test(`J19 legacy redirects and browser history ${locale} ${width}px`, async ({ page }, testInfo) => {
   test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_LIVE_HYDRATION !== '1', 'Requires isolated live fixtures and database')
   const prefix = locale === 'zh-CN' ? '/zh-CN' : ''
   const session = await createSession({ entryId: 15702 })
   const documents: { path: string; status: number; location: string | null }[] = []
   page.on('response', response => {
    if (response.request().resourceType() !== 'document') return
    const url = new URL(response.url())
    documents.push({ path: url.pathname + url.search, status: response.status(), location: response.headers().location ?? null })
   })
   try {
    await page.setViewportSize({ width, height: 900 })
    await addSessionCookie(page, session.cookie)
    const predictions = `${prefix}/explore/price-predictions`
    const assertPredictions = async () => {
     await expect(page).toHaveURL(url => url.pathname === predictions)
     await expect(page.getByRole('combobox', { name: locale === 'zh-CN' ? '预测范围' : 'Prediction scope', exact: true })).toBeEnabled()
     const saka = page.getByRole('main').getByRole('link', { name: 'Saka', exact: true }).filter({ visible: true })
     await expect(saka).toHaveCount(1)
     await expect(saka).toHaveAttribute('href', `${prefix}/explore/player-stats?p1=1`)
    }
    await page.goto(predictions)
    await assertPredictions()
    await page.goto(`${prefix}/competitions/6?gw=1&created=1`)
    await expect(page).toHaveURL(url => url.pathname === `${prefix}/live/competitions` && url.searchParams.get('tournamentId') === '6' && url.searchParams.get('created') === '1' && url.searchParams.get('gw') === '1')
    const board = page.locator('[data-competition-perf-ready="detail"][data-competition-tournament-id="6"][data-competition-gameweek="1"]')
    const team = board.getByRole('link', { name: 'E2E United Test Manager', exact: true }).filter({ visible: true })
    await expect(team).toHaveCount(1)
    await expect(team).toHaveAttribute('href', `${prefix}/live/points/15702?tournamentId=6&gw=1`)
    expect(documents.some(item => item.path === `${prefix}/competitions/6?gw=1&created=1`)).toBe(true)
    expect(documents.some(item => item.path === `/${locale}/live/competitions/6?gw=1&created=1`)).toBe(true)
    await page.goBack()
    await assertPredictions()
    await page.goForward()
    await expect(team).toBeVisible()
    await page.goto(`${prefix}/explore/price-changes`)
    await assertPredictions()
    expect(documents.some(item => item.path === `${prefix}/explore/price-changes`)).toBe(true)
    await testInfo.attach('legacy-document-chain', { body: JSON.stringify(documents, null, 2), contentType: 'application/json' })
   } finally { await session.cleanup() }
  })
 }
}

for (const locale of ['en', 'zh-CN'] as const) {
 for (const width of [1440, 390]) {
  test(`J19 invalid legacy IDs never render a board ${locale} ${width}px`, async ({ page }) => {
   test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Requires isolated fixture database')
   const prefix = locale === 'zh-CN' ? '/zh-CN' : ''
   const session = await createSession({ entryId: 15702 })
   try {
    await page.setViewportSize({ width, height: 900 })
    await addSessionCookie(page, session.cookie)
    for (const id of ['0', '-1', 'abc', '1.5', '9007199254740992']) {
     const response = await page.goto(`${prefix}/competitions/${id}?gw=1&created=1`)
     expect(response).not.toBeNull()
     if (!id.includes('.')) {
      expect(response!.headers()['cache-control']).toContain('private')
      expect(response!.headers()['cache-control']).toContain('no-store')
     }
     // Next streamed not-found responses can retain HTTP 200; require the explicit 404 payload.
     expect([200, 404]).toContain(response!.status())
     if (response!.status() === 200) {
      expect(await response!.text()).toContain('NEXT_HTTP_ERROR_FALLBACK;404')
     }
     await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached()
     await expect(page).toHaveURL(url => url.pathname === `${prefix}/competitions/${id}`)
     // Dotted paths bypass the locale middleware matcher; an unprefixed path uses Next's root 404.
     const title = locale === 'zh-CN' ? '找不到页面' : id.includes('.') ? 'This page could not be found.' : 'Page not found'
     await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
     await expect(page.locator('[data-competition-perf-ready="detail"]')).toHaveCount(0)
     await expect(page.getByRole('link', { name: 'E2E United Test Manager', exact: true })).toHaveCount(0)
    }
   } finally { await session.cleanup() }
  })
 }
}

test.describe('J19 planned UTC dark mobile states', () => {
 test.use({ timezoneId: 'UTC', colorScheme: 'dark', viewport: { width: 390, height: 900 } })
 test('valid-id, legacy-link and invalid-id keep their terminal contracts', async ({ page }, testInfo) => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_LIVE_HYDRATION !== '1', 'Requires isolated live fixtures and database')
  const session = await createSession({ entryId: 15702 })
  try {
   await addSessionCookie(page, session.cookie)
   await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
   await page.goto('/zh-CN/competitions/6?gw=1&created=1')
   await expect(page).toHaveURL(url => url.pathname === '/zh-CN/live/competitions' && url.searchParams.get('tournamentId') === '6' && url.searchParams.get('gw') === '1' && url.searchParams.get('created') === '1')
   const board = page.locator('[data-competition-perf-ready="detail"][data-competition-tournament-id="6"][data-competition-gameweek="1"]')
   await expect(board.getByRole('link', { name: 'E2E United Test Manager', exact: true }).filter({ visible: true })).toHaveCount(1)
   await expect(page.locator('html')).toHaveClass(/dark/)
   expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('UTC')
   await page.goto('/zh-CN/explore/price-changes')
   await expect(page).toHaveURL(url => url.pathname === '/zh-CN/explore/price-predictions')
   await expect(page.getByRole('combobox', { name: '预测范围', exact: true })).toBeEnabled()
   await expect(page.getByRole('main').getByRole('link', { name: 'Saka', exact: true }).filter({ visible: true })).toHaveAttribute('href', '/zh-CN/explore/player-stats?p1=1')
   const invalidResults: { id: string; status: number }[] = []
   for (const id of ['0', '-1', 'abc', '1.5', '9007199254740992']) {
    const response = await page.goto(`/zh-CN/competitions/${id}?gw=1&created=1`)
    expect(response).not.toBeNull()
    expect([200, 404]).toContain(response!.status())
    if (response!.status() === 200) expect(await response!.text()).toContain('NEXT_HTTP_ERROR_FALLBACK;404')
    await expect(page).toHaveURL(url => url.pathname === `/zh-CN/competitions/${id}`)
    await expect(page.getByRole('heading', { name: '找不到页面', exact: true })).toBeVisible()
    await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached()
    await expect(page.locator('[data-competition-perf-ready="detail"]')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'E2E United Test Manager', exact: true })).toHaveCount(0)
    await expect(page.locator('html')).toHaveClass(/dark/)
    invalidResults.push({ id, status: response!.status() })
   }
   await testInfo.attach('J19-state-variants', { body: JSON.stringify({ variantIds: ['J19.state.01', 'J19.state.02', 'J19.state.03'], locale: 'zh-CN', viewport: page.viewportSize(), timezone: 'UTC', theme: 'dark', invalidResults }), contentType: 'application/json' })
  } finally { await session.cleanup() }
 })
})

for (const locale of ['en', 'zh-CN'] as const) {
 for (const width of [1440, 390]) {
  test(`J16 unbound navigation leaves identity unchanged ${locale} ${width}px`, async ({ page }) => {
   test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Uses isolated unbound identity')
   const prefix = locale === 'zh-CN' ? '/zh-CN' : ''
   const session = await createSession()
   const sql = postgres(process.env.E2E_DIRECT_DATABASE_URL!, { max: 1, prepare: false })
   const mutations: string[] = []
   page.on('request', request => {
    if (request.headers()['next-action'] || (request.method() !== 'GET' && /\/api\/(auth|fpl)/.test(new URL(request.url()).pathname))) mutations.push(new URL(request.url()).pathname)
   })
   try {
    await page.setViewportSize({ width, height: 900 })
    await addSessionCookie(page, session.cookie)
    await page.goto(prefix || '/')
    const main = page.locator('#main-content')
    await expect(main.getByText(locale === 'zh-CN' ? '绑定你的 FPL 球队' : 'Link your FPL team', { exact: true })).toBeVisible()
    const clickNav = async (href: string) => {
     const nav = page.getByRole('navigation').first()
     if (width === 390) await nav.locator('[data-navigation-mobile] > summary').click()
     else await nav.locator('details').filter({ has: page.locator(`a[href="${href}"]`) }).locator('summary').filter({ visible: true }).click()
     const link = nav.locator(`a[href="${href}"]`).filter({ visible: true })
     await expect(link).toHaveCount(1)
     await link.click()
    }
    await clickNav(`${prefix}/my-fpl/team`)
    await expect(page).toHaveURL(url => url.pathname === `${prefix}/onboarding/bind-entry`)
    const input = main.locator('input[name="entryId"]')
    await expect(input).toBeVisible()
    await input.fill('-1')
    await expect(input).toHaveValue('-1')
    await input.clear()
    await expect(input).toHaveValue('')
    await expect(main.getByText(locale === 'zh-CN' ? '如何查找参赛 ID' : 'How to find your entry ID', { exact: true })).toBeVisible()
    await expect(main.locator('a[href="https://fantasy.premierleague.com/en/my-team"]')).toHaveAttribute('target', '_blank')
    await expect(main.getByRole('dialog')).toHaveCount(0)
    await page.goBack()
    await expect(page).toHaveURL(url => url.pathname === (prefix || '/'))
    await clickNav(`${prefix}/profile`)
    await expect(page).toHaveURL(url => url.pathname === `${prefix}/profile`)
    await expect(main.getByRole('heading', { name: locale === 'zh-CN' ? '我的资料' : 'My Profile', exact: true })).toBeVisible()
    const [identity] = await sql`SELECT fpl_entry_id, fpl_entry_verified_at FROM bauth."user" WHERE id=${session.userId}`
    expect(identity).toEqual({ fpl_entry_id: null, fpl_entry_verified_at: null })
    expect(mutations).toEqual([])
   } finally { await sql.end(); await session.cleanup() }
  })
 }
}


for (const locale of ['en', 'zh-CN'] as const) {
 for (const width of [1440, 390]) {
 test(`J10 manager season history and transfer sheets ${locale} ${width}px`, async ({ page }) => {
 test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Shared manager fixture requires the dedicated single-worker SSR suite')
 const zh = locale === 'zh-CN'
 const labels = zh ? ['赛季复盘', '队长历史', '板凳得分', '转会历史', '道具卡使用', '轮次历史'] : ['Season Review', 'Captain History', 'Bench Points', 'Transfer History', 'Chip Usage', 'Gameweek History']
 const session = await createSession({ entryId: 15702 })
 const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
 const rules = [
  { operation: 'GetMyFplManagerReview', data: { myFplManagerReview: { ...managerReview, entry: { ...managerReview.entry!, id: session.entryId! }, currentGameweek: { ...managerGameweek(3), entry: { ...managerReview.entry!, id: session.entryId! } } } } },
  ...[1, 2, 3].map(eventId => ({ operation: 'GetMyFplManagerGameweek', variables: { eventId }, data: { myFplManagerGameweek: { ...managerGameweek(eventId), entry: { ...managerReview.entry!, id: session.entryId! } } } }))
 ]
 try {
  expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules }) })).ok).toBe(true)
  await addSessionCookie(page, session.cookie)
  await page.setViewportSize({ width, height: 900 })
  const prefix = zh ? '/zh-CN' : ''
  await page.goto(prefix || '/')
  const nav = page.getByRole('navigation').first()
  const href = `${prefix}/my-fpl/team`
  if (width === 390) await nav.locator('[data-navigation-mobile] > summary').click()
  else await nav.locator('details').filter({ has: page.locator(`a[href="${href}"]`) }).locator('summary').filter({ visible: true }).click()
  const teamLink = nav.locator(`a[href="${href}"]`).filter({ visible: true })
  await expect(teamLink).toHaveCount(1)
  await teamLink.click()
  await expect(page).toHaveURL(url => url.pathname === href)
  const season = page.getByRole('tab', { name: labels[0], exact: true })
  await season.click()
  await expect(season).toHaveAttribute('aria-selected', 'true')
  for (const name of labels.slice(1)) {
   await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
  }
  const section = (name: string) => page.locator('div.bg-card').filter({ has: page.getByRole('heading', { name, exact: true }) })
  const captains = section(labels[1])
  await expect(captains).toHaveCount(1)
  for (const gw of [1, 2, 3]) {
   const row = captains.locator('li').filter({ has: page.getByRole('button', { name: zh ? `打开第 ${gw} 轮` : `Open gameweek ${gw}`, exact: true }) })
   await expect(row).toHaveCount(1)
   await expect(row.getByText('Saka', { exact: true })).toBeVisible()
   await expect(row.getByText('20', { exact: true })).toBeVisible()
  }
  const bench = section(labels[2])
  await expect(bench).toHaveCount(1)
  await expect(bench.getByText(zh ? '本赛季没有轮次板凳分达到 10+。' : 'No gameweek hit 10+ on the bench this season.', { exact: true })).toBeVisible()
  const chips = section(labels[4])
  await expect(chips).toHaveCount(1)
  for (const gw of [2, 3]) await expect(chips.getByRole('button', { name: zh ? `打开第 ${gw} 轮` : `Open gameweek ${gw}`, exact: true })).toBeVisible()
  const transfers = page.locator('div.bg-card').filter({ has: page.getByRole('heading', { name: labels[3], exact: true }) })
  await expect(transfers).toHaveCount(1)
  await expect(transfers.locator('[aria-busy]')).toHaveAttribute('aria-busy', 'false')
  await transfers.locator('button[aria-expanded]').click()
  await expect(transfers.getByText('Incoming 1-1', { exact: true })).toBeVisible()
  for (const chip of (zh ? ['WC', 'FH'] : ['Wildcard', 'Free Hit'])) {
   await transfers.getByRole('button').filter({ hasText: chip }).click()
   const dialog = page.getByRole('dialog')
   await expect(dialog).toBeVisible()
   await expect(dialog.getByRole('heading')).toContainText(chip)
   await dialog.getByRole('button', { name: zh ? '关闭' : 'Close', exact: true }).click()
   await expect(dialog).toHaveCount(0)
  }
  const history = page.locator('div.bg-card').filter({ has: page.getByRole('heading', { name: labels[5], exact: true }) })
  await history.getByRole('button', { name: zh ? '打开第 1 轮' : 'Open gameweek 1', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'GW1', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page).toHaveURL(url => url.searchParams.get('gw') === '1')
  await expect.poll(async () => {
   const observed = await (await fetch(fixture)).json() as { requests: { operation: string; variables: Record<string, unknown> }[] }
   return observed.requests.filter(request => request.operation === 'GetMyFplManagerGameweek' && request.variables.eventId === 1)
  }).not.toHaveLength(0)
  const observed = await (await fetch(fixture)).json() as { requests: { operation: string; variables: Record<string, unknown> }[] }
  const historicalReads = observed.requests.filter(request => request.operation === 'GetMyFplManagerGameweek' && request.variables.eventId === 1)
  for (const request of historicalReads) expect(request.variables.snapshotRevision ?? null).toBeNull()
  await season.click()
  await expect(season).toHaveAttribute('aria-selected', 'true')
 } finally {
  await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
  await session.cleanup()
 }
})

 }
}

for (const locale of ['en', 'zh-CN'] as const) {
 for (const width of [1440, 390]) {
  test(`J10 pending review opens live points and returns ${locale} ${width}px`, async ({ page }) => {
   test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1' || process.env.E2E_LIVE_HYDRATION !== '1', 'Shared live and manager fixtures require the dedicated single-worker SSR suite')
   const session = await createSession({ entryId: 15702 })
   const prefix = locale === 'zh-CN' ? '/zh-CN' : ''
   const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
   const pending = { ...managerGameweek(1), entry: { ...managerReview.entry!, id: session.entryId! }, state: 'PENDING', result: null, review: null, snapshotMeta: null }
   try {
    expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [
     { operation: 'GetMyFplManagerReview', data: { myFplManagerReview: { ...managerReview, entry: { ...managerReview.entry!, id: session.entryId! }, currentGameweek: { ...managerGameweek(3), entry: { ...managerReview.entry!, id: session.entryId! } } } } },
     { operation: 'GetMyFplManagerGameweek', variables: { eventId: 1 }, data: { myFplManagerGameweek: pending } }
    ] }) })).ok).toBe(true)
    await addSessionCookie(page, session.cookie)
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`${prefix}/my-fpl/team?view=gameweek&gw=1`)
    const liveLink = page.getByRole('main').locator(`a[href="${prefix}/live/points/${session.entryId}"]`).filter({ visible: true })
    await expect(liveLink).toHaveCount(1)
    const returnUrl = page.url()
    await liveLink.click()
    await expect(page).toHaveURL(url => url.pathname === `${prefix}/live/points/${session.entryId}` && !url.searchParams.has('gw'))
    const pitch = page.getByRole('region', { name: locale === 'zh-CN' ? /阵型/ : /formation/ })
    await expect(pitch.getByRole('button', { name: locale === 'zh-CN' ? /查看 Player/ : /View details for Player/ })).toHaveCount(15)
    await expect(page.getByRole('region', { name: /GW33/ })).toBeVisible()
    const observed = await (await fetch(fixture)).json() as { requests: { operation: string; variables: Record<string, unknown> }[] }
    const reads = observed.requests.filter(request => request.operation === 'GetLiveCalcPoints')
    expect(reads.length).toBeGreaterThan(0)
    for (const request of reads) {
     expect(request.variables.entryId).toBe(session.entryId)
     expect(request.variables.eventId).toBe(33)
    }
    // Separate BFF contract probe; not a timing sample or the original SSR response.
    const apiResponse = await page.request.post('/api/graphql', {
     headers: { 'X-LetLetMe-Contract': 'live-points-v2' },
     data: { query: GET_LIVE_POINTS, variables: { entryId: session.entryId, eventId: 33 } }
    })
    expect(apiResponse.ok()).toBe(true)
    const api = await apiResponse.json()
    expect(api.errors).toBeUndefined()
    const live = api.data.calcLivePointsByEntry
    expect(live.entry).toBe(session.entryId)
    expect(live.event).toBe(33)
    expect(live.snapshot.eventId).toBe(33)
    // GET_LIVE_POINTS selects snapshot eventId/state only. This probe verifies
    // identity, not snapshot/score revision parity; fixture-only extra fields
    // cannot establish that contract.
    await page.goBack()
    await expect(page).toHaveURL(returnUrl)
    await expect(page.getByRole('tab', { name: 'GW1', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(liveLink).toHaveCount(1)
   } finally {
    await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
    await session.cleanup()
   }
  })
 }
}


for (const locale of ['en', 'zh-CN'] as const) {
for (const width of [1440, 390]) {
test(`J08 official H2H standings and fixtures preserve round identity ${locale} ${width}px`, async ({ page }) => {
 const zh = locale === 'zh-CN'
 const prefix = zh ? '/zh-CN' : ''
 const tableName = zh ? /对战积分榜/ : /Head-to-Head table/
 const fixturesName = zh ? /本轮对阵/ : /Round fixtures/
 test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1' || process.env.E2E_LIVE_HYDRATION !== '1', 'Dedicated isolated single-worker fixture suite')
 const session = await createSession({ entryId: 15702 })
 const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
 const tournament = { id: 6, name: 'J08 Official H2H', leagueType: 'H2H', groupMode: 'BATTLE_RACES', rosterMode: 'OFFICIAL_SYNC', totalTeamNum: 3, setupStatus: 'READY', standingsReadyAt: '2026-09-01T00:00:00.000Z', setupHasWarnings: false, warningSummaries: [] }
 const rules = [
  { operation: 'GetEntryTournaments', data: { entryTournaments: [{ ...tournament, id: 7, name: 'J08 Other H2H' }, tournament] } },
  ...[6, 7].flatMap(tournamentId => ([3, 4] as const).flatMap(eventId => {
   const value = officialH2HFixture(eventId, tournamentId)
   return [
    { operation: 'GetTournamentOfficialH2H', variables: { tournamentId, eventId }, data: { tournamentOfficialH2H: value.snapshot } },
    { operation: 'GetLeagueLiveHead', variables: { tournamentId, eventId }, data: { leagueLiveHead: value.head } },
    { operation: 'GetTournamentOfficialH2HHistory', variables: { tournamentId, eventId }, data: { tournamentOfficialH2HHistory: { tournamentId, eventId, matches: [] } } },
   ]
  })),
 ]
 try {
  expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules }) })).ok).toBe(true)
  await addSessionCookie(page, session.cookie)
  await page.setViewportSize({ width, height: 900 })
  await page.goto(`${prefix}/live/competitions?tournamentId=7&gw=4`)
  const selector = page.getByRole('button', { name: zh ? '对战联赛' : 'Head-to-head', exact: true })
  await expect(selector).toContainText('J08 Other H2H')
  await selector.click()
  await page.getByRole('menuitem', { name: 'J08 Official H2H', exact: true }).click()
  await expect(page).toHaveURL(url => url.searchParams.get('tournamentId') === '6' && url.searchParams.get('gw') === '4')
  await expect(selector).toContainText('J08 Official H2H')
  const standings = page.getByRole('tab', { name: tableName })
  await standings.click()
  const homeLink = page.getByRole('tabpanel', { name: tableName }).locator(`a[href="${prefix}/live/points/123?tournamentId=6&gw=4"]`).filter({ visible: true })
  await expect(homeLink).toHaveCount(1)
  await expect(homeLink).toContainText('H2H Home United')
  await page.getByRole('tab', { name: fixturesName }).click()
  await expect(page.getByRole('tabpanel', { name: fixturesName }).getByText('H2H Away United', { exact: true })).toBeVisible()
  const matchPanel = page.getByRole('tabpanel', { name: fixturesName })
  for (const name of ['H2H Home United', 'H2H Away United']) {
   await expect(matchPanel.getByText(name, { exact: true })).toBeVisible()
   await expect(matchPanel.getByRole('link', { name, exact: true })).toHaveCount(1)
  }
  const byeCard = matchPanel.locator('li').filter({ has: page.getByText('H2H Bye United', { exact: true }) })
  await expect(byeCard).toHaveCount(1)
  await expect(byeCard.getByText(zh ? '轮空' : 'Bye', { exact: true })).toBeVisible()
  await expect(byeCard.getByText(zh ? '平均队' : 'Average Team', { exact: true })).toBeVisible()
  await expect(byeCard.getByRole('link', { name: zh ? '平均队' : 'Average Team', exact: true })).toHaveCount(0)
  await expect(byeCard.getByRole('link', { name: 'H2H Bye United', exact: true })).toHaveCount(1)

  await expect(page.locator('a[href*="/live/points/null"], a[href*="/live/points/0?"]')).toHaveCount(0)
  await page.getByRole('link', { name: zh ? '上一轮' : 'Previous', exact: true }).click()
  await expect(page).toHaveURL(url => url.searchParams.get('gw') === '3')
  await page.getByRole('tab', { name: tableName }).click()
  await expect(page.getByRole('tabpanel', { name: tableName }).locator(`a[href="${prefix}/live/points/123?tournamentId=6&gw=3"]`).filter({ visible: true })).toHaveCount(1)
  await page.getByRole('link', { name: zh ? '下一轮' : 'Next', exact: true }).click()
  await expect(page).toHaveURL(url => url.searchParams.get('gw') === '4')
  for (const entryId of [123, 456]) {
   await page.getByRole('tab', { name: fixturesName }).click()
   const link = page.getByRole('tabpanel', { name: fixturesName }).locator(`a[href="${prefix}/live/points/${entryId}?tournamentId=6&gw=4"]`).filter({ visible: true })
   await expect(link).toHaveCount(1)
   const returnUrl = page.url()
   await link.click()
   await expect(page).toHaveURL(url => url.pathname === `${prefix}/live/points/${entryId}` && url.searchParams.get('tournamentId') === '6' && url.searchParams.get('gw') === '4')
   const pitch = page.getByRole('region', { name: zh ? /阵型/ : /formation/ })
   await expect(pitch.getByRole('button', { name: zh ? /查看 Player/ : /View details for Player/ })).toHaveCount(15)
   await expect(page.getByRole('region', { name: /GW4/ })).toBeVisible()
   await page.goBack()
   await expect(page).toHaveURL(returnUrl)
   await expect(page.getByRole('tab', { name: tableName })).toBeVisible()
  }
 } finally {
  await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
  await session.cleanup()
 }
})

}
}


test.describe('J12 Perth baseline journeys', () => {
 test.use({ timezoneId: 'Australia/Perth' })
for (const locale of ['en', 'zh-CN'] as const) {
 for (const width of [1440, 390]) {
 test(`J12 browse filters and owner cancel preserve read-only behavior ${locale} ${width}px`, async ({ page }, testInfo) => {
 const zh = locale === 'zh-CN'
 const prefix = zh ? '/zh-CN' : ''
 await page.setViewportSize({ width, height: 900 })
 test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1' || process.env.E2E_LIVE_HYDRATION !== '1', 'Dedicated isolated single-worker owner fixture')
 const session = await createSession({ entryId: 909090 })
 const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
 const browseRows = [
  managedTournament,
  { ...managedTournament, id: 78, name: 'J12 Finished Classic', state: 'FINISHED' },
  { ...managedTournament, id: 79, name: 'J12 Paused Classic', state: 'INACTIVE' },
  { ...managedTournament, id: 80, name: 'J12 Active H2H', leagueType: 'H2H', groupMode: 'BATTLE_RACES' },
  { ...managedTournament, id: 81, name: 'J12 Finished H2H', leagueType: 'H2H', groupMode: 'BATTLE_RACES', state: 'FINISHED' },
  { ...managedTournament, id: 82, adminEntryId: 808080, name: 'J12 Paused H2H', leagueType: 'H2H', groupMode: 'BATTLE_RACES', state: 'INACTIVE' }
 ].map((row, index) => ({ ...row, updatedAt: `2026-09-0${index + 1}T00:00:00.000Z`, totalTeamNum: [2, 8, 4, 12, 6, 10][index] }))
 const managementOnly = { ...managedTournament, id: 83, name: 'J12 Management Only' }
 const manageableRows = [...browseRows.filter(row => row.adminEntryId === 909090), managementOnly]
 const mutations: string[] = []
 await page.route('**/api/tournaments/**', async route => {
  const method = route.request().method()
  if (['POST', 'PATCH', 'DELETE'].includes(method)) {
   mutations.push(method)
   await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'Unexpected mutation blocked by test' }) })
  } else await route.continue()
 })
 try {
  expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [
   { operation: 'GetManagedTournament', variables: { tournamentId: 77, entryId: 909090 }, data: { managedTournament } },
   { operation: 'GetEntryTournamentsList', variables: { entryId: 909090 }, data: { entryTournaments: browseRows } },
   { operation: 'GetManageableTournamentsList', variables: { entryId: 909090 }, data: { manageableTournaments: manageableRows } },
   { operation: 'GetEntryTournaments', data: { entryTournaments: browseRows } }
  ] }) })).ok).toBe(true)
  await addSessionCookie(page, session.cookie)
  await page.goto(`${prefix}/competitions/browse`)
  await expect(page).toHaveURL(url => url.pathname === `${prefix}/competitions/browse`)
  const actions = page.getByRole('button', { name: zh ? 'J12 Owned Cup 的操作' : 'Actions for J12 Owned Cup', exact: true })
  await expect(actions).toHaveCount(1)
  await expect(actions).toBeVisible()
  const sort = page.getByRole('toolbar', { name: zh ? '赛事筛选' : 'Tournament filters', exact: true }).getByRole('button', { name: zh ? '排序' : 'Sort', exact: true })
  await expect(sort).toBeVisible()
  await sort.click()
  await expect(page.getByRole('menuitem', { name: zh ? '最近更新优先' : 'Last Updated (Newest)', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(sort).toBeFocused()
  const search = page.getByRole('textbox', { name: zh ? '搜索赛事' : 'Search tournaments', exact: true })
  await search.fill('No matching tournament')
  await expect(actions).toHaveCount(0)
  await search.fill('J12 Owned')
  await expect(actions).toBeVisible()
  const type = page.getByRole('group', { name: zh ? '联赛类型' : 'Tournament type', exact: true })
  await type.getByRole('button', { name: zh ? '对战联赛' : 'H2H', exact: true }).click()
  await expect(actions).toHaveCount(0)
  await type.getByRole('button', { name: zh ? '经典联赛' : 'Classic', exact: true }).click()
  await expect(actions).toBeVisible()
  const status = page.getByRole('group', { name: zh ? '状态' : 'Status', exact: true })
  await status.getByRole('button', { name: zh ? '已结束' : 'Finished', exact: true }).click()
  await expect(actions).toHaveCount(0)
  await status.getByRole('button', { name: zh ? '进行中' : 'Active', exact: true }).click()
  await expect(actions).toBeVisible()
  await search.fill('')
  const renderedNames = page.locator('tbody tr td:first-child > .font-medium')
  for (const [typeName, typeMatches] of (zh ? [['全部', true], ['经典联赛', true], ['对战联赛', false]] : [['All', true], ['Classic', true], ['H2H', false]]) as Array<[string, boolean]>) {
   await type.getByRole('button', { name: typeName, exact: true }).click()
   for (const [statusName, statusMatches] of (zh ? [['全部', true], ['进行中', true], ['已结束', false], ['已暂停', false]] : [['All', true], ['Active', true], ['Finished', false], ['Paused', false]]) as Array<[string, boolean]>) {
    const option = status.getByRole('button', { name: statusName, exact: true })
    await option.click()
    await expect(option).toHaveAttribute('aria-pressed', 'true')
    await expect(actions).toHaveCount(typeMatches && statusMatches ? 1 : 0)
    const typeIndex = (zh ? ['全部', '经典联赛', '对战联赛'] : ['All', 'Classic', 'H2H']).indexOf(typeName)
    const stateIndex = (zh ? ['全部', '进行中', '已结束', '已暂停'] : ['All', 'Active', 'Finished', 'Paused']).indexOf(statusName)
    const expectedNames = browseRows.filter(row => (typeIndex === 0 || row.leagueType === ['all', 'CLASSIC', 'H2H'][typeIndex]) && (stateIndex === 0 || row.state === ['all', 'ACTIVE', 'FINISHED', 'INACTIVE'][stateIndex])).map(row => row.name).sort()
    await expect.poll(async () => (await renderedNames.allTextContents()).sort()).toEqual(expectedNames)
   }
  }
  await type.getByRole('button', { name: zh ? '全部' : 'All', exact: true }).click()
  await status.getByRole('button', { name: zh ? '全部' : 'All', exact: true }).click()
  await search.fill('')
  await expect(actions).toBeVisible()
  const sortTrigger = page.getByRole('toolbar', { name: zh ? '赛事筛选' : 'Tournament filters', exact: true }).getByRole('button').filter({ has: page.locator('svg.lucide-arrow-up-down') })
  await expect(sortTrigger).toHaveCount(1)
  const orders = [
   { label: zh ? '最近更新优先' : 'Last Updated (Newest)', indices: [5, 4, 3, 2, 1, 0] },
   { label: zh ? '最早更新优先' : 'Last Updated (Oldest)', indices: [0, 1, 2, 3, 4, 5] },
   { label: zh ? '名称（A–Z）' : 'Name (A–Z)', indices: [3, 1, 4, 0, 2, 5] },
   { label: zh ? '名称（Z–A）' : 'Name (Z–A)', indices: [5, 2, 0, 4, 1, 3] },
   { label: zh ? '参赛球队最多' : 'Most Participants', indices: [3, 5, 1, 4, 2, 0] }
  ]
  for (const order of orders) {
   await sortTrigger.click()
   await page.getByRole('menuitem', { name: order.label, exact: true }).click()
   await expect(renderedNames).toHaveText(order.indices.map(index => browseRows[index].name))
  }
  const mine = page.getByRole('button', { name: zh ? '我管理的' : 'I manage', exact: true })
  await mine.click()
  await expect(mine).toHaveAttribute('aria-pressed', 'true')
  await expect(page).toHaveURL(url => url.searchParams.get('mine') === 'true')
  await expect.poll(async () => (await renderedNames.allTextContents()).sort()).toEqual(manageableRows.map(row => row.name).sort())
  await expect(page.getByRole('row').filter({ hasText: 'J12 Management Only' }).getByText(zh ? '可管理 · 未参赛' : 'Manageable · not participating', { exact: true })).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: 'J12 Owned Cup' }).getByText(zh ? '可管理 · 已参赛' : 'Manageable · participating', { exact: true })).toBeVisible()
  await mine.click()
  await expect(mine).toHaveAttribute('aria-pressed', 'false')
  await expect(page).toHaveURL(url => !url.searchParams.has('mine'))
  await expect.poll(async () => (await renderedNames.allTextContents()).sort()).toEqual(browseRows.map(row => row.name).sort())
  await expect(page.getByText('J12 Management Only', { exact: true })).toHaveCount(0)
  await actions.click()
  const manage = page.getByRole('menuitem', { name: zh ? '管理赛事' : 'Manage tournament', exact: true })
  await expect(manage).toHaveAttribute('href', `${prefix}/competitions/77/manage`)
  await manage.click()
  await expect(page).toHaveURL(url => url.pathname === `${prefix}/competitions/77/manage`)
  await expect(page.locator('[data-competition-perf-ready="manage"]')).toHaveAttribute('data-competition-tournament-id', '77')
  for (const title of (zh ? ['赛事设置', '赛事信息', '生命周期控制', '危险操作'] : ['Tournament settings', 'Tournament information', 'Lifecycle controls', 'Danger zone'])) await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
  const opener = page.getByRole('button', { name: zh ? '删除赛事' : 'Delete tournament', exact: true })
  await opener.click()
  const dialog = page.getByRole('alertdialog')
  const confirm = dialog.getByRole('button', { name: zh ? '永久删除' : 'Delete permanently', exact: true })
  await expect(confirm).toBeDisabled()
  const input = dialog.locator('#delete-confirmation')
  await input.fill('Wrong Cup')
  await expect(confirm).toBeDisabled()
  await input.fill('J12 Owned Cup')
  await expect(confirm).toBeEnabled()
  await dialog.getByRole('button', { name: zh ? '取消' : 'Cancel', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await opener.click()
  await expect(input).toHaveValue('')
  await expect(confirm).toBeDisabled()
  await dialog.getByRole('button', { name: zh ? '取消' : 'Cancel', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  const live = page.getByRole('link', { name: zh ? '返回赛事' : 'Back to tournament', exact: true })
  await expect(live).toHaveAttribute('href', `${prefix}/live/competitions/77`)
  await live.click()
  await expect(page).toHaveURL(url => url.pathname === `${prefix}/live/competitions/77`)
  const ready = page.locator('[data-competition-perf-ready="detail"]')
  await expect(ready).toHaveAttribute('data-competition-tournament-id', '77')
  await expect(ready).toHaveAttribute('data-competition-gameweek', '33')
  await expect(ready.getByRole('heading', { name: 'J12 Owned Cup', exact: true })).toBeVisible()
  await expect(ready.getByRole('link', { name: /E2E United/ }).filter({ visible: true })).toHaveCount(1)
  await page.goBack()
  await expect(page).toHaveURL(url => url.pathname === `${prefix}/competitions/77/manage`)
  await expect(page.locator('[data-competition-perf-ready="manage"]')).toHaveAttribute('data-competition-tournament-id', '77')
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  expect(mutations).toEqual([])
  expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('Australia/Perth')
  await testInfo.attach('J12-baseline-scope', { body: JSON.stringify({ variantId: `J12.O.${locale}.${width === 1440 ? 'desktop1440' : 'mobile390'}.base`, locale, viewport: page.viewportSize(), timezone: 'Australia/Perth', theme: 'system', scope: 'One functional journey; cache cold/warm repetitions and performance remain unverified' }), contentType: 'application/json' })
 } finally {
  await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
  await session.cleanup()
 }
})

 }
}

})

for (const locale of ['en', 'zh-CN'] as const) {
for (const width of [1440, 390]) {
 test(`J12 non-owner cannot access management ${locale} ${width}px`, async ({ page }) => {
  const zh = locale === 'zh-CN'
  const prefix = zh ? '/zh-CN' : ''
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Isolated non-owner fixture')
  await page.setViewportSize({ width, height: 900 })
  const session = await createSession({ entryId: 909090 })
  const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
  const mutations: string[] = []
  await page.route('**/api/tournaments/**', async route => {
   if (['POST', 'PATCH', 'DELETE'].includes(route.request().method())) {
    mutations.push(route.request().method())
    await route.fulfill({ status: 409, body: 'Unexpected mutation blocked' })
   } else await route.continue()
  })
  try {
   expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [
    { operation: 'GetEntryTournamentsList', variables: { entryId: 909090 }, data: { entryTournaments: [{ ...managedTournament, adminEntryId: 808080 }] } },
    { operation: 'GetManagedTournament', variables: { tournamentId: 77, entryId: 909090 }, data: { managedTournament: null } }
   ] }) })).ok).toBe(true)
   await addSessionCookie(page, session.cookie)
   await page.goto(`${prefix}/competitions/browse`)
   await page.getByRole('button', { name: zh ? 'J12 Owned Cup 的操作' : 'Actions for J12 Owned Cup', exact: true }).click()
   await expect(page.getByRole('menuitem', { name: zh ? '查看实时详情' : 'View live details', exact: true })).toBeVisible()
   await expect(page.getByRole('menuitem', { name: zh ? '管理赛事' : 'Manage tournament', exact: true })).toHaveCount(0)
   await page.keyboard.press('Escape')
   await page.goto(`${prefix}/competitions/77/manage`)
   await expect(page.getByRole('heading', { name: zh ? '需要管理员权限' : 'Administrator access required', exact: true })).toBeVisible()
   await expect(page.locator('[data-competition-perf-ready="manage"]')).toHaveCount(0)
   await expect(page.getByRole('button', { name: zh ? '删除赛事' : 'Delete tournament', exact: true })).toHaveCount(0)
   await expect(page.getByRole('heading', { name: /J12 Owned Cup/ })).toHaveCount(0)
   const observations = await (await fetch(fixture)).json()
   expect(observations.requests.some((request: { operation: string; variables: { tournamentId?: number; entryId?: number } }) => request.operation === 'GetManagedTournament' && request.variables.tournamentId === 77 && request.variables.entryId === 909090)).toBe(true)
   expect(mutations).toEqual([])
  } finally {
   await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
   await session.cleanup()
  }
 })
}

}

test.describe('J12 planned UTC dark mobile management states', () => {
 test.use({ timezoneId: 'UTC', colorScheme: 'dark', viewport: { width: 390, height: 900 } })
 for (const scenario of ['active', 'paused', 'setup-failed'] as const) {
  test(`J12 state ${scenario} preserves state on cancellation`, async ({ page }, testInfo) => {
   test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Dedicated isolated state fixture')
   const session = await createSession({ entryId: 909090 })
   const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
   const tournament = {
    ...managedTournament,
    state: scenario === 'paused' ? 'INACTIVE' : 'ACTIVE',
    ...(scenario === 'setup-failed' ? {
     setupStatus: 'FAILED', setupPhase: 'BUILDING_STRUCTURE',
     setupCompletedUnits: 1, setupFinishedAt: null,
     standingsReadyAt: null, profilesReadyAt: null, insightsReadyAt: null
    } : {})
   }
   const mutations: string[] = []
   await page.route('**/api/tournaments/**', async route => {
    if (['POST', 'PATCH', 'DELETE'].includes(route.request().method())) {
     mutations.push(route.request().method())
     await route.fulfill({ status: 409, body: 'Unexpected mutation blocked' })
    } else await route.continue()
   })
   try {
    expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [
     { operation: 'GetManagedTournament', variables: { tournamentId: 77, entryId: 909090 }, data: { managedTournament: tournament } }
    ] }) })).ok).toBe(true)
    await addSessionCookie(page, session.cookie)
    await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
    await page.goto('/zh-CN/competitions/77/manage')
    await expect(page.locator('html')).toHaveClass(/dark/)
    expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('UTC')
    await expect(page.locator('[data-competition-perf-ready="manage"]')).toHaveAttribute('data-competition-tournament-id', '77')
    const lifecycle = page.getByRole('button', { name: scenario === 'paused' ? '恢复并补齐数据' : '暂停', exact: true })
    await expect(lifecycle).toBeEnabled()
    await expect(page.getByRole('button', { name: scenario === 'paused' ? '暂停' : '恢复并补齐数据', exact: true })).toHaveCount(0)
    const repair = page.getByRole('button', { name: '修复赛事设置', exact: true })
    if (scenario === 'setup-failed') await expect(repair).toBeEnabled()
    else await expect(repair).toHaveCount(0)
    await page.getByRole('button', { name: '删除赛事', exact: true }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: '取消', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(lifecycle).toBeEnabled()
    expect(mutations).toEqual([])
    await testInfo.attach('J12-state-scope', { body: JSON.stringify({ variantId: `J12.state.0${['active', 'paused', 'setup-failed'].indexOf(scenario) + 1}`, scenario, locale: 'zh-CN', viewport: page.viewportSize(), timezone: 'UTC', theme: 'dark', scope: 'Management state and cancellation only; full state journey and performance remain unverified' }), contentType: 'application/json' })
   } finally {
    await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
    await session.cleanup()
   }
  })
 }
})

for (const locale of ['en', 'zh-CN'] as const) {
 for (const width of [1440, 390]) {
 test.describe(`J13 ${locale} ${width}`, () => {
 test.use({ viewport: { width, height: 900 }, timezoneId: 'Australia/Perth' })
 test(`J13 ${locale} creation modes keep unprepared fields hidden and leave without writes`, async ({ page }) => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Isolated session and intercepted API only')
  const session = await createSession({ entryId: 15702 })
  const prefix = locale === 'en' ? '' : '/zh-CN'
  const forbidden: string[] = []
  await page.route('**/api/tournaments{,/**}', async route => {
   const path = new URL(route.request().url()).pathname
   if (path === '/api/tournaments/check-name') {
    await route.fulfill({ json: { available: true } })
   } else {
    forbidden.push(`${route.request().method()} ${path}`)
    await route.abort()
   }
  })
  try {
   await addSessionCookie(page, session.cookie)
   await page.goto(`${prefix}/competitions/browse`)
   const create = page.locator(`a[href="${prefix}/competitions/create"]`).filter({ visible: true }).first()
   await create.click()
   await expect(page).toHaveURL(new RegExp(`${prefix}/competitions/create$`))
   await expect(page.locator('#tournament-create-form')).toHaveAttribute('aria-busy', 'false')
   await page.locator('label[for="creation-mode-classic"]').click()
   await expect(page.locator('#creation-mode-classic')).toHaveAttribute('aria-checked', 'true')
   await expect(page.locator('#tournament-name')).toHaveCount(0)
   await page.locator('label[for="creation-mode-h2h"]').click()
   await expect(page.locator('#creation-mode-h2h')).toHaveAttribute('aria-checked', 'true')
   const importHelp = page.getByRole('region', { name: locale === 'en' ? 'How to get the link' : '如何获取链接', exact: true })
   await expect(importHelp).toBeVisible()
   await expect(importHelp.getByRole('listitem')).toHaveCount(3)
   await expect(importHelp).toContainText(locale === 'en' ? 'Select the Head-to-Head league you want to mirror.' : '选择你要镜像的对战联赛。')
   await expect(importHelp).toContainText(locale === 'en' ? 'Open Standings or New entries and copy the browser URL.' : '打开“Standings”或“New entries”，复制浏览器地址栏中的链接。')
   await expect(page.locator('#tournament-name')).toHaveCount(0)
   await page.locator('label[for="creation-mode-custom"]').click()
   await expect(page.locator('#tournament-name')).toBeVisible()
   const help = page.getByRole('button', { name: locale === 'en' ? 'Show help' : '显示帮助', exact: true })
   await help.click()
   const helpDialog = page.getByRole('dialog')
   await expect(helpDialog.getByRole('heading', { name: locale === 'en' ? 'Choose participants' : '选择参赛球队', exact: true })).toBeVisible()
   await helpDialog.getByRole('tab', { name: locale === 'en' ? 'FAQ' : '常见问题', exact: true }).click()
   await expect(helpDialog.getByRole('heading', { name: locale === 'en' ? 'Why must I fetch a league first?' : '为什么必须先加载联赛？', exact: true })).toBeVisible()
   await page.keyboard.press('Escape')
   await expect(helpDialog).toHaveCount(0)
   await expect(help).toBeFocused()
   await page.locator('#tournament-name').fill('J13 local draft')
   await expect(page.locator('#tournament-name')).toHaveValue('J13 local draft')
   await expect(page.locator('#tournament-create-form button[type="submit"]')).toBeDisabled()
   await page.locator('label[for="creation-mode-h2h"]').click()
   await expect(page.locator('#tournament-name')).toHaveCount(0)
   await page.getByRole('contentinfo').locator(`a[href="${prefix}/competitions/browse"]`).click()
   await expect(page).toHaveURL(new RegExp(`${prefix}/competitions/browse$`))
   expect(forbidden).toEqual([])
  } finally { await session.cleanup() }
 })
 })
 }
}

test('J13 prepared preview exposes every group and knockout format without creation', async ({ page }) => {
 test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Isolated preview substitute only')
 const session = await createSession({ entryId: 15702 })
 const writes: string[] = []
 let previews = 0
 await page.route('**/api/tournaments{,/**}', async route => {
  const path = new URL(route.request().url()).pathname
  if (path === '/api/tournaments/preview') {
   previews += 1
   expect(route.request().method()).toBe('POST')
   expect(route.request().postDataJSON()).toEqual({ leagueUrl: 'https://fantasy.premierleague.com/leagues/123/standings/c' })
   await route.fulfill({ json: { previewToken: 'isolated-j13-preview', expiresAt: new Date(Date.now() + 600000).toISOString(), leagueId: 123, leagueType: 'classic', leagueName: 'J13 fixture league', startEvent: 1, participants: Array.from({ length: 8 }, (_, i) => ({ id: String(i + 1), team: `J13 Team ${i + 1}`, manager: `Fixture ${i + 1}`, overallRank: i + 1, totalPoints: 100 })) } })
  } else if (path === '/api/tournaments/check-name') await route.fulfill({ json: { available: true } })
  else { writes.push(path); await route.abort() }
 })
 try {
  await addSessionCookie(page, session.cookie)
  await page.goto('/competitions/create')
  await expect(page.locator('#tournament-create-form')).toHaveAttribute('aria-busy', 'false')
  await page.locator('label[for="creation-mode-custom"]').click()
  await page.locator('#league-url').fill('https://fantasy.premierleague.com/leagues/123/standings/c')
  await page.getByRole('button', { name: 'Fetch league', exact: true }).click()
  await expect(page.locator('#group-format')).toBeVisible()
  for (const format of ['No Group', 'Points Race', 'No Group']) {
   await page.locator('#group-format').click()
   await page.getByRole('option', { name: format, exact: true }).click()
   await expect(page.locator('#group-format')).toHaveText(format)
  }
  for (const format of ['Single Elimination', 'Double Elimination', 'No Knockout']) {
   await page.locator('#knockout-format').click()
   await page.getByRole('option', { name: format, exact: true }).click()
   await expect(page.locator('#knockout-format')).toHaveText(format)
  }
  expect(previews).toBe(1)
  expect(writes).toEqual([])
 } finally { await session.cleanup() }
})

for (const locale of ['en', 'zh-CN'] as const) {
 for (const width of [1440, 390]) {
  for (const persona of ['anonymous', 'unbound', 'bound'] as const) {
   test(`AUTH04 bind entry identity boundary ${persona} ${locale} ${width}`, async ({ page }) => {
    test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Requires isolated identity fixtures')
    const prefix = locale === 'en' ? '' : '/zh-CN'
    const session = persona === 'anonymous' ? null : await createSession(persona === 'bound' ? { entryId: 909090 } : {})
    try {
     await page.setViewportSize({ width, height: 900 })
     if (session) await addSessionCookie(page, session.cookie)
     await page.goto(`${prefix}/onboarding/bind-entry?next=${encodeURIComponent('/auth/forgot-password')}`)
     if (persona === 'anonymous') {
      await expect(page).toHaveURL(url => url.pathname === `${prefix}/auth/login`)
      await expect(page.locator('#main-content input[type="password"]')).toBeEnabled()
     } else if (persona === 'bound') {
      await expect(page).toHaveURL(url => url.pathname === `${prefix}/auth/forgot-password`)
      await expect(page.locator('#main-content input[type="email"]')).toBeEnabled()
     } else {
      await expect(page).toHaveURL(url => url.pathname === `${prefix}/onboarding/bind-entry`)
      const input = page.locator('#main-content input[name="entryId"]')
      await expect(input).toBeEnabled()
      const writes: string[] = []
      page.on('request', request => {
       if (request.headers()['next-action']) writes.push(request.url())
      })
      const searches: string[] = []
      await page.route('**/api/graphql', async route => {
       const body = route.request().postDataJSON()
       if (body?.operationName !== 'SearchEntries' && !String(body?.query).includes('query SearchEntries')) return route.fallback()
       searches.push(body.variables.query)
       await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { searchEntries: [] } }) })
      })
      const submit = page.locator('#main-content button[type="submit"]')
      for (const value of ['-1', '1.5']) {
       await input.fill(value)
       await expect(input).toHaveValue(value)
       await submit.click()
       await expect(page.getByText(locale === 'zh-CN' ? '本站没有匹配的球队。请改用参赛 ID，可查任意有效 FPL 球队。' : 'No matching team on LetLetMe. Try an entry ID — that looks up any valid FPL team.', { exact: true })).toBeVisible()
       await expect(submit).toBeEnabled()
      }
      expect(searches).toEqual(['-1', '1.5'])
      await input.fill('')
      await submit.click()
      await expect(input).toBeFocused()
      expect(await input.evaluate(element => (element as HTMLInputElement).validity.valueMissing)).toBe(true)
      expect(writes).toEqual([])
      const sql = postgres(process.env.E2E_DIRECT_DATABASE_URL!, { max: 1, prepare: false })
      try {
       const [row] = await sql`SELECT fpl_entry_id, fpl_entry_verified_at FROM bauth."user" WHERE id=${session!.userId}`
       expect(row).toEqual({ fpl_entry_id: null, fpl_entry_verified_at: null })
      } finally { await sql.end() }
     }
    } finally { if (session) await session.cleanup() }
   })
  }
 }
}

for (const profile of [
 { name: 'baseline', timezoneId: 'Australia/Perth', theme: 'system' },
 { name: 'state-probe', timezoneId: 'UTC', theme: 'dark' }
] as const) {
test.describe(`J01 ${profile.name}`, () => {
 test.use({ timezoneId: profile.timezoneId, colorScheme: 'light' })
for (const scenario of ['normal', 'slow-personal'] as const) {
for (const locale of ['en', 'zh-CN'] as const) {
for (const width of [1440, 390]) {
 if (profile.name === 'state-probe' && (locale !== 'zh-CN' || width !== 390)) continue
 test(`${scenario === 'slow-personal' ? 'SSR remediation ' : ''}J01 continuous bound fixture comparison journey ${scenario} ${locale} ${width}px`, async ({ page }, testInfo) => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Requires isolated fixture database')
  test.skip(scenario === 'slow-personal' && process.env.E2E_SSR_REMEDIATION !== '1', 'Requires serial fixture control')
  const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
  const reportedVitals: Array<Record<string, unknown>> = []
  await page.route('**/api/vitals', route => {
   const payload = route.request().postDataJSON()
   if (payload && Array.isArray(payload.samples)) reportedVitals.push(...payload.samples)
   return route.fulfill({ status: 204, body: '' })
  })
  const zh = locale === 'zh-CN'
  const session = await createSession({ entryId: 15702 })
  try {
   await page.setViewportSize({ width, height: 900 })
   await page.addInitScript(theme => localStorage.setItem('theme', theme), profile.theme)
   await addSessionCookie(page, session.cookie)
   await page.goto(zh ? '/zh-CN' : '/')
   await expect(page.getByRole('main')).toContainText('E2E United')
   await expect(page.locator('[data-home-personal-ready="true"]').filter({ visible: true })).toContainText('E2E United')
   await expect(page.locator('[data-home-league-ranks-ready="true"]').filter({ visible: true })).toHaveCount(1)
   await expect(page.locator('[data-home-matches]')).toHaveAttribute('data-home-fixtures-event', '33')
   await expect.poll(() => ['HOME_TEAM_DESK_READY', 'HOME_LEAGUE_RANKS_READY'].every(name => reportedVitals.some(sample => sample.metricName === name))).toBe(true)
   await testInfo.attach('home-personal-readiness', { body: JSON.stringify(reportedVitals.filter(sample => ['HOME_TEAM_DESK_READY', 'HOME_LEAGUE_RANKS_READY'].includes(String(sample.metricName))).map(sample => ({ ...sample, validDurationMs: sample.result === 'ok' && typeof sample.value === 'number' ? sample.value : null }))), contentType: 'application/json' })
   expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(profile.timezoneId)
   expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe(profile.theme)
   await expect(page.locator('html')).toHaveClass(profile.theme === 'dark' ? /dark/ : /light/)
   testInfo.annotations.push({ type: 'coverage-profile', description: `${profile.name}; ${profile.timezoneId}; ${profile.theme}; ${locale}; ${width}` })
   if (scenario === 'slow-personal') expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [{ operation: 'GetEntryHistory', delayMs: 2000 }] }) })).ok).toBe(true)
   const menu = width < 768 ? page.locator('details[data-navigation-mobile]') : page.locator('details[data-navigation-group="explore"]')
   await menu.locator(':scope > summary').click()
   await menu.getByRole('link', { name: zh ? '赛程' : 'Fixtures', exact: true }).click()
   await expect(page).toHaveURL(/\/explore\/fixtures$/)
   const matrix = page.getByRole('region', { name: zh ? '球队 FDR' : 'Team FDR', exact: true })
   await expect(matrix.locator('tbody tr')).toHaveCount(3)
   await matrix.getByRole('searchbox', { name: zh ? '搜索球队' : 'Search teams' }).fill('Arsenal')
   await expect(matrix.locator('tbody tr')).toHaveCount(1)
   if (scenario === 'slow-personal') {
    const requests = (await (await fetch(fixture)).json()).requests
    const history = requests.find((row: { operation: string }) => row.operation === 'GetEntryHistory')
    expect(history).toBeDefined()
    expect(history.finishedAt).toBeNull()
   }
   const arsenal = matrix.locator('#fdr-team-1')
   const headings = await matrix.getByRole('columnheader').allTextContents()
   const gw33 = headings.findIndex(text => text.trim() === 'GW33')
   const gw34 = headings.findIndex(text => text.trim() === 'GW34')
   expect(gw33).toBeGreaterThanOrEqual(0)
   expect(gw34).toBeGreaterThan(gw33)
   const cells = arsenal.locator(':scope > td, :scope > th')
   await expect(cells.nth(gw33).getByText(zh ? '双赛轮' : 'DGW', { exact: true })).toBeVisible()
   await expect(cells.nth(gw33).locator('[title]')).toHaveCount(2)
   await expect(cells.nth(gw34)).toHaveText(zh ? '空白轮' : 'BGW')
   await expect(cells.nth(gw34).locator('[title]')).toHaveCount(0)
   const trigger = matrix.getByRole('button', { name: zh ? '查看 Arsenal 的整个赛季赛程' : "View Arsenal's full-season fixtures", exact: true })
   await trigger.click()
   const dialog = page.getByRole('dialog')
   await expect(dialog.getByRole('heading', { name: /Arsenal/ })).toBeVisible()
   await expect(dialog).toContainText('GW38')
   await page.keyboard.press('Escape')
   await expect(dialog).toHaveCount(0)
   await expect(trigger).toBeFocused()
   await expect.poll(() => reportedVitals.filter(sample => sample.metricName === 'FIXTURES_WINDOW_READY').length).toBeGreaterThan(0)
   for (const horizon of [6, 5]) {
    const previousReadyCount = reportedVitals.filter(sample => sample.metricName === 'FIXTURES_WINDOW_READY').length
    const button = page.getByRole('button', { name: zh ? `${horizon} 轮` : `${horizon} GWs`, exact: true })
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect(matrix.getByRole('columnheader').filter({ hasText: /^GW\d+$/ })).toHaveText(Array.from({ length: horizon }, (_, index) => `GW${33 + index}`))
    await expect(cells.nth(gw33).locator('[title]')).toHaveCount(2)
    await expect(cells.nth(gw34)).toHaveText(zh ? '空白轮' : 'BGW')
    await expect.poll(() => reportedVitals.filter(sample => sample.metricName === 'FIXTURES_WINDOW_READY').length).toBeGreaterThan(previousReadyCount)
   }
   await testInfo.attach('fixture-window-readiness', { body: JSON.stringify({ fromGw: 33, horizons: [6, 5], teamId: 1, samples: reportedVitals.filter(sample => sample.metricName === 'FIXTURES_WINDOW_READY').map(sample => ({ ...sample, validDurationMs: sample.result === 'ok' && typeof sample.value === 'number' ? sample.value : null })) }), contentType: 'application/json' })
   await page.locator('#my-squad > summary').click()
   await expect(page.locator('#my-squad')).toHaveAttribute('open', '')
   if (scenario === 'slow-personal') {
    await expect.poll(async () => (await (await fetch(fixture)).json()).requests.find((row: { operation: string }) => row.operation === 'GetEntryHistory')?.finishedAt).toBeTruthy()
    await expect(page.locator('#my-squad').getByRole('button', { name: zh ? /^查看 Player 1 的赛程详情/ : /^View Player 1's fixture details/ }).filter({ visible: true })).toHaveCount(1)
    await testInfo.attach('slow-personal-request-timeline', { body: JSON.stringify((await (await fetch(fixture)).json()).requests), contentType: 'application/json' })
   }
   const playerLink = page.getByRole('link', { name: zh ? 'Palmer — 打开球员深度页' : 'Palmer — Open player desk', exact: true }).filter({ visible: true })
   await expect(playerLink).toHaveCount(1)
   await playerLink.click()
   await expect(page).toHaveURL(/p1=2/)
   const overall = page.getByRole('region', { name: zh ? '球员总览' : 'Player overall', exact: true })
   await expect(overall).toContainText('Palmer')
   await page.getByRole('button', { name: zh ? '添加对比' : 'Add comparison', exact: true }).click()
   await page.getByRole('region', { name: zh ? '球员' : 'Players', exact: true }).getByRole('button', { name: /^Saka/ }).click()
   await expect(page).toHaveURL(/p1=2&p2=1/)
   await expect(overall).toContainText('Palmer')
   await expect(overall).toContainText('Saka')
   const navigationId = await page.locator('[data-player-stats-navigation-id]').getAttribute('data-player-stats-navigation-id')
   expect(navigationId).toBeTruthy()
   await expect.poll(() => reportedVitals.filter(sample => sample.metricName === 'PLAYER_COMPARE_PAINT' && sample.navigationId === navigationId && sample.result === 'ok' && typeof sample.interactionId === 'string').length).toBeGreaterThan(0)
   const samples = reportedVitals.filter(sample => sample.navigationId === navigationId).map(sample => ({ ...sample, validDurationMs: sample.result === 'ok' && typeof sample.value === 'number' ? sample.value : null }))
   await testInfo.attach('current-player-navigation-readiness', { body: JSON.stringify({ url: page.url(), players: [2, 1], navigationId, samples }), contentType: 'application/json' })
   await page.getByRole('navigation', { name: zh ? '区块' : 'Sections', exact: true }).getByRole('button', { name: zh ? '赛程' : 'Fixtures', exact: true }).click()
   await expect(page).toHaveURL(/#ps-fixtures$/)
   await expect(page.locator('#ps-fixtures')).toBeVisible()
   const comparisonUrl = page.url()
   await page.getByRole('link', { name: zh ? '在赛程页查看阵容规划' : 'Squad fixture plan on Fixtures', exact: true }).click()
   await expect(page).toHaveURL(/\/explore\/fixtures#my-squad$/)
   await expect(page.locator('#my-squad')).toBeVisible()
   await page.goBack()
   await expect(page).toHaveURL(comparisonUrl)
   await expect(overall).toContainText('Saka')
   await expect(overall).toContainText('Palmer')
   await page.goForward()
   await expect(page).toHaveURL(/\/explore\/fixtures#my-squad$/)
   await expect(page.locator('#my-squad')).toBeVisible()
   testInfo.annotations.push({ type: 'coverage-case', description: `J01 continuous ${scenario} bound path with DGW/BGW and section anchor; performance assertions remain separate` })
  } finally {
   try {
    if (scenario === 'slow-personal') expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })).ok).toBe(true)
   } finally { await session.cleanup() }
  }
 })
}
}
}
})
}

for (const locale of ['en', 'zh-CN'] as const) {
 for (const width of [1440, 390]) {
  test(`J12 large browse list expands collapses and resets ${locale} ${width}px`, async ({ page }) => {
   test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Serial isolated list fixture')
   const zh = locale === 'zh-CN'
   const session = await createSession({ entryId: 909090 })
   const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
   const entries = Array.from({ length: 45 }, (_, index) => ({ ...managedTournament, id: 1000 + index, name: `Bulk ${String(index).padStart(3, '0')}`, updatedAt: new Date(Date.UTC(2026, 8, 1, 0, index)).toISOString() }))
   try {
    expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [{ operation: 'GetEntryTournamentsList', variables: { entryId: 909090 }, data: { entryTournaments: entries } }] }) })).ok).toBe(true)
    await page.setViewportSize({ width, height: 900 })
    await addSessionCookie(page, session.cookie)
    await page.goto(`${zh ? '/zh-CN' : ''}/competitions/browse`)
    const names = page.locator('tbody tr td:first-child > .font-medium')
    const ordered = [...entries].reverse().map(row => row.name)
    await expect(names).toHaveText(ordered.slice(0, 20))
    await page.getByRole('button', { name: zh ? '再显示 20 个赛事' : 'Show 20 more tournaments', exact: true }).click()
    await expect(names).toHaveText(ordered.slice(0, 40))
    await page.getByRole('button', { name: zh ? '再显示 5 个赛事' : 'Show 5 more tournaments', exact: true }).click()
    await expect(names).toHaveText(ordered)
    await page.getByRole('button', { name: zh ? '收起' : 'Show less', exact: true }).click()
    await expect(names).toHaveText(ordered.slice(0, 20))
    await page.getByRole('button', { name: zh ? '显示全部 45 个赛事' : 'Show all 45 tournaments', exact: true }).click()
    await expect(names).toHaveText(ordered)
    const search = page.getByRole('textbox', { name: zh ? '搜索赛事' : 'Search tournaments', exact: true })
    await search.fill('Bulk 04')
    await expect(names).toHaveText(['Bulk 044', 'Bulk 043', 'Bulk 042', 'Bulk 041', 'Bulk 040'])
    await expect(page.getByRole('button', { name: zh ? '收起' : 'Show less', exact: true })).toHaveCount(0)
    await search.fill('')
    await expect(names).toHaveText(ordered.slice(0, 20))
   } finally {
    try { await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) }) } finally { await session.cleanup() }
   }
  })
 }
}

test.describe('J12 platform admin baseline profile', () => {
 test.use({ timezoneId: 'Australia/Perth', colorScheme: 'light' })
for (const locale of ['en', 'zh-CN'] as const) {
 for (const width of [1440, 390]) {
  test(`J12 platform admin sees managed non-participating tournament ${locale} ${width}px`, async ({ page }, testInfo) => {
   test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1' || process.env.PLATFORM_ADMIN_USER_IDS !== 'e2e-browse-platform-admin' || process.env.PLATFORM_ADMIN_FPL_ENTRY_IDS !== '909090', 'Requires dedicated isolated dual-allowlist admin runtime')
   const reportedVitals: Array<Record<string, unknown>> = []
   await page.route('**/api/vitals', route => {
    const payload = route.request().postDataJSON()
    if (payload && Array.isArray(payload.samples)) reportedVitals.push(...payload.samples)
    return route.fulfill({ status: 204, body: '' })
   })
   await page.addInitScript(() => localStorage.setItem('theme', 'system'))
   const zh = locale === 'zh-CN'
   const session = await createSession({ entryId: 909090, userId: 'e2e-browse-platform-admin' })
   const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
   const other = { ...managedTournament, id: 88, adminEntryId: 808080, name: 'Other Owner Cup' }
   try {
    expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [
     { operation: 'GetEntryTournamentsList', variables: { entryId: 909090 }, data: { entryTournaments: [managedTournament] } },
     { operation: 'GetManageableTournamentsList', variables: { entryId: 909090 }, data: { manageableTournaments: [managedTournament, other] } }
    ] }) })).ok).toBe(true)
    await page.setViewportSize({ width, height: 900 })
    await addSessionCookie(page, session.cookie)
    await page.goto(`${zh ? '/zh-CN' : ''}/competitions/browse`)
    await expect(page.getByText('Other Owner Cup', { exact: true })).toHaveCount(0)
    expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('Australia/Perth')
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('system')
    await expect(page.locator('html')).toHaveClass(/light/)
    await expect(page.locator('[data-competition-perf-ready="browse"]')).toBeVisible()
    await expect.poll(() => reportedVitals.filter(sample => sample.metricName === 'COMPETITIONS_BROWSE_READY').length).toBeGreaterThan(0)
    await testInfo.attach('browse-admin-readiness', { body: JSON.stringify({ url: page.url(), persona: 'PA', timezone: 'Australia/Perth', theme: 'system', samples: reportedVitals.filter(sample => sample.metricName === 'COMPETITIONS_BROWSE_READY').map(sample => ({ ...sample, validDurationMs: sample.result === 'ok' && typeof sample.value === 'number' ? sample.value : null })) }), contentType: 'application/json' })
    const mine = page.getByRole('button', { name: zh ? '我管理的' : 'I manage', exact: true })
    await mine.click()
    await expect(page).toHaveURL(url => url.searchParams.get('mine') === 'true')
    const otherRow = page.getByRole('row').filter({ hasText: 'Other Owner Cup' })
    await expect(otherRow).toHaveCount(1)
    await expect(otherRow.getByText(zh ? '可管理 · 未参赛' : 'Manageable · not participating', { exact: true })).toBeVisible()
    await expect(page.getByRole('row').filter({ hasText: 'J12 Owned Cup' }).getByText(zh ? '可管理 · 已参赛' : 'Manageable · participating', { exact: true })).toBeVisible()
    await mine.click()
    await expect(page).toHaveURL(url => !url.searchParams.has('mine'))
    await expect(page.getByText('Other Owner Cup', { exact: true })).toHaveCount(0)
   } finally {
    try { await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) }) } finally { await session.cleanup() }
   }
  })
 }
}

})

test.describe('Home coverage fixture scenarios', () => {
 test.use({ timezoneId: 'Australia/Perth', colorScheme: 'light' })
 test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Dedicated isolated single-worker fixture suite')
 test.describe.configure({ mode: 'serial' })

for (const locale of ['en', 'zh-CN']) {
 for (const width of [1440, 390]) {
  test(`SSR remediation HOME01 public regions precede personal desk ${locale} ${width}px`, async ({ page }, testInfo) => {
   test.skip(process.env.E2E_SSR_REMEDIATION !== '1', 'Requires isolated fixture controls')
   const zh = locale === 'zh-CN'
   const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
   const session = await createSession({ entryId: 15702 })
   try {
    await page.setViewportSize({ width, height: 900 })
    await addSessionCookie(page, session.cookie)
    expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [{ operation: 'GetHomePersonalDesk', delayMs: 3500 }] }) })).ok).toBe(true)
    await page.goto(zh ? '/zh-CN' : '/', { waitUntil: 'commit' })
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const performance = page.getByRole('region', { name: zh ? '本轮表现' : 'Matchday performance', exact: true })
    await expect(performance).toContainText('101')
    await expect(performance).toContainText('Saka')
    await expect(page.getByRole('region', { name: zh ? '市场看板' : 'Market desk', exact: true })).toContainText('Saka')
    const matches = page.locator('[data-home-matches]')
    await expect(matches).toHaveAttribute('data-home-fixtures-event', '33')
    await expect(matches).toContainText('ARS')
    await expect(matches).toContainText('CHE')
    const pending = (await (await fetch(fixture)).json()).requests.find((row: { operation: string }) => row.operation === 'GetHomePersonalDesk')
    expect(pending).toBeDefined()
    expect(pending.finishedAt).toBeNull()
    await expect(page.locator('[data-home-personal-ready="true"]')).toHaveCount(0)
    await matches.getByRole('button', { name: zh ? '下一轮' : 'Next gameweek', exact: true }).click()
    await expect(matches).toHaveAttribute('data-home-fixtures-event', '34')
    await expect(page.locator('[data-home-personal-ready="true"]')).toContainText('E2E United')
    await expect(page.locator('[data-home-league-ranks-ready="true"]')).toHaveCount(1)
    await expect(matches).toHaveAttribute('data-home-fixtures-event', '34')
    await testInfo.attach('home-personal-request-timeline', { body: JSON.stringify((await (await fetch(fixture)).json()).requests), contentType: 'application/json' })
   } finally {
    try { await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) }) } finally { await session.cleanup() }
   }
  })
 }
}

for (const locale of ['en', 'zh-CN']) {
 for (const width of [1440, 390]) {
  test(`SSR remediation HOME01 personal failure preserves public content and retries ${locale} ${width}px`, async ({ page }, testInfo) => {
   test.skip(process.env.E2E_SSR_REMEDIATION !== '1', 'Requires isolated fixture controls')
   const zh = locale === 'zh-CN'
   const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
   const session = await createSession({ entryId: 15702 })
   try {
    await page.setViewportSize({ width, height: 900 })
    await addSessionCookie(page, session.cookie)
    expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [{ operation: 'GetHomePersonalDesk', error: true }] }) })).ok).toBe(true)
    await page.goto(zh ? '/zh-CN' : '/')
    const unavailable = page.locator('#main-content [data-home-personal-ready="unavailable"]').filter({ visible: true })
    await expect(unavailable).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const performance = page.getByRole('region', { name: zh ? '本轮表现' : 'Matchday performance', exact: true })
    await expect(performance).toContainText('101')
    await expect(performance).toContainText('Saka')
    const market = page.getByRole('region', { name: zh ? '市场看板' : 'Market desk', exact: true })
    await expect(market).toContainText('Saka')
    const matches = page.locator('[data-home-matches]')
    await expect(matches).toHaveAttribute('data-home-fixtures-event', '33')
    await expect(matches).toContainText('ARS')
    await expect(matches).toContainText('CHE')
    await matches.getByRole('button', { name: zh ? '下一轮' : 'Next gameweek', exact: true }).click()
    await expect(matches).toHaveAttribute('data-home-fixtures-event', '34')
    const before = (await (await fetch(fixture)).json()).requests.filter((row: { operation: string }) => row.operation === 'GetHomePersonalDesk').length
    expect(before).toBeGreaterThan(0)
    expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ reset: false, rules: [] }) })).ok).toBe(true)
    await unavailable.getByRole('button', { name: zh ? '重试' : 'Try again', exact: true }).click()
    await expect(page.locator('[data-home-personal-ready="true"]')).toContainText('E2E United')
    await expect(unavailable).toHaveCount(0)
    await expect(matches).toHaveAttribute('data-home-fixtures-event', '34')
    await expect(performance).toContainText('101')
    await expect(market).toContainText('Saka')
    const requests = (await (await fetch(fixture)).json()).requests
    expect(requests.filter((row: { operation: string }) => row.operation === 'GetHomePersonalDesk').length).toBeGreaterThan(before)
    await testInfo.attach('home-personal-recovery-timeline', { body: JSON.stringify(requests), contentType: 'application/json' })
   } finally {
    try { await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) }) } finally { await session.cleanup() }
   }
  })
 }
}

for (const locale of ['en', 'zh-CN']) {
 for (const width of [1440, 390]) {
  test(`SSR remediation HOME01 unbound identity preserves public regions ${locale} ${width}px`, async ({ page }, testInfo) => {
   const zh = locale === 'zh-CN'
   const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
   const session = await createSession()
   try {
    await page.setViewportSize({ width, height: 900 })
    await addSessionCookie(page, session.cookie)
    expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })).ok).toBe(true)
    const response = await page.goto(zh ? '/zh-CN' : '/')
    expect(response?.headers()['cache-control']).toContain('private')
    const main = page.locator('#main-content')
    await expect(main.getByText(zh ? '绑定你的 FPL 球队' : 'Link your FPL team', { exact: true })).toBeVisible()
    const bind = main.getByRole('link', { name: zh ? '绑定 FPL 球队' : 'Link FPL entry', exact: true })
    await expect(bind).toHaveAttribute('href', zh ? '/zh-CN/onboarding/bind-entry' : '/onboarding/bind-entry')
    await expect(main.locator('[data-home-personal-ready]')).toHaveCount(0)
    await expect(main.getByRole('region', { name: zh ? '本轮表现' : 'Matchday performance', exact: true })).toContainText('101')
    await expect(main.getByRole('region', { name: zh ? '市场看板' : 'Market desk', exact: true })).toContainText('Saka')
    const matches = main.locator('[data-home-matches]')
    await expect(matches).toHaveAttribute('data-home-fixtures-event', '33')
    await expect(matches).toContainText('ARS')
    await matches.getByRole('button', { name: zh ? '下一轮' : 'Next gameweek', exact: true }).click()
    await expect(matches).toHaveAttribute('data-home-fixtures-event', '34')
    const requests = (await (await fetch(fixture)).json()).requests
    expect(requests.filter((row: { operation: string }) => row.operation === 'GetHomePersonalDesk')).toHaveLength(0)
    await testInfo.attach('home-unbound-request-timeline', { body: JSON.stringify(requests), contentType: 'application/json' })
   } finally {
    try { await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) }) } finally { await session.cleanup() }
   }
  })
 }
}

for (const locale of ['en', 'zh-CN']) {
 for (const width of [1440, 390]) {
  test(`SSR remediation HOME04 dates and gameweek boundaries ${locale} ${width}px`, async ({ page }, testInfo) => {
   const zh = locale === 'zh-CN'
   const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
   const teams = [{ id: 1, name: 'Arsenal', shortName: 'ARS' }, { id: 2, name: 'Chelsea', shortName: 'CHE' }, { id: 3, name: 'Everton', shortName: 'EVE' }]
   const fixtures = [0, 1].map(index => ({ id: 3401 + index, code: 3401 + index, event: { id: 34, name: 'Gameweek 34' }, kickoffTime: `2026-08-${index ? '10' : '09'}T12:00:00.000Z`, finished: false, started: false, homeTeam: teams[index], awayTeam: teams[index + 1], homeScore: null, awayScore: null, homeTeamDifficulty: 2, awayTeamDifficulty: 3 }))
   try {
    await page.setViewportSize({ width, height: 900 })
    expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [{ operation: 'GetHomeEventFixtures', variables: { eventId: 34 }, data: { coreEventContext: { season: '2627', revision: '7', sourceCheckedAt: '2026-08-13T09:40:00.000Z', currentEventId: 33 }, eventFixtures: fixtures } }] }) })).ok).toBe(true)
    await page.goto(zh ? '/zh-CN' : '/')
    const requests: number[] = []
    page.on('request', request => { const url = new URL(request.url()); if (url.pathname === '/api/home/fixtures') requests.push(Number(url.searchParams.get('eventId'))) })
    const matches = page.locator('#main-content [data-home-matches]')
    const previous = matches.getByRole('button', { name: zh ? '上一轮' : 'Previous gameweek', exact: true })
    const next = matches.getByRole('button', { name: zh ? '下一轮' : 'Next gameweek', exact: true })
    await expect(matches).toHaveAttribute('data-home-fixtures-event', '33')
    await next.click()
    await expect(matches).toHaveAttribute('data-home-fixtures-event', '34')
    const tabs = matches.getByRole('tab')
    await expect(tabs).toHaveCount(2)
    await tabs.nth(0).click()
    await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true')
    await expect(matches.getByRole('tabpanel')).toContainText('ARS')
    await expect(matches.getByRole('tabpanel')).not.toContainText('EVE')
    await tabs.nth(1).click()
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')
    await expect(matches.getByRole('tabpanel')).toContainText('EVE')
    await expect(matches.getByRole('tabpanel')).not.toContainText('ARS')
    await tabs.nth(1).press('Home')
    await expect(tabs.nth(0)).toBeFocused()
    await expect(matches.getByRole('tabpanel')).toContainText('ARS')
    await tabs.nth(0).press('End')
    await expect(tabs.nth(1)).toBeFocused()
    await expect(matches.getByRole('tabpanel')).toContainText('EVE')
    expect(requests).toEqual([34])
    for (let event = 33; event >= 1; event -= 1) {
     await previous.click()
     await expect(matches).toHaveAttribute('data-home-fixtures-event', String(event))
     await expect(matches.getByText(`GW${event}`, { exact: true })).toBeVisible()
    }
    await expect(previous).toBeDisabled()
    await expect(next).toBeEnabled()
    for (let event = 2; event <= 38; event += 1) {
     await next.click()
     await expect(matches).toHaveAttribute('data-home-fixtures-event', String(event))
     await expect(matches.getByText(`GW${event}`, { exact: true })).toBeVisible()
    }
    await expect(next).toBeDisabled()
    await expect(previous).toBeEnabled()
    expect(requests.every(event => event >= 1 && event <= 38)).toBe(true)
    expect(requests.filter(event => event === 34)).toHaveLength(1)
    expect(requests.filter(event => event === 33)).toHaveLength(0)
    await testInfo.attach('home-fixture-read-events', { body: JSON.stringify(requests), contentType: 'application/json' })
   } finally {
    await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
   }
  })
 }
}

for (const timezoneId of ['UTC', 'Australia/Perth']) {
 test.describe(`HOME05 ${timezoneId}`, () => {
  test.use({ timezoneId })
  for (const locale of ['en', 'zh-CN']) {
   test(`SSR remediation HOME05 finished current event uses next deadline ${locale}`, async ({ page }, testInfo) => {
    const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
    const deadline = '2030-01-01T18:30:00.000Z'
    const hydrationErrors: string[] = []
    page.on('pageerror', error => hydrationErrors.push(error.message))
    page.on('console', message => { if (message.type() === 'error' && /hydrat|server rendered/i.test(message.text())) hydrationErrors.push(message.text()) })
    try {
     expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [{ operation: 'GetHomePublicBootstrap', data: { homePublicBootstrap: { context: { season: '2627', revision: 'home05', sourceCheckedAt: '2026-09-18T00:00:00.000Z', currentEventId: 33, latestFinishedEventId: 33, nextEventId: 34, nextDeadlineTime: deadline }, fixtures: [] } } }] }) })).ok).toBe(true)
     // The shared standalone server keeps the real five-second bootstrap cache.
     // Establish this scenario before observing the tested navigation.
     await expect.poll(async () => {
      await (await page.request.get('/')).body()
      const requests = (await (await fetch(fixture)).json()).requests
      return requests.some((row: { operation: string; finishedAt: number | null }) => row.operation === 'GetHomePublicBootstrap' && row.finishedAt !== null)
     }, { timeout: 12_000, intervals: [100, 250, 500] }).toBe(true)
     const setupRequests = (await (await fetch(fixture)).json()).requests.length
     await page.goto(locale === 'zh-CN' ? '/zh-CN' : '/')
     const card = page.locator('#main-content [data-countdown-card]')
     await expect(card.locator('[data-countdown-title]')).toContainText('34')
     const expected = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short', timeZone: timezoneId }).format(new Date(deadline))
     await expect(card.locator('[data-countdown-deadline] time')).toHaveText(expected)
     const matches = page.locator('#main-content [data-home-matches]')
     await expect(matches).toHaveAttribute('data-home-fixtures-event', '34')
     await expect(matches).toContainText('CHE')
     await expect(matches).toContainText('EVE')
     const observations = (await (await fetch(fixture)).json()).requests.slice(setupRequests)
     const requestedEvents = observations.filter((row: { operation: string }) => row.operation === 'GetHomeEventFixtures').map((row: { variables: { eventId: number } }) => row.variables.eventId)
     await testInfo.attach('home05-all-requests', { body: JSON.stringify(observations), contentType: 'application/json' })
     expect(requestedEvents).toContain(34)
     expect(requestedEvents).not.toContain(33)
     for (const targetLocale of [locale === 'en' ? 'zh-CN' : 'en', locale]) {
      const switcher = page.locator('details[data-locale-picker]').filter({ visible: true })
      await expect(switcher).toHaveCount(1)
      await switcher.locator(':scope > summary').click()
      await switcher.getByRole('radio', { name: targetLocale === 'en' ? 'English' : '简体中文', exact: true }).click()
      await expect(page).toHaveURL(url => targetLocale === 'en' ? ['/', '/en'].includes(url.pathname) : url.pathname === '/zh-CN')
      await expect(page.locator('html')).toHaveAttribute('lang', targetLocale)
      const switchedDeadline = new Intl.DateTimeFormat(targetLocale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short', timeZone: timezoneId }).format(new Date(deadline))
      await expect(card.locator('[data-countdown-deadline] time')).toHaveText(switchedDeadline)
      await expect(card.locator('[data-countdown-title]')).toContainText('34')
      await expect(matches).toHaveAttribute('data-home-fixtures-event', '34')
      await expect(matches).toContainText('CHE')
      await expect(matches).toContainText('EVE')
     }
     expect(hydrationErrors).toEqual([])
     await testInfo.attach('home-deadline-localized', { body: JSON.stringify({ timezoneId, locale, deadline, expected, requestedEvents, hydrationErrors, ssrUtcText: 'NOT_OBSERVED' }), contentType: 'application/json' })
    } finally {
     await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
    }
   })
  }
 })
}

})
