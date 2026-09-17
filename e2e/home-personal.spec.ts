import { officialH2HFixture } from './fixtures/official-h2h'
import { createHmac, randomUUID } from 'node:crypto'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import postgres from 'postgres'

const authSecret = 'playwright-better-auth-secret-at-least-32-bytes'

async function createSession(
	options: {
		entryId?: number
	} = {}
): Promise<{ cookie: string; userId: string; cleanup: () => Promise<void> }> {
	const directDatabaseUrl = process.env.E2E_DIRECT_DATABASE_URL
	if (!directDatabaseUrl) throw new Error('E2E_DIRECT_DATABASE_URL is required')
	const sql = postgres(directDatabaseUrl, { max: 1, prepare: false })
	const suffix = randomUUID()
	const userId = `home-e2e-user-${suffix}`
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
				await expect(page.locator('#my-squad li')).not.toHaveCount(0)
				if (pathname.includes('fixtures')) await expect(page.getByRole('button', { name: 'Hardest first', exact: true })).toHaveAttribute('aria-pressed', 'true')
				else await expect(page.locator('#price-change-search')).toHaveValue('Saka')
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

for (const recoveryMode of ['none', 'retry-button', 'tab-reentry', 'partial-ssr-seed', 'failed-ssr-seed', 'search-empty', 'gw-route', 'live-journey', 'live-journey-pinned'] as const) {
for (const locale of recoveryMode === 'none' || recoveryMode === 'search-empty' || recoveryMode === 'gw-route' || (recoveryMode === 'live-journey' || recoveryMode === 'live-journey-pinned') ? ['en', 'zh-CN'] : ['en']) {
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
	const reviewTournamentId = (recoveryMode === 'live-journey' || recoveryMode === 'live-journey-pinned') ? 6 : 77
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
		if ((recoveryMode === 'live-journey' || recoveryMode === 'live-journey-pinned')) {
			await page.setViewportSize(locale === 'zh-CN' ? { width: 390, height: 844 } : { width: 1440, height: 900 })
			if (recoveryMode === 'live-journey-pinned') {
				await page.route('**/api/live/competitions/6/board', async route => {
					const response = await route.fetch()
					const body = await response.json()
					const board = body.entryLiveCompetitionBoard
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
			await live.click()
			await expect(page).toHaveURL(url => url.pathname === `${prefix}/live/competitions` && url.searchParams.get('tournamentId') === '6' && url.searchParams.get('gw') === '4')
			const team = page.getByRole('link', { name: /E2E United/ }).filter({ visible: true })
			await expect(team).toHaveCount(1)
			await expect(team).toBeVisible()
			if (recoveryMode === 'live-journey-pinned') {
				await expect(page.getByRole('link', { name: /Pinned Viewer United/ }).filter({ visible: true })).toHaveCount(1)
				await page.getByRole('button', { name: locale === 'zh-CN' ? '对比' : 'Compare', exact: true }).click()
				await page.getByRole('checkbox', { name: locale === 'zh-CN' ? '选择 E2E United 进行对比' : 'Select E2E United for comparison', exact: true }).filter({ visible: true }).check()
				await page.getByRole('checkbox', { name: locale === 'zh-CN' ? '选择 Pinned Viewer United 进行对比' : 'Select Pinned Viewer United for comparison', exact: true }).filter({ visible: true }).check()
				const compareOpener = page.getByRole('button', { name: locale === 'zh-CN' ? '对比（2）' : 'Compare (2)', exact: true })
				await compareOpener.click()
				await expect(page.getByRole('dialog')).toBeVisible()
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
 test(`canonical competition board sort and pagination preserve request scope at ${width}px`, async ({ page }) => {
  test.skip(process.env.E2E_SSR_REMEDIATION !== '1', 'Uses isolated board fixtures')
  const session = await createSession({ entryId: 123 })
  const inputs: Array<{ sort?: string; direction?: string; after?: string | null }> = []
  try {
   await page.setViewportSize({ width, height: 900 })
   await addSessionCookie(page, session.cookie)
   await page.route('**/api/live/competitions/6/board', async route => {
    const payload = route.request().postDataJSON()
    expect(payload.eventId).toBe(4)
    const input = payload.input ?? {}
    inputs.push(input)
    const response = await route.fetch()
    expect(response.ok()).toBe(true)
    const body = await response.json()
    const board = body.entryLiveCompetitionBoard
    const template = board.rows[0]
    const rows = [
     { ...template, entry: 15702, entryName: 'Alpha Coverage', score: { ...template.score, eventPoints: 30, totalPoints: 100 } },
     { ...template, entry: 15703, entryName: 'Beta Coverage', score: { ...template.score, eventPoints: 20, totalPoints: 300 } },
     { ...template, entry: 15704, entryName: 'Gamma Coverage', score: { ...template.score, eventPoints: 10, totalPoints: 200 } }
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
   await page.goto('/live/competitions?tournamentId=6&gw=4')
   const teams = page.getByRole('link', { name: /(?:Alpha|Beta|Gamma) Coverage/ }).filter({ visible: true })
   await expect(teams).toHaveCount(2)
   await expect(teams.nth(0)).toContainText('Alpha Coverage')
   await page.getByRole('button', { name: 'Show 1 more', exact: true }).click()
   await expect(teams).toHaveCount(3)
   await expect(teams.nth(2)).toContainText('Gamma Coverage')
   expect(inputs.at(-1)).toMatchObject({ after: 'coverage-page-2' })
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
  } finally {
   await session.cleanup()
  }
 })
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


test('J08 official H2H standings and fixtures preserve round identity', async ({ page }) => {
 test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1' || process.env.E2E_LIVE_HYDRATION !== '1', 'Dedicated isolated single-worker fixture suite')
 const session = await createSession({ entryId: 15702 })
 const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
 const tournament = { id: 6, name: 'J08 Official H2H', leagueType: 'H2H', groupMode: 'BATTLE_RACES', rosterMode: 'OFFICIAL_SYNC', totalTeamNum: 3, setupStatus: 'READY', standingsReadyAt: '2026-09-01T00:00:00.000Z', setupHasWarnings: false, warningSummaries: [] }
 const rules = [
  { operation: 'GetEntryTournaments', data: { entryTournaments: [tournament] } },
  ...([3, 4] as const).flatMap(eventId => {
   const value = officialH2HFixture(eventId)
   return [
    { operation: 'GetTournamentOfficialH2H', variables: { eventId }, data: { tournamentOfficialH2H: value.snapshot } },
    { operation: 'GetLeagueLiveHead', variables: { eventId }, data: { leagueLiveHead: value.head } },
    { operation: 'GetTournamentOfficialH2HHistory', variables: { eventId }, data: { tournamentOfficialH2HHistory: { tournamentId: 6, eventId, matches: [] } } },
   ]
  }),
 ]
 try {
  expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules }) })).ok).toBe(true)
  await addSessionCookie(page, session.cookie)
  await page.goto('/live/competitions?tournamentId=6&gw=4')
  const standings = page.getByRole('tab', { name: /Head-to-Head table/ })
  await standings.click()
  const homeLink = page.locator('a[href="/live/points/123?tournamentId=6&gw=4"]').filter({ visible: true })
  await expect(homeLink).toHaveCount(1)
  await expect(homeLink).toContainText('H2H Home United')
  await page.getByRole('tab', { name: /Round fixtures/ }).click()
  await expect(page.getByRole('tabpanel', { name: /Round fixtures/ }).getByText('H2H Away United', { exact: true })).toBeVisible()
  await expect(page.locator('a[href*="/live/points/null"], a[href*="/live/points/0?"]')).toHaveCount(0)
  await page.getByRole('link', { name: 'Previous', exact: true }).click()
  await expect(page).toHaveURL(url => url.searchParams.get('gw') === '3')
  await page.getByRole('tab', { name: /Head-to-Head table/ }).click()
  await expect(page.locator('a[href="/live/points/123?tournamentId=6&gw=3"]').filter({ visible: true })).toHaveCount(1)
 } finally {
  await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
  await session.cleanup()
 }
})
