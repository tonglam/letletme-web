import { createHmac, randomUUID } from 'node:crypto'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import postgres from 'postgres'

const authSecret = 'playwright-better-auth-secret-at-least-32-bytes'

async function createSession(
	options: {
		entryId?: number
	} = {}
): Promise<{ cookie: string; cleanup: () => Promise<void> }> {
	const directDatabaseUrl = process.env.DIRECT_DATABASE_URL
	if (!directDatabaseUrl) throw new Error('DIRECT_DATABASE_URL is required')
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

async function useCookie(page: Page, cookie: string): Promise<void> {
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
	await useCookie(
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
		await useCookie(page, session.cookie)
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
		await useCookie(page, session.cookie)
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

test('the server-rendered signed navigation logs out through a same-origin POST', async ({
	page
}) => {
	const session = await createSession({ entryId: 15702 })
	try {
		await useCookie(page, session.cookie)
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
		await useCookie(page, session.cookie)
		await page.goto('/zh-CN')
		const navigation = page.getByRole('navigation')
		await navigation.getByText('E2E Manager', { exact: true }).first().click()
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
		await useCookie(page, session.cookie)
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
		await useCookie(page, session.cookie)
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
		await useCookie(page, session.cookie)
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
		await useCookie(page, session.cookie)
		await page.goto('/')
		await expect(page.locator('[data-home-league-ranks-ready]')).toBeVisible()
		await page.clock.fastForward(61_000)
		expect(
			clientGraphqlOperations.some(operation =>
				operation.includes('entryOfficialH2HDesk')
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
