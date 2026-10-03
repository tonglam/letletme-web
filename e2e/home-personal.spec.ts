import { getCurrentSeasonKey } from '../lib/season'
import { managedTournament } from './fixtures/managed-tournament'
import { officialH2HFixture } from './fixtures/official-h2h'
import { createHmac, randomUUID } from 'node:crypto'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import postgres from 'postgres'
import { managerReview, managerGameweek, managerSnapshot, managerStateReview, managerStateScenarios } from './fixtures/manager-review'
import enMessages from '../messages/en.json'
import zhMessages from '../messages/zh-CN.json'
import { GET_LIVE_POINTS } from '../lib/graphql/operations/live'

test.describe('HOME04 planned fixture states', () => {
 test.use({ viewport: { width: 390, height: 900 }, colorScheme: 'dark', timezoneId: 'UTC' })
 for (const [index, scenario] of [[0, 'DGW'], [1, 'BGW'], [2, 'settled']] as const) {
  test(`SSR remediation HOME04 planned ${scenario} dates and round boundaries`, async ({ page }, testInfo) => {
   test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Isolated fixture controls only')
   const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
   const teams = [{ id: 1, name: 'Arsenal', shortName: 'ARS' }, { id: 2, name: 'Chelsea', shortName: 'CHE' }, { id: 3, name: 'Everton', shortName: 'EVE' }]
   const fixtures = scenario === 'BGW' ? [] : [0, 1].map(day => ({ id: 3401 + day, code: 3401 + day, event: { id: 34, name: 'Gameweek 34' }, kickoffTime: `2026-08-${day ? '10' : '09'}T12:00:00.000Z`, finished: scenario === 'settled', started: scenario === 'settled', homeTeam: teams[0], awayTeam: teams[day + 1], homeScore: scenario === 'settled' ? day + 2 : null, awayScore: scenario === 'settled' ? day : null, homeTeamDifficulty: 2, awayTeamDifficulty: 3 }))
   const requests: number[] = []
   try {
    await page.addInitScript(() => localStorage.setItem('theme', 'system'))
    expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [{ operation: 'GetHomeEventFixtures', variables: { eventId: 34 }, data: { coreEventContext: { season: '2627', revision: `home04-${scenario}`, sourceCheckedAt: '2026-08-13T09:40:00.000Z', currentEventId: 33 }, eventFixtures: fixtures } }] }) })).ok).toBe(true)
    await page.goto('/zh-CN')
    page.on('request', request => { const url = new URL(request.url()); if (url.pathname === '/api/home/fixtures') requests.push(Number(url.searchParams.get('eventId'))) })
    const matches = page.locator('#main-content [data-home-matches]')
    const previous = matches.getByRole('button', { name: '上一轮', exact: true })
    const next = matches.getByRole('button', { name: '下一轮', exact: true })
    await expect(matches).toHaveAttribute('data-home-fixtures-event', '33')
    await next.click()
    await expect(matches).toHaveAttribute('data-home-fixtures-event', '34')
    const tabs = matches.getByRole('tab')
    if (scenario === 'BGW') {
     await expect(tabs).toHaveCount(0)
     await expect(matches.getByText('第 34 轮暂无比赛安排。', { exact: true })).toBeVisible()
     await expect(matches.getByRole('tabpanel')).toHaveCount(0)
    } else {
     await expect(tabs).toHaveCount(2)
     for (const day of [0, 1]) {
      await tabs.nth(day).click()
      await expect(tabs.nth(day)).toHaveAttribute('aria-selected', 'true')
      const panel = matches.getByRole('tabpanel')
      await expect(panel).toHaveAttribute('id', `home-fixture-panel-2026-08-${day ? '10' : '09'}`)
      await expect(panel).toContainText('ARS')
      await expect(panel).toContainText(day ? 'EVE' : 'CHE')
      await expect(panel).not.toContainText(day ? 'CHE' : 'EVE')
      if (scenario === 'settled') await expect(panel.getByText(day ? '3 - 1' : '2 - 0', { exact: true })).toBeVisible()
     }
    }
    expect(requests).toEqual([34])
    for (let event = 33; event >= 1; event--) {
     await previous.click()
     await expect(matches).toHaveAttribute('data-home-fixtures-event', String(event))
    }
    await expect(previous).toBeDisabled()
    for (let event = 2; event <= 38; event++) {
     await next.click()
     await expect(matches).toHaveAttribute('data-home-fixtures-event', String(event))
    }
    await expect(next).toBeDisabled()
    expect(requests.every(event => event >= 1 && event <= 38)).toBe(true)
    expect(requests.filter(event => event === 34)).toHaveLength(1)
    expect(requests.filter(event => event === 33)).toHaveLength(0)
    await expect(page.locator('html')).toHaveClass(/dark/)
    expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('UTC')
    await testInfo.attach('home04-planned-state', { contentType: 'application/json', body: JSON.stringify({ variantId: `HOME04.state.0${index + 1}`, scenario, identity: 'A', locale: 'zh-CN', viewport: page.viewportSize(), theme: 'dark', timezone: 'UTC', fixtureCount: fixtures.length, requests, functionalStatus: 'PASS', readyMs: null, performanceStatus: 'N/A', scope: 'Isolated scenario assertions only; not production performance' }) })
   } finally {
    await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
   }
  })
 }
})

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
}, testInfo) => {
	const session = await createSession({ entryId: 15702 })
	const clientGraphqlOperations: string[] = []
	page.on('request', request => {
		if (request.url().includes('/api/graphql')) {
			clientGraphqlOperations.push(request.postData() ?? '')
		}
	})
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
		expect(
			clientGraphqlOperations.some(operation =>
				operation.includes('tournamentOfficialH2H')
			)
		).toBe(false)
		await testInfo.attach('HOME03-states', {
			contentType: 'application/json',
			body: JSON.stringify({
				caseId: 'HOME03',
				stepIds: ['HOME03.01', 'HOME03.02'],
				fixture: {
					entryId: 15702,
					leagueRankRows: 8,
					classic: { name: 'E2E Classic', tournamentId: null },
					h2h: { name: 'E2E H2H', tournamentId: 6, officialMatchId: 2071743 },
					custom: {
						name: 'E2E League 2',
						tournamentId: 77,
						route: '/my-fpl/competitions?tournamentId=77'
					}
				},
				assertions: [
					'classic tab renders ranks and does not expose loading as zero',
					'H2H tab renders the official matchup and links to live competition 6 at GW1',
					'custom tournament entry links to tournament management with tournamentId=77',
					'no client tournamentOfficialH2H polling request after tab navigation'
				],
				clientGraphqlOperations: clientGraphqlOperations.length,
				businessWrites: [],
				functionalStatus: 'PASS',
				performanceStatus: 'NOT_OBSERVED',
				readyMs: null,
				eventToPaintMs: null,
				wholeCaseComplete: false,
				wholePlannedStepComplete: false,
				missingReason: 'HOME03 state and route subset passed in the isolated fixture; full case variants, component/touchpoint matrix, and controlled timing repeats remain open.'
			})
		})
	} finally {
		await session.cleanup()
	}
})

for (const context of [
 ...(['en', 'zh-CN'] as const).flatMap(locale => [1440, 390].map(width => ({ locale, width, theme: 'system', timezoneId: 'Australia/Perth' }))),
 { locale: 'zh-CN', width: 390, theme: 'dark', timezoneId: 'UTC' }
]) {
 test.describe(`FIX04 planned ${context.locale} ${context.width} ${context.theme}`, () => {
  test.use({ viewport: { width: context.width, height: 900 }, timezoneId: context.timezoneId })
test('FIX04 bound squad opens a selectable gameweek range and preserves the terminal share pitch', async ({
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
		await page.addInitScript(theme => localStorage.setItem('theme', theme), context.theme)
		await addSessionCookie(page, session.cookie)
		await page.goto(context.locale === 'en' ? '/explore/fixtures' : '/zh-CN/explore/fixtures')
		expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(context.timezoneId)
		expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe(context.theme)

		await expect(page.locator('[data-page-fdr-legend="true"]')).toHaveCount(1)
		await page.locator('#my-squad summary').click()
		const pitch = page.locator('[data-schedule-pitch="true"]:visible')
		await expect(pitch).toBeVisible()
		const initialRequestCount = fixtureWindowRequests.length
		await pitch.getByRole('button', { name: context.locale === 'en' ? /^View Player 1's fixture details;/ : /^查看 Player 1 的赛程详情/ }).click()

		const dialog = page.getByRole('dialog')
		await expect(dialog).toBeVisible()
		await expect(dialog.getByRole('heading', { name: 'Player 1', exact: true })).toBeVisible()
		await expect(dialog.locator('#my-squad-fixture-range-from')).toBeVisible()
		await expect(dialog.locator('#my-squad-fixture-range-to')).toBeVisible()
		await dialog.locator('#my-squad-fixture-range-from').selectOption('1')
		await dialog.locator('#my-squad-fixture-range-to').selectOption('38')
		const schedule = dialog.locator('ol')
		await expect(schedule.getByText('GW1', { exact: true })).toBeVisible()
		await expect(schedule.getByText('GW38', { exact: true })).toBeVisible()
		await expect(dialog.getByText('2–1', { exact: true })).toBeVisible()
		await expect(dialog.getByText('Finished', { exact: true })).toHaveCount(0)
		await expect(dialog.getByRole('button', { name: context.locale === 'en' ? 'Image' : '图片' })).toBeVisible()
		await expect
			.poll(() => fixtureWindowRequests.length)
			.toBe(initialRequestCount + 8)

		await page.keyboard.press('Escape')
		await expect(dialog).toHaveCount(0)
		await expect(pitch.getByRole('button', { name: context.locale === 'en' ? /^View Player 1's fixture details;/ : /^查看 Player 1 的赛程详情/ })).toBeFocused()

		const sixGws = page.getByRole('button', { name: context.locale === 'en' ? '6 GWs' : '6 轮' })
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
			page.locator('#my-squad').getByRole('button', { name: context.locale === 'en' ? 'Image' : '图片' })
		).toBeVisible()
	} finally {
		await session.cleanup()
	}
})

 })
}

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
		await page.evaluate(async () => {
			await document.fonts?.ready
		})
		// Streaming market content and the carousel can commit a layout update
		// after the heading and fonts are ready. Assert the settled layout while
		// retaining the real overflow condition; persistent overflow still fails.
		await expect
			.poll(
				() =>
					page.evaluate(
						() => document.documentElement.scrollWidth <= window.innerWidth
					),
				{ timeout: 5_000 }
			)
			.toBe(true)
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

	for (const locale of ['en', 'zh-CN']) for (const width of [1440, 390]) {
	 test.describe(`S08 bound isolation baseline ${locale} ${width}`, () => {
	  test.use({ locale, viewport: { width, height: 900 }, colorScheme: 'light', timezoneId: 'Australia/Perth' })
	 test(`prediction squad isolates A B A session reads ${locale} ${width}px`, async ({ page }, testInfo) => {
	  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Isolated session switching only')
	  const a = await createSession({ entryId: 15702 })
	  const b = await createSession({ entryId: 15702 })
	  expect(a.userId).not.toBe(b.userId)
	  expect(a.entryId).not.toBe(b.entryId)
	  await page.addInitScript(() => localStorage.setItem('theme', 'system'))
	  const accounts = [a, b]
	  const rules = accounts.map((account, index) => ({ operation: 'GetEntryEventResult', variables: { entryId: account.entryId }, data: { entryEventResult: { eventPicks: Array.from({ length: 15 }, (_, player) => ({ element: 1001 + index * 100 + player, webName: `Account${index} Player${player + 1}`, teamShortName: 'ARS', elementTypeName: player < 2 ? 'GOALKEEPER' : player < 7 ? 'DEFENDER' : player < 12 ? 'MIDFIELDER' : 'FORWARD', position: player + 1, multiplier: 1, isCaptain: player === 0, isViceCaptain: player === 1 })) } } }))
	  try {
	   await control(rules)
	   await page.setViewportSize({ width, height: 900 })
	   const path = `${locale === 'zh-CN' ? '/zh-CN' : ''}/explore/price-predictions#my-squad`
	   let navigationCount = 0
	   for (const index of [0, 1, 0]) {
	    await page.context().clearCookies()
	    await addSessionCookie(page, accounts[index].cookie)
	    const documentResponse = navigationCount++ === 0 ? await page.goto(path) : await page.reload()
	    expect(documentResponse?.status()).toBe(200)
	    const squad = page.locator('#my-squad')
	    await expect(squad).toHaveAttribute('open', '')
	    await expect(squad.locator('li:visible')).toHaveCount(15)
	    for (let player = 1; player <= 15; player++) await expect(squad.getByText(`Account${index} Player${player}`, { exact: true })).toBeVisible()
	    await expect(squad).not.toContainText(`Account${1 - index} Player`)
	   }
	   const reads = (await observations()).filter(row => row.operation === 'GetEntryEventResult').map(row => row.variables.entryId)
	   expect(reads).toEqual([a.entryId, b.entryId, a.entryId])
	   await control(rules)
	   await page.context().clearCookies()
	   expect((await page.reload())?.status()).toBe(200)
	   await expect(page.locator('#my-squad')).not.toContainText('Account0 Player')
	   await expect(page.locator('#my-squad')).not.toContainText('Account1 Player')
	   expect((await observations()).filter(row => ['GetEntryHistory', 'GetEntryEventResult'].includes(row.operation))).toEqual([])
	   expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('Australia/Perth')
	   expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('system')
	   await expect(page.locator('html')).toHaveClass(/light/)
	   expect(page.viewportSize()?.width).toBe(width)
	   await testInfo.attach('prediction-account-isolation', { body: JSON.stringify({ locale, width, theme: 'system', timezone: 'Australia/Perth', parentVariantId: `S08.UNRESOLVED_ROLE.${locale}.${width === 1440 ? 'desktop1440' : 'mobile390'}.base`, ownerIds: ['bound-member-allowed', 'B1-to-B2-cache-isolation'], wholeVariantComplete: false, entrySequence: reads, anonymousPrivateReads: 0, readyMs: null, environment: 'isolated fixture' }), contentType: 'application/json' })
	  } finally { await a.cleanup(); await b.cleanup() }
	 })
	 })
if (locale === 'zh-CN' && width === 390) test.describe('S08 required display context', () => {
test.use({ colorScheme: 'dark', timezoneId: 'UTC', locale, viewport: { width, height: 900 } })
test.beforeEach(async ({ page }, testInfo) => {
  expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('UTC')
  expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(true)
  expect(page.viewportSize()?.width).toBe(width)
  await testInfo.attach('S08-context', { contentType: 'application/json', body: JSON.stringify({ locale, width, theme: 'dark', timezone: 'UTC', environment: 'local-isolated', readyMs: null }) })
 })
test('S08.directed.08 exact context', async ({ page }, testInfo) => {
	  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Isolated session switching only')
	  const a = await createSession({ entryId: 15702 })
	  const b = await createSession({ entryId: 15702 })
	  const accounts = [a, b]
	  const rules = accounts.map((account, index) => ({ operation: 'GetEntryEventResult', variables: { entryId: account.entryId }, data: { entryEventResult: { eventPicks: Array.from({ length: 15 }, (_, player) => ({ element: 1001 + index * 100 + player, webName: `Account${index} Player${player + 1}`, teamShortName: 'ARS', elementTypeName: player < 2 ? 'GOALKEEPER' : player < 7 ? 'DEFENDER' : player < 12 ? 'MIDFIELDER' : 'FORWARD', position: player + 1, multiplier: 1, isCaptain: player === 0, isViceCaptain: player === 1 })) } } }))
	  try {
	   await control(rules)
	   await page.setViewportSize({ width, height: 900 })
	   const path = `${locale === 'zh-CN' ? '/zh-CN' : ''}/explore/price-predictions#my-squad`
	   let navigationCount = 0
	   for (const index of [0, 1, 0]) {
	    await page.context().clearCookies()
	    await addSessionCookie(page, accounts[index].cookie)
	    const documentResponse = navigationCount++ === 0 ? await page.goto(path) : await page.reload()
	    expect(documentResponse?.status()).toBe(200)
	    const squad = page.locator('#my-squad')
	    await expect(squad).toHaveAttribute('open', '')
	    await expect(squad.locator('li:visible')).toHaveCount(15)
	    for (let player = 1; player <= 15; player++) await expect(squad.getByText(`Account${index} Player${player}`, { exact: true })).toBeVisible()
	    await expect(squad).not.toContainText(`Account${1 - index} Player`)
	   }
	   const reads = (await observations()).filter(row => row.operation === 'GetEntryEventResult').map(row => row.variables.entryId)
	   expect(reads).toEqual([a.entryId, b.entryId, a.entryId])
	   await control(rules)
	   await page.context().clearCookies()
	   expect((await page.reload())?.status()).toBe(200)
	   await expect(page.locator('#my-squad')).not.toContainText('Account0 Player')
	   await expect(page.locator('#my-squad')).not.toContainText('Account1 Player')
	   expect((await observations()).filter(row => ['GetEntryHistory', 'GetEntryEventResult'].includes(row.operation))).toEqual([])
	   await testInfo.attach('prediction-account-isolation', { body: JSON.stringify({ locale, width, entrySequence: reads, anonymousPrivateReads: 0, readyMs: null, environment: 'isolated fixture' }), contentType: 'application/json' })
	  } finally { await a.cleanup(); await b.cleanup() }
	 })
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

	test.describe('C14 directed context', () => {
	test.use({ timezoneId: 'UTC', colorScheme: 'dark', viewport: { width: 390, height: 844 } })
	test('C14 navigation identity survives actual link Back and Forward', async ({ page }, testInfo) => {
		const { installVitals } = await import('../scripts/performance-metrics.mjs')
		await installVitals(page)
		await control([])
		const identity = () => page.evaluate(() => (performance.getEntriesByName('letletme-active-navigation').at(-1) as PerformanceMark | undefined)?.detail?.navigationId ?? null)
		await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
		await page.goto('/zh-CN/explore/selections?scope=public&cohort=competition:777&gw=33')
		expect(await page.evaluate(() => ({ width: innerWidth, lang: document.documentElement.lang, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }))).toEqual({ width: 390, lang: 'zh-CN', timezone: 'UTC' })
		await expect(page.locator('html')).toHaveClass(/dark/)
		const player = page.getByRole('tabpanel').getByRole('link', { name: 'Saka', exact: true }).first()
		await expect(player).toBeVisible()
		await expect.poll(identity).not.toBeNull()
		const initialId = await identity()
		const href = await player.getAttribute('href')
		expect(href).toBeTruthy()
		await player.click()
		await expect(page).toHaveURL(url => url.pathname === new URL(href!, url).pathname)
		await expect.poll(identity).not.toBe(initialId)
		const playerId = await identity()
		expect(playerId).not.toBeNull()
		await page.goBack()
		await expect(page).toHaveURL(/explore\/selections/)
		await expect(player).toBeVisible()
		await expect.poll(identity).not.toBe(playerId)
		const backId = await identity()
		expect(backId).not.toBeNull()
		await page.goForward()
		await expect(page).toHaveURL(url => url.pathname === new URL(href!, url).pathname)
		await expect.poll(identity).not.toBe(backId)
		const currentId = await identity()
		expect(currentId).not.toBeNull()
		const result = await page.evaluate(async ({ currentId, initialId }) => {
			for (const [navigationId, value] of [[currentId, 240], [initialId, 130]]) {
				await fetch('/api/vitals', { method: 'POST', body: JSON.stringify({ schemaVersion: 2, batchId: crypto.randomUUID(), samples: [{ metricName: 'C14_READY', result: 'ok', measurementKind: 'in_page_navigation', navigationId, value }] }) })
			}
			return (window as typeof window & { __performanceMetrics: { ready: Record<string, number> } }).__performanceMetrics.ready.C14_READY
		}, { currentId, initialId })
		expect(result).toBe(240)
		const invalidation = await page.evaluate(async navigationId => {
			const metrics = (window as typeof window & { __performanceMetrics: { ready: Record<string, number> } }).__performanceMetrics
			const send = async (batchId: string, result: string, value: number) => {
				await fetch('/api/vitals', { method: 'POST', body: JSON.stringify({ schemaVersion: 2, batchId, samples: [{ metricName: 'C14_READY', result, value, navigationId, measurementKind: 'in_page_navigation' }] }) })
			}
			const observed: (number | null)[] = []
			for (const status of ['unavailable', 'error']) {
				await send(crypto.randomUUID(), status, 0)
				observed.push(metrics.ready.C14_READY ?? null)
				await send(crypto.randomUUID(), 'ok', 240)
				observed.push(metrics.ready.C14_READY ?? null)
			}
			const batch = crypto.randomUUID()
			await send(batch, 'ok', 125)
			await send(crypto.randomUUID(), 'ok', 240)
			await send(batch, 'ok', 125)
			observed.push(metrics.ready.C14_READY ?? null)
			return observed
		}, currentId)
		expect(invalidation).toEqual([null, 240, null, 240, 240])
		await testInfo.attach('C14-directed-context', { contentType: 'application/json', body: JSON.stringify({ variantIds: ['C14.directed.02', 'C14.directed.03', 'C14.directed.08', 'C14.directed.01', 'C14.directed.06', 'C14.directed.09', 'C14.directed.10', 'C14.directed.11'], locale: 'zh-CN', width: 390, theme: 'dark', timezone: 'UTC', syntheticValues: [240, 130], readyMs: null, wholeVariantComplete: false }) })
	})
	})

	test('PUBLIC Trends is usable while its private catalog is pending', async ({ page }, testInfo) => {
		const readySamples: Record<string, unknown>[] = []
		let initialDeskSample: Record<string, unknown> | null = null
		await page.route('**/api/vitals', async route => {
			const payload = route.request().postDataJSON()
			readySamples.push(...(payload.samples ?? []).filter((sample: { metricName: string }) => ['TRENDS_CATALOG_READY', 'TRENDS_DESK_READY'].includes(sample.metricName)))
			await route.fulfill({ status: 204, body: '' })
		})
		const session = await createSession({ entryId: 15702 })
		await control([{ operation: 'TrendCohorts', variables: { access: 'MINE' }, delayMs: 4000 }])
		try {
			await addSessionCookie(page, session.cookie)
			await page.goto('/explore/selections?scope=public&cohort=competition:777&gw=33', { waitUntil: 'commit' })
			const cohort = page.getByRole('combobox', { name: 'Active league', exact: true })
			await expect(cohort).toHaveValue('competition:777', { timeout: 1500 })
			await expect(page.getByRole('tabpanel').getByRole('link', { name: 'Saka', exact: true }).first()).toBeVisible()
			await expect.poll(async () => (await observations()).some(row => row.operation === 'TrendCohorts' && row.variables.access === 'MINE' && row.finishedAt === null)).toBe(true)
			await expect(cohort).toHaveAttribute('aria-busy', 'false')
			await expect(page).toHaveURL(url => url.searchParams.get('scope') === 'public' && url.searchParams.get('cohort') === 'competition:777' && url.searchParams.get('gw') === '33')
			await expect.poll(() => readySamples.filter(sample => sample.metricName === 'TRENDS_DESK_READY').length).toBe(1)
			initialDeskSample = readySamples.find(sample => sample.metricName === 'TRENDS_DESK_READY')!
			expect(initialDeskSample.result).toBe('ok')
			expect(initialDeskSample.measurementKind).toBe('initial_navigation')
			expect(typeof initialDeskSample.value).toBe('number')
			expect(Number.isFinite(initialDeskSample.value)).toBe(true)
			expect(initialDeskSample.value).toBeGreaterThan(0)
			// The initial desk must finish while the independent private read is still pending.
			expect((await observations()).some(row => row.operation === 'TrendCohorts' && row.variables.access === 'MINE' && row.finishedAt === null)).toBe(true)
			await cohort.selectOption('competition:779')
			await expect(page.getByRole('tabpanel').getByRole('link', { name: 'Palmer', exact: true }).first()).toBeVisible()
			await expect.poll(async () => (await observations()).some(row => row.operation === 'TrendCohorts' && row.variables.access === 'MINE' && row.finishedAt !== null), { timeout: 6000 }).toBe(true)
			await expect(cohort).toHaveValue('competition:779')
			await expect(page).toHaveURL(url => url.searchParams.get('scope') === 'public' && url.searchParams.get('cohort') === 'competition:779')
			await expect(page.getByRole('tabpanel').getByRole('link', { name: 'Palmer', exact: true }).first()).toBeVisible()
			await expect(page.getByRole('button', { name: /^My Leagues/ })).toBeEnabled()
			await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
			expect(readySamples.filter(sample => sample.metricName === 'TRENDS_CATALOG_READY')).toHaveLength(1)
		} finally {
			const readyMs = initialDeskSample?.result === 'ok' && typeof initialDeskSample.value === 'number' && Number.isFinite(initialDeskSample.value) ? initialDeskSample.value : null
			await testInfo.attach('TR02-public-desk-ready', { body: JSON.stringify({
				caseId: 'TR02', stepId: 'TR02.02', variantId: 'TR02.state.01',
				environment: 'isolated fixture', scenario: 'private catalog delayed 4000ms',
				cohortId: 'competition:777', eventId: 33, readyMs, budgetMs: 2500,
				performanceStatus: readyMs === null ? 'NOT_OBSERVED' : readyMs <= 2500 ? 'PASS' : 'FAIL',
				measurement: initialDeskSample, normalPerformanceDistribution: false,
				wholeCaseComplete: false
			}), contentType: 'application/json' })
			await testInfo.attach('private-catalog-timeline', { body: JSON.stringify(await observations()), contentType: 'application/json' })
			await session.cleanup()
		}
	})

	test('PUBLIC Trends recovers private catalog failure and preserves scope history', async ({ page }) => {
		const session = await createSession({ entryId: 15702 })
		let attempts = 0
		await page.route('**/api/trends/my-cohorts', async route => {
			attempts++
			if (attempts === 1) return route.fulfill({ status: 503, json: { error: 'isolated catalog failure' } })
			await route.continue()
		})
		try {
			await addSessionCookie(page, session.cookie)
			await page.goto('/explore/selections?scope=public&cohort=competition:777&gw=33')
			const cohort = page.getByRole('combobox', { name: 'Active league', exact: true })
			await expect(cohort).toHaveValue('competition:777')
			await expect(page.getByText('My Leagues could not be loaded. Public League data is unaffected.', { exact: true })).toBeVisible()
			await expect(page.getByRole('tabpanel').getByRole('link', { name: 'Saka', exact: true }).first()).toBeVisible()
			await page.getByRole('button', { name: 'Retry', exact: true }).click()
			await expect(page.getByRole('button', { name: /^My Leagues/ })).toBeEnabled()
			await expect(cohort).toHaveValue('competition:777')
			await page.getByRole('button', { name: /^My Leagues/ }).click()
			await expect(cohort).toHaveValue('competition:778')
			await expect(cohort).toHaveAttribute('aria-busy', 'false')
			await expect(page).toHaveURL(url => url.searchParams.get('scope') === 'mine')
			await page.getByRole('button', { name: /^Public Leagues/ }).click()
			await expect(cohort).toHaveValue('competition:777')
			await expect(page).toHaveURL(url => url.searchParams.get('scope') === 'public')
			await page.goBack()
			await expect(cohort).toHaveValue('competition:778')
			await expect(cohort).toHaveAttribute('aria-busy', 'false')
			await page.goForward()
			await expect(cohort).toHaveValue('competition:777')
			await expect(page.getByRole('tabpanel').getByRole('link', { name: 'Saka', exact: true }).first()).toBeVisible()
			expect(attempts).toBe(2)
		} finally { await session.cleanup() }
	})

	for (const locale of ['en', 'zh-CN']) {
		for (const width of [1440, 390]) {
			test(`late private catalog preserves overlapping PUBLIC identity ${locale} ${width}`, async ({ page }) => {
				const zh = locale === 'zh-CN'
				const session = await createSession({ entryId: 15702 })
				let release!: () => void
				const gate = new Promise<void>(resolve => { release = resolve })
				let catalogStarted = false
				await page.route('**/api/trends/my-cohorts', async route => {
					const response = await route.fetch()
					const catalog = await response.json()
					catalog.cohorts[0].id = 'competition:777'
					catalogStarted = true
					await gate
					await route.fulfill({ response, json: catalog })
				})
				try {
					await page.setViewportSize({ width, height: 900 })
					await addSessionCookie(page, session.cookie)
					await page.goto(`${zh ? '/zh-CN' : ''}/explore/selections?scope=public&cohort=competition:777&gw=33`)
					const cohort = page.getByRole('combobox', { name: zh ? '当前联赛' : 'Active league', exact: true })
					await expect(cohort).toHaveValue('competition:777')
					await expect.poll(() => catalogStarted).toBe(true)
					release()
					const mine = page.getByRole('button', { name: zh ? /^我的联赛/ : /^My Leagues/ })
					const publicScope = page.getByRole('button', { name: zh ? /^公共联赛/ : /^Public Leagues/ })
					await expect(mine).toBeEnabled()
					await expect(publicScope).toHaveAttribute('aria-pressed', 'true')
					await expect(cohort).toHaveValue('competition:777')
					await expect(page).toHaveURL(url => url.searchParams.get('scope') === 'public')
					const privateRead = page.waitForResponse(response => response.url().includes('/api/trends/my-desk?') && response.url().includes('eventId=33'))
					await mine.click()
					expect((await privateRead).status()).toBe(200)
					await expect(cohort).toHaveAttribute('aria-busy', 'false')
					await expect(mine).toHaveAttribute('aria-pressed', 'true')
					await expect(page).toHaveURL(url => url.searchParams.get('scope') === 'mine' && url.searchParams.get('cohort') === 'competition:777')
					await publicScope.click()
					await expect(publicScope).toHaveAttribute('aria-pressed', 'true')
					await expect(page.getByRole('tabpanel').getByRole('link', { name: 'Saka', exact: true }).first()).toBeVisible()
					await expect(page).toHaveURL(url => url.searchParams.get('scope') === 'public')
				} finally { release(); await session.cleanup() }
			})
		}
	}

	test('unsupported personal exposure stays absent across same-cohort scope switches', async ({ page }) => {
		const session = await createSession({ entryId: 15702 })
		const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}`
		const seed = await (await fetch(`${fixture}/graphql`, {method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({query:'query TrendCohortSnapshot { fixture }', variables:{cohortId:'competition:777',eventId:33,access:'PUBLIC'}})})).json()
		const desk = seed.data.trendCohortSnapshot
		const exposure = {...desk.sections[0], capability:'PERSONAL_EXPOSURE', state:'UNSUPPORTED', rows:null, evidenceContext:{...desk.sections[0].evidenceContext, availabilityState:'UNSUPPORTED'}}
		desk.sections.push(exposure)
		desk.cohort.capabilities.push({capability:'PERSONAL_EXPOSURE',state:'UNSUPPORTED'})
		await page.route('**/api/trends/my-cohorts', async route => {
			const response = await route.fetch(); const catalog = await response.json()
			catalog.cohorts[0].id = 'competition:777'
			await route.fulfill({response,json:catalog})
		})
		let privateReads = 0
		await page.route('**/api/trends/my-desk?**', async route => {
			const response = await route.fetch(); const body = await response.json()
			const state = ++privateReads === 1 ? 'UNAVAILABLE' : 'READY'
			body.trendCohortSnapshot = {...desk, cohort:{...desk.cohort,access:'MINE'}, sections:[...desk.sections.filter((section: {capability:string}) => section.capability !== 'PERSONAL_EXPOSURE'), {...exposure,state,evidenceContext:{...exposure.evidenceContext,availabilityState:state},rows:state === 'READY' ? [{...desk.sections[0].rows[0],playerName:'Private exposure player'}] : null}]}
			await route.fulfill({response,json:body})
		})
		try {
			expect((await fetch(`${fixture}/__performance`,{method:'POST',body:JSON.stringify({rules:[{operation:'TrendCohortSnapshot',data:seed.data}]})})).ok).toBe(true)
			await addSessionCookie(page,session.cookie)
			await page.goto('/explore/selections?scope=public&cohort=competition:777&gw=33')
			await expect(page.getByRole('tab',{name:'My exposure',exact:true})).toHaveCount(0)
			await expect(page.getByRole('tabpanel')).toContainText('Saka')
			const mine = page.getByRole('button',{name:/^My Leagues/})
			await expect(mine).toBeEnabled(); await mine.click()
			await page.getByRole('tab',{name:'My exposure',exact:true}).click()
			const retry = page.getByRole('button',{name:'Retry',exact:true})
			await expect(retry).toBeVisible()
			await retry.click()
			await expect(page.getByRole('tabpanel')).toContainText('Private exposure player')
			expect(privateReads).toBe(2)
			await page.getByRole('button',{name:/^Public Leagues/}).click()
			await expect(page).toHaveURL(url => url.searchParams.get('scope') === 'public' && url.searchParams.get('cohort') === 'competition:777')
			await expect(page.getByRole('tab',{name:'My exposure',exact:true})).toHaveCount(0)
			await expect(page.getByRole('tabpanel')).toContainText('Saka')
			await expect(page.getByRole('tabpanel')).not.toContainText('Private exposure player')
			await expect(page.getByRole('button',{name:'Retry',exact:true})).toHaveCount(0)
		} finally { await fetch(`${fixture}/__performance`,{method:'POST',body:JSON.stringify({rules:[]})}); await session.cleanup() }
	})

	test('Trends desk readiness never reports stale data during scope switch', async ({ page }) => {
		const session = await createSession({ entryId: 15702 })
		const samples: Record<string, unknown>[] = []
		await page.route('**/api/vitals', route => {
			const payload = route.request().postDataJSON()
			if (Array.isArray(payload?.samples)) samples.push(...payload.samples)
			return route.fulfill({ status: 204, body: '' })
		})
		await page.route('**/api/trends/my-cohorts', async route => {
			const response = await route.fetch()
			const catalog = await response.json()
			catalog.cohorts[0].id = 'competition:777'
			await route.fulfill({ response, json: catalog })
		})
		let release!: () => void
		const gate = new Promise<void>(resolve => { release = resolve })
		let waiting = false
		await page.route('**/api/trends/my-desk?**', async route => {
			const response = await route.fetch()
			waiting = true
			await gate
			await route.fulfill({ response })
		})
		try {
			await addSessionCookie(page, session.cookie)
			await page.goto('/explore/selections?scope=public&cohort=competition:777&gw=33')
			await expect(page.getByRole('button', { name: /^My Leagues/ })).toBeEnabled()
			await expect.poll(() => samples.filter(row => row.metricName === 'TRENDS_DESK_READY').length).toBeGreaterThan(0)
			const initial = samples.length
			await page.getByRole('button', { name: /^My Leagues/ }).click()
			await expect.poll(() => waiting).toBe(true)
			await expect(page.getByRole('combobox', { name: 'Active league', exact: true })).toHaveAttribute('aria-busy', 'true')
			await page.waitForTimeout(500)
			const pendingSamples = samples.slice(initial)
			expect(pendingSamples.filter(row => row.metricName === 'TRENDS_DESK_READY' || row.metricName === 'TRENDS_SWITCH_READY')).toEqual([])
			release()
			await expect(page.getByRole('combobox', { name: 'Active league', exact: true })).toHaveAttribute('aria-busy', 'false')
			await expect.poll(() => samples.filter(row => row.metricName === 'TRENDS_SWITCH_READY').length).toBeGreaterThan(0)
			await expect.poll(() => samples.slice(initial).filter(row => row.metricName === 'TRENDS_DESK_READY' && row.result === 'ok').length).toBeGreaterThan(0)
		} finally { release(); await session.cleanup() }
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

for (const locale of ['en', 'zh-CN']) {
 for (const width of [1440, 390]) {
  test(`canonical competition board and compatibility redirect preserve the committed selection ${locale} ${width}px`, async ({ page }, testInfo) => {
   test.skip(process.env.E2E_LIVE_HYDRATION !== '1', 'Uses the deterministic live competition fixture')
   const session = await createSession({ entryId: 15702 })
   const prefix = locale === 'en' ? '' : '/zh-CN'
   const chain: Array<{ url: string; status: number; location: string | null }> = []
   try {
    await addSessionCookie(page, session.cookie)
    await page.setViewportSize({ width, height: 900 })
    const response = await page.goto(`${prefix}/competitions/6?gw=1&created=1`)
    expect(response).not.toBeNull()
    for (let request = response!.request(); ; ) {
     const hop = await request.response()
     expect(hop).not.toBeNull()
     const url = new URL(request.url())
     chain.unshift({ url: url.pathname + url.search, status: hop!.status(), location: await hop!.headerValue('location') })
     const previous = request.redirectedFrom()
     if (!previous) break
     request = previous
    }
    expect(chain[0].status).toBe(308)
    expect(new URL(chain[0].location!, testInfo.project.use.baseURL).searchParams.get('gw')).toBe('1')
    const assertBoard = async () => {
     await expect(page).toHaveURL(url => url.pathname === `${prefix}/live/competitions` && url.searchParams.get('tournamentId') === '6' && url.searchParams.get('gw') === '1' && url.searchParams.get('created') === '1')
     const board = page.locator('[data-competition-perf-ready="detail"][data-competition-tournament-id="6"][data-competition-gameweek="1"]')
     await expect(board).toBeVisible()
     await expect(board.getByRole('list')).toBeVisible()
     await expect(board.getByRole('link', { name: 'E2E United Test Manager' }).filter({ visible: true })).toHaveCount(1)
    }
    await assertBoard()
    await page.reload()
    await assertBoard()
    await page.goto('about:blank')
    await page.goBack()
    await assertBoard()
    await page.goForward()
    await expect(page).toHaveURL('about:blank')
    await page.goBack()
    await assertBoard()
    await testInfo.attach('R13-alias-history', { contentType: 'application/json', body: JSON.stringify({ locale, width, chain, url: page.url(), tournament: 6, gw: 1, created: '1', functionalStatus: 'PASS', performanceStatus: 'NOT_RUN', readyMs: null, note: 'HTTP chain only; streamed redirects verified by final URL and board; blank history entry is not an internal click journey' }) })
   } finally { await session.cleanup() }
  })
 }
}

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

for (const scenarioMode of ['classic-mobile', 'partial-mobile', 'loading-layout', 'settlement-time', 'none', 'tournament-race', 'tournament-race-retry', 'retry-button', 'tab-reentry', 'partial-ssr-seed', 'failed-ssr-seed', 'search-empty', 'catalog-pagination', 'catalog-race', 'catalog-retry', 'catalog-deep-link', 'gw-route', 'live-journey', 'live-journey-second-entry', 'live-journey-published', 'live-journey-ready-mobile', 'live-journey-stale-mobile', 'live-journey-dgw-mobile', 'live-journey-auto-sub-mobile', 'live-journey-pinned', 'live-journey-pinned-ready', 'live-journey-pinned-large', 'live-journey-index-retry', 'live-journey-index-gone', 'live-journey-index-gone-new-revision', 'live-journey-sort', 'live-journey-focus', 'live-journey-filter-options', 'live-journey-filter-limits', 'live-journey-filter-scope-race'] as const) {
const plannedReview = scenarioMode === 'classic-mobile' || scenarioMode === 'partial-mobile'
const recoveryMode = scenarioMode === 'classic-mobile' ? 'none' : scenarioMode === 'partial-mobile' ? 'partial-ssr-seed' : scenarioMode
const comparisonJourney = recoveryMode.startsWith('live-journey-pinned')
const plannedComparison = recoveryMode === 'live-journey-pinned-ready' || recoveryMode === 'live-journey-pinned-large'
const plannedState = recoveryMode === 'live-journey-ready-mobile' ? 'ready' : recoveryMode === 'live-journey-stale-mobile' ? 'stale' : recoveryMode === 'live-journey-dgw-mobile' ? 'DGW' : recoveryMode === 'live-journey-auto-sub-mobile' ? 'auto-sub' : null
const plannedStateJourney = plannedState !== null
const captainPoints = plannedState === 'DGW' ? 7 : 6
const squadPoints = plannedState === 'DGW' ? 24 : 22
const benchPlayerId = plannedState === 'auto-sub' ? 6 : 12
const publishedJourney = recoveryMode === 'live-journey-published' || plannedStateJourney
const formalJourney = recoveryMode === 'live-journey-second-entry' || recoveryMode === 'live-journey-filter-scope-race' || publishedJourney
const journeyTimezone = plannedStateJourney || plannedComparison || plannedReview ? 'UTC' : 'Australia/Perth'
const journeyTheme = plannedStateJourney || plannedComparison || plannedReview ? 'dark' : 'system'
for (const locale of plannedStateJourney || plannedComparison || plannedReview ? ['zh-CN'] : recoveryMode === 'loading-layout' || recoveryMode === 'settlement-time' || recoveryMode === 'none' || recoveryMode.startsWith('tournament-race') || recoveryMode === 'search-empty' || recoveryMode.startsWith('catalog-') || recoveryMode === 'gw-route' || recoveryMode.startsWith('live-journey') ? ['en', 'zh-CN'] : ['en']) {
for (const catalogWidth of plannedStateJourney || plannedComparison || plannedReview ? [390] : recoveryMode.startsWith('catalog-') || recoveryMode.startsWith('tournament-race') || recoveryMode === 'live-journey-focus' || recoveryMode === 'live-journey-filter-options' || recoveryMode === 'live-journey-filter-limits' || formalJourney || comparisonJourney ? [1440, 390] : [0]) {
const routePath = locale === 'zh-CN' ? '/zh-CN/my-fpl/competitions' : '/my-fpl/competitions'
const fixturesPath = locale === 'zh-CN' ? '/zh-CN/explore/fixtures' : '/explore/fixtures'
const partialSsrSeed = recoveryMode === 'partial-ssr-seed' || recoveryMode === 'failed-ssr-seed'
const failFirstSections = (recoveryMode === 'retry-button' || recoveryMode === 'tab-reentry')
const pointsSectionOperation = 'GetMyTournamentSeasonReviewPointsSection'
const isSeasonSectionOperation = (query: string | undefined) =>
	query?.includes(pointsSectionOperation) === true ||
	query?.includes('GetMyTournamentSeasonReviewSection') === true
test.describe(() => {
if (formalJourney || comparisonJourney || plannedReview) test.use({ timezoneId: journeyTimezone, colorScheme: plannedStateJourney || plannedComparison || plannedReview ? 'dark' : 'light' })
test(`SSR remediation tournament season sections load on demand without a false missing-publication state [${locale}]${plannedReview ? ` planned-${scenarioMode}` : ''}${recoveryMode !== 'none' ? ` and recover via ${recoveryMode}${catalogWidth ? ` ${catalogWidth}px` : ''}` : ''}`, async ({ page }, testInfo) => {
	test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Uses serial isolated fixture controls')
	const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
	if (plannedReview) await page.setViewportSize({ width: 390, height: 900 })
	const attachPlannedReview = async () => {
	 if (!plannedReview) return
	 await expect(page.locator('html')).toHaveClass(/dark/)
	 expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('UTC')
	 await testInfo.attach('J11-points-variant', { contentType: 'application/json', body: JSON.stringify({ variantId: scenarioMode === 'classic-mobile' ? 'J11.state.01' : 'J11.state.05', scenario: scenarioMode, locale, viewport: page.viewportSize(), theme: 'dark', timezone: 'UTC', tournamentId: 77, eventId: 4, revision: '1', scope: 'POINTS view section loading or partial section retry; scoped existing route assertions', wholeJourneyPass: false, readyMs: null, performanceStatus: 'NOT_RUN' }) })
	}
	const session = await createSession({ entryId: 123 })
	if (formalJourney || comparisonJourney || plannedReview) await page.addInitScript(theme => localStorage.setItem('theme', theme), journeyTheme)
	const phase = { phaseId: 'points-1', format: 'POINTS', startEventId: recoveryMode === 'live-journey-second-entry' ? 3 : 1, endEventId: 4, state: 'READY', revision: '1', semanticSha256: 'a'.repeat(64), settledAt: '2026-09-15T00:00:00Z', publishedAt: '2026-09-15T01:00:00Z', correctedAt: null }
	if (recoveryMode === 'settlement-time') {
		phase.settledAt = '2026-09-15T18:00:00Z'
		phase.publishedAt = '2026-09-15T19:00:00Z'
	}
	const points = {
		headlineMetric: 'GROSS_POINTS', grossPointsTotal: 75, grossPointsAverage: 75, netPointsTotal: 71,
		seasonGrossPointsTotal: 300, seasonGrossPointsAverage: 300, seasonNetPointsTotal: 296,
		nextCursor: null, hasNextPage: false,
		rows: [{ entryId: 123, entryName: 'Season Fixture United', playerName: 'Fixture Manager', applicable: true, groupId: null, rank: 1, previousRank: 2, grossPoints: 75, transferCost: 4, netPoints: 71, tournamentScore: 300, seasonGrossPoints: 300, seasonNetPoints: 296, eventRank: 1, overallPoints: 300, overallRank: 100 }]
	}
	if (recoveryMode === 'loading-layout') points.rows = Array.from({ length: 48 }, (_, index) => ({ ...points.rows[0], entryId: 123 + index, entryName: `Layout Team ${index + 1}`, rank: index + 1 }))
	const pageInfo: { hasNextPage: boolean; endCursor: string | null } = { hasNextPage: false, endCursor: null }
	const reviewTournamentId = recoveryMode.startsWith('live-journey') ? 6 : 77
	const scope = { ...phase, tournamentId: reviewTournamentId, eventId: 4, rowCount: 1, expectedSubjectCount: 1, readySubjectCount: 1, notApplicableSubjectCount: 0 }
	const rules = [
		{ operation: 'GetMyTournamentReviewCatalog', data: { myTournamentReviewCatalog: { state: 'READY', asOf: phase.publishedAt, viewerEntryId: 123, adminReadAll: recoveryMode === 'search-empty', pageInfo, edges: [{ cursor: '77', node: { tournamentId: reviewTournamentId, name: 'Fixture Review Cup', creator: 'Fixture', leagueId: 77, leagueType: 'CLASSIC', totalTeamNum: 1, latestFinalizedEventId: 4, previousReadyEventId: 3, setupStatus: 'READY', latestFinalizedScope: { ...scope, repairState: 'NONE' }, phaseSummaries: [phase], state: 'READY' } }] } } },
		{ operation: 'GetMyTournamentSeasonReview', data: { myTournamentSeasonReview: { state: 'READY', tournamentId: reviewTournamentId, throughEventId: 4, latestFinalizedEventId: 4, phases: [phase] } } },
		{ operation: 'GetMyTournamentGameweekReview', data: { myTournamentGameweekReview: { state: 'READY', scope, payload: { format: 'POINTS', points } } } },
		...['POINTS_STANDINGS', 'POINTS_TRAJECTORIES'].map(section => ({ operation: pointsSectionOperation, variables: { section }, data: { myTournamentSeasonReviewSection: { ...phase, tournamentId: reviewTournamentId, throughEventId: 4, section, points, h2h: null, knockout: null, pageInfo } } }))
	]
	let releaseSections!: () => void
	const gate = new Promise<void>(resolve => { releaseSections = resolve })
	let sectionRequests = 0
	let secondSectionRequests = 0
	let viewNavigationRequests = 0
	let readyReports = 0
	await page.route('**/api/vitals', async route => {
		const samples = route.request().postDataJSON().samples ?? []
		for (const sample of samples) {
			if (sample.metricName !== 'TOURNAMENT_REVIEW_READY') continue
			await expect(page.locator('[data-review-ready]')).toHaveAttribute('data-review-ready', 'true')
			readyReports += 1
		}
		await route.fulfill({ status: 204, body: '' })
	})
	const comparisonRules = []
	if (comparisonJourney) {
		for (const eventId of [3, 4]) for (const scoreCoreRevision of ['e2e-competition-score-v1', 'e2e-competition-score-v2']) {
			const ref = { season: String(getCurrentSeasonKey()), eventId, scoreCoreRevision }
			const response = await fetch(fixture.replace('/__performance', '/graphql'), {
				method: 'POST', headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ query: 'query GetTournamentEntrySquads { __typename }', variables: { tournamentId: 6, comparedEntryIds: [123, 15702], ref } })
			})
			const seed = await response.json()
			expect(seed.errors).toBeUndefined()
			const order = [1, 3, 4, 5, 8, 9, 10, 11, 13, 14, 15, 2, 6, 7, 12]
			for (const entry of seed.data.tournamentEntrySquads.entries) {
				entry.pickList = entry.pickList.map((pick: { element: number }) => {
					const position = order.indexOf(pick.element) + 1
					const active = position <= 11
					const points = pick.element === 1 ? 6 : scoreCoreRevision.endsWith('-v2') ? (pick.element === 3 ? 11 : 6) : 4
					return { ...pick, position, pickActive: active, multiplier: pick.element === 1 ? 2 : active ? 1 : 0, isCaptain: pick.element === 1, isViceCaptain: pick.element === 8, autoSub: false, totalPoints: points }
				})
				const active = entry.pickList.filter((pick: { pickActive: boolean }) => pick.pickActive)
				expect(['GOALKEEPER', 'DEFENDER', 'MIDFIELDER', 'FORWARD'].map(type => active.filter((pick: { elementTypeName: string }) => pick.elementTypeName === type).length)).toEqual([1, 3, 4, 3])
				expect(entry.pickList.reduce((sum: number, pick: { totalPoints: number; multiplier: number }) => sum + pick.totalPoints * pick.multiplier, 0)).toBe(entry.score.eventPoints)
			}
			comparisonRules.push({ operation: 'GetTournamentEntrySquads', variables: { tournamentId: 6, ref }, data: seed.data })
		}
	}
	try {
		expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [...rules, ...comparisonRules] }) })).ok).toBe(true)
		await addSessionCookie(page, session.cookie)
		await page.route('**/api/graphql', async route => {
			const payload = route.request().postDataJSON()
			// This navigation fixture has no official player breakdown. Return a
			// deterministic empty result instead of the fixture server's unknown-query
			// 503, which would fence the subsequent board refresh for 30 seconds.
			if (formalJourney && /query (PlayerLive|EventLiveExplainPlayer)\b/.test(payload.query ?? '')) {
				const playerId = Number(payload.variables.playerId ?? payload.variables.elementId)
				expect(payload.variables.eventId).toBe(4)
				expect([1, benchPlayerId]).toContain(playerId)
				const stats = { minutes: plannedState === 'DGW' && playerId === 1 ? 90 : 45, goalsScored: playerId === 1 ? 1 : 0, assists: 0, cleanSheets: 0, goalsConceded: playerId === 1 ? 2 : 0, defensiveContribution: 0, ownGoals: 0, penaltiesSaved: 0, penaltiesMissed: 0, yellowCards: 0, redCards: 0, saves: 0, bonus: 0 }
				const contributions = [{ identifier: 'minutes', value: 45, points: 1 }, ...(playerId === 1 ? [{ identifier: 'goals_scored', value: 1, points: 6 }, { identifier: 'goals_conceded', value: 2, points: -1 }] : [])]
				// The public operation selects aggregated contributions, not fixture
				// breakdowns. Two 45-minute appearances contribute two points in a DGW.
				if (plannedState === 'DGW' && playerId === 1) {
					contributions[0] = { identifier: 'minutes', value: 90, points: 2 }
				}
				const explanation = { elementId: playerId, stats, contributions }
				expect(contributions.reduce((sum, item) => sum + item.points, 0)).toBe(playerId === 1 ? captainPoints : 1)
				return route.fulfill({ json: { data: /query PlayerLive\b/.test(payload.query) ? { playerLive: { ...stats, totalPoints: playerId === 1 ? captainPoints : 1, bps: 10 } } : { eventLiveExplain: explanation } } })
			}
			if (recoveryMode.startsWith('live-journey')) {
				if (/query EventLiveExplainPlayer\b/.test(payload.query ?? '')) {
					return route.fulfill({ json: { data: { eventLiveExplain: null } } })
				}
				if (/query PlayerLive\b/.test(payload.query ?? '')) {
					return route.fulfill({ json: { data: { playerLive: null } } })
				}
			}
			if (!isSeasonSectionOperation(payload.query)) return route.continue()
			if (recoveryMode.startsWith('tournament-race') && payload.variables.tournamentId === 78) {
				secondSectionRequests += 1
				expect(payload.variables).toMatchObject({ tournamentId: 78, throughEventId: 4, phaseId: 'points-2', revision: '2', semanticSha256: 'b'.repeat(64) })
				if (recoveryMode === 'tournament-race-retry' && secondSectionRequests <= 2) return route.fulfill({ status: 503, headers: { 'retry-after': '0' }, json: { errors: [{ message: 'Second tournament section fixture failure' }] } })
				return route.continue()
			}
			sectionRequests += 1
			expect(payload.variables).toMatchObject({ tournamentId: reviewTournamentId, throughEventId: 4, phaseId: phase.phaseId, revision: '1', semanticSha256: phase.semanticSha256 })
			await gate
			if (failFirstSections && sectionRequests <= 2) {
				await route.fulfill({ status: 503, headers: { 'retry-after': '0' }, json: { errors: [{ message: 'Section temporarily unavailable' }] } })
				return
			}
			await route.continue()
		})
        if (recoveryMode === 'loading-layout') {
            const layoutCdp = await page.context().newCDPSession(page)
            await layoutCdp.send('Network.enable')
            await layoutCdp.send('Network.setCacheDisabled', {cacheDisabled:true})
            await layoutCdp.send('Network.emulateNetworkConditions', {offline:false,latency:100,downloadThroughput:500000,uploadThroughput:500000})
            releaseSections()
            expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: rules.map(rule => rule.operation === 'GetMyTournamentReviewCatalog' ? { ...rule, delayMs: 1200 } : rule) }) })).ok).toBe(true)
            await page.addInitScript(() => {
                const shifts: Array<{ value: number; startTime: number; hadRecentInput: boolean }> = []
                const observer = new PerformanceObserver(list => {
                    for (const entry of list.getEntries()) {
                        const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean }
                        shifts.push(Object.assign({ value: shift.value, startTime: shift.startTime, hadRecentInput: shift.hadRecentInput }, {
                            scrollY, readyState: document.readyState,
                            main: Array.from(document.querySelectorAll('#main-content, #main-content > div')).map(node => ({className: node.className, rect: node.getBoundingClientRect().toJSON(), minHeight: getComputedStyle(node).minHeight, display: getComputedStyle(node).display})),
                            footer: document.querySelector('footer')?.getBoundingClientRect().toJSON(),
                            styles: Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(node => ({loaded: Boolean((node as HTMLLinkElement).sheet), href: (node as HTMLLinkElement).href})),
                            sources: (entry as PerformanceEntry & { sources: Array<{node?: Element; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly}> }).sources.map(source => ({tag:source.node?.tagName,before:source.previousRect.toJSON(),after:source.currentRect.toJSON()}))
                        }))
                    }
                })
                observer.observe({ type: 'layout-shift', buffered: true })
                ;(window as unknown as { __reviewLayout: { shifts: typeof shifts; observer: PerformanceObserver } }).__reviewLayout = { shifts, observer }
            })
			for (const width of [1440, 390]) {
				await page.setViewportSize({ width, height: 900 })
				await page.goto(`${routePath}?tournamentId=77&view=season&gw=4`)
				await expect(page.locator('[data-review-ready="true"]')).toHaveAttribute('data-review-tournament', '77')
				const standingsRows = page.locator('table tbody tr')
				await expect(standingsRows).toHaveCount(48)
				const renderedEntryNames = await standingsRows.evaluateAll(rows =>
					rows.map(row => row.querySelector('td:nth-child(2) > div')?.textContent?.trim() ?? '')
				)
				expect(renderedEntryNames).toEqual(
					Array.from({ length: 48 }, (_, index) => `Layout Team ${index + 1}`)
				)
				const shifts = await page.evaluate(async () => {
                    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
                    const state = (window as unknown as { __reviewLayout: { shifts: Array<{ value: number; startTime: number; hadRecentInput: boolean }>; observer: PerformanceObserver } }).__reviewLayout
                    state.observer.disconnect()
                    return state.shifts.filter(shift => !shift.hadRecentInput)
                })
                let max = 0, sum = 0, start = 0, previous = -Infinity
                for (const shift of shifts) {
                    if (shift.startTime - previous >= 1000 || shift.startTime - start >= 5000) { sum = 0; start = shift.startTime }
                    sum += shift.value
                    max = Math.max(max, sum)
                    previous = shift.startTime
                }
				await testInfo.attach(`review-loading-layout-${width}`, { contentType: 'application/json', body: JSON.stringify({ locale, width, shifts, cls: max, budget: 0.1, networkLatencyMs: 100, bytesPerSecond: 500000, catalogDelayMs: 1200, productionDistributionEligible: false }) })
				await testInfo.attach(`S01-max-reasonable-${locale}-${width}`, {
					contentType: 'application/json',
					body: JSON.stringify({
						caseId: 'S01',
						stepIds: ['S01.01'],
						state: 'max-reasonable',
						locale,
						viewport: { width, height: 900 },
						rows: 48,
						readyMarker: { selector: '[data-review-ready="true"]', tournamentId: 77, gw: 4 },
						assertions: ['all 48 fixture rows are visible after the delayed catalog/section response', 'ready is emitted after business content is present', 'layout shift stays within the 0.1 fixture budget'],
						businessWrites: [],
						functionalStatus: 'PASS',
						performanceStatus: 'NOT_OBSERVED',
						readyMs: null,
						eventToPaintMs: null,
						wholeCaseComplete: false,
						missingReason: 'Maximum fixture set is scoped to the season review table; minimum set, other routes, full matrix bindings and controlled timing remain open.'
					})
				})
                expect(max, `Review loading layout ${locale} ${width}: ${JSON.stringify(shifts)}`).toBeLessThanOrEqual(0.1)
            }
            return
        }
		if (recoveryMode === 'settlement-time') {
			const url = `${routePath}?tournamentId=77&view=gameweek&gw=4`
			const response = await page.request.get(url)
			expect(response.ok()).toBe(true)
			const html = (await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
			// Check rendered SSR content, excluding serialized RSC payloads.
			expect(html).toContain('2026-09-15 18:00:00 UTC')
			expect(html).toContain('2026-09-15 19:00:00 UTC')
			const cdp = await page.context().newCDPSession(page)
			try {
				for (const timezoneId of ['UTC', 'Australia/Perth']) {
					await cdp.send('Emulation.setTimezoneOverride', { timezoneId })
					for (const width of [1440, 390]) {
						await page.setViewportSize({ width, height: 900 })
						await page.goto(url)
						await expect(page.locator('[data-review-ready="true"]')).toBeVisible()
						const timestamp = page.locator('time[datetime="2026-09-15T18:00:00Z"]')
						await expect(timestamp).toContainText(/UTC|GMT|AWST/)
						await expect(timestamp).not.toContainText('2026-09-15 18:00:00 UTC')
						await expect(timestamp).toContainText(timezoneId === 'UTC' ? /15/ : /16/)
						expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
					}
				}
			} finally {
				await cdp.send('Emulation.setTimezoneOverride', { timezoneId: '' })
				await cdp.detach()
			}
			return
		}
		if (recoveryMode.startsWith('tournament-race')) {
			const catalogData = rules[0].data
			if (!('myTournamentReviewCatalog' in catalogData) || !catalogData.myTournamentReviewCatalog) throw new Error('Missing catalog fixture')
			const original = catalogData.myTournamentReviewCatalog
			const second = JSON.parse(JSON.stringify(original.edges[0]).replaceAll('"tournamentId":77', '"tournamentId":78').replaceAll('points-1', 'points-2').replaceAll('"revision":"1"', '"revision":"2"').replaceAll('a'.repeat(64), 'b'.repeat(64)).replaceAll('Fixture Review Cup', 'Second Review Cup'))
			second.cursor = '78'
			const scoped = rules.slice(1).flatMap(rule => [77, 78].map(id => ({ ...rule, variables: { ...('variables' in rule ? rule.variables : {}), tournamentId: id }, data: id === 77 ? rule.data : JSON.parse(JSON.stringify(rule.data).replaceAll('"tournamentId":77', '"tournamentId":78').replaceAll('points-1', 'points-2').replaceAll('"revision":"1"', '"revision":"2"').replaceAll('a'.repeat(64), 'b'.repeat(64)).replaceAll('Season Fixture United', 'Second Fixture United')) })))
			expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [{ ...rules[0], data: { myTournamentReviewCatalog: { ...original, edges: [original.edges[0], second] } } }, ...scoped] }) })).ok).toBe(true)
			await page.setViewportSize({ width: catalogWidth, height: 900 })
			await page.goto(`${routePath}?tournamentId=77&view=gameweek&gw=4`)
			const ready = page.locator('[data-review-ready]')
			await expect(ready).toHaveAttribute('data-review-ready', 'true')
			await expect(page.getByRole('cell', { name: /Season Fixture United/ })).toBeVisible()
			await page.getByRole('tab', { name: locale === 'zh-CN' ? '赛季' : 'Season', exact: true }).click()
			await expect.poll(() => sectionRequests).toBe(2)
			await expect(ready).toHaveAttribute('data-review-ready', 'false')
			const selector = page.getByRole('complementary').getByRole('combobox').filter({ has: page.locator('option[value="78"]') })
			await expect(selector).toHaveCount(1)
			await selector.selectOption('78')
			await expect(ready).toHaveAttribute('data-review-tournament', '78')
			await expect(ready).toHaveAttribute('data-review-phase', 'points-2')
			await expect(ready).toHaveAttribute('data-review-revision', '2')
			if (recoveryMode === 'tournament-race-retry') {
				const retry = page.getByRole('button', { name: locale === 'zh-CN' ? zhMessages.TournamentStats.reviewRetryPhase : 'Retry this phase', exact: true })
				await expect(retry).toBeVisible()
				await expect(ready).toHaveAttribute('data-review-ready', 'false')
				await expect(page).toHaveURL(url => url.searchParams.get('tournamentId') === '78' && url.searchParams.get('gw') === '4')
				await expect(page.getByRole('cell', { name: /Season Fixture United/ })).toHaveCount(0)
				expect(secondSectionRequests).toBe(2)
				await retry.click()
				await expect(retry).toHaveCount(0)
			}
			await expect(ready).toHaveAttribute('data-review-ready', 'true')
			await expect(page.getByRole('cell', { name: /Second Fixture United/ })).toBeVisible()
			await expect(page).toHaveURL(url => url.searchParams.get('tournamentId') === '78' && url.searchParams.get('gw') === '4')
			expect(secondSectionRequests).toBe(recoveryMode === 'tournament-race-retry' ? 4 : 2)
			const lateResponses = Promise.all([page.waitForResponse(response => response.url().includes('/api/graphql') && response.request().postDataJSON()?.variables?.tournamentId === 77 && response.request().postDataJSON()?.variables?.section === 'POINTS_STANDINGS'), page.waitForResponse(response => response.url().includes('/api/graphql') && response.request().postDataJSON()?.variables?.tournamentId === 77 && response.request().postDataJSON()?.variables?.section === 'POINTS_TRAJECTORIES')])
			releaseSections()
			await lateResponses
			await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
			await expect(ready).toHaveAttribute('data-review-tournament', '78')
			await expect(ready).toHaveAttribute('data-review-phase', 'points-2')
			await expect(page.getByRole('cell', { name: /Season Fixture United/ })).toHaveCount(0)
			await selector.selectOption('77')
			await expect(ready).toHaveAttribute('data-review-ready', 'true')
			await expect(ready).toHaveAttribute('data-review-tournament', '77')
			await expect(ready).toHaveAttribute('data-review-phase', 'points-1')
			await expect(ready).toHaveAttribute('data-review-revision', '1')
			await expect(page.getByRole('cell', { name: /Season Fixture United/ })).toBeVisible()
			await expect(page.getByRole('cell', { name: /Second Fixture United/ })).toHaveCount(0)
			await expect(page).toHaveURL(url => url.searchParams.get('tournamentId') === '77' && url.searchParams.get('gw') === '4')
			return
		}
		if (recoveryMode.startsWith('live-journey')) {
			let comparisonBoardRevision = 'e2e-competition-score-v1'
			let journeyPagination = false
			await page.setViewportSize(catalogWidth ? { width: catalogWidth, height: 900 } : locale === 'zh-CN' ? { width: 390, height: 844 } : { width: 1440, height: 900 })
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
			if (comparisonJourney) {
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
					if (recoveryMode === 'live-journey-pinned-large') {
						board.rows.push(...Array.from({ length: 47 }, (_, index) => ({ ...board.rows[0], entry: 8000000 + index, entryName: `Large Comparison ${index + 1}`, liveRank: index + 2 })))
						board.totalEntries = board.filteredEntries = 49
					}
					await route.fulfill({ response, json: body })
				})
			}
			const secondEntryRules: { operation: string; variables: { entryId: number; eventId: number }; data: unknown }[] = []
			let journeyScoreRevision: string | undefined
			const journeyTournamentRules: { operation: string; data: unknown }[] = []
			if (formalJourney) {
				const catalogResponse = await fetch(fixture.replace('/__performance', '/graphql'), {
					method: 'POST', headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ query: 'query GetEntryTournaments { __typename }', variables: { entryId: 123 } })
				})
				expect(catalogResponse.ok).toBe(true)
				const catalog = await catalogResponse.json()
				expect(catalog.errors).toBeUndefined()
				const targetTournament = catalog.data.entryTournaments.find((item: { id: number }) => item.id === 6)
				expect(targetTournament).toBeDefined()
				journeyTournamentRules.push({ operation: 'GetEntryTournaments', data: {
					entryTournaments: [targetTournament, { ...targetTournament, id: 7, leagueId: 315, name: 'Journey Alternate Classic', sourceLeagueName: 'Journey Alternate Classic' }]
				} })
				const response = await fetch(fixture.replace('/__performance', '/graphql'), {
					method: 'POST', headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ query: 'query GetLiveCalcPoints { __typename }', variables: { entryId: 6733550, eventId: 4 } })
				})
				const seed = await response.json()
				expect(seed.errors).toBeUndefined()
				const second = seed.data.calcLivePointsByEntry
				journeyScoreRevision = second.score.revisions.input
				expect(typeof journeyScoreRevision).toBe('string')
				expect(journeyScoreRevision).not.toBe('')
				// Use a legal 3-4-3 and four ordered substitutes, not the generic
				// fixture's first eleven element IDs (which include two keepers).
				const pickOrder = [1, 3, 4, 5, 8, 9, 10, 11, 13, 14, 15, 2, 6, 7, 12]
				second.pickList = second.pickList.map((pick: { element: number }) => {
					const position = pickOrder.indexOf(pick.element) + 1
					return { ...pick, position, pickActive: position <= 11, multiplier: pick.element === 1 ? 2 : position <= 11 ? 1 : 0, isViceCaptain: pick.element === 8 }
				})
				if (plannedState === 'DGW') {
					const firstPlayer = second.pickList.find((pick: { element: number }) => pick.element === 1)
					firstPlayer.minutes = 90
					firstPlayer.totalPoints = captainPoints
					second.score.eventPoints = second.score.netEventPoints = squadPoints
					second.activeCaptain.points = captainPoints
				}
				if (plannedState === 'auto-sub') {
					const outgoing = second.pickList.find((pick: { element: number }) => pick.element === 11)
					Object.assign(outgoing, { minutes: 0, totalPoints: 0, pickActive: false, multiplier: 0, isPlayed: false, isGwFinished: true })
					const incoming = second.pickList.find((pick: { element: number }) => pick.element === 12)
					Object.assign(incoming, { pickActive: true, autoSub: true, multiplier: 1 })
				}
				if (plannedState === 'stale') {
					for (const publication of [seed.data.liveSnapshot, second, second.snapshot, second.score]) {
						publication.delivery = { ...publication.delivery, state: 'STALE', reasonCodes: ['SOURCE_OVERDUE'] }
						if (publication.times) publication.times.contentUpdatedAt = '2026-08-03T18:00:00.000Z'
					}
				}
				{
					const first = structuredClone(seed.data)
					first.calcLivePointsByEntry.entry = 15702
					secondEntryRules.push({ operation: 'GetLiveCalcPoints', variables: { entryId: 15702, eventId: 4 }, data: first })
				}
				const activePicks = second.pickList.filter((pick: { pickActive: boolean }) => pick.pickActive)
				expect(activePicks).toHaveLength(11)
				expect([1, 2, 3, 4].map(type => activePicks.filter((pick: { elementType: number }) => pick.elementType === type).length)).toEqual([1, 3, 4, 3])
				expect(second.pickList.filter((pick: { pickActive: boolean }) => !pick.pickActive)).toHaveLength(4)
				const captain = second.pickList.find((pick: { isCaptain: boolean }) => pick.isCaptain)
				expect(captain).toMatchObject({ element: 1, totalPoints: captainPoints, multiplier: 2, pickActive: true })
				const contribution = (pick: { pickActive: boolean; totalPoints: number; multiplier: number }) => pick.pickActive ? pick.totalPoints * pick.multiplier : 0
				expect(contribution(captain)).toBe(captainPoints * 2)
				expect(second.pickList.reduce((sum: number, pick: { pickActive: boolean; totalPoints: number; multiplier: number }) => sum + contribution(pick), 0)).toBe(second.score.eventPoints)
				expect(second.score.eventPoints).toBe(squadPoints)
				second.entryName = 'Second Journey United'
				second.pickList = second.pickList.map((pick: { webName: string }) => ({ ...pick, webName: `Second ${pick.webName}` }))
				secondEntryRules.push({ operation: 'GetLiveCalcPoints', variables: { entryId: 6733550, eventId: 4 }, data: seed.data })
				await page.route('**/api/live/competitions/6/board', async route => {
					const request = route.request().postDataJSON()
					const response = await route.fetch(publishedJourney ? { postData: JSON.stringify({ ...request, input: { ...request.input, chips: [], captainPlayerIds: [], search: null, after: null } }) } : {})
					const body = await response.json()
					const board = body.entryLiveCompetitionBoard
					board.rows.push({ ...board.rows[0], entry: 6733550, entryName: 'Second Journey United', liveRank: 2 })
					board.totalEntries = 2
					if (publishedJourney) for (const row of board.rows) {
						row.score.eventPoints = row.score.netEventPoints = squadPoints
						if (plannedState === 'stale') row.score.delivery.state = 'STALE'
					}
					const search = (route.request().postDataJSON().input.search ?? '').toLowerCase()
					board.rows = board.rows.filter((row: { entryName: string; playerName: string }) => `${row.entryName} ${row.playerName}`.toLowerCase().includes(search))
					if (publishedJourney) {
						board.rows = board.rows.filter((row: { captainId: number; chip: string | null }) =>
							(!request.input.captainPlayerIds?.length || request.input.captainPlayerIds.includes(row.captainId)) &&
							(!request.input.chips?.length || request.input.chips.includes(row.chip)))
						if (request.input.direction === 'DESC') board.rows.reverse()
						if (journeyPagination && !search && !request.input.captainPlayerIds?.length && !request.input.chips?.length) {
							const third = { ...board.rows[0], entry: 9000001, entryName: 'Pagination Journey United', liveRank: 3 }
							board.totalEntries = board.filteredEntries = 3
							board.rows = request.input.after ? [third] : board.rows
							board.pageInfo = { hasNextPage: !request.input.after, endCursor: request.input.after ? null : 'j06-page-1' }
						} else {
							board.filteredEntries = board.rows.length
							board.pageInfo = { hasNextPage: false, endCursor: null }
						}
					} else board.filteredEntries = board.rows.length
					await route.fulfill({ response, json: body })
				})
			}
			const earlierPhase = { ...phase, phaseId: 'points-earlier', startEventId: 1, endEventId: 2, revision: '2', semanticSha256: 'c'.repeat(64) }
			const earlierSectionReads: { section: string; after?: string | null }[] = []
			let journeyCatalogPages = 0
			if (recoveryMode === 'live-journey-second-entry') {
				const catalogRule = rules[0]
				if (!('myTournamentReviewCatalog' in catalogRule.data)) throw new Error('Expected journey catalog')
				const catalog = catalogRule.data.myTournamentReviewCatalog!
				catalog.pageInfo = { hasNextPage: true, endCursor: 'journey-catalog-1' }
				await page.route('**/api/graphql', async route => {
					const body = route.request().postDataJSON()
					if (body.query?.includes('GetMyTournamentReviewCatalog')) {
						expect(body.variables).toMatchObject({ scope: 'ACCESSIBLE', first: 100, after: 'journey-catalog-1', search: null })
						journeyCatalogPages++
						const first = catalog.edges[0]
						await route.fulfill({ json: { data: { myTournamentReviewCatalog: { ...catalog, pageInfo: { hasNextPage: false, endCursor: null }, edges: [first, { ...first, cursor: '7', node: { ...first.node, tournamentId: 7, name: 'Appended Catalog Cup', latestFinalizedScope: { ...first.node.latestFinalizedScope, tournamentId: 7 } } }] } } } })
						return
					}
					if (!isSeasonSectionOperation(body.query) || body.variables.phaseId !== earlierPhase.phaseId) return route.fallback()
					const v = body.variables
					expect(v).toMatchObject({ tournamentId: 6, throughEventId: 4, phaseId: earlierPhase.phaseId, revision: '2', semanticSha256: earlierPhase.semanticSha256 })
					earlierSectionReads.push(v)
					const secondPage = Boolean(v.after)
					if (secondPage) expect(v).toMatchObject({ section: 'POINTS_STANDINGS', after: 'earlier-page-1' })
					const hasNextPage = v.section === 'POINTS_STANDINGS' && !secondPage
					const cursor = hasNextPage ? 'earlier-page-1' : null
					const row = { ...points.rows[0], entryId: secondPage ? 456 : 123, entryName: secondPage ? 'Earlier Appended United' : 'Earlier Phase United', rank: secondPage ? 2 : 1 }
					await route.fulfill({ json: { data: { myTournamentSeasonReviewSection: { ...earlierPhase, tournamentId: 6, throughEventId: 4, section: v.section, points: { ...points, rows: [row], hasNextPage, nextCursor: cursor }, h2h: null, knockout: null, pageInfo: { hasNextPage, endCursor: cursor } } } } })
				})
			}
			const unavailableRules = [
				...journeyTournamentRules,
				...comparisonRules,
				...secondEntryRules,
				...(recoveryMode === 'live-journey-second-entry' ? [
					{ operation: 'GetMyTournamentSeasonReview', variables: { throughEventId: 4 }, data: { myTournamentSeasonReview: { state: 'READY', tournamentId: 6, throughEventId: 4, latestFinalizedEventId: 4, phases: [earlierPhase, phase] } } },
					{ operation: 'GetMyTournamentGameweekReview', variables: { eventId: 3 }, data: { myTournamentGameweekReview: { state: 'READY', scope: { ...scope, eventId: 3, revision: '3', semanticSha256: 'b'.repeat(64) }, payload: { format: 'POINTS', points: { ...points, grossPointsTotal: 33, netPointsTotal: 29, rows: points.rows.map(row => ({ ...row, entryName: 'GW3 Journey United', grossPoints: 33, netPoints: 29 })) } } } } },
					{ operation: 'GetMyTournamentSeasonReview', variables: { throughEventId: 3 }, data: { myTournamentSeasonReview: { state: 'READY', tournamentId: 6, throughEventId: 3, latestFinalizedEventId: 3, phases: [{ ...phase, endEventId: 3, revision: '3', semanticSha256: 'b'.repeat(64) }] } } }
				] : []),
				...(publishedJourney ? [] : [{ operation: 'GetMyTournamentGameweekReview', data: { myTournamentGameweekReview: { state: 'UNAVAILABLE', scope: null, payload: null } } }]),
				...rules
			]
			expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: unavailableRules }) })).ok).toBe(true)
			await page.goto(`${routePath}?tournamentId=6&view=gameweek&gw=4`)
			const prefix = locale === 'zh-CN' ? '/zh-CN' : ''
			const unsettledLink = page.getByRole('link', { name: locale === 'zh-CN' ? '未结算数据请前往 Live' : 'Open Live for unsettled data', exact: true })
			if (recoveryMode === 'live-journey-second-entry') {
				// Keep catalog/view interactions in the same browser journey as the
				// contextual Live link; no direct navigation between these controls.
				const search = page.getByRole('textbox', { name: locale === 'zh-CN' ? '搜索赛事' : 'Search tournaments', exact: true })
				await expect(search).toHaveCount(0)
				await expect(page.getByRole('button', { name: locale === 'zh-CN' ? '管理员：查看全部赛事' : 'Admin: show all tournaments', exact: true })).toHaveCount(0)
				const selector = page.getByRole('complementary').getByRole('combobox').first()
				await expect(selector).toHaveValue('6')
				const catalogMore = page.getByRole('button', { name: locale === 'zh-CN' ? '加载更多赛事' : 'Load more tournaments', exact: true })
				await expect(selector.locator('option[value="7"]')).toHaveCount(0)
				await catalogMore.click()
				await expect(selector.locator('option[value="7"]')).toHaveText(/Appended Catalog Cup/)
				await expect(selector.locator('option[value="6"]')).toHaveCount(1)
				await expect(selector).toHaveValue('6')
				await expect(catalogMore).toHaveCount(0)
				expect(journeyCatalogPages).toBe(1)
				await expect(page).toHaveURL(url => url.searchParams.get('tournamentId') === '6' && url.searchParams.get('gw') === '4')
				await selector.selectOption('')
				await expect(page.getByRole('status')).toHaveText(locale === 'zh-CN' ? '选择赛事' : 'Select tournament')
				await selector.selectOption('6')
				await expect(unsettledLink).toBeVisible()
				await expect(page).toHaveURL(url => url.searchParams.get('tournamentId') === '6' && url.searchParams.get('gw') === '4')
				const reviewGw = page.getByRole('combobox').nth(1)
				await reviewGw.selectOption('3')
				const historicalReady = page.locator('[data-review-ready="true"]')
				await expect(historicalReady).toHaveAttribute('data-review-tournament', '6')
				await expect(historicalReady).toHaveAttribute('data-review-gw', '3')
				await expect(historicalReady).toHaveAttribute('data-review-revision', '3')
				await expect(historicalReady).toHaveAttribute('data-review-hash', 'b'.repeat(64))
				const historicalRow = page.getByRole('row').filter({ hasText: 'GW3 Journey United' })
				await expect(historicalRow).toHaveCount(1)
				await expect(historicalRow).toContainText('33')
				await expect(historicalRow).toContainText('29')
				await expect(page).toHaveURL(url => url.searchParams.get('tournamentId') === '6' && url.searchParams.get('gw') === '3')
				await reviewGw.selectOption('4')
				await expect(unsettledLink).toBeVisible()
				await expect(page.getByRole('cell', { name: 'GW3 Journey United Fixture Manager', exact: true })).toHaveCount(0)
				releaseSections()
				await page.getByRole('tab', { name: locale === 'zh-CN' ? zhMessages.TournamentStats.viewSeason : 'Season', exact: true }).click()
				const seasonReady = page.locator('[data-review-ready="true"]')
				await expect(seasonReady).toHaveAttribute('data-review-tournament', '6')
				await expect(seasonReady).toHaveAttribute('data-review-gw', '4')
				await expect(seasonReady).toHaveAttribute('data-review-view', 'season')
				await expect(seasonReady).toHaveAttribute('data-review-hash', phase.semanticSha256)
				await expect(page.getByRole('cell', { name: /Season Fixture United/ })).toBeVisible()
				const phaseTabs = page.getByRole('tablist', { name: locale === 'zh-CN' ? zhMessages.TournamentStats.reviewPhaseTimeline : 'Tournament phases', exact: true })
				await phaseTabs.getByRole('tab').filter({ hasText: 'GW1–2' }).click()
				await expect(seasonReady).toHaveAttribute('data-review-phase', earlierPhase.phaseId)
				await expect(seasonReady).toHaveAttribute('data-review-revision', '2')
				await expect(seasonReady).toHaveAttribute('data-review-hash', earlierPhase.semanticSha256)
				await expect(page.getByRole('cell', { name: 'Earlier Phase United Fixture Manager', exact: true })).toBeVisible()
				await expect(page.getByRole('cell', { name: 'Season Fixture United Fixture Manager', exact: true })).toHaveCount(0)
				const phaseMore = page.getByRole('button', { name: locale === 'zh-CN' ? zhMessages.TournamentStats.reviewLoadMore : 'Load more', exact: true })
				await phaseMore.click()
				await expect(page.getByRole('cell', { name: 'Earlier Appended United Fixture Manager', exact: true })).toBeVisible()
				await expect(page.getByRole('cell', { name: 'Earlier Phase United Fixture Manager', exact: true })).toHaveCount(1)
				await expect(phaseMore).toHaveCount(0)
				expect(earlierSectionReads).toHaveLength(3)
				await phaseTabs.getByRole('tab').filter({ hasText: 'GW3–4' }).click()
				await expect(seasonReady).toHaveAttribute('data-review-phase', phase.phaseId)
				await expect(seasonReady).toHaveAttribute('data-review-hash', phase.semanticSha256)
				await expect(page.getByRole('cell', { name: 'Season Fixture United Fixture Manager', exact: true })).toBeVisible()
				await expect(page.getByRole('cell', { name: 'Earlier Appended United Fixture Manager', exact: true })).toHaveCount(0)
				await page.getByRole('tab', { name: locale === 'zh-CN' ? zhMessages.TournamentStats.viewGameweek : 'Gameweek', exact: true }).click()
				await expect(unsettledLink).toBeVisible()
				await expect(page).toHaveURL(url => url.searchParams.get('view') === 'gameweek' && url.searchParams.get('tournamentId') === '6' && url.searchParams.get('gw') === '4')
				await testInfo.attach('J11-continuous-review-prefix', { contentType: 'application/json', body: JSON.stringify({ stepIds: ['J11.04', 'J11.05', 'J11.06', 'J11.08', 'J11.09', 'J11.10', 'J11.07'], notApplicable: { 'J11.02': 'adminReadAll false: no scope control', 'J11.03': 'adminReadAll false: no catalog search' }, order: ['assert-admin-controls-absent', 'catalog-next-page', 'clear-selection', 'select-6', 'GW3-ready-revision3', 'GW4-unavailable', 'season', 'earlier-phase', 'phase-next-page', 'current-phase', 'gameweek', 'contextual-live-link'], tournamentId: 6, eventId: 4, seasonRevision: '1', semanticSha256: phase.semanticSha256, wholeJourneyComplete: false, readyMs: null }) })
			}
			const live = publishedJourney
				? page.getByRole('contentinfo').getByRole('link', { name: locale === 'zh-CN' ? '实时赛事' : 'Live Competitions', exact: true })
				: unsettledLink
			if (publishedJourney) {
				const review = page.locator('[data-review-ready="true"]')
				await expect(review).toHaveAttribute('data-review-tournament', '6')
				await expect(review).toHaveAttribute('data-review-gw', '4')
				await expect(review).toHaveAttribute('data-review-revision', '1')
				await expect(review).toHaveAttribute('data-review-hash', 'a'.repeat(64))
				const row = review.getByRole('row').filter({ hasText: 'Season Fixture United' })
				await expect(row).toHaveCount(1)
				await expect(row).toContainText('75')
				await expect(row).toContainText('71')
				await expect(unsettledLink).toHaveCount(0)
			}
			await expect(live).toBeVisible()
			await expect(live).toHaveAttribute('href', publishedJourney ? `${prefix}/live/competitions` : `${prefix}/live/competitions?tournamentId=6&gw=4`)
			let recoveryBoardRequests = 0
			if (recoveryMode === 'live-journey-index-gone-new-revision') {
				await page.route('**/api/live/competitions/6/board', async route => {
					recoveryBoardRequests += 1
					const response = await route.fetch()
					const body = await response.json()
					if (recoveryBoardRequests > 1) {
						const board = body.entryLiveCompetitionBoard
						board.head.contentRevision = 'recovered-content-v2'
						board.head.publication.revisions.scoreCore = 'e2e-competition-score-v2'
						for (const row of board.rows) row.score.revisions.scoreCore = 'e2e-competition-score-v2'
					}
					await route.fulfill({ response, json: body })
				})
			}
			let indexRequests = 0
			if (recoveryMode === 'live-journey-index-retry' || recoveryMode.startsWith('live-journey-index-gone')) {
				await page.route('**/api/live/competitions/6/selection-index?*', async route => {
					indexRequests += 1
					if (indexRequests === 1) await route.fulfill({ status: recoveryMode.startsWith('live-journey-index-gone') ? 409 : 503, json: { error: recoveryMode.startsWith('live-journey-index-gone') ? 'LIVE_SCORE_REVISION_GONE' : 'DEPENDENCY_UNAVAILABLE' } })
					else if (recoveryMode === 'live-journey-index-gone-new-revision') {
						expect(new URL(route.request().url()).searchParams.get('scoreCoreRevision')).toBe('e2e-competition-score-v2')
						const response = await route.fetch()
						const body = await response.json()
						body.tournamentSelectionIndex.scoreCoreRevision = 'e2e-competition-score-v2'
						await route.fulfill({ response, json: body })
					} else await route.continue()
				})
			}

            if (recoveryMode === 'live-journey-filter-limits') {
                await page.route('**/api/live/competitions/6/selection-index?*', async route => {
                    const response = await route.fetch()
                    const payload = await response.json()
                    const first = payload.tournamentSelectionIndex.rows[0]
                    payload.tournamentSelectionIndex.rows = Array.from({ length: 6 }, (_, index) => ({ ...first, playerId: index + 1, playerName: index ? `LimitPlayer${index + 1}` : 'Saka', teamId: index + 1, teamName: index ? `LimitClub${index + 1}` : 'Arsenal', teamShortName: index ? `LC${index + 1}` : 'ARS' }))
                    await route.fulfill({ response, json: payload })
                })
            }
			const selectionResponse = page.waitForResponse(response =>
				response.url().includes('/api/live/competitions/6/selection-index?') && new URL(response.url()).searchParams.get('eventId') === '4' && response.status() === 200)
			await live.click()
			if (publishedJourney) {
				await expect(page).toHaveURL(url => url.pathname === `${prefix}/live/competitions`)
				for (const name of ['Journey Alternate Classic', 'E2E Classic League']) {
					await page.getByRole('button', { name: locale === 'zh-CN' ? '经典联赛' : 'Classic', exact: true }).click()
					const initialTournament = page.getByRole('menuitem', { name, exact: true })
					await expect(initialTournament).toBeEnabled()
					await initialTournament.click()
				}
				await expect(page).toHaveURL(url => url.searchParams.get('tournamentId') === '6')
				await page.getByRole('combobox', { name: locale === 'zh-CN' ? '选择轮次' : 'Select gameweek', exact: true }).click()
				await page.getByRole('option', { name: locale === 'zh-CN' ? '第 4 轮' : 'Gameweek 4', exact: true }).click()
			}
			if (recoveryMode === 'live-journey-index-retry' || recoveryMode === 'live-journey-index-gone') {
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
				tournamentId: 6, eventId: 4, scoreCoreRevision: recoveryMode === 'live-journey-index-gone-new-revision' ? 'e2e-competition-score-v2' : 'e2e-competition-score-v1',
				rows: recoveryMode === 'live-journey-filter-limits' ? Array.from({ length: 6 }, (_, index) => ({ playerId: index + 1, playerName: index ? `LimitPlayer${index + 1}` : 'Saka', captainCount: 1 })) : [{ playerId: 1, playerName: 'Saka', captainCount: 1 }]
			})
			await expect(page).toHaveURL(url => url.pathname === `${prefix}/live/competitions` && url.searchParams.get('tournamentId') === '6' && url.searchParams.get('gw') === '4')
			if (formalJourney) {
				for (const tournament of [{ id: 7, name: 'Journey Alternate Classic' }, { id: 6, name: 'E2E Classic League' }]) {
					await page.getByRole('button', { name: locale === 'zh-CN' ? '经典联赛' : 'Classic', exact: true }).click()
					const option = page.getByRole('menuitem', { name: tournament.name, exact: true })
					await expect(option).toHaveCount(1)
					await expect(option).toBeEnabled()
					const boardResponse = page.waitForResponse(response => response.url().endsWith(`/api/live/competitions/${tournament.id}/board`) && response.request().method() === 'POST')
					await option.click()
					const response = await boardResponse
					expect(response.status()).toBe(200)
					expect(response.request().postDataJSON()).toMatchObject({ tournamentId: tournament.id, eventId: 4 })
					expect((await response.json()).entryLiveCompetitionBoard.head).toMatchObject({ tournamentId: tournament.id, eventId: 4 })
					await expect(page).toHaveURL(url => url.pathname === `${prefix}/live/competitions` && url.searchParams.get('tournamentId') === String(tournament.id) && url.searchParams.get('gw') === '4')
					await expect(page.locator(`[data-competition-perf-ready="detail"][data-competition-tournament-id="${tournament.id}"][data-competition-gameweek="4"]`)).toHaveCount(1)
					const selectedTeam = page.getByRole('link', { name: /E2E United/ }).filter({ visible: true })
					await expect(selectedTeam).toHaveCount(1)
					await expect(selectedTeam).toHaveAttribute('href', `${prefix}/live/points/15702?tournamentId=${tournament.id}&gw=4`)
				}
			}
			if (recoveryMode === 'live-journey-index-gone-new-revision') {
				expect(recoveryBoardRequests).toBe(2)
				expect(indexRequests).toBe(2)
				await expect(page.getByRole('alert').filter({ hasText: locale === 'zh-CN' ? '筛选选项暂时不可用' : 'Filter options are temporarily unavailable' })).toHaveCount(0)
				await expect(page.locator('[data-competition-perf-ready="detail"]')).toBeVisible()
			}



            if (recoveryMode === 'live-journey-filter-scope-race') {
                const labels = (locale === 'zh-CN' ? zhMessages : enMessages).Filters
                const ensureFiltersVisible = async () => {
                    if (catalogWidth === 390 && !await page.getByRole('combobox', { name: labels.ownershipScope, exact: true }).isVisible()) {
                        await page.getByRole('button', { name: labels.advancedFilters, exact: true }).click()
                    }
                }
                const chooseTournament = async (id: number) => {
                    await page.getByRole('button', { name: locale === 'zh-CN' ? '经典联赛' : 'Classic', exact: true }).click()
                    await page.getByRole('menuitem', { name: id === 7 ? 'Journey Alternate Classic' : 'E2E Classic League', exact: true }).click()
                }
                const readyFor = (tournament: number, gw: number) => page.locator(`[data-competition-perf-ready="detail"][data-competition-tournament-id="${tournament}"][data-competition-gameweek="${gw}"]`)
                for (const scope of ['gameweek', 'tournament'] as const) {
                    await expect(readyFor(6, 4)).toHaveCount(1)
                    await ensureFiltersVisible()
                    await page.getByRole('button', { name: labels.addPlayer, exact: true }).click()
                    const ownerResponse = page.waitForResponse(response => response.url().endsWith('/api/live/competitions/6/board') && response.request().postDataJSON().input.ownership?.playerIds?.[0] === 1)
                    await page.getByRole('button', { name: /^Saka MID/ }).click()
                    expect((await ownerResponse).status()).toBe(200)
                    await expect(page.getByRole('button', { name: labels.removePlayer.replace('{name}', 'Saka'), exact: true })).toBeVisible()
                    await page.getByRole('combobox', { name: labels.selectTeamAria, exact: true }).click()
                    await page.getByRole('option', { name: 'Arsenal', exact: true }).click()
                    let release!: () => void
                    let markStarted!: () => void
                    let markSettled!: () => void
                    const gate = new Promise<void>(resolve => { release = resolve })
                    const started = new Promise<void>(resolve => { markStarted = resolve })
                    const settled = new Promise<void>(resolve => { markSettled = resolve })
                    let held = false
                    await page.route('**/api/live/competitions/6/board', async route => {
                        const input = route.request().postDataJSON()
                        if (held || input.eventId !== 4 || !input.input.teamCountRules?.length) return route.continue()
                        held = true
                        expect(input.input).toMatchObject({ ownership: { playerIds: [1], scope: 'ANY', captainMode: 'ANY' }, teamCountRules: [{ teamId: 1, exactCount: 1, scope: 'ANY' }] })
                        const response = await route.fetch()
                        const payload = await response.json()
                        for (const row of payload.entryLiveCompetitionBoard.rows) row.entryName = 'Obsolete combined filter row'
                        markStarted()
                        await gate
                        try {
                            if (scope === 'gameweek') await route.fulfill({ response, json: payload })
                            else await route.fulfill({ status: 503, json: { error: 'Obsolete filter failure' } })
                        } finally { markSettled() }
                    })
                    const targetId = scope === 'gameweek' ? 6 : 7
                    const targetGw = scope === 'gameweek' ? 3 : 4
                    try {
                        await page.getByRole('button', { name: labels.addTeam, exact: true }).click()
                        await started
                        if (scope === 'gameweek') await page.getByRole('button', { name: locale === 'zh-CN' ? '上一轮' : 'Previous gameweek', exact: true }).click()
                        else await chooseTournament(7)
                        await expect(page).toHaveURL(url => url.searchParams.get('tournamentId') === String(targetId) && url.searchParams.get('gw') === String(targetGw))
                        await expect(readyFor(targetId, targetGw)).toHaveCount(1)
                        const link = page.getByRole('link', { name: /E2E United/ }).filter({ visible: true })
                        await expect(link).toHaveAttribute('href', `${prefix}/live/points/15702?tournamentId=${targetId}&gw=${targetGw}`)
                        await ensureFiltersVisible()
                        await expect(page.getByRole('combobox', { name: labels.ownershipScope, exact: true })).toBeDisabled()
                        release()
                        await settled
                        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
                        await expect(readyFor(targetId, targetGw)).toHaveCount(1)
                        await expect(link).toHaveAttribute('href', `${prefix}/live/points/15702?tournamentId=${targetId}&gw=${targetGw}`)
                        await expect(page.getByRole('link', { name: /Obsolete combined filter row/ })).toHaveCount(0)
                        await expect(page.getByRole('button', { name: labels.removePlayer.replace('{name}', 'Saka'), exact: true })).toHaveCount(0)
                        await expect(page.getByRole('button', { name: labels.removeTeamItem.replace('{team}', 'Arsenal'), exact: true })).toHaveCount(0)
                        await expect(page.locator('#main-content').getByRole('alert')).toHaveCount(0)
                    } finally {
                        release()
                        await page.unroute('**/api/live/competitions/6/board')
                    }
                    if (scope === 'gameweek') await page.getByRole('button', { name: locale === 'zh-CN' ? '下一轮' : 'Next gameweek', exact: true }).click()
                    else await chooseTournament(6)
                    await expect(readyFor(6, 4)).toHaveCount(1)
                }
                await testInfo.attach('J06-filter-scope-race', { contentType: 'application/json', body: JSON.stringify({ locale, width: catalogWidth, cases: ['late success after GW change', 'late503 after tournament change'], scope: 'Actual input and controlled late delivery; aborted requests may prevent consumer delivery', wholeVariantComplete: false, readyMs: null }) })
                return
            }
            if (recoveryMode === 'live-journey-filter-limits') {
                const labels = (locale === 'zh-CN' ? zhMessages : enMessages).Filters
                if (catalogWidth === 390) await page.getByRole('button', { name: labels.advancedFilters, exact: true }).click()
                const owners: number[] = []
                const clubs: number[] = []
                const observations: unknown[] = []
                await page.route('**/api/live/competitions/6/board', async route => {
                    const input = route.request().postDataJSON().input
                    const response = await route.fetch()
                    const payload = await response.json()
                    const board = payload.entryLiveCompetitionBoard
                    board.rows = [{ ...board.rows[0], entryName: `Limit result P${input.ownership?.playerIds.length ?? 0} T${input.teamCountRules?.length ?? 0}` }]
                    board.filteredEntries = 1
                    board.pageInfo = { hasNextPage: false, endCursor: null }
                    observations.push(input)
                    await route.fulfill({ response, json: payload })
                })
                const apply = async (action: () => Promise<unknown>) => {
                    const result = page.waitForResponse(response => response.url().endsWith('/api/live/competitions/6/board') && response.request().method() === 'POST')
                    await action()
                    const response = await result
                    expect(response.status()).toBe(200)
                    expect(response.request().postDataJSON()).toMatchObject({ tournamentId: 6, eventId: 4, input: { ownership: owners.length ? { playerIds: [...owners], scope: 'ANY', captainMode: 'ANY' } : null, teamCountRules: clubs.map(teamId => ({ teamId, exactCount: 1, scope: 'ANY' })) } })
                    await expect(page.getByRole('link', { name: new RegExp(`^Limit result P${owners.length} T${clubs.length}`) }).filter({ visible: true })).toHaveCount(1)
                    await expect(page.locator('[data-competition-perf-ready="detail"][data-competition-tournament-id="6"][data-competition-gameweek="4"]')).toHaveCount(1)
                }
                const playerName = (id: number) => id === 1 ? 'Saka' : `LimitPlayer${id}`
                const clubName = (id: number) => id === 1 ? 'Arsenal' : `LimitClub${id}`
                const addPlayer = page.getByRole('button', { name: labels.addPlayer, exact: true })
                const addTeam = page.getByRole('button', { name: labels.addTeam, exact: true })
                const selectClub = async (id: number) => {
                    await page.getByRole('combobox', { name: labels.selectTeamAria, exact: true }).click()
                    for (const selected of clubs) await expect(page.getByRole('option', { name: clubName(selected), exact: true })).toHaveCount(0)
                    await page.getByRole('option', { name: clubName(id), exact: true }).click()
                }
                for (const id of [1, 2, 3, 4, 5]) {
                    await addPlayer.click()
                    for (const selected of owners) await expect(page.getByRole('button', { name: new RegExp(`^${playerName(selected)} MID`) })).toHaveCount(0)
                    owners.push(id)
                    await apply(() => page.getByRole('button', { name: new RegExp(`^${playerName(id)} MID`) }).click())
                }
                await expect(addPlayer).toBeDisabled()
                owners.shift()
                await apply(() => page.getByRole('button', { name: labels.removePlayer.replace('{name}', 'Saka'), exact: true }).click())
                await expect(addPlayer).toBeEnabled()
                await addPlayer.click()
                owners.push(6)
                await apply(() => page.getByRole('button', { name: /^LimitPlayer6 MID/ }).click())
                await expect(addPlayer).toBeDisabled()
                for (const id of [1, 2, 3, 4]) {
                    await selectClub(id)
                    clubs.push(id)
                    await apply(() => addTeam.click())
                }
                await selectClub(5)
                await expect(addTeam).toBeDisabled()
                clubs.shift()
                await apply(() => page.getByRole('button', { name: labels.removeTeamItem.replace('{team}', 'Arsenal'), exact: true }).click())
                await expect(addTeam).toBeEnabled()
                clubs.push(5)
                await apply(() => addTeam.click())
                await expect(addTeam).toBeDisabled()
                const clears = page.getByRole('button', { name: labels.clearAll, exact: true })
                await expect(clears).toHaveCount(3)
                owners.length = 0
                await apply(() => clears.nth(0).click())
                await expect(addPlayer).toBeEnabled()
                await expect(page.getByRole('combobox', { name: labels.ownershipScope, exact: true })).toBeDisabled()
                await expect(clears).toHaveCount(2)
                clubs.length = 0
                await apply(() => clears.nth(0).click())
                await expect(clears).toHaveCount(1)
                await expect(clears).toBeDisabled()
                await addPlayer.click()
                owners.push(1)
                await apply(() => page.getByRole('button', { name: /^Saka MID/ }).click())
                await selectClub(1)
                clubs.push(1)
                await apply(() => addTeam.click())
                owners.length = 0
                clubs.length = 0
                await apply(() => clears.last().click())
                await expect(clears).toHaveCount(1)
                await expect(clears).toBeDisabled()
                await testInfo.attach('J06-filter-limits', { contentType: 'application/json', body: JSON.stringify({ locale, width: catalogWidth, observations, ownershipLimit: 5, teamRuleLimit: 4, wholeVariantComplete: false, readyMs: null, scope: 'Web control and payload limits; controlled result responses' }) })
                return
            }
            if (recoveryMode === 'live-journey-filter-options') {
                const labels = (locale === 'zh-CN' ? zhMessages : enMessages).Filters
                if (catalogWidth === 390) await page.getByRole('button', { name: labels.advancedFilters, exact: true }).click()
                const teams = [
                    { entry: 910001, name: 'Filter Captain', scope: 'STARTER', captain: 'CAPTAIN', counts: { ANY: 3, STARTER: 2, BENCH: 1 } },
                    { entry: 910002, name: 'Filter Vice', scope: 'STARTER', captain: 'VICE', counts: { ANY: 2, STARTER: 2, BENCH: 0 } },
                    { entry: 910003, name: 'Filter Bench', scope: 'BENCH', captain: 'ANY', counts: { ANY: 1, STARTER: 0, BENCH: 1 } }
                ]
                const observations: unknown[] = []
                await page.route('**/api/live/competitions/6/board', async route => {
                    const input = route.request().postDataJSON().input
                    const response = await route.fetch()
                    const payload = await response.json()
                    const board = payload.entryLiveCompetitionBoard
                    const matched = teams.filter(team => (!input.ownership || ((input.ownership.scope === 'ANY' || input.ownership.scope === team.scope) && (input.ownership.captainMode === 'ANY' || input.ownership.captainMode === team.captain))) && (input.teamCountRules ?? []).every((rule: { scope: 'ANY' | 'STARTER' | 'BENCH'; exactCount: number }) => team.counts[rule.scope] === rule.exactCount))
                    const template = board.rows[0]
                    expect(template).toBeTruthy()
                    board.rows = matched.map((team, index) => ({ ...template, entry: team.entry, entryName: team.name, liveRank: index + 1 }))
                    board.totalEntries = 3
                    board.filteredEntries = matched.length
                    board.pageInfo = { hasNextPage: false, endCursor: null }
                    observations.push({ input, expectedEntries: matched.map(team => team.entry) })
                    await route.fulfill({ response, json: payload })
                })
                const links = page.getByRole('link', { name: /^Filter (Captain|Vice|Bench)/ }).filter({ visible: true })
                const apply = async (action: () => Promise<unknown>, expected: object, names: string[]) => {
                    const result = page.waitForResponse(response => response.url().endsWith('/api/live/competitions/6/board') && response.request().method() === 'POST')
                    await action()
                    const response = await result
                    expect(response.status()).toBe(200)
                    expect(response.request().postDataJSON()).toMatchObject({ tournamentId: 6, eventId: 4, input: expected })
                    await expect(links).toHaveCount(names.length)
                    for (const name of names) await expect(links.filter({ hasText: name })).toHaveCount(1)
                    await expect(page.locator('[data-competition-perf-ready="detail"][data-competition-tournament-id="6"][data-competition-gameweek="4"]')).toHaveCount(1)
                }
                const choose = async (name: string, value: string) => {
                    await page.getByRole('combobox', { name, exact: true }).click()
                    await page.getByRole('option', { name: value, exact: true }).click()
                }
                const scopeLabels = { ANY: labels.any, STARTER: labels.starter, BENCH: labels.bench }
                const captainLabels = { ANY: labels.anyCaptain, CAPTAIN: labels.selectedCaptain, VICE: labels.selectedViceCaptain }
                const allNames = teams.map(team => team.name)
                await expect(page.getByRole('combobox', { name: labels.ownershipScope, exact: true })).toBeDisabled()
                await expect(page.getByRole('combobox', { name: labels.captaincyFilter, exact: true })).toBeDisabled()
                await page.getByRole('button', { name: labels.addPlayer, exact: true }).click()
                await apply(() => page.getByRole('button', { name: /^Saka MID/ }).click(), { ownership: { playerIds: [1], scope: 'ANY', captainMode: 'ANY' } }, allNames)
                let currentScope = 'ANY'
                let currentCaptain = 'ANY'
                for (const scope of ['ANY', 'STARTER', 'BENCH'] as const) {
                    for (const captainMode of ['ANY', 'CAPTAIN', 'VICE'] as const) {
                        if (scope !== currentScope) {
                            await apply(() => choose(labels.ownershipScope, scopeLabels[scope]), { ownership: { playerIds: [1], scope, captainMode: currentCaptain } }, teams.filter(team => (scope === 'ANY' || team.scope === scope) && (currentCaptain === 'ANY' || team.captain === currentCaptain)).map(team => team.name))
                            currentScope = scope
                        }
                        if (captainMode === currentCaptain) continue
                        await apply(() => choose(labels.captaincyFilter, captainLabels[captainMode]), { ownership: { playerIds: [1], scope, captainMode } }, teams.filter(team => (scope === 'ANY' || team.scope === scope) && (captainMode === 'ANY' || team.captain === captainMode)).map(team => team.name))
                        currentCaptain = captainMode
                    }
                }
                await apply(() => page.getByRole('button', { name: labels.removePlayer.replace('{name}', 'Saka'), exact: true }).click(), { ownership: null }, allNames)
                await expect(page.getByRole('combobox', { name: labels.ownershipScope, exact: true })).toBeDisabled()
                for (const scope of ['ANY', 'STARTER', 'BENCH'] as const) {
                    for (const exactCount of [1, 2, 3]) {
                        await choose(labels.selectTeamAria, 'Arsenal')
                        await choose(labels.minimumPlayers, String(exactCount))
                        await choose(labels.teamScope, scopeLabels[scope])
                        await apply(() => page.getByRole('button', { name: labels.addTeam, exact: true }).click(), { ownership: null, teamCountRules: [{ teamId: 1, exactCount, scope }] }, teams.filter(team => team.counts[scope] === exactCount).map(team => team.name))
                        await apply(() => page.getByRole('button', { name: labels.removeTeamItem.replace('{team}', 'Arsenal'), exact: true }).click(), { teamCountRules: [] }, allNames)
                    }
                }
                await testInfo.attach('J06-filter-options', { contentType: 'application/json', body: JSON.stringify({ locale, width: catalogWidth, observations, scope: 'Web parameter forwarding and rendering of controlled three-team results; not backend filtering proof', ownershipCombinations: 9, teamCountCombinations: 9, wholeVariantComplete: false, readyMs: null }) })
                return
            }
			if (recoveryMode === 'live-journey-focus') {
				const zh = locale === 'zh-CN'
				if (catalogWidth === 390) await page.getByRole('button', { name: zh ? '更多筛选' : 'More filters', exact: true }).click()
				for (const filterKind of ['team', 'player']) {
					const focusTarget = filterKind === 'team' ? page.getByRole('combobox', { name: zh ? '选择要筛选的球队' : 'Select team for exposure filter', exact: true }) : page.getByRole('button', { name: zh ? '添加球员' : 'Add player', exact: true })
					for (const scenario of filterKind === 'team' ? ['restore', 'preserve', 'failure-retry', 'revision', 'revision-preserve', 'revision-failure-retry'] : ['restore', 'preserve', 'failure-retry']) {
						const moveFocus = scenario.endsWith('preserve')
						await focusTarget.click()
						if (filterKind === 'team') {
							await page.getByRole('option', { name: 'Arsenal', exact: true }).click()
							await page.getByRole('button', { name: zh ? '添加球队' : 'Add team', exact: true }).click()
						} else {
							await page.getByRole('button', { name: /^Saka MID/ }).click()
						}
						const remove = page.getByRole('button', { name: scenario === 'revision-failure-retry' ? new RegExp(`^${zh ? '移除' : 'Remove'} (Arsenal|1)$`) : `${zh ? '移除' : 'Remove'} ${filterKind === 'team' ? 'Arsenal' : 'Saka'}`, exact: true })
						await expect(remove).toBeVisible()
						await expect(page.getByRole('button', { name: zh ? '全部清除' : 'Clear all', exact: true }).first()).toBeEnabled()
						let releaseIndex!: () => void
						const indexGate = new Promise<void>(resolve => { releaseIndex = resolve })
						let indexStarted = false
						if (scenario.startsWith('revision')) await page.route('**/api/live/competitions/6/selection-index?*', async route => {
							indexStarted = true
							await indexGate
							const response = await route.fetch()
							const body = await response.json()
							body.tournamentSelectionIndex.scoreCoreRevision = new URL(route.request().url()).searchParams.get('scoreCoreRevision')
							await route.fulfill({ response, json: body })
						})
						let releaseRemoval!: () => void
						const removalGate = new Promise<void>(resolve => { releaseRemoval = resolve })
						if (scenario === 'revision-failure-retry') {
							await page.route('**/api/live/competitions/6/board', async route => {
								const response = await route.fetch()
								const body = await response.json()
								body.entryLiveCompetitionBoard.head.contentRevision = 'focus-pending-index'
								body.entryLiveCompetitionBoard.head.publication.revisions.scoreCore = 'e2e-competition-score-v3'
								for (const row of body.entryLiveCompetitionBoard.rows) row.score.revisions.scoreCore = 'e2e-competition-score-v3'
								await route.fulfill({ response, json: body })
							})
							await page.getByRole('button', { name: zh ? '刷新' : 'Refresh', exact: true }).click()
							await expect.poll(() => indexStarted).toBe(true)
							await expect(focusTarget).toBeDisabled()
							await page.unroute('**/api/live/competitions/6/board')
						}
						await page.route('**/api/live/competitions/6/board', async route => {
							await removalGate
							if (scenario.endsWith('failure-retry')) await route.fulfill({ status: 400, json: { error: 'INVALID_FILTER_INPUT' } })
							else if (scenario.startsWith('revision')) {
								const response = await route.fetch()
								const body = await response.json()
								body.entryLiveCompetitionBoard.head.contentRevision = 'focus-content-v2'
								body.entryLiveCompetitionBoard.head.publication.revisions.scoreCore = 'e2e-competition-score-v2'
								for (const row of body.entryLiveCompetitionBoard.rows) row.score.revisions.scoreCore = 'e2e-competition-score-v2'
								await route.fulfill({ response, json: body })
							} else await route.continue()
						})
						await remove.press('Enter')
						await expect(remove).toHaveCount(0)
						await expect(focusTarget).toBeDisabled()
						const elsewhere = page.getByRole('link', { name: /E2E United/ }).filter({ visible: true }).first()
						if (moveFocus) await elsewhere.focus()
						releaseRemoval()
						if (scenario.startsWith('revision')) {
							await expect.poll(() => indexStarted).toBe(true)
							await expect(focusTarget).toBeDisabled()
							if (scenario !== 'revision-failure-retry') releaseIndex()
						}
						if (scenario.endsWith('failure-retry')) {
							await expect(remove).toBeVisible()
							await expect(remove).toBeFocused()
							if (scenario === 'revision-failure-retry') releaseIndex()
						} else {
							await expect(focusTarget).toBeEnabled()
							await expect(moveFocus ? elsewhere : focusTarget).toBeFocused()
						}
						await page.unroute('**/api/live/competitions/6/board')
						if (scenario.startsWith('revision')) await page.unroute('**/api/live/competitions/6/selection-index?*')
						if (scenario.endsWith('failure-retry')) {
							await expect(remove).toBeVisible()
							await remove.press('Enter')
							await expect(remove).toHaveCount(0)
							await expect(focusTarget).toBeEnabled()
							await expect(focusTarget).toBeFocused()
						}
					}
				}
				return
			}
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
			if (formalJourney) {
				const messages = (locale === 'zh-CN' ? zhMessages : enMessages).LiveTournament
				const search = page.getByRole('textbox', { name: messages.search, exact: true })
				for (const [query, expectedEntries] of [['E2E United', [15702]], ['no-such-journey-team', []]] as const) {
					const result = page.waitForResponse(response => response.url().endsWith('/api/live/competitions/6/board') && response.request().postDataJSON()?.input?.search === query)
					await search.fill(query)
					const response = await result
					expect(response.status()).toBe(200)
					expect(response.request().postDataJSON()).toMatchObject({ tournamentId: 6, eventId: 4 })
					const board = (await response.json()).entryLiveCompetitionBoard
					expect(board.rows.map((row: { entry: number }) => row.entry)).toEqual(expectedEntries)
					await expect(page.getByRole('link', { name: /E2E United/ }).filter({ visible: true })).toHaveCount(expectedEntries.length)
					await expect(page.getByRole('link', { name: /Second Journey United/ }).filter({ visible: true })).toHaveCount(0)
					if (expectedEntries.length === 0) await expect(page.getByText(messages.noMatchingTeams, { exact: true })).toBeVisible()
				}
				await page.getByRole('button', { name: messages.clearSearch, exact: true }).click()
				await expect(search).toHaveValue('')
				await expect(page.getByRole('link', { name: /E2E United/ }).filter({ visible: true })).toHaveCount(1)
				await expect(page.getByRole('link', { name: /Second Journey United/ }).filter({ visible: true })).toHaveCount(1)
				await expect(page.getByText(messages.noMatchingTeams, { exact: true })).toHaveCount(0)
			}
			if (publishedJourney) {
				const messages = (locale === 'zh-CN' ? zhMessages : enMessages).LiveTournament
				if (catalogWidth === 390) await page.getByRole('button', { name: locale === 'zh-CN' ? '更多筛选' : 'More filters', exact: true }).click()
				await page.getByRole('combobox', { name: messages.filterCaptain, exact: true }).click()
				const captainFiltered = page.waitForResponse(response => response.url().endsWith('/api/live/competitions/6/board') && response.request().postDataJSON()?.input?.captainPlayerIds?.includes(1))
				await page.getByRole('option', { name: 'Saka · MID · ARS', exact: true }).click()
				const captainResponse = await captainFiltered
				expect(captainResponse.status()).toBe(200)
				const captainBoard = (await captainResponse.json()).entryLiveCompetitionBoard
				expect(captainBoard.rows.every((row: { captainId: number }) => row.captainId === 1)).toBe(true)
				expect(captainBoard.rows.find((row: { entry: number }) => row.entry === 15702).score.eventPoints).toBe(squadPoints)
				const captainCleared = page.waitForResponse(response => response.url().endsWith('/api/live/competitions/6/board') && response.request().postDataJSON()?.input?.captainPlayerIds?.length === 0)
				await page.getByRole('button', { name: locale === 'zh-CN' ? '移除队长 Saka' : 'Remove captain Saka', exact: true }).click()
				expect((await captainCleared).status()).toBe(200)
				await expect(page.getByRole('group', { name: messages.filterChip, exact: true }).getByRole('button')).toHaveText([messages.tripleCaptain, messages.benchBoost, messages.wildcard, messages.freeHit, messages.assistantManager])
				for (const [chip, label] of [['TRIPLE_CAPTAIN', messages.tripleCaptain], ['BENCH_BOOST', messages.benchBoost], ['WILDCARD', messages.wildcard], ['FREE_HIT', messages.freeHit], ['MANAGER', messages.assistantManager]]) {
					const button = page.getByRole('group', { name: messages.filterChip, exact: true }).getByRole('button', { name: label, exact: true })
					const filtered = page.waitForResponse(response => response.url().endsWith('/api/live/competitions/6/board') && response.request().postDataJSON()?.input?.chips?.includes(chip))
					await button.click()
					expect((await (await filtered).json()).entryLiveCompetitionBoard).toMatchObject({ filteredEntries: 0, rows: [] })
					await expect(page.getByText(messages.noMatchingTeams, { exact: true })).toBeVisible()
					const cleared = page.waitForResponse(response => response.url().endsWith('/api/live/competitions/6/board') && response.request().postDataJSON()?.input?.chips?.length === 0)
					await button.click()
					expect((await (await cleared).json()).entryLiveCompetitionBoard.filteredEntries).toBe(2)
				}
				if (catalogWidth === 390) await page.keyboard.press('Escape')
				const sortColumns = [['TOTAL_POINTS', messages.totalPointsShort], ['OVERALL_RANK', messages.overallRankShort], ['TEAM_VALUE', messages.teamValueShort], ['TRANSFER_COST', messages.cost], ['EVENT_POINTS', messages.gameweekPointsShort]]
				for (const [sort, label] of sortColumns) {
					const nextSort = page.waitForResponse(response => response.url().endsWith('/api/live/competitions/6/board') && response.request().postDataJSON()?.input?.sort === sort)
					await page.getByRole('combobox', { name: messages.sortStandings, exact: true }).click()
					expect((await page.getByRole('option').allTextContents()).sort()).toEqual(sortColumns.map(([, option]) => option).sort())
					await page.getByRole('option', { name: label, exact: true }).click()
					const response = await nextSort
					expect(response.status()).toBe(200)
					const direction = response.request().postDataJSON().input.direction
					const links = page.getByRole('link', { name: /(?:E2E|Second Journey) United/ }).filter({ visible: true })
					await expect(links).toHaveText(direction === 'ASC' ? [/E2E United/, /Second Journey United/] : [/Second Journey United/, /E2E United/])
					const flipped = page.waitForResponse(response => response.url().endsWith('/api/live/competitions/6/board') && response.request().postDataJSON()?.input?.sort === sort && response.request().postDataJSON()?.input?.direction !== direction)
					await page.getByRole('button', { name: direction === 'ASC' ? messages.ascending : messages.descending, exact: true }).click()
					expect((await flipped).status()).toBe(200)
					await expect(links).toHaveText(direction === 'ASC' ? [/Second Journey United/, /E2E United/] : [/E2E United/, /Second Journey United/])
				}
				journeyPagination = true
				const firstPage = page.waitForResponse(response => response.url().endsWith('/api/live/competitions/6/board') && !response.request().postDataJSON()?.input?.after)
				await page.getByRole('button', { name: messages.refresh, exact: true }).click()
				expect((await (await firstPage).json()).entryLiveCompetitionBoard.pageInfo).toMatchObject({ hasNextPage: true, endCursor: 'j06-page-1' })
				const nextPage = page.waitForResponse(response => response.url().endsWith('/api/live/competitions/6/board') && response.request().postDataJSON()?.input?.after === 'j06-page-1')
				const more = page.getByRole('button', { name: locale === 'zh-CN' ? '再显示 1 条' : 'Show 1 more', exact: true })
				await more.click()
				const pageResponse = await nextPage
				expect(pageResponse.request().postDataJSON()).toMatchObject({ tournamentId: 6, eventId: 4 })
				expect((await pageResponse.json()).entryLiveCompetitionBoard.rows.map((row: { entry: number }) => row.entry)).toEqual([9000001])
				await expect(page.getByRole('link', { name: /(?:E2E|Second Journey|Pagination Journey) United/ }).filter({ visible: true })).toHaveCount(3)
				await expect(more).toHaveCount(0)
				journeyPagination = false
				await page.getByRole('button', { name: messages.refresh, exact: true }).click()
				await expect(page.getByRole('link', { name: /Pagination Journey United/ })).toHaveCount(0)
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
			if (comparisonJourney) {
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
				if (recoveryMode === 'live-journey-pinned-large') {
					await expect(page.getByRole('checkbox').filter({ visible: true })).toHaveCount(49)
					await expect(page.getByRole('checkbox', { name: '选择 Large Comparison 1 进行对比', exact: true }).filter({ visible: true })).toBeDisabled()
				}
				const initialScrollLock = await page.evaluate(() => ({ overflow: document.body.style.overflow, lock: document.body.getAttribute('data-scroll-locked') }))
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
				for (const [label, count] of [['GKP', 1], ['DEF', 3], ['MID', 4], ['FWD', 3], ['SUB', 4]] as const) {
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
					await expect(comparison.getByText('Player 12', { exact: true })).toHaveCount(2)
					const playerRow = comparison.getByText('Player 12', { exact: true }).first().locator('../..')
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
				await expect.poll(() => page.evaluate(() => ({ overflow: document.body.style.overflow, lock: document.body.getAttribute('data-scroll-locked') }))).toEqual(initialScrollLock)
				await page.getByRole('button', { name: locale === 'zh-CN' ? '取消' : 'Cancel', exact: true }).click()
				await expect(page.getByRole('checkbox').filter({ visible: true })).toHaveCount(0)
				await expect(compareOpener).toHaveCount(0)
				await expect(page.getByRole('button', { name: locale === 'zh-CN' ? '对比' : 'Compare', exact: true })).toBeEnabled()
				await expect(team).toBeVisible()
				await expect(team).toHaveAttribute('href', `${prefix}/live/points/15702?tournamentId=6&gw=4`)
				await expect(page.getByRole('dialog')).toHaveCount(0)
				await expect.poll(() => page.evaluate(() => ({ overflow: document.body.style.overflow, lock: document.body.getAttribute('data-scroll-locked') }))).toEqual(initialScrollLock)
				// J07.08–11 must remain contiguous: reload must not mask comparison state.
				const cancelledBoardUrl = page.url()
				await team.click()
				await expect(page).toHaveURL(url => url.pathname === `${prefix}/live/points/15702` && url.searchParams.get('tournamentId') === '6' && url.searchParams.get('gw') === '4')
				await expect(page.locator('[data-live-entry="15702"][data-live-gw="4"][data-selected-gw="4"]')).toHaveCount(1)
				const cancelledTeamPitch = page.getByRole('region', { name: locale === 'zh-CN' ? /阵型/ : /formation/ })
				await expect(cancelledTeamPitch.getByRole('button', { name: locale === 'zh-CN' ? /查看 Player/ : /View details for Player/ })).toHaveCount(15)
				await expect(page.getByRole('dialog')).toHaveCount(0)
				await page.goBack()
				await expect(page).toHaveURL(cancelledBoardUrl)
				await expect(page.locator('[data-competition-perf-ready="detail"][data-competition-tournament-id="6"][data-competition-gameweek="4"]')).toHaveCount(1)
				await expect(team).toBeVisible()
				await expect(team).toHaveAttribute('href', `${prefix}/live/points/15702?tournamentId=6&gw=4`)
				await expect(page.getByRole('dialog')).toHaveCount(0)
				await expect.poll(() => page.evaluate(() => ({ overflow: document.body.style.overflow, lock: document.body.getAttribute('data-scroll-locked') }))).toEqual(initialScrollLock)
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
			if (comparisonJourney) {
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
			if (formalJourney) expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(journeyTimezone)
			const originalBoardUrl = page.url()
			const firstReady = page.locator('[data-live-points-ready="true"][data-live-entry="15702"][data-live-gw="4"]')
			await team.click()
			await expect(page).toHaveURL(url => url.pathname === `${prefix}/live/points/15702` && url.searchParams.get('gw') === '4' && url.searchParams.get('tournamentId') === '6')
			const pitch = page.getByRole('region', { name: locale === 'zh-CN' ? /阵型/ : /formation/ })
			await expect(pitch.getByRole('button', { name: locale === 'zh-CN' ? /查看 Player/ : /View details for Player/ })).toHaveCount(15)
			if (formalJourney) {
				await expect(firstReady).toHaveCount(1)
				await expect(firstReady).toHaveAttribute('data-selected-gw', '4')
				await expect(firstReady).toHaveAttribute('data-live-revision', journeyScoreRevision!)
				await expect(pitch.getByText(locale === 'zh-CN' ? '得分' : 'GW PTS', { exact: true }).locator('..')).toContainText(String(squadPoints))
				const captain = pitch.getByRole('button', { name: locale === 'zh-CN' ? '查看 Player 1 的详情' : 'View details for Player 1', exact: true })
				await expect(captain.getByRole('img', { name: locale === 'zh-CN' ? '队长' : 'Captain', exact: true })).toBeVisible()
				await expect(captain.getByText(String(captainPoints), { exact: true })).toBeVisible()
				const labels = (locale === 'zh-CN' ? zhMessages : enMessages).LivePoints
				const viceCaptain = pitch.getByRole('button', { name: locale === 'zh-CN' ? '查看 Player 8 的详情' : 'View details for Player 8', exact: true })
				await expect(viceCaptain.getByRole('img', { name: labels.viceCaptain, exact: true })).toBeVisible()
				const substitutes = pitch.getByRole('heading', { name: labels.substitutes, exact: true }).locator('..').locator('..')
				await expect(substitutes.getByRole('button')).toHaveCount(4)
				await expect(substitutes.getByRole('button', { name: locale === 'zh-CN' ? `查看 Player ${benchPlayerId} 的详情` : `View details for Player ${benchPlayerId}`, exact: true })).toBeVisible()
			}
			if (plannedState === 'stale') {
				await expect(page.locator('time[datetime="2026-08-03T18:00:00.000Z"]')).toContainText('UTC')
				await expect(pitch.getByText('官方最终', { exact: true })).toHaveCount(0)
			}
			if (plannedState === 'auto-sub') {
				await expect(pitch.getByRole('button', { name: '查看 Player 12 的详情; 实时自动换人：Player 12 换入，替下 Player 11', exact: true })).toBeVisible()
				await expect(pitch.getByRole('button', { name: '查看 Player 11 的详情; 实时自动换人：Player 11 被 Player 12 替下', exact: true })).toBeVisible()
			}
			for (const playerId of [1, benchPlayerId]) {
				const opener = pitch.getByRole('button', { name: locale === 'zh-CN' ? `查看 Player ${playerId} 的详情` : `View details for Player ${playerId}`, exact: true })
				// Exercise the unmodified pointer path in this continuous journey.
				await opener.click()
				const dialog = page.getByRole('dialog')
				await expect(dialog.getByRole('heading', { name: `Player ${playerId}`, exact: true })).toBeVisible()
				await expect(dialog.getByText(locale === 'zh-CN' ? '正在加载积分明细…' : 'Loading breakdown…', { exact: true })).toHaveCount(0)
				if (formalJourney) {
					const items = dialog.getByRole('listitem')
					await expect(items).toHaveCount(playerId === 1 ? 4 : 2)
					const values = await items.locator(':scope > span:last-child').allTextContents()
					const numbers = values.map(value => Number(value.replace(/\s/g, '')))
					expect(numbers).toEqual(playerId === 1 ? [plannedState === 'DGW' ? 2 : 1, 6, -1, captainPoints] : [1, 1])
					expect(numbers.slice(0, -1).reduce((sum, value) => sum + value, 0)).toBe(numbers.at(-1))
					await expect(dialog.getByText(locale === 'zh-CN' ? '估算' : 'Estimated', { exact: true })).toHaveCount(0)
				}
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
			// J07.11: browser history directly from the team, before the page-level return.
			const originalTeamUrl = page.url()
			await page.goBack()
			await expect(page).toHaveURL(originalBoardUrl)
			const restoredBoard = page.locator('[data-competition-perf-ready="detail"][data-competition-tournament-id="6"][data-competition-gameweek="4"]')
			await expect(restoredBoard).toHaveCount(1)
			await expect(restoredBoard).toHaveAttribute('data-competition-tournament-id', '6')
			await expect(restoredBoard).toHaveAttribute('data-competition-gameweek', '4')
			await expect(team).toHaveCount(1)
			await expect(team).toBeVisible()
			await expect(team).toHaveAttribute('href', `${prefix}/live/points/15702?tournamentId=6&gw=4`)
			await expect(page.getByRole('dialog')).toHaveCount(0)
			await page.goForward()
			await expect(page).toHaveURL(originalTeamUrl)
			if (formalJourney) {
				await expect(firstReady).toHaveCount(1)
				await expect(firstReady).toHaveAttribute('data-selected-gw', '4')
				await expect(firstReady).toHaveAttribute('data-live-revision', journeyScoreRevision!)
			}
			await expect(pitch.getByRole('button', { name: locale === 'zh-CN' ? /查看 Player/ : /View details for Player/ })).toHaveCount(15)
			await page.getByRole('link', { name: locale === 'zh-CN' ? '返回赛事' : 'Back to competition', exact: true }).click()
			await expect(page).toHaveURL(url => url.pathname === `${prefix}/live/competitions` && url.searchParams.get('tournamentId') === '6' && url.searchParams.get('gw') === '4')
			await expect(restoredBoard).toHaveCount(1)
			await expect(team).toBeVisible()
			await page.goBack()
			await expect(page).toHaveURL(url => url.pathname === `${prefix}/live/points/15702` && url.searchParams.get('tournamentId') === '6' && url.searchParams.get('gw') === '4')
			if (formalJourney) {
				await expect(firstReady).toHaveCount(1)
				await expect(firstReady).toHaveAttribute('data-selected-gw', '4')
				await expect(firstReady).toHaveAttribute('data-live-revision', journeyScoreRevision!)
			}
			await expect(pitch.getByRole('button', { name: locale === 'zh-CN' ? /查看 Player/ : /View details for Player/ })).toHaveCount(15)
			await page.goForward()
			await expect(restoredBoard).toHaveCount(1)
			await expect(team).toBeVisible()
			if (formalJourney) {
				const secondTeam = page.getByRole('link', { name: /Second Journey United/ }).filter({ visible: true })
				await expect(secondTeam).toHaveCount(1)
				await expect(secondTeam).toHaveAttribute('href', `${prefix}/live/points/6733550?tournamentId=6&gw=4`)
				await secondTeam.click()
				await expect(page).toHaveURL(url => url.pathname === `${prefix}/live/points/6733550` && url.searchParams.get('gw') === '4' && url.searchParams.get('tournamentId') === '6')
				const secondReady = page.locator('[data-live-points-ready="true"][data-live-entry="6733550"][data-live-gw="4"]')
				await expect(secondReady).toHaveCount(1)
				await expect(secondReady).toHaveAttribute('data-selected-gw', '4')
				await expect(secondReady).toHaveAttribute('data-live-revision', journeyScoreRevision!)
				await expect(pitch.getByRole('button', { name: /Second Player/ })).toHaveCount(15)
				for (const playerId of [1, benchPlayerId]) {
                    const secondPlayer = pitch.getByRole('button', { name: locale === 'zh-CN' ? `查看 Second Player ${playerId} 的详情` : `View details for Second Player ${playerId}`, exact: true })
                    await secondPlayer.click()
                    const dialog = page.getByRole('dialog')
                    await expect(dialog.getByRole('heading', { name: `Second Player ${playerId}`, exact: true })).toBeVisible()
                    await expect(dialog.getByRole('heading', { name: `Player ${playerId}`, exact: true })).toHaveCount(0)
                    await expect(dialog.getByText(locale === 'zh-CN' ? '正在加载积分明细…' : 'Loading breakdown…', { exact: true })).toHaveCount(0)
                    const items = dialog.getByRole('listitem')
                    await expect(items).toHaveCount(playerId === 1 ? 4 : 2)
                    const values = (await items.locator(':scope > span:last-child').allTextContents()).map(value => Number(value.replace(/\s/g, '')))
                    expect(values).toEqual(playerId === 1 ? [plannedState === 'DGW' ? 2 : 1, 6, -1, captainPoints] : [1, 1])
                    expect(values.slice(0, -1).reduce((sum, value) => sum + value, 0)).toBe(values.at(-1))
                    await expect(dialog.getByText(locale === 'zh-CN' ? '估算' : 'Estimated', { exact: true })).toHaveCount(0)
                    await dialog.press('Escape')
                    await expect(dialog).toHaveCount(0)
                    await expect(secondPlayer).toBeFocused()
                }
				await page.goBack()
				await expect(restoredBoard).toHaveCount(1)
				await expect(secondTeam).toBeVisible()
				await page.goForward()
				await expect(secondReady).toHaveCount(1)
				await expect(secondReady).toHaveAttribute('data-selected-gw', '4')
				await expect(secondReady).toHaveAttribute('data-live-revision', journeyScoreRevision!)
				await expect(pitch.getByRole('button', { name: /Second Player/ })).toHaveCount(15)
				expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe(journeyTheme)
				if (plannedStateJourney) {
					await expect(page.locator('html')).toHaveClass(/dark/)
					expect(await page.evaluate(() => ({ width: innerWidth, language: document.documentElement.lang }))).toEqual({ width: 390, language: 'zh-CN' })
				}
				await testInfo.attach('J06-J11-formal-journey-binding', { contentType: 'application/json', body: JSON.stringify({
					recoveryMode, scoreRevision: journeyScoreRevision,
					tournamentSelectionSequence: [6, 7, 6],
					variantIds: plannedStateJourney ? [`J06.state.${plannedState === 'ready' ? '01' : plannedState === 'stale' ? '02' : plannedState === 'DGW' ? '03' : '04'}`] : ['J06', 'J11'].map(caseId => `${caseId}.B.${locale}.${catalogWidth === 390 ? 'mobile390' : 'desktop1440'}.base`),
					locale, viewport: { width: catalogWidth, height: 900 }, theme: journeyTheme, timezone: journeyTimezone, scenario: plannedState ?? 'baseline',
					tournamentId: 6, gameweek: 4, entries: [15702, 6733550], formalDetailPlayers: [1, benchPlayerId], searchAssertions: ['hit', 'empty', 'clear-restores-both'],
					controlAssertions: publishedJourney ? { captainIds: [1], chips: ['TRIPLE_CAPTAIN', 'BENCH_BOOST', 'WILDCARD', 'FREE_HIT', 'MANAGER'], sortColumns: ['TOTAL_POINTS', 'OVERALL_RANK', 'TEAM_VALUE', 'TRANSFER_COST', 'EVENT_POINTS'], sortDirections: ['ASC', 'DESC'], cursor: 'j06-page-1', appendedEntry: 9000001 } : null,
						reviewStart: publishedJourney ? 'READY revision1 hash a*64 with row75/71' : 'UNAVAILABLE',
					formation: '3-4-3', startingCount: 11, benchCount: 4, viceCaptainId: 8, captainRawPoints: captainPoints, captainMultiplier: 2, captainContribution: captainPoints * 2, activeSquadTotal: squadPoints,
					doubleGameweekAggregatedAppearances: plannedState === 'DGW' ? { minutes: 90, points: 2, assumedFixtures: 2, fixtureIdsObserved: false } : null, autoSub: plannedState === 'auto-sub' ? { playerIn: 12, playerOut: 11 } : null,
					wholeCaseComplete: false, wholeVariantComplete: false, readyMs: null, eventToPaintMs: null,
					missingReason: publishedJourney ? 'Ownership/team-count option enumeration, alternate competition phases, and controlled production performance remain open; captain/chip filters, five sort columns and cursor pagination are asserted.' : 'Scoped formal detail/navigation assertions; complete catalog/filter/phase matrix and production performance not covered.'
				}) })
			}

			if (comparisonJourney) {
				expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(journeyTimezone)
				expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe(journeyTheme)
				await expect(page.locator('html')).toHaveClass(plannedComparison ? /dark/ : /light/)
				await testInfo.attach('J07-planned-binding', { contentType: 'application/json', body: JSON.stringify({
					variantId: plannedComparison ? `J07.state.${recoveryMode.endsWith('-large') ? '02' : '01'}` : `J07.B.${locale}.${catalogWidth === 390 ? 'mobile390' : 'desktop1440'}.base`,
					locale, viewport: page.viewportSize(), theme: journeyTheme, timezone: journeyTimezone, identity: 'B', tournamentId: 6, gameweeks: [3, 4], entries: [123, 15702],
					formation: '3-4-3', scoreTotals: [52, 77], rosterCount: recoveryMode.endsWith('-large') ? 49 : 2,
					readyMs: null, eventToPaintMs: null, wholeVariantComplete: false, missingReason: 'Isolated functional comparison, fault recovery and navigation only; production and performance not measured.'
				}) })
			}

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
		if (recoveryMode === 'catalog-deep-link') {
            const catalogRule = rules[0]
            if (!('myTournamentReviewCatalog' in catalogRule.data)) throw new Error('Expected catalog fixture')
            const original = catalogRule.data.myTournamentReviewCatalog!
            const target = original.edges[0]
            const firstCatalog = { ...original, pageInfo: { hasNextPage: true, endCursor: 'catalog-page-1' }, edges: [{ ...target, cursor: '76', node: { ...target.node, tournamentId: 76, name: 'First Page Cup', latestFinalizedScope: { ...target.node.latestFinalizedScope, tournamentId: 76 } } }] }
            expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ reset: true, rules: [
                { operation: 'GetMyTournamentReviewCatalog', variables: { search: '77' }, data: { myTournamentReviewCatalog: original } },
                { operation: 'GetMyTournamentReviewCatalog', data: { myTournamentReviewCatalog: firstCatalog } },
                ...rules.slice(1)
            ] }) })).ok).toBe(true)
            await page.setViewportSize({ width: catalogWidth, height: 900 })
            await page.goto(`${routePath}?tournamentId=77&view=gameweek&gw=4`)
            const ready = page.locator('[data-review-ready]')
            await expect(ready).toHaveAttribute('data-review-ready', 'true')
            await expect(ready).toHaveAttribute('data-review-tournament', '77')
            await expect(ready).toHaveAttribute('data-review-gw', '4')
            await expect(page.getByRole('cell', { name: /Season Fixture United/ })).toBeVisible()
            const selector = page.getByRole('complementary').getByRole('combobox').first()
            await expect(selector).toHaveValue('77')
            await expect(selector.locator('option[value="76"]')).toHaveCount(1)
            await expect(selector.locator('option[value="77"]')).toHaveCount(1)
            const observed = await (await fetch(fixture)).json() as { requests: { operation: string; variables: Record<string, unknown> }[] }
            const catalogRequests = observed.requests.filter(request => request.operation === 'GetMyTournamentReviewCatalog')
            expect(catalogRequests.map(request => request.variables)).toEqual([
                { scope: 'ACCESSIBLE', first: 50 },
                { scope: 'ACCESSIBLE', first: 100, after: null, search: '77' }
            ])
            await expect(page).toHaveURL(url => url.searchParams.get('tournamentId') === '77' && url.searchParams.get('gw') === '4')
            return
        }
		if (recoveryMode.startsWith('catalog-')) {
            const catalogRule = rules[0]
            if (!('myTournamentReviewCatalog' in catalogRule.data)) throw new Error('Expected catalog fixture')
            const original = catalogRule.data.myTournamentReviewCatalog!
            const firstCatalog = { ...original, adminReadAll: true, pageInfo: { hasNextPage: true, endCursor: 'catalog-page-1' } }
            expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [{ operation: 'GetMyTournamentReviewCatalog', data: { myTournamentReviewCatalog: firstCatalog } }, ...rules.slice(1)] }) })).ok).toBe(true)
            await page.goto(`${routePath}?tournamentId=77&view=gameweek&gw=4`)
            await expect(page.getByRole('cell', { name: /Season Fixture United/ })).toBeVisible()
            let releasePage!: () => void
            const pageGate = new Promise<void>(resolve => { releasePage = resolve })
            const requests: unknown[] = []
            let pageReturned = false
            await page.route('**/api/graphql', async route => {
                const body = route.request().postDataJSON()
                if (!body.query?.includes('GetMyTournamentReviewCatalog')) return route.fallback()
                requests.push(body.variables)
                if (body.variables.scope === 'ALL') {
                    await route.fulfill({ json: { data: { myTournamentReviewCatalog: { ...original, adminReadAll: true } } } })
                    return
                }
                await pageGate
                if (recoveryMode === 'catalog-retry' && requests.length === 1) {
                    await route.fulfill({ json: { errors: [{ message: 'Isolated catalog page failure', extensions: { code: 'BAD_USER_INPUT' } }] } })
                    return
                }
                const firstEdge = original.edges[0]
                await route.fulfill({ json: { data: { myTournamentReviewCatalog: { ...original, edges: [firstEdge, { cursor: '78', node: { ...firstEdge.node, tournamentId: 78, name: 'Second Catalog Cup' } }] } } } })
                pageReturned = true
            })
            const more = page.getByRole('button', { name: locale === 'zh-CN' ? '加载更多赛事' : 'Load more tournaments', exact: true })
            await page.setViewportSize({ width: catalogWidth, height: 900 })
            try {
                await more.click()
                await expect.poll(() => requests.length).toBe(1)
                expect(requests[0]).toMatchObject({ first: 100, after: 'catalog-page-1', search: null })
                expect((requests[0] as { scope: string }).scope).toBe('ACCESSIBLE')
                await expect(page.getByRole('button', { name: locale === 'zh-CN' ? '正在加载赛事…' : 'Loading tournaments…', exact: true })).toBeDisabled()
                if (recoveryMode === 'catalog-race') {
                    await expect(page.getByRole('button', { name: locale === 'zh-CN' ? '搜索' : 'Search', exact: true })).toBeDisabled()
                    await page.getByRole('button', { name: locale === 'zh-CN' ? '管理员：查看全部赛事' : 'Admin: show all tournaments', exact: true }).click({ timeout: 3000 })
                    await expect.poll(() => requests.length).toBe(2)
                    expect(requests[1]).toMatchObject({ first: 100, after: null, scope: 'ALL', search: null })
                    expect(pageReturned).toBe(false)
                    await expect(page).toHaveURL(/scope=all/)
                }
            } finally { releasePage() }
            if (recoveryMode === 'catalog-retry') {
                await expect(page.getByRole('complementary').getByRole('status')).toHaveText(locale === 'zh-CN' ? '赛事复盘暂时不可用，请重试。' : 'Tournament review is temporarily unavailable. Please try again.')
                await expect(more).toBeEnabled()
                await expect(page.getByRole('cell', { name: /Season Fixture United/ })).toBeVisible()
                await expect(page.getByRole('complementary').getByRole('combobox').first()).toHaveValue('77')
                await more.click()
                await expect.poll(() => requests.length).toBe(2)
                expect(requests[1]).toEqual(requests[0])
                await expect(page.getByRole('complementary').getByRole('status')).toHaveCount(0)
            }
            await expect.poll(() => pageReturned).toBe(true)
            await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
            const selector = page.getByRole('complementary').getByRole('combobox').first()
            await expect(selector.locator('option[value="78"]')).toHaveCount(recoveryMode === 'catalog-race' ? 0 : 1)
            await expect(selector.locator('option[value="77"]')).toHaveCount(1)
            await expect(selector).toHaveValue('77')
            await expect(more).toHaveCount(0)
            await expect(page.locator('[data-review-ready]')).toHaveAttribute('data-review-tournament', '77')
            await expect(page.locator('[data-review-ready]')).toHaveAttribute('data-review-gw', '4')
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
			const retry = page.getByRole('button', { name: locale === 'zh-CN' ? zhMessages.TournamentStats.reviewRetryPhase : 'Retry this phase', exact: true })
			await expect(retry).toBeVisible()
			await expect(page.getByRole('cell', { name: /Season Fixture United/ })).toBeVisible()
			await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
			await expect(page.locator('[data-review-ready]')).toHaveAttribute('data-review-ready', 'false')
			expect(readyReports).toBe(0)
			expect(sectionRequests).toBe(0)
			const seeded = await (await fetch(fixture)).json()
			expect(seeded.requests.filter((item: { operation: string }) => item.operation === pointsSectionOperation)).toHaveLength(2)
			expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules }) })).ok).toBe(true)
			releaseSections()
			await retry.click()
			await expect.poll(() => sectionRequests).toBe(2)
			await expect(retry).toHaveCount(0)
			await expect(page.getByRole('cell', { name: /Season Fixture United/ })).toBeVisible()
			await expect(page.locator('[data-review-ready]')).toHaveAttribute('data-review-ready', 'true')
			await expect.poll(() => readyReports).toBe(1)
			await attachPlannedReview()
			return
		}
		await page.goto(`${routePath}?tournamentId=77&view=gameweek&gw=4`)
		await expect(page.getByRole('cell', { name: /Season Fixture United/ })).toBeVisible()
		const reviewReady = page.locator('[data-review-ready]')
		await expect(reviewReady).toHaveAttribute('data-review-ready', 'true')
		await expect(reviewReady).toHaveAttribute('data-review-view', 'gameweek')
		await expect(reviewReady).toHaveAttribute('data-review-revision', '1')
		await expect.poll(() => readyReports).toBe(1)
		const observations = await (await fetch(fixture)).json()
		expect(observations.requests.filter((item: { operation: string }) => item.operation === pointsSectionOperation)).toHaveLength(0)
		page.on('request', request => {
			const url = new URL(request.url())
			if (url.pathname === routePath && url.searchParams.has('_rsc')) viewNavigationRequests += 1
		})
		const season = page.getByRole('tab', { name: locale === 'zh-CN' ? '赛季' : 'Season', exact: true })
		const gameweek = page.getByRole('tab', { name: locale === 'zh-CN' ? '轮次' : 'Gameweek', exact: true })
		await season.click()
		await expect.poll(() => sectionRequests).toBe(2)
		await expect(reviewReady).toHaveAttribute('data-review-ready', 'false')
		await expect(reviewReady).toHaveAttribute('data-review-view', 'season')
		expect(viewNavigationRequests).toBe(0)
		await expect(page.getByText(locale === 'zh-CN' ? '已结算发布缺少对应赛制数据。' : 'The finalized publication has no format payload.', { exact: true })).toHaveCount(0)
		await gameweek.click()
		await expect(page.getByRole('cell', { name: /Season Fixture United/ })).toBeVisible()
		await expect(reviewReady).toHaveAttribute('data-review-view', 'gameweek')
		await expect(reviewReady).toHaveAttribute('data-review-ready', 'true')
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
		await expect(reviewReady).toHaveAttribute('data-review-ready', 'true')
		await expect(reviewReady).toHaveAttribute('data-review-phase', 'points-1')
		expect(readyReports, 'View changes must not reuse the navigation clock for new samples').toBe(1)
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
		await attachPlannedReview()
		if (recoveryMode === 'none' && !plannedReview) {
			await testInfo.attach(`S01-minimal-complete-${locale}`, {
				contentType: 'application/json',
				body: JSON.stringify({
					caseId: 'S01',
					stepIds: ['S01.01'],
					state: 'minimal-complete',
					locale,
					viewport: { width: 0, height: 0, configured: 'default desktop project' },
					rows: 1,
					readyMarker: { selector: '[data-review-ready="true"]', tournamentId: 77, gw: 4 },
					assertions: ['single complete review row is visible', 'ready is true only with the row content present', 'gameweek/season navigation returns to the same seeded review'],
					businessWrites: [],
					functionalStatus: 'PASS',
					performanceStatus: 'NOT_OBSERVED',
					readyMs: null,
					eventToPaintMs: null,
					wholeCaseComplete: false,
					missingReason: 'Minimum fixture set is scoped to the tournament review page; other routes, full matrix bindings and controlled timing remain open.'
				})
			})
		}
	} finally {
		releaseSections()
		await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
		await session.cleanup()
	}
})
})

}

}
}

test('C07 extreme live table data keeps paging, sort and mobile geometry bounded', async ({ page }, testInfo) => {
 test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Uses isolated extreme table fixture')
 const session = await createSession({ entryId: 123 })
 const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
 const requests: Array<{ sort?: string; direction?: string; after?: string | null }> = []
 const businessWrites: string[] = []
 page.on('request', request => {
  if (
   !['GET', 'HEAD'].includes(request.method()) &&
   !request.url().includes('/api/vitals') &&
   !request.url().includes('/api/graphql') &&
   !request.url().includes('/api/live/competitions/')
  ) businessWrites.push(`${request.method()} ${new URL(request.url()).pathname}`)
 })
 try {
  const liveSeed = await (await fetch(fixture.replace('/__performance', '/graphql'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'query GetLiveContext { __typename }' }) })).json()
  expect(liveSeed.errors).toBeUndefined()
  Object.assign(liveSeed.data.coreEventContext, { currentEventId: 4, nextEventId: 5, latestFinishedEventId: 3 })
  Object.assign(liveSeed.data.liveContext, { eventId: 4, nextEventId: 5, anchorEventId: 4, latestFinalizedEventId: 3 })
  expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [{ operation: 'GetLiveContext', data: liveSeed.data }, { operation: 'GetEntryTournaments', data: { entryTournaments: [{ ...managedTournament, id: 6, name: 'Extreme Coverage League', adminEntryId: 15702 }] } }] }) })).ok).toBe(true)
  await addSessionCookie(page, session.cookie)
  await page.route('**/api/live/competitions/6/board', async route => {
   const payload = route.request().postDataJSON()
   const input = payload.input ?? {}
   requests.push(input)
   const response = await route.fetch()
   const body = await response.json()
   const board = body.entryLiveCompetitionBoard
   const template = board.rows[0]
	   const rows = Array.from({ length: 48 }, (_, index) => ({
	    ...template,
	    entry: 2000 + index,
	    entryName: `Extreme Team ${String(index + 1).padStart(2, '0')} ${'LongName '.repeat(8)}`,
	    liveRank: index + 1,
	    overallRank: index + 1,
	    availability: index === 0 ? 'MISSING' : template.availability,
	    score: index === 0 ? null : { ...template.score, eventPoints: index + 1, netEventPoints: index + 1, totalPoints: index === 1 ? 0 : (index + 1) * 100 }
	   }))
	   const sortKey = input.sort === 'TOTAL_POINTS' ? 'totalPoints' : 'eventPoints'
	   rows.sort((left, right) => {
	    const leftValue = left.score?.[sortKey] ?? 0
	    const rightValue = right.score?.[sortKey] ?? 0
	    return input.direction === 'ASC' ? leftValue - rightValue : rightValue - leftValue
	   })
   const pageIndex = input.after === 'extreme-page-2' ? 1 : input.after === 'extreme-page-3' ? 2 : 0
   const pageRows = rows.slice(pageIndex * 20, (pageIndex + 1) * 20)
   board.rows = pageRows
   board.viewerRow = null
   board.totalEntries = rows.length
   board.filteredEntries = rows.length
   board.pageInfo = { hasNextPage: pageIndex < 2, endCursor: pageIndex < 2 ? `extreme-page-${pageIndex + 2}` : null }
   await route.fulfill({ response, json: body })
  })
  for (const width of [1440, 390]) {
   requests.length = 0
   await page.setViewportSize({ width, height: 900 })
   await page.goto('/live/competitions?tournamentId=6&gw=4')
   const teams = page.getByRole('link', { name: /Extreme Team/ }).filter({ visible: true })
   await expect(teams).toHaveCount(20)
   await expect(teams.first()).toContainText('Extreme Team 48')
	   const loadMore = page.getByRole('button', { name: /Show 20 more|Show 8 more/ }).filter({ visible: true })
	   await loadMore.click()
	   await expect(teams).toHaveCount(40)
	   const loadMoreFinal = page.getByRole('button', { name: 'Show 8 more', exact: true }).filter({ visible: true })
	   await expect(loadMoreFinal).toBeVisible()
	   await loadMoreFinal.click()
	   await expect(teams).toHaveCount(48)
	   expect(new Set(await teams.evaluateAll(nodes => nodes.map(node => (node as HTMLAnchorElement).href))).size).toBe(48)
	   const missingRow = page.locator('li').filter({ hasText: 'Extreme Team 01' }).filter({ visible: true }).first()
	   const zeroRow = page.locator('li').filter({ hasText: 'Extreme Team 02' }).filter({ visible: true }).first()
	   await expect(missingRow).toContainText('—')
	   await expect(zeroRow).toContainText('0')
   await page.getByRole('combobox', { name: 'Sort competition standings', exact: true }).click()
   await page.getByRole('option', { name: 'Total Pts', exact: true }).click()
   await expect(teams.first()).toContainText('Extreme Team 48')
   await page.getByRole('button', { name: 'Desc', exact: true }).click()
   await expect(teams.first()).toContainText('Extreme Team 01')
   await expect(teams).toHaveCount(48)
   expect(new Set(await teams.evaluateAll(nodes => nodes.map(node => (node as HTMLAnchorElement).href))).size).toBe(48)
   const geometry = await page.evaluate(() => ({ viewport: innerWidth, documentWidth: document.documentElement.scrollWidth }))
   expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewport + 1)
   expect(businessWrites).toEqual([])
	   await testInfo.attach(`C07-extreme-table-${width}`, { contentType: 'application/json', body: JSON.stringify({
    caseId: 'C07', stepIds: ['C07.04'], state: 'extreme-table', locale: 'en', viewport: { width, height: 900 }, rows: 48,
    assertions: ['stable sort order across 48 rows', 'server paging 20→40→48 without duplicate hrefs', 'long team names stay inside the viewport', 'no business writes'],
    geometry, requests, businessWrites, functionalStatus: 'PASS', performanceStatus: 'NOT_OBSERVED', readyMs: null, eventToPaintMs: null, wholeCaseComplete: false
   }) })
	   await testInfo.attach(`S17-extreme-bounds-${width}`, { contentType: 'application/json', body: JSON.stringify({
	    caseId: 'S17', stepIds: ['S17.01'], state: 'large-paged-mixed-values', locale: 'en', viewport: { width, height: 900 },
	    rows: 48, pages: [20, 40, 48], longName: true, missingValue: 'Extreme Team 01 → —', zeroValue: 'Extreme Team 02 → 0',
	    assertions: ['48-row list remains paged and hrefs remain unique', 'sort order remains stable for numeric and missing values', 'zero and missing values render distinctly', 'document width stays within viewport'],
	    businessWrites: [], functionalStatus: 'PASS', performanceStatus: 'NOT_OBSERVED', readyMs: null, eventToPaintMs: null, wholeCaseComplete: false,
	    missingReason: 'Large-list/paging/long-name/zero-vs-missing subset is covered; memory growth, minimum dataset, all historical pages and controlled performance remain open.'
	   }) })
  }
 } finally {
  await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
  await session.cleanup()
 }
})

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

for (const locale of ['en', 'zh-CN'] as const) {
test.describe(`LC02 planned ${locale}`, () => {
 test.use({ locale, timezoneId: 'Australia/Perth', colorScheme: 'light' })
for (const width of [1440, 390]) {
 for (const failure of [false, true]) {
 test(`canonical competition board sort and pagination preserve request scope at ${width}px${failure ? ' with next-page failure recovery' : ''}`, async ({ page }, testInfo) => {
  test.skip(process.env.E2E_SSR_REMEDIATION !== '1', 'Uses isolated board fixtures')
  const zh = locale === 'zh-CN'
  const variantId = `LC02.B.${locale}.${width === 1440 ? 'desktop1440' : 'mobile390'}.base`
  testInfo.annotations.push({ type: 'coverage-variant', description: variantId })
  await page.addInitScript(() => localStorage.setItem('theme', 'system'))
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
    const fixtureValues: Record<string, number[]> = {
     EVENT_POINTS: [30, 20, 10], TOTAL_POINTS: [100, 300, 200],
     OVERALL_RANK: [100, 500, 999], TEAM_VALUE: [1000, 1020, 1010], TRANSFER_COST: [0, 8, 4]
    }
    const values = fixtureValues[input.sort ?? 'EVENT_POINTS']
    expect(values).toBeDefined()
    rows.sort((a, b) => (values[a.entry - 15702] - values[b.entry - 15702]) * (input.direction === 'ASC' ? 1 : -1))
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
   await page.goto(`${zh ? '/zh-CN' : ''}/live/competitions?tournamentId=6&gw=4`)
   await expect(page.locator('html')).toHaveClass(/light/)
   expect(await page.evaluate(() => ({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, theme: localStorage.getItem('theme'), language: navigator.language }))).toEqual({ timezone: 'Australia/Perth', theme: 'system', language: locale })
   expect(page.viewportSize()?.width).toBe(width)
   const teams = page.getByRole('link', { name: /(?:Alpha|Beta|Gamma) Coverage/ }).filter({ visible: true })
   await expect(teams).toHaveCount(2)
   await expect(teams.nth(0)).toContainText('Alpha Coverage')
   await page.getByRole('button', { name: (zh ? '对比' : 'Compare'), exact: true }).click()
   const selectedAlpha = page.getByRole('checkbox', { name: (zh ? '选择 Alpha Coverage 进行对比' : 'Select Alpha Coverage for comparison'), exact: true }).filter({ visible: true })
   await selectedAlpha.check()
   if (failure) await page.clock.pauseAt(new Date(Date.now() + 1_000))
   await page.getByRole('button', { name: (zh ? '再显示 1 条' : 'Show 1 more'), exact: true }).click()
   if (failure) {
    await expect.poll(() => failedNextPage).toBe(1)
    await expect.poll(() => page.evaluate(() => Number(sessionStorage.getItem('letletme:dependency-cooldown-until-v1')) > Date.now())).toBe(true)
    await page.clock.runFor(1_100)
    const warning = page.getByText((zh ? '刷新失败，继续显示上一次可用的积分榜。' : 'Refresh failed. The last available standings are still shown.'), { exact: true })
    await expect(warning).toBeVisible()
    await expect(teams).toHaveText([/Alpha Coverage/, /Beta Coverage/])
    await test.info().attach('pagination-retry-clock', { body: JSON.stringify(await page.evaluate(() => ({ now: Date.now(), cooldownUntil: sessionStorage.getItem('letletme:dependency-cooldown-until-v1'), failureAt: sessionStorage.getItem('letletme:dependency-cooldown-failure-at-v1') }))), contentType: 'application/json' })
    expect(inputs.filter(input => input.after === 'coverage-page-2')).toHaveLength(2)
    // Advance the same browser clock used by Retry-After and the cooldown fence.
    await page.clock.runFor(1_100)
    await page.clock.resume()
    await page.getByRole('button', { name: (zh ? '再显示 1 条' : 'Show 1 more'), exact: true }).click()
    await expect(warning).toHaveCount(0)
    expect(inputs.filter(input => input.after === 'coverage-page-2')).toHaveLength(3)
   }
   await expect(teams).toHaveCount(3)
   await expect(teams.nth(2)).toContainText('Gamma Coverage')
   expect(inputs.at(-1)).toMatchObject({ after: 'coverage-page-2' })
   await expect(selectedAlpha).toBeChecked()
   await page.getByRole('checkbox', { name: (zh ? '选择 Gamma Coverage 进行对比' : 'Select Gamma Coverage for comparison'), exact: true }).filter({ visible: true }).check()
   await expect(page.getByRole('checkbox', { name: (zh ? '选择 Beta Coverage 进行对比' : 'Select Beta Coverage for comparison'), exact: true }).filter({ visible: true })).toBeDisabled()
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
   await page.getByRole('button', { name: (zh ? '对比（2）' : 'Compare (2)'), exact: true }).click()
   expect((await refreshedBoard).status()).toBe(200)
   await expect(page.getByRole('dialog')).toBeVisible()
   await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible()
   expect(comparisonAttempts).toBe(1)
   const compared = page.waitForResponse(response => response.url().includes('/api/live/competitions/6/compare?'))
   await page.getByRole('dialog').getByRole('button', { name: (zh ? '刷新' : 'Refresh'), exact: true }).click()
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
   await page.getByRole('button', { name: (zh ? '对比（2）' : 'Compare (2)'), exact: true }).click()
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
   await page.getByRole('button', { name: (zh ? '取消' : 'Cancel'), exact: true }).click()
   await page.getByRole('combobox', { name: (zh ? '积分榜排序方式' : 'Sort competition standings'), exact: true }).click()
   await page.getByRole('option', { name: (zh ? '总积分' : 'Total Pts'), exact: true }).click()
   await expect(teams).toHaveCount(2)
   await expect(teams.nth(0)).toContainText('Beta Coverage')
   await expect(teams.nth(1)).toContainText('Gamma Coverage')
   expect(inputs.at(-1)).toMatchObject({ sort: 'TOTAL_POINTS', direction: 'DESC' })
   expect(inputs.at(-1)?.after ?? null).toBeNull()
   await page.getByRole('button', { name: (zh ? '降序' : 'Desc'), exact: true }).click()
   await expect(teams.nth(0)).toContainText('Alpha Coverage')
   await expect(teams.nth(1)).toContainText('Gamma Coverage')
   expect(inputs.at(-1)).toMatchObject({ sort: 'TOTAL_POINTS', direction: 'ASC' })
   await expect(page).toHaveURL(url => url.searchParams.get('tournamentId') === '6' && url.searchParams.get('gw') === '4')
   const sortCases = [
    { label: zh ? '本轮积分' : 'GW Pts', sort: 'EVENT_POINTS', direction: 'DESC', expected: ['Alpha Coverage', 'Beta Coverage', 'Gamma Coverage'] },
    { label: zh ? '总积分' : 'Total Pts', sort: 'TOTAL_POINTS', direction: 'DESC', expected: ['Beta Coverage', 'Gamma Coverage', 'Alpha Coverage'] },
    { label: zh ? '总排名' : 'OR', sort: 'OVERALL_RANK', direction: 'ASC', expected: ['Alpha Coverage', 'Beta Coverage', 'Gamma Coverage'] },
    { label: zh ? '阵容身价' : 'TV', sort: 'TEAM_VALUE', direction: 'DESC', expected: ['Beta Coverage', 'Gamma Coverage', 'Alpha Coverage'] },
    { label: zh ? '扣分' : 'Cost', sort: 'TRANSFER_COST', direction: 'DESC', expected: ['Beta Coverage', 'Gamma Coverage', 'Alpha Coverage'] }
   ]
   const sortControl = page.getByRole('combobox', { name: zh ? '积分榜排序方式' : 'Sort competition standings', exact: true })
   for (const [index, item] of Array.from(sortCases.entries())) {
    await sortControl.click()
    if (index === 0) await expect(page.getByRole('option')).toHaveText(sortCases.map(option => option.label))
    await page.getByRole('option', { name: item.label, exact: true }).click()
    await expect(teams).toHaveCount(2)
    for (const [position, name] of Array.from(item.expected.slice(0, 2).entries())) await expect(teams.nth(position)).toContainText(name)
    expect(inputs.at(-1)).toMatchObject({ sort: item.sort, direction: item.direction })
    expect(inputs.at(-1)?.after ?? null).toBeNull()
    await expect(sortControl).toHaveText(item.label)
    await page.getByRole('button', { name: item.direction === 'ASC' ? (zh ? '升序' : 'Asc') : (zh ? '降序' : 'Desc'), exact: true }).click()
    for (const [position, name] of Array.from([...item.expected].reverse().slice(0, 2).entries())) await expect(teams.nth(position)).toContainText(name)
    expect(inputs.at(-1)).toMatchObject({ sort: item.sort, direction: item.direction === 'ASC' ? 'DESC' : 'ASC' })
    expect(inputs.at(-1)?.after ?? null).toBeNull()
   }
   await page.getByRole('button', { name: (zh ? '对比' : 'Compare'), exact: true }).click()
   await page.getByRole('checkbox', { name: (zh ? '选择 Gamma Coverage 进行对比' : 'Select Gamma Coverage for comparison'), exact: true }).filter({ visible: true }).check()
   await expect(page.getByText((zh ? '再选 1 支球队' : 'Select 1 more to compare'), { exact: true })).toBeVisible()
   await page.getByRole('button', { name: (zh ? '经典联赛' : 'Classic'), exact: true }).click()
   const switched = page.waitForResponse(response => new URL(response.url()).pathname === '/api/live/competitions/7/board')
   await page.getByRole('menuitem', { name: 'Coverage League 7', exact: true }).click()
   const switchedResponse = await switched
   expect(switchedResponse.status()).toBe(200)
   expect((await switchedResponse.json()).entryLiveCompetitionBoard.head).toMatchObject({ tournamentId: 7, eventId: 4 })
   await expect(page).toHaveURL(url => url.searchParams.get('tournamentId') === '7' && url.searchParams.get('gw') === '4')
   await expect(page.getByRole('link', { name: /E2E United/ }).filter({ visible: true })).toHaveCount(1)
   await expect(page.getByRole('button', { name: (zh ? '对比' : 'Compare'), exact: true })).toBeVisible()
   await expect(page.getByText((zh ? '再选 1 支球队' : 'Select 1 more to compare'), { exact: true })).toHaveCount(0)
   await page.getByRole('button', { name: (zh ? '对比' : 'Compare'), exact: true }).click()
   await expect(page.getByText((zh ? '勾选 2 支队伍' : 'Select 2 teams'), { exact: true })).toBeVisible()
   await expect(page.getByRole('checkbox', { name: (zh ? '选择 E2E United 进行对比' : 'Select E2E United for comparison'), exact: true }).filter({ visible: true })).not.toBeChecked()
   await testInfo.attach('LC02-scoped-context', { contentType: 'application/json', body: JSON.stringify({ variantId, locale, width, timezone: 'Australia/Perth', theme: 'system', identity: 'bound fixture user', boundEntryId: session.entryId, failureInjection: failure, functionalAssertions: 'PASS', readyMs: null, wholeVariantComplete: false, remaining: 'Large roster, empty state, server sorting algorithm and performance remain open.' }) })
  } finally {
   await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
   await session.cleanup()
  }
 })
}
}

})
}

for (const profile of ['baseline', 'ready', 'session-expired'] as const) {
for (const locale of profile === 'baseline' ? ['en', 'zh-CN'] : ['zh-CN']) {
	for (const width of profile === 'baseline' ? [1440, 390] : [390]) {
 test.describe(`J14 planned ${profile} ${locale} ${width}`, () => {
 test.use({ timezoneId: profile === 'baseline' ? 'Australia/Perth' : 'UTC', colorScheme: profile === 'baseline' ? 'light' : 'dark' })
		test(`J14 isolated bound profile and session journey ${locale} ${width}px`, async ({ page }, testInfo) => {
			test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Requires isolated server FPL fixture')
			const zh = locale === 'zh-CN'
			const prefix = zh ? '/zh-CN' : ''
			const session = await createSession({ entryId: 15702 })
			const sql = postgres(process.env.E2E_DIRECT_DATABASE_URL!, { max: 1, prepare: false })
			const untouched = profile !== 'session-expired' ? await createSession({ entryId: 15702 }) : null
			const otherSessionId = `j14-other-${randomUUID()}`
			const writes: string[] = []
			page.on('request', request => {
				if (request.url().includes('/api/auth/') && request.method() !== 'GET') writes.push(new URL(request.url()).pathname)
			})
			const theme = profile === 'baseline' ? 'system' : 'dark'
			try {
                await page.addInitScript(value => localStorage.setItem('theme', value), theme)
				await sql`INSERT INTO bauth.session (id, expires_at, token, user_id, user_agent) VALUES (${otherSessionId}, ${new Date(Date.now() + 3600000)}, ${randomUUID()}, ${session.userId}, 'Mozilla/5.0 (Windows NT 10.0) Firefox/130.0')`
				await addSessionCookie(page, session.cookie)
				await page.setViewportSize({ width, height: 900 })
				if (profile !== 'session-expired') {
     const [before] = await sql`SELECT fpl_team_name, fpl_manager_name, fpl_identity_refreshed_at FROM bauth."user" WHERE id=${session.userId}`
     expect(before).toEqual({ fpl_team_name: 'E2E United', fpl_manager_name: 'Test Manager', fpl_identity_refreshed_at: null })
     expect(await sql`SELECT team_name FROM bauth.fpl_entry_name_history WHERE user_id=${session.userId}`).toHaveLength(0)
    }
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
				const bindingWrites: string[] = []
				await page.route('**/*', route => {
					if (!['GET', 'HEAD'].includes(route.request().method())) {
						const pathname = new URL(route.request().url()).pathname
						// Vitals are telemetry, not a binding mutation; still abort them here.
						if (pathname !== '/api/vitals' || route.request().headers()['next-action']) bindingWrites.push(pathname)
						return route.abort()
					}
					return route.continue()
				})
				await main.getByRole('button', { name: zh ? '更改' : 'Change', exact: true }).click()
				const entryInput = main.getByLabel(zh ? 'FPL 参赛 ID / 球队名 / 经理名' : 'FPL entry ID / team or manager name', { exact: true })
				await expect(entryInput).toHaveValue(String(session.entryId))
				await entryInput.fill('999999')
				await main.getByRole('button', { name: zh ? '取消' : 'Cancel', exact: true }).click({ timeout: 2000 })
				await expect(entryInput).toHaveCount(0)
				await main.getByRole('button', { name: zh ? '更改' : 'Change', exact: true }).click()
				await expect(entryInput).toHaveValue(String(session.entryId))
				await main.getByRole('button', { name: zh ? '取消' : 'Cancel', exact: true }).click()
				const unlink = main.getByRole('button', { name: zh ? '解除关联' : 'Unlink', exact: true })
				await unlink.click()
				const confirmation = page.getByRole('alertdialog')
				await expect(confirmation).toContainText(String(session.entryId))
				await confirmation.getByRole('button', { name: zh ? '取消' : 'Cancel', exact: true }).click()
				await expect(confirmation).toHaveCount(0)
				await expect(unlink).toBeFocused()
				const [unchangedBinding] = await sql`SELECT fpl_entry_id FROM bauth."user" WHERE id=${session.userId}`
				expect(unchangedBinding.fpl_entry_id).toBe(session.entryId)
				expect(bindingWrites).toEqual([])
				await page.unroute('**/*')
				const [identity] = await sql`SELECT fpl_team_name, fpl_manager_name FROM bauth."user" WHERE id=${session.userId}`
				expect(identity).toEqual({ fpl_team_name: 'E2E Synced United', fpl_manager_name: 'Fixture Manager' })
				if (profile !== 'session-expired') {
     const history = await sql`SELECT entry_id, team_name FROM bauth.fpl_entry_name_history WHERE user_id=${session.userId} ORDER BY team_name`
     expect(history).toEqual([{ entry_id: session.entryId, team_name: 'E2E Synced United' }, { entry_id: session.entryId, team_name: 'E2E United' }])
     const [after] = await sql`SELECT fpl_entry_id, fpl_identity_refreshed_at FROM bauth."user" WHERE id=${session.userId}`
     expect(after.fpl_entry_id).toBe(session.entryId)
     expect(after.fpl_identity_refreshed_at).not.toBeNull()
     const [other] = await sql`SELECT fpl_team_name, fpl_manager_name, fpl_identity_refreshed_at FROM bauth."user" WHERE id=${untouched!.userId}`
     expect(other).toEqual({ fpl_team_name: 'E2E United', fpl_manager_name: 'Test Manager', fpl_identity_refreshed_at: null })
     expect(await sql`SELECT team_name FROM bauth.fpl_entry_name_history WHERE user_id=${untouched!.userId}`).toHaveLength(0)
    }
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
                if (profile !== 'ready') {
				await sql`UPDATE bauth.session SET expires_at=${new Date(Date.now() - 60000)} WHERE user_id=${session.userId}`
				for (const protectedPath of ['/profile', '/profile/sessions']) {
					await page.goto(`${prefix}${protectedPath}`)
					await expect(page).toHaveURL(url => url.pathname === `${prefix}/auth/login` && url.searchParams.get('next') === `${prefix}${protectedPath}`)
					await expect(main).not.toContainText('E2E Synced United')
					await expect(main.getByLabel(zh ? '邮箱' : 'Email', { exact: true })).toBeVisible()
				}
				expect(writes).toEqual([])
                }
                expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe(theme)
                expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(profile === 'baseline' ? 'Australia/Perth' : 'UTC')
                if (profile === 'baseline') {
                    await expect(page.locator('html')).toHaveClass(/\blight\b/)
                    await expect(page.locator('html')).not.toHaveClass(/\bdark\b/)
                } else await expect(page.locator('html')).toHaveClass(/\bdark\b/)
                await testInfo.attach('J14-planned-context', { body: JSON.stringify({ variantId: profile === 'baseline' ? `J14.B.${locale}.${width === 390 ? 'mobile390' : 'desktop1440'}.base` : `J14.state.${profile === 'ready' ? '01' : '02'}`, locale, viewport: page.viewportSize(), theme, timezone: profile === 'baseline' ? 'Australia/Perth' : 'UTC', scenario: profile, expiredSessionChecked: profile !== 'ready', forbiddenAuthRequests: writes, scope: 'Actual account menu, Profile, Sessions, current device, Profile return, forgot-password and login; isolated sync upstream; no email or session revoke.', wholeJourneyPass: false, readyMs: null, performanceStatus: 'NOT_RUN' }), contentType: 'application/json' })
			} finally {
				await sql`DELETE FROM bauth.session WHERE id=${otherSessionId}`
				await sql`DELETE FROM bauth.fpl_entry_name_history WHERE user_id=${session.userId}`
				await sql.end()
				await session.cleanup()
    await untouched?.cleanup()
			}
		})
 })
	}
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
  test.describe(`S08 unbound baseline ${locale} ${width}`, () => {
   test.use({ locale, viewport: { width, height: 900 }, colorScheme: 'light', timezoneId: 'Australia/Perth' })
  test(`J16 unbound navigation leaves identity unchanged ${locale} ${width}px`, async ({ page }, testInfo) => {
   test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Uses isolated unbound identity')
   const prefix = locale === 'zh-CN' ? '/zh-CN' : ''
   await page.addInitScript(() => localStorage.setItem('theme', 'system'))
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
    await expect(main.locator('[data-manager-entry]')).toHaveCount(0)
    await expect(main.getByText('E2E United', { exact: true })).toHaveCount(0)
    await expect(main.getByText('Test Manager', { exact: true })).toHaveCount(0)
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
    const [identity] = await sql`SELECT name, email, fpl_entry_id, fpl_entry_verified_at FROM bauth."user" WHERE id=${session.userId}`
    expect(identity).toMatchObject({ fpl_entry_id: null, fpl_entry_verified_at: null })
    await expect(main.getByText(identity.name, { exact: true })).toBeVisible()
    await expect(main.getByText(identity.email, { exact: true })).toHaveCount(2)
    await expect(main.locator('[data-manager-entry]')).toHaveCount(0)
    await expect(main.getByText('E2E United', { exact: true })).toHaveCount(0)
    expect(mutations).toEqual([])
    expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('Australia/Perth')
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('system')
    await expect(page.locator('html')).toHaveClass(/light/)
    expect(page.viewportSize()?.width).toBe(width)
    await testInfo.attach('S08-unbound-baseline-context', { contentType: 'application/json', body: JSON.stringify({ parentVariantId: `S08.UNRESOLVED_ROLE.${locale}.${width === 1440 ? 'desktop1440' : 'mobile390'}.base`, journeyVariantId: `J16.U.${locale}.${width === 1440 ? 'desktop1440' : 'mobile390'}.base`, identity: 'U', locale, width, theme: 'system', timezone: 'Australia/Perth', owner: 'unbound-guidance', identityUnchanged: true, mutations, wholeVariantComplete: false, readyMs: null }) })
   } finally { await sql.end(); await session.cleanup() }
  })
  })
if (locale === 'zh-CN' && width === 390) test.describe('S08 required display context', () => {
test.use({ colorScheme: 'dark', timezoneId: 'UTC', locale, viewport: { width, height: 900 } })
test.beforeEach(async ({ page }, testInfo) => {
  expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('UTC')
  expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(true)
  expect(page.viewportSize()?.width).toBe(width)
  await testInfo.attach('S08-context', { contentType: 'application/json', body: JSON.stringify({ locale, width, theme: 'dark', timezone: 'UTC', environment: 'local-isolated', readyMs: null }) })
 })
test('S08.directed.02 exact context', async ({ page }) => {
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
    await expect(main.locator('[data-manager-entry]')).toHaveCount(0)
    await expect(main.getByText('E2E United', { exact: true })).toHaveCount(0)
    await expect(main.getByText('Test Manager', { exact: true })).toHaveCount(0)
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
    const [identity] = await sql`SELECT name, email, fpl_entry_id, fpl_entry_verified_at FROM bauth."user" WHERE id=${session.userId}`
    expect(identity).toMatchObject({ fpl_entry_id: null, fpl_entry_verified_at: null })
    await expect(main.getByText(identity.name, { exact: true })).toBeVisible()
    await expect(main.getByText(identity.email, { exact: true })).toHaveCount(2)
    await expect(main.locator('[data-manager-entry]')).toHaveCount(0)
    await expect(main.getByText('E2E United', { exact: true })).toHaveCount(0)
    expect(mutations).toEqual([])
   } finally { await sql.end(); await session.cleanup() }
  })
})
 }
}


for (const planned of [false, true]) {
 test.describe(planned ? 'TEAM01 planned many-GW context' : 'J10 planned baseline contexts', () => {
 test.use({ timezoneId: planned ? 'UTC' : 'Australia/Perth', colorScheme: planned ? 'dark' : 'light' })
for (const locale of (planned ? ['zh-CN'] : ['en', 'zh-CN'])) {
 for (const width of (planned ? [390] : [1440, 390])) {
 test(`J10 manager season history and transfer sheets ${locale} ${width}px`, async ({ page }, testInfo) => {
 test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Shared manager fixture requires the dedicated single-worker SSR suite')
 await page.addInitScript(theme => localStorage.setItem('theme', theme), planned ? 'dark' : 'system')
 const metrics: Array<{ metricName: string }> = []
 await page.route('**/api/vitals', async route => {
  metrics.push(...(route.request().postDataJSON().samples ?? []))
  await route.fulfill({ status: 204, body: '' })
 })
 const zh = locale === 'zh-CN'
 const labels = zh ? ['赛季复盘', '队长历史', '板凳得分', '转会历史', '道具卡使用', '轮次历史'] : ['Season Review', 'Captain History', 'Bench Points', 'Transfer History', 'Chip Usage', 'Gameweek History']
 const session = await createSession({ entryId: 15702 })
 const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
 const distinctGameweek = (eventId: number) => {
  const data = managerGameweek(eventId)
  return { ...data, snapshotMeta: { ...data.snapshotMeta!, publishedAt: `200${eventId}-02-03T04:05:06.000Z`, sourceMaxCheckedAt: `200${eventId}-02-03T01:02:03.000Z` }, result: { ...data.result!, picks: data.result!.picks.map(pick => ({ ...pick, webName: `${pick.webName} GW${eventId}` })) } }
 }
 const rules = [
  { operation: 'GetMyFplManagerReview', data: { myFplManagerReview: { ...managerReview, entry: { ...managerReview.entry!, id: session.entryId! }, currentGameweek: { ...distinctGameweek(3), entry: { ...managerReview.entry!, id: session.entryId! } } } } },
  ...[1, 2, 3].map(eventId => ({ operation: 'GetMyFplManagerGameweek', variables: { eventId }, data: { myFplManagerGameweek: { ...distinctGameweek(eventId), entry: { ...managerReview.entry!, id: session.entryId! } } } }))
 ]
 let releaseHistory: (() => void) | undefined
 let releaseChunks: (() => void) | undefined
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
  await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-ready', 'true')
  await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-entry', String(session.entryId))
  await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-revision', '103')
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
  for (const [index, chip] of (zh ? ['WC', 'FH'] : ['Wildcard', 'Free Hit']).map((chip, index) => [index, chip] as const)) {
   const opener = transfers.getByRole('button').filter({ hasText: chip })
   await expect(opener).toHaveCount(1)
   const overflowBefore = await page.locator('body').evaluate(body => body.style.overflow)
   await opener.click()
   const dialog = page.getByRole('dialog')
   await expect(dialog).toBeVisible()
   await expect(dialog.getByRole('heading')).toContainText(chip)
   await expect(dialog).toHaveAccessibleDescription(zh ? '2 次转会' : '2 transfers')
   const eventId = index + 2
   await expect(dialog.locator('li')).toHaveCount(2)
   for (const move of [1, 2]) {
    const row = dialog.locator('li').filter({ hasText: `Incoming ${eventId}-${move}` })
    await expect(row).toHaveCount(1)
    await expect(row.getByText(`Incoming ${eventId}-${move}`, { exact: true })).toBeVisible()
    await expect(row.getByText(`Outgoing ${eventId}-${move}`, { exact: true })).toBeVisible()
    await expect(row.getByText('ARS', { exact: true })).toBeVisible()
    await expect(row.getByText('CHE', { exact: true })).toBeVisible()
   }
   await dialog.getByRole('button', { name: zh ? '关闭' : 'Close', exact: true }).click()
   await expect(dialog).toHaveCount(0)
   await expect(opener).toBeFocused()
   await expect(page.locator('body')).not.toHaveAttribute('data-scroll-locked')
   await expect.poll(() => page.locator('body').evaluate(body => body.style.overflow)).toBe(overflowBefore)
  }
  const history = page.locator('div.bg-card').filter({ has: page.getByRole('heading', { name: labels[5], exact: true }) })
  await expect.poll(() => metrics.filter(m => m.metricName === 'MANAGER_REVIEW_READY').length).toBeGreaterThan(0)
  const initialReadySamples = metrics.filter(m => m.metricName === 'MANAGER_REVIEW_READY').length
  const chunkGate = new Promise<void>(resolve => { releaseChunks = resolve })
  const heldChunks: string[] = []
  await page.route('**/_next/static/chunks/*.js*', async route => {
   heldChunks.push(route.request().url())
   await chunkGate
   await route.continue()
  })
  await history.getByRole('button', { name: zh ? '打开第 3 轮' : 'Open gameweek 3', exact: true }).click()
  await expect.poll(() => heldChunks.length).toBeGreaterThan(0)
  await expect(page.locator('[data-manager-view="gameweek"][data-manager-ready="true"]').filter({ visible: true })).toHaveCount(0)
  expect(metrics.filter(m => m.metricName === 'MANAGER_REVIEW_READY')).toHaveLength(initialReadySamples)
  await expect(season).toBeVisible()
  await expect(page.getByRole('tab', { name: 'GW3', exact: true })).toBeVisible()
  await season.click()
  await expect(season).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('heading', { name: labels[1], exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'GW3', exact: true }).click()
  await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-ready', 'false')
  releaseChunks!()
  await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-view', 'gameweek')
  await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-ready', 'true')
  await expect(page.getByText('Review Player 1 GW3', { exact: true }).filter({ visible: true }).first()).toBeVisible()
  await season.click()
  await expect(season).toHaveAttribute('aria-selected', 'true')
  const historyGate = new Promise<void>(resolve => { releaseHistory = resolve })
  const historyRequest = page.waitForRequest(request => request.url().endsWith('/api/graphql') && request.postDataJSON()?.query?.includes('GetMyFplManagerGameweek') && request.postDataJSON()?.variables?.eventId === 1)
  await page.route('**/api/graphql', async route => {
   const payload = route.request().postDataJSON()
   if (payload?.query?.includes('GetMyFplManagerGameweek') && payload?.variables?.eventId === 1) await historyGate
   await route.continue()
  })
  await history.getByRole('button', { name: zh ? '打开第 1 轮' : 'Open gameweek 1', exact: true }).click()
  await historyRequest
  await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-view', 'gameweek')
  await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-gw', '1')
  await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-ready', 'false')
  await expect(page.locator('[data-manager-ready]').getByRole('alert').filter({ hasText: /200[123]|2026/ })).toHaveCount(0)
  if (planned) {
   await page.getByRole('button', { name: '关闭第 1 轮', exact: true }).click()
   await expect(page.getByRole('tab', { name: 'GW1', exact: true })).toHaveCount(0)
   await expect(page.getByRole('tab', { name: 'GW3', exact: true })).toHaveAttribute('aria-selected', 'true')
   const lateResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/graphql' && response.request().postDataJSON()?.query?.includes('GetMyFplManagerGameweek') && response.request().postDataJSON()?.variables?.eventId === 1)
   releaseHistory!()
   const response = await lateResponse
   expect(response.ok()).toBe(true)
   await response.finished()
   await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
   await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-ready', 'true')
   await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-gw', '3')
   await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-revision', '103')
   await expect(page.getByText('Review Player 1 GW3', { exact: true }).filter({ visible: true }).first()).toBeVisible()
   await expect(page.getByText('Review Player 1 GW1', { exact: true }).filter({ visible: true })).toHaveCount(0)
   await expect(page).toHaveURL(url => url.searchParams.get('gw') === '3')
   await season.click()
   await history.getByRole('button', { name: '打开第 1 轮', exact: true }).click()
   await testInfo.attach('TEAM01-closed-request-completion', { contentType: 'application/json', body: JSON.stringify({ closedGw: 1, retainedGw: 3, retainedRevision: '103', lateResponseCompleted: true, readyMs: null, wholeVariantComplete: false }) })
  }
  releaseHistory!()
  await expect.poll(() => heldChunks.length).toBeGreaterThan(0)
  await expect(page.getByRole('tab', { name: 'GW1', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page).toHaveURL(url => url.searchParams.get('gw') === '1')
  await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-ready', 'true')
  await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-gw', '1')
  await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-revision', '101')
  await expect(page.locator('[data-manager-ready]').getByRole('alert')).toContainText('2001')
  await expect.poll(() => metrics.filter(m => m.metricName === 'MANAGER_REVIEW_READY').length).toBeGreaterThan(initialReadySamples)
  await expect.poll(async () => {
   const observed = await (await fetch(fixture)).json() as { requests: { operation: string; variables: Record<string, unknown> }[] }
   return observed.requests.filter(request => request.operation === 'GetMyFplManagerGameweek' && request.variables.eventId === 1)
  }).not.toHaveLength(0)
  const observed = await (await fetch(fixture)).json() as { requests: { operation: string; variables: Record<string, unknown> }[] }
  const historicalReads = observed.requests.filter(request => request.operation === 'GetMyFplManagerGameweek' && request.variables.eventId === 1)
  for (const request of historicalReads) expect(request.variables.snapshotRevision ?? null).toBeNull()
  await season.click()
  await expect(season).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('[data-manager-ready]').getByRole('alert')).toContainText('2026')
  await expect(page.locator('[data-manager-ready]').getByRole('alert')).not.toContainText('2001')
  await history.getByRole('button', { name: zh ? '打开第 2 轮' : 'Open gameweek 2', exact: true }).click()
  for (const gw of [1, 2, 3]) await expect(page.getByRole('tab', { name: `GW${gw}`, exact: true })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'GW2', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('Review Player 1 GW2', { exact: true }).filter({ visible: true }).first()).toBeVisible()
  await page.getByRole('button', { name: zh ? '关闭第 1 轮' : 'Close gameweek 1', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'GW1', exact: true })).toHaveCount(0)
  await expect(page.getByRole('tab', { name: 'GW2', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page).toHaveURL(url => url.searchParams.get('gw') === '2')
  await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-ready', 'true')
  await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-gw', '2')
  await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-revision', '102')
  await expect(page.locator('[data-manager-ready]').getByRole('alert')).toContainText('2002')
  const openSnapshotDetail = async (name: string, points: number) => {
   const opener = page.getByRole('button', { name: zh ? `查看 ${name} 的详情` : `View details for ${name}`, exact: true })
   await expect(opener).toHaveCount(1)
   await opener.click()
   const modal = page.getByRole('dialog')
   await expect(modal.getByRole('heading', { name, exact: true })).toBeVisible()
   await expect(modal.getByText(zh ? '积分来自所选轮次的历史快照；该快照未包含逐项计分明细。' : 'These points come from the selected gameweek snapshot. Detailed scoring events are not included in this snapshot.', { exact: true })).toBeVisible()
   await expect(modal.getByText(zh ? '估算' : 'Provisional', { exact: true })).toHaveCount(0)
   await expect(modal.getByText(`+${points}`, { exact: true }).first()).toBeVisible()
   await modal.getByRole('button', { name: zh ? '关闭' : 'Close', exact: true }).click()
   await expect(modal).toHaveCount(0)
   await expect(opener).toBeFocused()
  }
  await openSnapshotDetail('Saka GW2', 10)
  await page.getByRole('button', { name: zh ? '关闭第 2 轮' : 'Close gameweek 2', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'GW2', exact: true })).toHaveCount(0)
  await expect(page.getByRole('tab', { name: 'GW3', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page).toHaveURL(url => url.searchParams.get('gw') === '3')
  await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-ready', 'true')
  await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-gw', '3')
  await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-revision', '103')
  await expect(page.locator('[data-manager-ready]').getByRole('alert')).toContainText('2003')
  await expect(page.getByText('Review Player 1 GW3', { exact: true }).filter({ visible: true }).first()).toBeVisible()
  await expect(page.getByText('Review Player 1 GW2', { exact: true }).filter({ visible: true })).toHaveCount(0)
  await openSnapshotDetail('Review Player 12 GW3', 1)
  await expect(page.getByRole('button', { name: zh ? '关闭第 3 轮' : 'Close gameweek 3', exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(planned ? 'UTC' : 'Australia/Perth')
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe(planned ? 'dark' : 'system')
  if (planned) await expect(page.locator('html')).toHaveClass(/dark/)
  else await expect(page.locator('html')).not.toHaveClass(/dark/)
  if (planned) {
   const completedHistoryReads = async () => {
    const ledger = await (await fetch(fixture)).json() as { requests: { operation: string }[] }
    return ledger.requests.filter(request => request.operation === 'GetMyFplManagerGameweek').length
   }
   const readsBeforeCycles = await completedHistoryReads()
   const browserReads: number[] = []
   const trackHistory = (request: import('@playwright/test').Request) => {
    if (new URL(request.url()).pathname === '/api/graphql' && request.postDataJSON()?.query?.includes('GetMyFplManagerGameweek')) browserReads.push(request.postDataJSON().variables.eventId)
   }
   page.on('request', trackHistory)
   for (let cycle = 0; cycle < 5; cycle++) {
    await season.click()
    await history.getByRole('button', { name: '打开第 1 轮', exact: true }).click()
    await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-ready', 'true')
    await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-gw', '1')
    await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-revision', '101')
    await expect(page.getByText('Review Player 1 GW1', { exact: true }).filter({ visible: true }).first()).toBeVisible()
    await page.getByRole('button', { name: '关闭第 1 轮', exact: true }).click()
    await expect(page.getByRole('tab', { name: 'GW1', exact: true })).toHaveCount(0)
    await expect(page.getByRole('tab', { name: 'GW3', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-gw', '3')
    await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-revision', '103')
    expect(await completedHistoryReads()).toBe(readsBeforeCycles)
    expect(browserReads).toEqual([])
   }
   page.off('request', trackHistory)
   await testInfo.attach('TEAM01-cached-reopen-cycles', { contentType: 'application/json', body: JSON.stringify({ variantIds: ['TEAM01.state.01', 'TEAM01.state.02'], cycles: 5, browserReads, readsBeforeCycles, readsAfterCycles: await completedHistoryReads(), scope: 'Completed-history cache reuse and selected revision after actual close/reopen. Pending races and eight-tab eviction remain separate.', readyMs: null, wholeVariantComplete: false }) })
  }
  await testInfo.attach('J10-planned-baseline', { body: JSON.stringify({
   variantId: planned ? 'TEAM01.state.02' : `J10.B.${locale}.${width === 1440 ? 'desktop1440' : 'mobile390'}.base`,
   overlappingVariantIds: planned ? ['TEAM01.state.01'] : [],
   locale, viewport: page.viewportSize(), identity: 'B', theme: planned ? 'dark' : 'system', timezone: planned ? 'UTC' : 'Australia/Perth',
   scenario: planned ? 'many-gw' : 'baseline', entryId: session.entryId, finalGw: 3, finalRevision: '103',
   functionalAssertions: 'Homepage menu, season sections, transfer expansion, WC/FH sheets, historical GW loading and revision identity, tabs and snapshot modals',
   wholeJourneyPass: false, performanceStatus: 'NOT_RUN', readyMs: null,
   missing: ['cold/warm repetitions', 'event-to-paint', 'LCP/INP/CLS'],
   notApplicable: 'FINAL snapshot has no direct live handoff; PENDING/PROVISIONAL journeys require separate evidence'
  }), contentType: 'application/json' })
 } finally {
  releaseChunks?.()
  releaseHistory?.()
  await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
  await session.cleanup()
 }
})

 }
}

})
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
    await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-ready', 'false')
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


for (const scenario of ['baseline', 'ready', 'bye', 'first-last-gw'] as const) {
for (const locale of (scenario === 'baseline' ? ['en', 'zh-CN'] : ['zh-CN']) as ('en' | 'zh-CN')[]) {
for (const width of scenario === 'baseline' ? [1440, 390] : [390]) {
const timezone = scenario === 'baseline' ? 'Australia/Perth' : 'UTC'
const theme = scenario === 'baseline' ? 'system' : 'dark'
test.describe(`J08 planned ${scenario} ${locale} ${width}`, () => {
test.use({ timezoneId: timezone, colorScheme: scenario === 'baseline' ? 'light' : 'dark' })
test(`J08 official H2H standings and fixtures preserve round identity ${locale} ${width}px ${scenario}`, async ({ page }, testInfo) => {
 await page.addInitScript(value => localStorage.setItem('theme', value), theme)
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
  ...[6, 7].flatMap(tournamentId => (scenario === 'first-last-gw' ? [1, 2, 3, 4, 37, 38] as const : [3, 4] as const).flatMap(eventId => {
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
  if (scenario === 'first-last-gw') {
   for (const [boundary, adjacent, disabled, enabled] of [
    [1, 2, zh ? '上一轮' : 'Previous', zh ? '下一轮' : 'Next'],
    [38, 37, zh ? '下一轮' : 'Next', zh ? '上一轮' : 'Previous'],
   ] as const) {
    await page.goto(`${prefix}/live/competitions?tournamentId=6&gw=${boundary}`)
    const overview = page.locator('section').filter({ has: page.getByRole('heading', { name: new RegExp(`^GW${boundary} `) }) })
    await expect(overview).toHaveCount(1)
    await expect(overview.getByRole('button', { name: disabled, exact: true })).toBeDisabled()
    await expect(page.getByRole('link', { name: disabled, exact: true })).toHaveCount(0)
    await page.getByRole('tab', { name: fixturesName }).click()
    await expect(page.getByRole('tabpanel', { name: fixturesName }).locator(`a[href="${prefix}/live/points/123?tournamentId=6&gw=${boundary}"]`)).toHaveCount(1)
    await overview.getByRole('link', { name: enabled, exact: true }).click()
    await expect(page).toHaveURL(url => url.searchParams.get('tournamentId') === '6' && url.searchParams.get('gw') === String(adjacent))
    await page.getByRole('link', { name: disabled, exact: true }).click()
    await expect(page).toHaveURL(url => url.searchParams.get('gw') === String(boundary))
    await expect(overview.getByRole('button', { name: disabled, exact: true })).toBeDisabled()
   }
  }
  expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(timezone)
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe(theme)
  await expect(page.locator('html')).toHaveClass(scenario === 'baseline' ? /light/ : /dark/)
  await testInfo.attach('J08-planned-binding', { contentType: 'application/json', body: JSON.stringify({
   variantId: scenario === 'baseline' ? `J08.B.${locale}.${width === 1440 ? 'desktop1440' : 'mobile390'}.base` : `J08.state.${scenario === 'ready' ? '01' : scenario === 'bye' ? '02' : '03'}`,
   scenario, locale, viewport: page.viewportSize(), identity: 'B', timezone, theme,
   tournamentId: 6, gameweeks: scenario === 'first-last-gw' ? [1, 2, 3, 4, 37, 38] : [3, 4], entries: [123, 456],
   assertions: ['tournament-menu', 'standings-fixtures', 'bye-no-invalid-link', 'previous-next', 'actual-home-away-navigation', '15-player-render', 'back-context'],
   boundaryAssertions: scenario === 'first-last-gw', functionalStatus: 'PASS', readyMs: null, eventToPaintMs: null,
   wholeVariantComplete: false, missingReason: 'Performance samples and formal score/squad-composition parity are not asserted; isolated fixture evidence only.'
  }) })
 } finally {
  await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
  await session.cleanup()
 }
})
})
}
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
  const manageMessages = (zh ? zhMessages : enMessages).TournamentManage
  const details = page.locator('dl > div')
  for (const [label, value] of [[manageMessages.administrator, 'Fixture Owner'], [manageMessages.sourceLeague, 'Fixture League'], [manageMessages.participants, '2'], [manageMessages.status, manageMessages.active], [manageMessages.leagueType, manageMessages.classic]]) {
   const detail = details.filter({ has: page.getByText(label, { exact: true }) })
   await expect(detail).toHaveCount(1)
   await expect(detail.locator('dd')).toHaveText(value)
  }
  const nameInput = page.locator('#tournament-name')
  const saveName = page.getByRole('button', { name: manageMessages.saveName, exact: true })
  await expect(nameInput).toHaveValue('J12 Owned Cup')
  await expect(saveName).toBeDisabled()
  await nameInput.fill('Unsaved fixture draft')
  await expect(saveName).toBeEnabled()
  await nameInput.fill('J12 Owned Cup')
  await expect(saveName).toBeDisabled()
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
  await testInfo.attach('R12-entry-scope', { body: JSON.stringify({
   caseId: 'R12',
   stepIds: ['R12.03'],
   variantId: `R12.O.${locale}.${width === 1440 ? 'desktop1440' : 'mobile390'}.base`,
   locale,
   viewport: page.viewportSize(),
   timezone: 'Australia/Perth',
   entry: 'Tournament browse → Actions for J12 Owned Cup → Manage tournament',
   href: `${prefix}/competitions/77/manage`,
   finalUrl: page.url(),
   readyMarker: { tournamentId: 77, route: 'manage' },
   functionalStatus: 'PASS',
   performanceStatus: 'NOT_OBSERVED',
   readyMs: null,
   businessWrites: mutations,
   wholeVariantComplete: false,
   limitation: 'This binds only the actual internal manage-link click; full R12 route/status variants and timing remain open.'
  }), contentType: 'application/json' })
  await testInfo.attach('J12-baseline-scope', { body: JSON.stringify({ variantId: `J12.O.${locale}.${width === 1440 ? 'desktop1440' : 'mobile390'}.base`, locale, viewport: page.viewportSize(), timezone: 'Australia/Perth', theme: 'system', scope: 'One functional journey; cache cold/warm repetitions and performance remain unverified' }), contentType: 'application/json' })
 } finally {
  await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
  await session.cleanup()
 }
})

 }
}

})

test.describe('management access baseline contexts', () => {
 test.use({ timezoneId: 'Australia/Perth', colorScheme: 'light' })
 test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('theme', 'system')) })
for (const locale of ['en', 'zh-CN'] as const) {
for (const width of [1440, 390]) {
 test(`J12 non-owner cannot access management ${locale} ${width}px`, async ({ page }, testInfo) => {
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
   expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('Australia/Perth')
   await expect(page.locator('html')).not.toHaveClass(/dark/)
   await testInfo.attach('manage-access-baseline', { contentType: 'application/json', body: JSON.stringify({
    variantIds: [`MANAGE02.B.${locale}.${width === 1440 ? 'desktop1440' : 'mobile390'}.base`, `MANAGE02.F.${locale}.${width === 1440 ? 'desktop1440' : 'mobile390'}.base`, `R12.F.${locale}.${width === 1440 ? 'desktop1440' : 'mobile390'}.base`],
    identity: 'verified bound non-owner (B with F access outcome)', locale, viewport: page.viewportSize(), theme: 'system/light', timezone: 'Australia/Perth',
    terminal: 'administrator-access-required', mutations, performanceStatus: 'NOT_OBSERVED', readyMs: null, wholeVariantComplete: false
   }) })

  } finally {
   await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
   await session.cleanup()
  }
 })
}

}


for (const locale of ['en', 'zh-CN'] as const) {
 for (const width of [1440, 390]) {
  test(`R12 X expired session rejects actual management link ${locale} ${width}px`, async ({ page }, testInfo) => {
   test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Isolated fresh-session boundary')
   const prefix = locale === 'en' ? '' : '/zh-CN'
   const zh = locale === 'zh-CN'
   await page.setViewportSize({ width, height: 900 })
   const session = await createSession({ entryId: 909090 })
   const sql = postgres(process.env.E2E_DIRECT_DATABASE_URL!, { max: 1, prepare: false })
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
     { operation: 'GetEntryTournamentsList', variables: { entryId: 909090 }, data: { entryTournaments: [managedTournament] } }
    ] }) })).ok).toBe(true)
    await addSessionCookie(page, session.cookie)
    await page.goto(`${prefix}/competitions/browse`)
    await page.getByRole('button', { name: zh ? 'J12 Owned Cup 的操作' : 'Actions for J12 Owned Cup', exact: true }).click()
    const manage = page.getByRole('menuitem', { name: zh ? '管理赛事' : 'Manage tournament', exact: true })
    await expect(manage).toBeVisible()
    await sql`UPDATE bauth.session SET expires_at = ${new Date(Date.now() - 60000)} WHERE user_id = ${session.userId}`
    expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ reset: true, rules: [] }) })).ok).toBe(true)
    await manage.click()
    const assertLogin = async () => {
     await expect(page).toHaveURL(url => url.pathname === `${prefix}/auth/login` && url.searchParams.get('next') === `${prefix}/competitions/77/manage`)
     await expect(page.getByLabel(zh ? zhMessages.Auth.email : enMessages.Auth.email, { exact: true })).toBeEnabled()
     await expect(page.locator('[data-competition-perf-ready="manage"]')).toHaveCount(0)
     await expect(page.locator('#tournament-name')).toHaveCount(0)
     await expect(page.getByRole('button', { name: zh ? '删除赛事' : 'Delete tournament', exact: true })).toHaveCount(0)
    }
    await assertLogin()
    await page.reload()
    await assertLogin()
    const observations = await (await fetch(fixture)).json()
    expect(observations.requests.filter((r: { operation: string }) => r.operation === 'GetManagedTournament')).toEqual([])
    expect(mutations).toEqual([])
    expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('Australia/Perth')
    await expect(page.locator('html')).not.toHaveClass(/dark/)
    await testInfo.attach('manage-expired-baseline', { contentType: 'application/json', body: JSON.stringify({
     variantIds: [`MANAGE02.X.${locale}.${width === 1440 ? 'desktop1440' : 'mobile390'}.base`, `R12.X.${locale}.${width === 1440 ? 'desktop1440' : 'mobile390'}.base`],
     identity: 'X isolated expired database session', locale, viewport: page.viewportSize(), theme: 'system/light', timezone: 'Australia/Perth',
     actualClick: true, loginNext: `${prefix}/competitions/77/manage`, managementReadsAfterExpiry: 0, mutations,
     performanceStatus: 'NOT_OBSERVED', readyMs: null, wholeVariantComplete: false
    }) })
   } finally {
    await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
    await sql.end()
    await session.cleanup()
   }
  })
if (locale === 'zh-CN' && width === 390) test.describe('S08 required display context', () => {
test.use({ colorScheme: 'dark', timezoneId: 'UTC', locale, viewport: { width, height: 900 } })
test.beforeEach(async ({ page }, testInfo) => {
  expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('UTC')
  expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(true)
  expect(page.viewportSize()?.width).toBe(width)
  await testInfo.attach('S08-context', { contentType: 'application/json', body: JSON.stringify({ locale, width, theme: 'dark', timezone: 'UTC', environment: 'local-isolated', readyMs: null }) })
 })
test('S08.directed.07 exact context', async ({ page }, testInfo) => {
   test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Isolated fresh-session boundary')
   const prefix = '/zh-CN'
   const zh = locale === 'zh-CN'
   await page.setViewportSize({ width, height: 900 })
   const session = await createSession({ entryId: 909090 })
   const sql = postgres(process.env.E2E_DIRECT_DATABASE_URL!, { max: 1, prepare: false })
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
     { operation: 'GetEntryTournamentsList', variables: { entryId: 909090 }, data: { entryTournaments: [managedTournament] } }
    ] }) })).ok).toBe(true)
    await addSessionCookie(page, session.cookie)
    await page.goto(`${prefix}/competitions/browse`)
    await page.getByRole('button', { name: zh ? 'J12 Owned Cup 的操作' : 'Actions for J12 Owned Cup', exact: true }).click()
    const manage = page.getByRole('menuitem', { name: zh ? '管理赛事' : 'Manage tournament', exact: true })
    await expect(manage).toBeVisible()
    await sql`UPDATE bauth.session SET expires_at = ${new Date(Date.now() - 60000)} WHERE user_id = ${session.userId}`
    expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ reset: true, rules: [] }) })).ok).toBe(true)
    await manage.click()
    const assertLogin = async () => {
     await expect(page).toHaveURL(url => url.pathname === `${prefix}/auth/login` && url.searchParams.get('next') === `${prefix}/competitions/77/manage`)
     await expect(page.getByLabel(zh ? zhMessages.Auth.email : enMessages.Auth.email, { exact: true })).toBeEnabled()
     await expect(page.locator('[data-competition-perf-ready="manage"]')).toHaveCount(0)
     await expect(page.locator('#tournament-name')).toHaveCount(0)
     await expect(page.getByRole('button', { name: zh ? '删除赛事' : 'Delete tournament', exact: true })).toHaveCount(0)
    }
    await assertLogin()
    await page.reload()
    await assertLogin()
    const observations = await (await fetch(fixture)).json()
    expect(observations.requests.filter((r: { operation: string }) => r.operation === 'GetManagedTournament')).toEqual([])
    expect(mutations).toEqual([])
    expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('UTC')
    await expect(page.locator('html')).toHaveClass(/dark/)
    await testInfo.attach('manage-expired-baseline', { contentType: 'application/json', body: JSON.stringify({
     variantIds: ['S08.directed.07'],
     identity: 'X isolated expired database session', locale, viewport: page.viewportSize(), theme: 'dark', timezone: 'UTC',
     actualClick: true, loginNext: `${prefix}/competitions/77/manage`, managementReadsAfterExpiry: 0, mutations,
     performanceStatus: 'NOT_OBSERVED', readyMs: null, wholeVariantComplete: false
    }) })
   } finally {
    await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
    await sql.end()
    await session.cleanup()
   }
  })
})
 }
}
})

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
    // C03: bind focus containment to this management AlertDialog instance.
    for (const key of ['Tab', 'Tab', 'Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab']) {
     await page.keyboard.press(key)
     expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true)
    }

    await dialog.getByRole('button', { name: '取消', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('button', { name: '删除赛事', exact: true })).toBeFocused()
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

for (const plannedMode of ['baseline', 'classic', 'h2h', 'custom'] as const) {
for (const locale of plannedMode === 'baseline' ? ['en', 'zh-CN'] as const : ['zh-CN'] as const) {
 for (const width of plannedMode === 'baseline' ? [1440, 390] : [390]) {
 test.describe(`J13 planned ${plannedMode} ${locale} ${width}`, () => {
 test.use({ viewport: { width, height: 900 }, timezoneId: plannedMode === 'baseline' ? 'Australia/Perth' : 'UTC', colorScheme: plannedMode === 'baseline' ? 'light' : 'dark' })
 test(`J13 ${locale} creation modes keep unprepared fields hidden and leave without writes`, async ({ page }, testInfo) => {
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
  const theme = plannedMode === 'baseline' ? 'system' : 'dark'
  try {
   await page.addInitScript(value => localStorage.setItem('theme', value), theme)
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
   if (plannedMode !== 'baseline') {
    await page.locator(`label[for="creation-mode-${plannedMode}"]`).click()
    await expect(page.locator(`#creation-mode-${plannedMode}`)).toHaveAttribute('aria-checked', 'true')
    await expect(page.locator('#tournament-name')).toHaveCount(plannedMode === 'custom' ? 1 : 0)
   }
   expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe(theme)
   expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(plannedMode === 'baseline' ? 'Australia/Perth' : 'UTC')
   if (plannedMode !== 'baseline') await expect(page.locator('html')).toHaveClass(/dark/)
   await page.getByRole('contentinfo').locator(`a[href="${prefix}/competitions/browse"]`).click()
   await expect(page).toHaveURL(new RegExp(`${prefix}/competitions/browse$`))
   expect(forbidden).toEqual([])
   await testInfo.attach('J13-planned-context', { body: JSON.stringify({ variantId: plannedMode === 'baseline' ? `J13.B.${locale}.${width === 390 ? 'mobile390' : 'desktop1440'}.base` : `J13.state.0${['classic', 'h2h', 'custom'].indexOf(plannedMode) + 1}`, locale, viewport: page.viewportSize(), theme, timezone: plannedMode === 'baseline' ? 'Australia/Perth' : 'UTC', scenario: plannedMode, forbiddenRequests: forbidden, scope: 'Actual browse/create click, all unprepared modes, name visibility, help and cancel with zero create/import/preview requests. Prepared group/knockout options are not covered.', wholeJourneyPass: false, readyMs: null, performanceStatus: 'NOT_RUN' }), contentType: 'application/json' })
  } finally { await session.cleanup() }
 })
 })
 }
}

}

for (const locale of ['en', 'zh-CN'] as const) {
 for (const width of [1440, 390]) {
test.describe(`J13 prepared matrix ${locale} ${width}`, () => {
 test.use({ timezoneId: 'Australia/Perth', colorScheme: 'light' })
 for (const scenario of ['formats', 'gameweeks', 'participants', 'recovery'] as const) {
test(`J13 prepared preview ${scenario} ${locale} ${width}px`, async ({ page }) => {
 test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Isolated preview substitute only')
 const zh = locale === 'zh-CN'
 const groupLabels = zh ? ['无小组赛', '积分赛'] : ['No Group', 'Points Race']
 const knockoutLabels = zh ? ['无淘汰赛', '单败淘汰', '双败淘汰'] : ['No Knockout', 'Single Elimination', 'Double Elimination']
 const session = await createSession({ entryId: 15702 })
 const writes: string[] = []
 let previews = 0
 let releasePreview = () => {}
 const previewGate = new Promise<void>(resolve => { releasePreview = resolve })
 const createMessages = (zh ? zhMessages : enMessages).TournamentCreate
 await page.route('**/api/tournaments{,/**}', async route => {
  const path = new URL(route.request().url()).pathname
  if (path === '/api/tournaments/preview') {
   previews += 1
   expect(route.request().method()).toBe('POST')
   expect(route.request().postDataJSON()).toEqual({ leagueUrl: 'https://fantasy.premierleague.com/leagues/123/standings/c' })
   if (scenario === 'recovery' && previews === 1) { await previewGate; await route.fulfill({ status: 503, json: { error: 'fixture unavailable' } }); return }
   await route.fulfill({ json: { previewToken: 'isolated-j13-preview', expiresAt: new Date(Date.now() + 600000).toISOString(), leagueId: 123, leagueType: 'classic', leagueName: 'J13 fixture league', startEvent: 1, participants: Array.from({ length: 8 }, (_, i) => ({ id: String(i + 1), team: `J13 Team ${i + 1}`, manager: `Fixture ${i + 1}`, overallRank: i + 1, totalPoints: 100 })) } })
  } else if (path === '/api/tournaments/check-name') await route.fulfill({ json: { available: true } })
  else { writes.push(path); await route.abort() }
 })
 try {
  await addSessionCookie(page, session.cookie)
  await page.addInitScript(() => localStorage.setItem('theme', 'system'))
  await page.setViewportSize({ width, height: 900 })
  await page.goto(`${zh ? '/zh-CN' : ''}/competitions/create`)
  await expect(page.locator('#tournament-create-form')).toHaveAttribute('aria-busy', 'false')
  expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('Australia/Perth')
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('system')
  await page.locator('label[for="creation-mode-custom"]').click()
  if (scenario === 'recovery') {
   await page.locator('#league-url').fill('https://example.invalid/leagues/123')
   await expect(page.getByRole('button', { name: createMessages.fetchLeague, exact: true })).toBeDisabled()
   expect(previews).toBe(0)
  }
  await page.locator('#league-url').fill('https://fantasy.premierleague.com/leagues/123/standings/c')
  await page.getByRole('button', { name: zh ? '加载联赛' : 'Fetch league', exact: true }).click()
  if (scenario === 'recovery') {
   await expect(page.getByRole('button', { name: createMessages.loading, exact: true })).toBeDisabled()
   expect(previews).toBe(1)
   releasePreview()
   await expect(page.getByText(createMessages.participantsLoadFailed, { exact: true })).toBeVisible()
   await expect(page.locator('#group-format')).toHaveCount(0)
   await page.getByRole('button', { name: createMessages.fetchLeague, exact: true }).click()
   await expect(page.getByText(createMessages.participantsLoadFailed, { exact: true })).toHaveCount(0)
   await expect(page.getByRole('checkbox', { name: zh ? '包含 J13 Team 1' : 'Include J13 Team 1', exact: true })).toBeVisible()
  }
  await expect(page.locator('#group-format')).toBeVisible()
  if (scenario === 'formats') for (const group of groupLabels) {
   await page.locator('#group-format').click()
   await page.getByRole('option', { name: group, exact: true }).click()
   await expect(page.locator('#group-format')).toHaveText(group)
   for (const knockout of knockoutLabels) {
    await page.locator('#knockout-format').click()
    await page.getByRole('option', { name: knockout, exact: true }).click()
    await expect(page.locator('#knockout-format')).toHaveText(knockout)
    await expect(page.locator('#group-num')).toHaveCount(group === groupLabels[1] ? 1 : 0)
    await expect(page.locator('#qualifiers-per-group')).toHaveCount(group === groupLabels[1] && knockout !== knockoutLabels[0] ? 1 : 0)
   }
  }
  if (scenario === 'gameweeks') for (const field of ['start-gameweek', 'end-gameweek']) {
   for (const gw of [1, 38]) {
    await page.locator(`#${field}`).click()
    await page.getByRole('option', { name: zh ? `第 ${gw} 轮` : `Gameweek ${gw}`, exact: true }).click()
    await expect(page.locator(`#${field}`)).toHaveText(zh ? `第 ${gw} 轮` : `Gameweek ${gw}`)
   }
  }
  if (scenario === 'participants') for (const source of ['custom', 'official', 'custom']) {
   await page.locator(`label[for="source-${source}"]`).click()
   await expect(page.locator(`#source-${source}`)).toHaveAttribute('aria-checked', 'true')
   const include = page.getByRole('checkbox', { name: zh ? '包含 J13 Team 1' : 'Include J13 Team 1', exact: true })
   if (source === 'official') await expect(include).toBeDisabled()
   else {
    await expect(include).toBeEnabled()
    await include.uncheck()
    await expect(include).not.toBeChecked()
    await include.check()
    await expect(include).toBeChecked()
   }
  }
  expect(previews).toBe(scenario === 'recovery' ? 2 : 1)
  expect(writes).toEqual([])
 } finally { releasePreview(); await session.cleanup() }
})
 }
})
 }
}

test.describe('AUTH04 explicit baseline context', () => {
 test.use({ timezoneId: 'Australia/Perth' })
for (const locale of ['en', 'zh-CN'] as const) {
 for (const width of [1440, 390]) {
  for (const persona of ['anonymous', 'unbound', 'bound'] as const) {
   test(`AUTH04 bind entry identity boundary ${persona} ${locale} ${width}`, async ({ page }, testInfo) => {
    test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Requires isolated identity fixtures')
    await page.addInitScript(() => localStorage.setItem('theme', 'system'))
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
    expect(await page.evaluate(() => ({ width: innerWidth, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, theme: localStorage.getItem('theme'), language: document.documentElement.lang }))).toEqual({ width, timezone: 'Australia/Perth', theme: 'system', language: locale })
    await testInfo.attach('AUTH04-context', { contentType: 'application/json', body: JSON.stringify({ variantId: `AUTH04.${persona === 'anonymous' ? 'A' : persona === 'unbound' ? 'U' : 'B'}.${locale}.${width === 390 ? 'mobile390' : 'desktop1440'}.base`, persona, locale, width, timezone: 'Australia/Perth', theme: 'system', functionalStatus: 'PASS', performanceStatus: 'NOT_RUN', readyMs: null, wholeVariantComplete: false, scope: 'Identity redirect or unbound validation, no real binding' }) })
    } finally { if (session) await session.cleanup() }
   })
  }
 }
}

})

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
   // The FDR table is server-rendered, but its search is client-owned. Under
   // the full parallel suite the input can be filled before hydration attaches
   // its change handler, leaving the visible rows unfiltered. Treat the
   // existing route-ready marker as the interaction boundary.
   await expect.poll(() => reportedVitals.some(sample => sample.metricName === 'FIXTURES_WINDOW_READY')).toBe(true)
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
   const mutations: string[] = []
   await page.route('**/api/tournaments/**', async route => {
    if (['POST', 'PATCH', 'DELETE'].includes(route.request().method())) {
     mutations.push(route.request().method())
     await route.fulfill({ status: 409, body: 'Unexpected mutation blocked' })
    } else await route.continue()
   })
   try {
    expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [
     { operation: 'GetEntryTournamentsList', variables: { entryId: 909090 }, data: { entryTournaments: [managedTournament] } },
     { operation: 'GetManageableTournamentsList', variables: { entryId: 909090 }, data: { manageableTournaments: [managedTournament, other] } },
     { operation: 'GetManagedTournament', variables: { tournamentId: 88, entryId: 909090 }, data: { managedTournament: other } }
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
    const prefix = zh ? '/zh-CN' : ''
    const assertManage = async () => {
     await expect(page).toHaveURL(url => url.pathname === `${prefix}/competitions/88/manage`)
     await expect(page.locator('[data-competition-perf-ready="manage"]')).toHaveAttribute('data-competition-tournament-id', '88')
     await expect(page.locator('#tournament-name')).toHaveValue('Other Owner Cup')
     await expect(page.getByRole('button', { name: zh ? '删除赛事' : 'Delete tournament', exact: true })).toBeVisible()
    }
    await otherRow.getByRole('button', { name: zh ? 'Other Owner Cup 的操作' : 'Actions for Other Owner Cup', exact: true }).click()
    await page.getByRole('menuitem', { name: zh ? '管理赛事' : 'Manage tournament', exact: true }).click()
    await assertManage()
    await page.reload()
    await assertManage()
    await page.goBack()
    await expect(page).toHaveURL(url => url.pathname === `${prefix}/competitions/browse` && url.searchParams.get('mine') === 'true')
    await expect(page.getByText('Other Owner Cup', { exact: true })).toBeVisible()
    await page.goForward()
    await assertManage()
    await page.goBack()
    await expect(mine).toBeVisible()
    await mine.click()
    await expect(page).toHaveURL(url => !url.searchParams.has('mine'))
    await expect(page.getByText('Other Owner Cup', { exact: true })).toHaveCount(0)
    const direct = await page.goto(`${prefix}/competitions/88/manage`)
    expect(direct?.status()).toBe(200)
    expect(direct?.request().redirectedFrom()).toBeNull()
    await assertManage()
    expect(mutations).toEqual([])
    const observations = await (await fetch(fixture)).json()
    expect(observations.requests.some((r: { operation: string; variables: { tournamentId?: number; entryId?: number } }) => r.operation === 'GetManagedTournament' && r.variables.tournamentId === 88 && r.variables.entryId === 909090)).toBe(true)
    await testInfo.attach('R12-admin-management', { contentType: 'application/json', body: JSON.stringify({
     variantId: `R12.PA.${locale}.${width === 1440 ? 'desktop1440' : 'mobile390'}.base`, identity: 'PA dedicated dual allowlist', locale,
     viewport: page.viewportSize(), theme: 'system/light', timezone: 'Australia/Perth', tournamentId: 88, ownerEntryId: 808080, viewerEntryId: 909090,
     actualManageClick: true, directStatus: direct!.status(), redirects: [], reload: true, backForward: true, mutations,
     functionalStatus: 'PASS', performanceStatus: 'NOT_OBSERVED', readyMs: null, wholeVariantComplete: false,
     scope: 'Web consumption of authorized fixture response; no real GraphQL authorization claim'
    }) })
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
  test.use({ timezoneId, viewport: { width: timezoneId === 'UTC' ? 1440 : 390, height: 900 } })
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
     const pathname = locale === 'zh-CN' ? '/zh-CN' : '/'
     const ssrUtcText = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short', timeZone: 'UTC' }).format(new Date(deadline))
     const ssrHtml = await (await page.request.get(pathname)).text()
     expect(ssrHtml, 'Deadline row is present before hydration, with explicit UTC').toContain('data-countdown-deadline="true"')
     expect(ssrHtml).toContain(ssrUtcText)
     let releaseScripts!: () => void
     const scriptsReleased = new Promise<void>(resolve => { releaseScripts = resolve })
     await page.route('**/_next/static/**/*.js', async route => { await scriptsReleased; await route.continue() })
     const card = page.locator('#main-content [data-countdown-card]')
     let ssrHeight = 0
     try {
      await page.goto(pathname, { waitUntil: 'commit' })
      await expect(card.locator('[data-countdown-deadline] time')).toHaveText(ssrUtcText)
      await page.evaluate(() => document.fonts.ready.then(() => undefined))
      ssrHeight = (await card.boundingBox())!.height
     } finally {
      releaseScripts()
     }
     await expect(card.locator('[data-countdown-title]')).toContainText('34')
     const expected = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short', timeZone: timezoneId }).format(new Date(deadline))
     await expect(card.locator('[data-countdown-deadline] time')).toHaveText(expected)
     await expect(page.locator('details[data-locale-picker]').filter({ visible: true })).toHaveCount(1)
     const hydratedHeight = (await card.boundingBox())!.height
     expect(Math.abs(hydratedHeight - ssrHeight), 'Deadline localization preserves the SSR card height').toBeLessThanOrEqual(1)
     await testInfo.attach('countdown-ssr-hydration-geometry', { body: JSON.stringify({ locale, timezoneId, viewport: page.viewportSize(), ssrUtcText, expected, ssrHeight, hydratedHeight }), contentType: 'application/json' })
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
     await testInfo.attach('home-deadline-localized', { body: JSON.stringify({ timezoneId, locale, deadline, expected, requestedEvents, hydrationErrors, ssrUtcText }), contentType: 'application/json' })
    } finally {
     await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
    }
   })
  }
 })
}

})

test.describe('SSR remediation TR03 planned bound dark UTC mobile', () => {
	test.use({ timezoneId: 'UTC', colorScheme: 'dark', viewport: { width: 390, height: 900 } })
	for (const state of ['stale', 'unpublished'] as const) {
		test(`${state} preserves its distinct public state`, async ({ page }, testInfo) => {
			test.skip(process.env.E2E_SSR_REMEDIATION !== '1', 'Requires isolated fixture database')
			test.skip(state === 'unpublished' && process.env.E2E_TRENDS_UNPUBLISHED !== '1', 'Requires isolated catalog cache')
			const session = await createSession({ entryId: 15702 })
			const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
			try {
				await addSessionCookie(page, session.cookie)
				await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
				if (state === 'unpublished') {
					const response = await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [{ operation: 'TrendCohorts', variables: { access: 'PUBLIC' }, data: { trendCohorts: { season: '2627', revision: 'unpublished-fixture', state: 'NOT_PUBLISHED', sourceCheckedAt: null, cohorts: [] } } }] }) })
					expect(response.ok).toBe(true)
				}
				await page.goto(`/zh-CN/explore/selections?scope=public${state === 'stale' ? '&cohort=competition:777&gw=33' : ''}`)
				await expect(page.locator('html')).toHaveClass(/dark/)
				expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('UTC')
				expect(page.viewportSize()?.width).toBe(390)
				const auth = await page.request.get('/api/auth/get-session')
				expect(auth.ok()).toBe(true)
				expect((await auth.json()).user.id).toBe(session.userId)
				expect(session.entryId).toBeGreaterThan(0)
				await expect(page.getByRole('button', { name: /^我的联赛/ })).toBeEnabled()
				if (state === 'unpublished') {
					await expect(page.getByRole('heading', { name: '本赛季公共趋势尚未发布。', exact: true })).toBeVisible()
					const ledger = await (await fetch(fixture)).json()
					expect(ledger.requests.some((row: { operation: string; variables: { access?: string }; finishedAt: number | null }) => row.operation === 'TrendCohorts' && row.variables.access === 'PUBLIC' && row.finishedAt !== null)).toBe(true)
					await expect(page.getByRole('tabpanel')).toHaveCount(0)
					await expect(page.getByRole('button', { name: '重试', exact: true })).toHaveCount(0)
				} else {
					await expect(page.getByRole('tabpanel')).toContainText('Saka')
					await page.route('**/api/trends/public-desk?**', async route => {
						const response = await route.fetch()
						const payload = await response.json()
						for (const section of payload.trendCohortSnapshot.sections) {
							section.state = 'STALE'
							section.evidenceContext.availabilityState = 'STALE'
						}
						await route.fulfill({ response, json: payload })
					})
					const cohort = page.getByRole('combobox', { name: '当前联赛', exact: true })
					await cohort.selectOption('competition:779')
					await expect(cohort).toHaveAttribute('aria-busy', 'false')
					for (const name of ['持有率', '队长选择', '转会']) {
						await page.getByRole('tab', { name, exact: true }).click()
						const panel = page.getByRole('tabpanel')
						await expect(panel.getByText('数据较旧', { exact: true }).first()).toBeVisible()
						await expect(panel.getByRole('link', { name: 'Palmer', exact: true }).first()).toBeVisible()
						await expect(panel).not.toContainText('Saka')
						await expect(panel.getByRole('button', { name: '重试', exact: true })).toHaveCount(0)
					}
					await expect(page).toHaveURL(url => url.searchParams.get('cohort') === 'competition:779' && url.searchParams.get('gw') === '33' && url.searchParams.get('scope') === 'public')
				}
				await testInfo.attach('planned-variant-context', { body: JSON.stringify({ variantId: `TR03.state.0${state === 'unpublished' ? 2 : 3}`, identity: 'bound', locale: 'zh-CN', width: 390, theme: 'dark', timezone: 'UTC', scenario: state }), contentType: 'application/json' })
			} finally {
				if (state === 'unpublished') await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
				await session.cleanup()
			}
		})
	}
})

test.describe('LP01 signed-in known entry input journey', () => {
	test.use({ timezoneId: 'Australia/Perth', colorScheme: 'light' })
	for (const locale of ['en', 'zh-CN']) {
		for (const width of [1440, 390]) {
			test(`${locale} ${width}px submits the visible form and renders the requested team`, async ({ page }, testInfo) => {
				test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Known fixture entry only; lookup can trigger synchronization')
				const requestedPath = `${locale === 'zh-CN' ? '/zh-CN' : ''}/live/points`
				await page.goto(requestedPath)
				await expect(page).toHaveURL(url => url.pathname.endsWith('/auth/login') && url.searchParams.get('next') === requestedPath)
				await expect(page.locator('#live-points-entry-id')).toHaveCount(0)
				const session = await createSession({ entryId: 15702 })
				try {
				await addSessionCookie(page, session.cookie)
				const zh = locale === 'zh-CN'
				await page.setViewportSize({ width, height: 900 })
				const liveRequests: Record<string, unknown>[] = []
				page.on('request', request => {
					if (!request.url().endsWith('/api/graphql') || request.method() !== 'POST') return
					const payload = request.postDataJSON()
					if (payload.query?.includes('calcLivePointsByEntry')) liveRequests.push(payload.variables)
				})
				await page.goto(`${zh ? '/zh-CN' : ''}/live/points`)
				const input = page.getByLabel(zh ? 'FPL 参赛 ID' : 'FPL entry ID', { exact: true })
				await expect(input).toBeEnabled()
				await input.fill('123')
				await page.getByRole('button', { name: zh ? '查看实时积分' : 'View Live Points', exact: true }).click()
				await expect.poll(() => liveRequests.some(row => row.entryId === 123 && row.eventId === 33)).toBe(true)
				const pitch = page.getByRole('region', { name: /^E2E United/ })
				await expect(pitch.getByRole('heading', { name: 'E2E United', exact: true })).toBeVisible()
				await expect(pitch.getByRole('button', { name: /Player \d+/ })).toHaveCount(15)
				await expect(input).toHaveValue('123')
				await expect(page).toHaveURL(url => url.pathname === `${zh ? '/zh-CN' : ''}/live/points`)
				await testInfo.attach('entry-input-requests', { body: JSON.stringify({ caseId: 'LP01', stepId: 'LP01.01', locale, width, liveRequests }), contentType: 'application/json' })
				} finally { await session.cleanup() }
			})
		}
	}
})

for (const { locale, width, planned } of [
 { locale: 'en', width: 1440, planned: false }, { locale: 'en', width: 390, planned: false },
 { locale: 'zh-CN', width: 1440, planned: false }, { locale: 'zh-CN', width: 390, planned: false },
 { locale: 'zh-CN', width: 390, planned: true }
]) {
 test.describe(`TEAM03 context ${locale} ${width} ${planned ? 'many-moves' : 'baseline'}`, () => {
  test.use({ timezoneId: planned ? 'UTC' : 'Australia/Perth', colorScheme: planned ? 'dark' : 'light' })
  test(`SSR remediation TEAM03 transfer filters and progressive reveal ${locale} ${width}px`, async ({ page }, testInfo) => {
   test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Dedicated isolated manager fixture')
   const zh = locale === 'zh-CN'
   const session = await createSession({ entryId: 15702 })
   const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
   const timeline = Array.from({ length: 25 }, (_, index) => ({
    ...managerReview.timeline[0], eventId: index + 1, eventChip: 'NONE',
    eventTransfersCost: planned && index === 23 ? 4 : 0,
    eventTransfers: index === 24 ? 0 : planned && index === 23 ? 8 : 1, overallPoints: (index + 1) * 60
   }))
   const review = {
    ...managerReview, entry: { ...managerReview.entry!, id: session.entryId! },
    throughEventId: 25, timeline, snapshotMeta: managerSnapshot(25),
    summary: { ...managerReview.summary!, gameweeksReviewed: 25, totalNetPoints: 1500, chips: [] },
    currentGameweek: { ...managerGameweek(3), eventId: 25, entry: { ...managerReview.entry!, id: session.entryId! }, snapshotMeta: managerSnapshot(25), result: { ...managerGameweek(3).result!, ...timeline[24] } },
    context: { ...managerReview.context, currentEventId: 25, nextEventId: 26, latestFinalizedEventId: 25, latestPublishedEventId: 25 },
    transfers: timeline.map(row => ({
     ...managerReview.transfers[0], eventId: row.eventId, eventTransfers: row.eventTransfers, eventTransfersCost: row.eventTransfersCost,
     transfers: Array.from({ length: row.eventTransfers }, (_, move) => ({ ...managerReview.transfers[0].transfers[0], eventId: row.eventId, elementInWebName: `Transfer In GW${row.eventId}-${move + 1}`, elementOutWebName: `Transfer Out GW${row.eventId}-${move + 1}`, evaluatedThroughEventId: row.eventId }))
    }))
   }
   const readCount = async () => {
    const observed = await (await fetch(fixture)).json() as { requests: { operation: string }[] }
    return observed.requests.filter(row => row.operation.startsWith('GetMyFplManager')).length
   }
   try {
    expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [{ operation: 'GetMyFplManagerReview', data: { myFplManagerReview: review } }] }) })).ok).toBe(true)
    await addSessionCookie(page, session.cookie)
    await page.addInitScript(theme => localStorage.setItem('theme', theme), planned ? 'dark' : 'system')
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`${zh ? '/zh-CN' : ''}/my-fpl/team?view=season`)
    await page.getByRole('tab', { name: zh ? '赛季复盘' : 'Season Review', exact: true }).click()
    const section = page.locator('div.bg-card').filter({ has: page.getByRole('heading', { name: zh ? '转会历史' : 'Transfer History', exact: true }) })
    await expect(section).toHaveCount(1)
    await expect(section.locator('[aria-busy]')).toHaveAttribute('aria-busy', 'false')
    const rows = section.getByRole('button', { name: zh ? /^打开第 \d+ 轮$/ : /^Open gameweek \d+$/ })
    const expectWeeks = async (weeks: number[]) => {
     await expect(rows).toHaveCount(weeks.length)
     await expect(rows).toHaveText(weeks.map(gw => `GW${gw}`))
    }
    const descending = (first: number, count: number) => Array.from({ length: count }, (_, index) => first - index)
    await expectWeeks(descending(24, 6))
    const before = await readCount()
    expect(before).toBeGreaterThan(0)
    if (planned) {
     const opener = section.getByRole('button', { name: /查看 8 次转会/ })
     await expect(opener).toHaveCount(1)
     for (let visit = 0; visit < 2; visit += 1) {
      await opener.click()
      const sheet = page.getByRole('dialog')
      await expect(sheet.getByRole('heading', { name: 'GW24 转会明细', exact: true })).toBeVisible()
      await expect(sheet).toHaveAccessibleDescription('8 次转会−4')
      await expect(sheet.locator('li')).toHaveCount(8)
      for (let move = 1; move <= 8; move += 1) {
       await expect(sheet.getByText(`Transfer In GW24-${move}`, { exact: true })).toBeVisible()
       await expect(sheet.getByText(`Transfer Out GW24-${move}`, { exact: true })).toBeVisible()
      }
      await sheet.getByRole('button', { name: '关闭', exact: true }).click()
      await expect(sheet).toHaveCount(0)
      await expect(opener).toBeFocused()
     }
     expect(await readCount()).toBe(before)
    }
    await section.getByRole('button', { name: zh ? '再显示 8 条' : 'Show 8 more', exact: true }).click()
    await expectWeeks(descending(24, 14))
    await section.getByRole('button', { name: zh ? '显示全部剩余（10）' : 'Show all remaining (10)', exact: true }).click()
    await expectWeeks(descending(24, 24))
    await section.getByRole('button', { name: zh ? '收起' : 'Show less', exact: true }).click()
    await expectWeeks(descending(24, 6))
    await section.getByRole('button', { name: zh ? '全赛季' : 'Full season', exact: true }).click()
    await expectWeeks(descending(25, 6))
    await expect(section.getByText(zh ? '无转会' : 'No transfer', { exact: true })).toBeVisible()
    await section.getByRole('button', { name: zh ? '有转会' : 'Active weeks', exact: true }).click()
    await expectWeeks(descending(24, 6))
    expect(await readCount()).toBe(before)
    const variantId = planned ? 'TEAM03.state.04' : `TEAM03.B.${locale}.${width === 390 ? 'mobile390' : 'desktop1440'}.base`
    expect(await page.evaluate(() => ({ width: innerWidth, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, theme: localStorage.getItem('theme') }))).toEqual({ width, timezone: planned ? 'UTC' : 'Australia/Perth', theme: planned ? 'dark' : 'system' })
    if (planned) await expect(page.locator('html')).toHaveClass(/dark/)
    await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-entry', String(session.entryId))
    await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-ready', 'true')
    await testInfo.attach(variantId, { contentType: 'application/json', body: JSON.stringify({ variantId, identity: 'B', locale, viewport: { width, height: 900 }, timezone: planned ? 'UTC' : 'Australia/Perth', theme: planned ? 'dark' : 'system', scenario: planned ? 'many-moves' : 'baseline', checkedWeeks: 25, activeWeeks: 24, sheetMoveCount: planned ? 8 : null, sheetVisits: planned ? 2 : 0, initialReads: before, finalReads: await readCount(), functionalStatus: 'PASS', performanceStatus: 'NOT_RUN', readyMs: null, scope: 'Actual active/all filtering, six/fourteen/all/collapsed weeks; no repeated manager reads; planned state additionally opens eight-move Sheet twice and restores focus' }) })
   } finally {
    await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
    await session.cleanup()
   }
  })
 })
}

for (const profile of ['baseline', 'planned', 'group', 'phase-pages', 'phase-race', 'phase-error'] as const) {
 test.describe(`J11 format ${profile}`, () => {
 test.use({ timezoneId: profile === 'baseline' ? 'Australia/Perth' : 'UTC', colorScheme: profile === 'baseline' ? 'light' : 'dark', viewport: { width: profile === 'baseline' ? 1440 : 390, height: 900 } })
for (const format of (profile === 'group' || (profile === 'phase-pages' || profile === 'phase-race' || profile === 'phase-error') ? ['H2H'] : ['H2H', 'KNOCKOUT']) as Array<'H2H' | 'KNOCKOUT'>) {
 test(`SSR remediation review readiness waits for required ${format} sections`, async ({ page }, testInfo) => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Isolated fixture controls only')
  const planned = profile !== 'baseline'
  await page.addInitScript(theme => localStorage.setItem('theme', theme), planned ? 'dark' : 'system')
  const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
  const session = await createSession({ entryId: 123 })
  const phase = { phaseId: 'format-phase', format, startEventId: 1, endEventId: 4, state: 'READY', revision: '9', semanticSha256: 'b'.repeat(64), settledAt: '2026-09-15T00:00:00Z', publishedAt: '2026-09-15T01:00:00Z', correctedAt: null }
  const scope = { ...phase, tournamentId: 78, eventId: 4, rowCount: profile === 'group' ? 4 : 2, expectedSubjectCount: profile === 'group' ? 4 : 2, readySubjectCount: profile === 'group' ? 4 : 2, notApplicableSubjectCount: 0 }
  const home = { entryId: 123, entryName: 'Readiness Home', isAverage: false, grossPoints: 75, transferCost: 4, netPoints: 71, matchPoints: 3, rank: 1, goalsScored: 2, goalsConceded: 0 }
  const away = { ...home, entryId: 456, entryName: 'Readiness Away', grossPoints: 50, transferCost: 0, netPoints: 50, matchPoints: 0, rank: 2 }
  const standing = { groupId: 1, entryId: 123, entryName: home.entryName, rank: 1, played: 1, won: 1, drawn: 0, lost: 0, matchPoints: 3, pointsFor: 71, pointsAgainst: 50 }
  const h2h = { matches: [{ matchId: 'r1', groupId: 1, home, away, isBye: false }], standings: [standing], nextCursor: null, hasNextPage: false }
  if (profile === 'group') {
   h2h.standings.push(
    { ...standing, entryId: 456, entryName: 'Readiness Away', rank: 2, won: 0, lost: 1, matchPoints: 0, pointsFor: 50, pointsAgainst: 71 },
    { ...standing, groupId: 2, entryId: 789, entryName: 'Group Two Home' },
    { ...standing, groupId: 2, entryId: 987, entryName: 'Group Two Away', rank: 2, won: 0, lost: 1, matchPoints: 0, pointsFor: 50, pointsAgainst: 71 }
   )
   h2h.matches.push({ matchId: 'r2', groupId: 2, home: { ...home, entryId: 789, entryName: 'Group Two Home' }, away: { ...away, entryId: 987, entryName: 'Group Two Away' }, isBye: false })
  }
  const knockout = { matches: [{ round: 1, name: 'Readiness Final', matchId: 1, playAgainstId: 2, home, away, winnerEntryId: 123 }], nextCursor: null, hasNextPage: false }
  const pageInfo = { hasNextPage: false, endCursor: null }
  const sections = format === 'H2H' ? ['H2H_STANDINGS', 'H2H_FIXTURES'] : ['KNOCKOUT_BRACKET']
  const rules = [
   { operation: 'GetMyTournamentReviewCatalog', data: { myTournamentReviewCatalog: { state: 'READY', asOf: phase.publishedAt, viewerEntryId: 123, adminReadAll: false, pageInfo, edges: [{ cursor: '78', node: { tournamentId: 78, name: 'Readiness Format Cup', creator: 'Fixture', leagueId: 78, leagueType: 'CLASSIC', totalTeamNum: profile === 'group' ? 4 : 2, latestFinalizedEventId: 4, previousReadyEventId: 3, setupStatus: 'READY', latestFinalizedScope: { ...scope, repairState: 'NONE' }, phaseSummaries: [phase], state: 'READY' } }] } } },
   { operation: 'GetMyTournamentSeasonReview', data: { myTournamentSeasonReview: { state: 'READY', tournamentId: 78, throughEventId: 4, latestFinalizedEventId: 4, phases: [phase] } } },
   { operation: 'GetMyTournamentGameweekReview', data: { myTournamentGameweekReview: { state: 'READY', scope, payload: format === 'H2H' ? { format, h2h } : { format, knockout } } } },
   ...sections.map(section => ({ operation: 'GetMyTournamentSeasonReviewSection', variables: { section }, data: { myTournamentSeasonReviewSection: { ...phase, tournamentId: 78, throughEventId: 4, section, points: null, h2h: format === 'H2H' ? { ...h2h, matches: section === 'H2H_FIXTURES' ? h2h.matches : [], standings: section === 'H2H_STANDINGS' ? h2h.standings : [] } : null, knockout: format === 'KNOCKOUT' ? knockout : null, pageInfo } } }))
  ]
  const secondPhase = { ...phase, phaseId: 'second-phase', revision: '10', semanticSha256: 'c'.repeat(64), startEventId: 1, endEventId: 2 }
  if ((profile === 'phase-pages' || profile === 'phase-race' || profile === 'phase-error')) {
   const seasonRule = rules.find(rule => rule.operation === 'GetMyTournamentSeasonReview')!
   Object.assign(seasonRule.data, { myTournamentSeasonReview: { state: 'READY', tournamentId: 78, throughEventId: 4, latestFinalizedEventId: 4, phases: [{ ...phase, startEventId: 3 }, secondPhase] } })
  }
  const sectionReads: Array<Record<string, unknown>> = []
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let releasePage!: () => void
  const pageGate = new Promise<void>(resolve => { releasePage = resolve })
  let heldPage = 0
  let heldRequests = 0
  try {
   expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules }) })).ok).toBe(true)
   await addSessionCookie(page, session.cookie)
   await page.route('**/api/graphql', async route => {
    const body = route.request().postDataJSON()
    if ((profile === 'phase-pages' || profile === 'phase-race' || profile === 'phase-error') && body.query?.includes('GetMyTournamentSeasonReviewSection')) {
     const v = body.variables
     sectionReads.push(v)
     const chosen = v.phaseId === secondPhase.phaseId ? secondPhase : phase
     expect(v).toMatchObject({ tournamentId: 78, throughEventId: 4, phaseId: chosen.phaseId, revision: chosen.revision, semanticSha256: chosen.semanticSha256 })
     const standings = v.section === 'H2H_STANDINGS'
     const pageTwo = Boolean(v.after)
     if (pageTwo) expect(v.after).toBe('standings-page-1')
     if ((profile === 'phase-race' || profile === 'phase-error') && pageTwo) { heldPage++; await pageGate }
     if (profile === 'phase-error' && pageTwo) {
      await route.fulfill({ status: 503, json: { errors: [{ message: 'Isolated old phase pagination failure' }] } })
      return
     }
     const row = { ...standing, entryId: chosen === secondPhase ? 789 : pageTwo ? 456 : 123, entryName: chosen === secondPhase ? 'Second Phase Only' : pageTwo ? 'Appended Player' : 'Readiness Home', rank: pageTwo ? 2 : 1 }
     if (v.section === sections.at(-1) && chosen === phase) { heldRequests++; await gate }
     await route.fulfill({ json: { data: { myTournamentSeasonReviewSection: { ...chosen, tournamentId: 78, throughEventId: 4, section: v.section, points: null, knockout: null, h2h: { ...h2h, standings: standings ? [row] : [], matches: standings ? [] : h2h.matches, hasNextPage: standings && chosen === phase && !pageTwo, nextCursor: standings && chosen === phase && !pageTwo ? 'standings-page-1' : null }, pageInfo: { hasNextPage: standings && chosen === phase && !pageTwo, endCursor: standings && chosen === phase && !pageTwo ? 'standings-page-1' : null } } } } })
     return
    }
    if (body.query?.includes('GetMyTournamentSeasonReviewSection') && body.variables.section === sections.at(-1)) { heldRequests++; await gate }
    await route.continue()
   })
   await page.goto(`${planned ? '/zh-CN' : ''}/my-fpl/competitions?tournamentId=78&view=gameweek&gw=4`)
   const ready = page.locator('[data-review-ready]')
   await expect(ready).toHaveAttribute('data-review-ready', 'true')
   await expect(ready).toHaveAttribute('data-review-revision', '9')
   await page.getByRole('tab', { name: planned ? zhMessages.TournamentStats.viewSeason : 'Season', exact: true }).click()
   await expect.poll(() => heldRequests).toBe(1)
   await expect(ready).toHaveAttribute('data-review-ready', 'false')
   release()
   await expect(ready).toHaveAttribute('data-review-ready', 'true')
   await expect(ready).toHaveAttribute('data-review-view', 'season')
   await expect(ready).toHaveAttribute('data-review-phase', phase.phaseId)
   await expect(ready).toHaveAttribute('data-review-hash', phase.semanticSha256)
   await expect(page.getByText('Readiness Away', { exact: true }).first()).toBeVisible()
   if (format === 'H2H') await expect(page.getByRole('cell', { name: 'Readiness Home', exact: true })).toBeVisible()
   else await expect(page.getByText('Readiness Final', { exact: true })).toBeVisible()
   if ((profile === 'phase-pages' || profile === 'phase-race' || profile === 'phase-error')) {
    const more = page.getByRole('button', { name: zhMessages.TournamentStats.reviewLoadMore, exact: true })
    await more.click()
    if (profile === 'phase-race' || profile === 'phase-error') await expect.poll(() => heldPage).toBe(1)
    else {
    await expect(page.getByRole('cell', { name: 'Appended Player', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Readiness Home', exact: true })).toHaveCount(1)
    await expect(more).toHaveCount(0)
    }
    expect(sectionReads.filter(v => v.after)).toHaveLength(1)
    const timeline = page.getByRole('tablist', { name: zhMessages.TournamentStats.reviewPhaseTimeline, exact: true })
    await timeline.getByRole('tab').filter({ hasText: 'GW1–2' }).click()
    await expect(ready).toHaveAttribute('data-review-ready', 'true')
    await expect(ready).toHaveAttribute('data-review-phase', secondPhase.phaseId)
    await expect(ready).toHaveAttribute('data-review-hash', secondPhase.semanticSha256)
    await expect(page.getByRole('cell', { name: 'Second Phase Only', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Appended Player', exact: true })).toHaveCount(0)
    expect(sectionReads.filter(v => v.phaseId === secondPhase.phaseId)).toHaveLength(2)
    if (profile === 'phase-race' || profile === 'phase-error') {
     const completed = page.waitForResponse(response => {
      if (!response.url().endsWith('/api/graphql')) return false
      return response.request().postDataJSON()?.variables?.after === 'standings-page-1'
     })
     releasePage()
     const late = await completed
     expect(late.status()).toBe(profile === 'phase-error' ? 503 : 200)
     expect(await late.finished()).toBeNull()
     await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
     await expect(ready).toHaveAttribute('data-review-ready', 'true')
     await expect(ready).toHaveAttribute('data-review-phase', secondPhase.phaseId)
     await expect(ready).toHaveAttribute('data-review-hash', secondPhase.semanticSha256)
     await expect(page.getByRole('cell', { name: 'Second Phase Only', exact: true })).toBeVisible()
     await expect(page.getByRole('cell', { name: 'Appended Player', exact: true })).toHaveCount(0)
     await expect(more).toHaveCount(0)
     await expect(page.getByText(zhMessages.TournamentStats.loadFailed, { exact: true })).toHaveCount(0)
    }
   }
   if (profile === 'group') {
    const groupRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'Group Two Home', exact: true }) })
    await expect(groupRow).toHaveCount(1)
    await expect(groupRow.getByRole('cell', { name: '2', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Group Two Away', exact: true })).toBeVisible()
   }
   if (planned) {
    await expect(page.locator('html')).toHaveClass(/dark/)
    expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('UTC')
    await testInfo.attach('J11-format-variant', { contentType: 'application/json', body: JSON.stringify({ variantId: (profile === 'phase-pages' || profile === 'phase-race' || profile === 'phase-error') ? null : profile === 'group' ? 'J11.state.03' : format === 'H2H' ? 'J11.state.02' : 'J11.state.04', format, profile, locale: 'zh-CN', viewport: page.viewportSize(), theme: 'dark', timezone: 'UTC', tournamentId: 78, eventId: 4, revision: '9', requiredSections: sections, groups: profile === 'group' ? [1, 2] : [1], scope: 'Direct GW entry and actual Season click with held required-section gate and rendered content', wholeJourneyPass: false, readyMs: null, performanceStatus: 'NOT_RUN' }) })
   }
  } finally {
   release()
   releasePage()
   await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
   await session.cleanup()
  }
 })
}


 })
}

test('J10 past-season pending prevents complete season readiness until recovery', async ({ page }) => {
 test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Isolated serial manager fixture')
 const session = await createSession({ entryId: 15702 })
 const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
 const review = { ...managerReview, entry: { ...managerReview.entry!, id: session.entryId! } }
 const configure = async (pending: boolean) => {
  expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [{ operation: 'GetMyFplManagerReview', data: { myFplManagerReview: { ...review, pastSeasonsState: pending ? 'PENDING' : 'READY' } } }] }) })).ok).toBe(true)
 }
 try {
  await configure(true)
  await addSessionCookie(page, session.cookie)
  await page.goto('/my-fpl/team')
  await expect(page.getByRole('tab', { name: 'Season Review', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-ready', 'false')
  await configure(false)
  await page.reload()
  await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-ready', 'true')
  await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-revision', '103')
 } finally {
  await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
  await session.cleanup()
 }
})

for (const state of ['UNAVAILABLE', 'EMPTY'] as const) {
 test(`TEAM04 past-season ${state} preserves current season`, async ({ page }) => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Isolated manager fixture only')
  const session = await createSession({ entryId: 15702 })
  const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
  try {
   const review = { ...managerReview, entry: { ...managerReview.entry!, id: session.entryId! }, pastSeasons: [], pastSeasonsState: state }
   expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [{ operation: 'GetMyFplManagerReview', data: { myFplManagerReview: review } }] }) })).ok).toBe(true)
   await addSessionCookie(page, session.cookie)
   await page.goto('/my-fpl/team')
   await expect(page.getByRole('tab', { name: 'Season Review', exact: true })).toHaveAttribute('aria-selected', 'true')
   await expect(page.getByRole('heading', { name: 'E2E Review United', exact: true })).toBeVisible()
   await expect(page.getByRole('heading', { name: 'Gameweek History', exact: true })).toBeVisible()
   await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-entry', String(session.entryId))
   await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-ready', state === 'EMPTY' ? 'true' : 'false')
   await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-revision', '103')
   const warning = page.getByText('Past-season history is temporarily unavailable. Please try again shortly.', { exact: true })
   if (state === 'UNAVAILABLE') await expect(warning).toBeVisible()
   else await expect(warning).toHaveCount(0)
  } finally {
   await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
   await session.cleanup()
  }
 })
}

test.describe('TEAM04 planned past-season boundaries', () => {
 test.use({ timezoneId: 'UTC', colorScheme: 'dark', viewport: { width: 390, height: 900 } })
 for (const state of ['UNAVAILABLE', 'EMPTY', 'READY'] as const) {
  test(`SSR remediation TEAM04 planned past-season ${state}`, async ({ page }, testInfo) => {
   test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Isolated manager fixture only')
   const session = await createSession({ entryId: 15702 })
   const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
   try {
    const pastSeasons = state === 'READY' ? [{ season: '2024/25', totalPoints: 2100, overallRank: 18000 }] : []
    const review = { ...managerReview, entry: { ...managerReview.entry!, id: session.entryId! }, pastSeasons, pastSeasonsState: state }
    expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [{ operation: 'GetMyFplManagerReview', data: { myFplManagerReview: review } }] }) })).ok).toBe(true)
    await addSessionCookie(page, session.cookie)
    await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
    await page.goto('/zh-CN/my-fpl/team')
    await expect(page.getByRole('tab', { name: zhMessages.TeamStats.viewSeason, exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('heading', { name: 'E2E Review United', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: '轮次历史', exact: true })).toBeVisible()
    const ready = page.locator('[data-manager-ready]')
    await expect(ready).toHaveAttribute('data-manager-entry', String(session.entryId))
    await expect(ready).toHaveAttribute('data-manager-revision', '103')
    await expect(ready).toHaveAttribute('data-manager-ready', state === 'UNAVAILABLE' ? 'false' : 'true')
    const warning = page.getByText(zhMessages.TeamStats.pastSeasonsUnavailable, { exact: true })
    if (state === 'UNAVAILABLE') await expect(warning).toBeVisible()
    else await expect(warning).toHaveCount(0)
    if (state === 'READY') {
     const row = page.getByRole('listitem').filter({ has: page.getByText('2024/25', { exact: true }) })
     await expect(row).toHaveCount(1)
     await expect(row).toContainText('2,100')
     await expect(row.getByText(zhMessages.TeamStats.seasonCurrent, { exact: true })).toHaveCount(0)
     await expect(row.locator('a, button, [role="button"]')).toHaveCount(0)
     await expect(ready).toHaveAttribute('data-manager-revision', '103')
    } else {
     await expect(page.getByText('2024/25', { exact: true })).toHaveCount(0)
    }
    expect(await page.evaluate(() => ({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, theme: localStorage.getItem('theme'), width: innerWidth }))).toEqual({ timezone: 'UTC', theme: 'dark', width: 390 })
    await expect(page.locator('html')).toHaveClass(/dark/)
    await testInfo.attach('TEAM04-boundary', { contentType: 'application/json', body: JSON.stringify({ variantId: state === 'UNAVAILABLE' ? 'TEAM04.state.02' : state === 'READY' ? 'TEAM04.state.03' : null, state, entryId: session.entryId, revision: '103', locale: 'zh-CN', timezone: 'UTC', theme: 'dark', viewport: page.viewportSize(), scope: 'Past-season availability and display-only reference rows preserve current-season identity and readiness semantics', wholeVariantPass: false, performanceStatus: 'NOT_RUN', readyMs: null }) })
   } finally {
    await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
    await session.cleanup()
   }
  })
 }
})

test('manager snapshot status survives a late historical read and failed selection', async ({ page }) => {
 test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Isolated serial manager fixture')
 const session = await createSession({ entryId: 15702 })
 const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
 let releaseSlow: (() => void) | undefined
 try {
  expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [
   { operation: 'GetMyFplManagerReview', data: { myFplManagerReview: { ...managerReview, entry: { ...managerReview.entry!, id: session.entryId! }, currentGameweek: { ...managerGameweek(3), entry: { ...managerReview.entry!, id: session.entryId! } } } } },
   ...[1, 2, 3].map(eventId => ({ operation: 'GetMyFplManagerGameweek', variables: { eventId }, data: { myFplManagerGameweek: { ...managerGameweek(eventId), entry: { ...managerReview.entry!, id: session.entryId! } } } }))
  ] }) })).ok).toBe(true)
  await addSessionCookie(page, session.cookie)
  await page.setViewportSize({ width: 390, height: 900 })
  await page.clock.install()
  await page.goto('/my-fpl/team')
  const status = page.locator('[data-manager-ready]').getByRole('alert').filter({ hasText: /snapshot/ })
  await expect(status).toContainText('2026')
  const slow = new Promise<void>(resolve => { releaseSlow = resolve })
  const historicalRequests: number[] = []
  let failure = true
  let slowDelivered = false
  await page.route('**/api/graphql', async route => {
   const payload = route.request().postDataJSON()
   if (!payload?.query?.includes('GetMyFplManagerGameweek')) { await route.continue(); return }
   const eventId = payload.variables.eventId
   historicalRequests.push(eventId)
   if (eventId === 1) await slow
   if (eventId === 2 && failure) { await route.fulfill({ status: 503, json: { errors: [{ message: 'isolated historical read failure' }] } }); return }
   const data = managerGameweek(eventId)
   try {
    await route.fulfill({ status: 200, json: { data: { myFplManagerGameweek: { ...data, entry: { ...data.entry!, id: session.entryId! }, snapshotMeta: { ...data.snapshotMeta!, publishedAt: `200${eventId}-02-03T04:05:06Z`, sourceMaxCheckedAt: `200${eventId}-02-03T01:02:03Z` } } } } })
   } finally { if (eventId === 1) slowDelivered = true }
  })
  const season = page.getByRole('tab', { name: 'Season Review', exact: true })
  const history = page.locator('div.bg-card').filter({ has: page.getByRole('heading', { name: 'Gameweek History', exact: true }) })
  const slowRequest = page.waitForRequest(r => r.postData()?.includes('GetMyFplManagerGameweek') === true && r.postDataJSON().variables.eventId === 1)
  await history.getByRole('button', { name: 'Open gameweek 1', exact: true }).click()
  await slowRequest
  await expect(status).toHaveCount(0)
  await season.click()
  await expect(season).toHaveAttribute('aria-selected', 'true')
  await expect(status).toContainText('2026')
  const failedRequest = page.waitForResponse(r => r.request().postData()?.includes('GetMyFplManagerGameweek') === true && r.request().postDataJSON().variables.eventId === 2)
  await history.getByRole('button', { name: 'Open gameweek 2', exact: true }).click()
  expect((await failedRequest).status()).toBe(503)
  await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-ready', 'false')
  await expect(status).toHaveCount(0)
  releaseSlow!()
  await expect.poll(() => slowDelivered).toBe(true)
  await expect(page).toHaveURL(url => url.searchParams.get('gw') === '2')
  await expect(status).toHaveCount(0)
  // A transient 503 deliberately activates the existing 30-second dependency fence.
  // Recovery is expected after that fence, not an immediate retry storm.
  await page.clock.fastForward(31_000)
  failure = false
  await season.click()
  await expect(season).toHaveAttribute('aria-selected', 'true')
  await expect(status).toContainText('2026')
  await history.getByRole('button', { name: 'Open gameweek 2', exact: true }).click()
  await expect.poll(() => historicalRequests.filter(id => id === 2).length, 'reopening failed GW2 must issue another read').toBe(2)
  await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-ready', 'true')
  await expect(status).toContainText('2002')
  await expect(status).not.toContainText('2001')
 } finally {
  releaseSlow?.()
  await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
  await session.cleanup()
 }
})


test('J12 MANAGE03 pause pending failure and retry recovery', async ({ page }) => {
 test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Isolated management mutation fixture')
 const session = await createSession({ entryId: 909090 })
 const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
 const requests: unknown[] = []
 let release!: () => void
 const held = new Promise<void>(resolve => { release = resolve })
 const setState = async (paused: boolean) => {
  expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [{ operation: 'GetManagedTournament', variables: { tournamentId: 77, entryId: 909090 }, data: { managedTournament: { ...managedTournament, state: paused ? 'INACTIVE' : 'ACTIVE' } } }] }) })).ok).toBe(true)
 }
 await page.route('**/api/tournaments/77', async route => {
  expect(route.request().method()).toBe('POST')
  requests.push(route.request().postDataJSON())
  if (requests.length === 1) {
   await held
   await route.fulfill({ status: 503, json: { error: 'Fixture unavailable' } })
  } else {
   await setState(true)
   await route.fulfill({ status: 200, json: { success: true } })
  }
 })
 try {
  await setState(false)
  await addSessionCookie(page, session.cookie)
  await page.goto('/zh-CN/competitions/77/manage')
  const pause = page.getByRole('button', { name: '暂停', exact: true })
  await pause.click()
  await expect(pause).toBeDisabled()
  expect(requests).toEqual([{ action: 'pause' }])
  release()
  await expect(page.locator('[data-competition-perf-ready="manage"] > [role="alert"]').filter({ hasText: '无法暂停赛事。' })).toBeVisible()
  await expect(pause).toBeEnabled()
  await expect(page.getByRole('button', { name: '恢复并补齐数据', exact: true })).toHaveCount(0)
  await pause.click()
  await expect(page.getByRole('button', { name: '恢复并补齐数据', exact: true })).toBeEnabled()
  await expect(pause).toHaveCount(0)
  await expect(page.locator('[data-competition-perf-ready="manage"] > [role="alert"]').filter({ hasText: '无法暂停赛事。' })).toHaveCount(0)
  expect(requests).toEqual([{ action: 'pause' }, { action: 'pause' }])
 } finally {
  release()
  await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
  await session.cleanup()
 }
})

test.describe('J12 MANAGE02 unavailable management scope', () => {
 test.use({ timezoneId: 'UTC', colorScheme: 'dark', viewport: { width: 390, height: 900 } })
 for (const scenario of ['owner-revoked', 'not-found', 'forbidden-code', 'http-forbidden', 'upstream-unavailable'] as const) {
  test(`J12 MANAGE02 ${scenario} clears sensitive management content`, async ({ page }) => {
   test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Isolated management boundary fixture')
   const session = await createSession({ entryId: 909090 })
   const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
   const id = scenario === 'owner-revoked' || scenario === 'upstream-unavailable' ? 77 : 987654321
   const configure = async (available: boolean) => {
    expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [
     { operation: 'GetManagedTournament', variables: { tournamentId: id, entryId: 909090 }, ...(scenario === 'forbidden-code' ? { error: true, errorCode: 'FORBIDDEN' } : scenario === 'http-forbidden' || (scenario === 'upstream-unavailable' && !available) ? { error: true, httpStatus: scenario === 'http-forbidden' ? 403 : 503 } : { data: { managedTournament: available ? managedTournament : null } }) }
    ] }) })).ok).toBe(true)
   }
   const mutations: string[] = []
   await page.route('**/api/tournaments/**', async route => {
    if (['POST', 'PATCH', 'DELETE'].includes(route.request().method())) {
     mutations.push(route.request().method())
     await route.fulfill({ status: 409, body: 'Unexpected mutation blocked' })
    } else await route.continue()
   })
   try {
    await addSessionCookie(page, session.cookie)
    await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
    await configure(scenario === 'owner-revoked')
    await page.goto(`/zh-CN/competitions/${id}/manage`)
    if (scenario === 'owner-revoked') {
     await expect(page.locator('[data-competition-perf-ready="manage"]')).toHaveAttribute('data-competition-tournament-id', '77')
     await expect(page.getByRole('button', { name: '删除赛事', exact: true })).toBeVisible()
     await configure(false)
     await page.reload()
    }
    await expect(page).toHaveURL(new RegExp(`/zh-CN/competitions/${id}/manage$`))
    const unavailable = scenario === 'upstream-unavailable'
    await expect(page.getByRole('heading', { name: unavailable ? '赛事管理暂时无法使用' : '需要管理员权限', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: unavailable ? '需要管理员权限' : '赛事管理暂时无法使用', exact: true })).toHaveCount(0)
    if (unavailable) await expect(page.getByRole('link', { name: '重试', exact: true })).toHaveAttribute('href', `/zh-CN/competitions/${id}/manage`)
    await expect(page.locator('[data-competition-perf-ready="manage"]')).toHaveCount(0)
    for (const name of ['删除赛事', '暂停', '恢复并补齐数据', '修复赛事设置']) {
     await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
    }
    await expect(page.locator('#tournament-name')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: /J12 Owned Cup/ })).toHaveCount(0)
    await expect(page.locator('html')).toHaveClass(/dark/)
    expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('UTC')
    const observations = await (await fetch(fixture)).json()
    expect(observations.requests.some((r: { operation: string; variables: { tournamentId?: number; entryId?: number } }) => r.operation === 'GetManagedTournament' && r.variables.tournamentId === id && r.variables.entryId === 909090)).toBe(true)
    if (unavailable) {
     await configure(true)
     await page.getByRole('link', { name: '重试', exact: true }).click()
     await expect(page.locator('[data-competition-perf-ready="manage"]')).toHaveAttribute('data-competition-tournament-id', '77')
     await expect(page.getByRole('button', { name: '删除赛事', exact: true })).toBeVisible()
     await expect(page.getByRole('heading', { name: '赛事管理暂时无法使用', exact: true })).toHaveCount(0)
    }
    expect(mutations).toEqual([])
   } finally {
    await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
    await session.cleanup()
   }
  })
 }
})

for (const { locale, width, planned, noHistory } of [
 { locale: 'en', width: 1440, planned: false, noHistory: false }, { locale: 'en', width: 390, planned: false, noHistory: false },
 { locale: 'zh-CN', width: 1440, planned: false, noHistory: false }, { locale: 'zh-CN', width: 390, planned: false, noHistory: false },
 { locale: 'zh-CN', width: 390, planned: true, noHistory: false }, { locale: 'zh-CN', width: 390, planned: true, noHistory: true }
]) {
 test.describe(`TEAM02 context ${locale} ${width} ${planned ? noHistory ? 'no-history' : 'ready' : 'baseline'}`, () => {
  test.use({ timezoneId: planned ? 'UTC' : 'Australia/Perth', colorScheme: planned ? 'dark' : 'light' })
  test(`SSR remediation manager chart integer ticks ${locale} ${width}px`, async ({ page }, testInfo) => {
   test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Isolated manager chart fixture')
   const session = await createSession({ entryId: 15702 })
   const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
   const prefix = locale === 'zh-CN' ? '/zh-CN' : ''
   try {
    await addSessionCookie(page, session.cookie)
    await page.addInitScript(theme => localStorage.setItem('theme', theme), planned ? 'dark' : 'system')
    await page.setViewportSize({ width, height: 900 })
    for (const counts of (noHistory ? [[]] : [[0, 1, 3], [0, 0, 0], [1]])) {
     const timeline = managerReview.timeline.slice(0, counts.length).map((row, index) => ({ ...row, eventTransfers: counts[index], eventNetPoints: index === 0 ? -1 : index }))
     const review = { ...managerReview, pastSeasons: [{ season: '2024/25', totalPoints: 2100, overallRank: 18000 }, { season: '2025/26', totalPoints: 2400, overallRank: 12000 }], entry: { ...managerReview.entry!, id: session.entryId! }, timeline, transfers: timeline.map(row => ({ ...managerReview.transfers[row.eventId - 1], eventTransfers: row.eventTransfers })) }
     expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [{ operation: 'GetMyFplManagerReview', data: { myFplManagerReview: review } }] }) })).ok).toBe(true)
     await page.goto(`${prefix}/my-fpl/team`)
     await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-ready', 'true')
     const chart = page.locator('div.bg-card').filter({ has: page.getByRole('heading', { name: locale === 'zh-CN' ? '赛季走势' : 'Season charts', exact: true }) })
     expect(await page.evaluate(() => ({ width: innerWidth, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, theme: localStorage.getItem('theme') }))).toEqual({ width, timezone: planned ? 'UTC' : 'Australia/Perth', theme: planned ? 'dark' : 'system' })
     if (planned) await expect(page.locator('html')).toHaveClass(/dark/)
     await expect(page.locator('[data-manager-ready]')).toHaveAttribute('data-manager-entry', String(session.entryId))
     if (noHistory) {
      await expect(chart).toHaveCount(0)
      const history = page.locator('div.bg-card').filter({ has: page.getByRole('heading', { name: '轮次历史', exact: true }) })
      await expect(history.getByText(zhMessages.TeamStats.noStats, { exact: true })).toBeVisible()
      await expect(history.getByRole('table')).toHaveCount(0)
      await expect(history.getByRole('button', { name: /^打开第/ })).toHaveCount(0)
      continue
     }
     await expect(chart).toHaveCount(1)
     const expectedModes = locale === 'zh-CN' ? ['总排名', '总得分', '净积分', '队长', '板凳', '转会'] : ['Overall rank', 'Total points', 'Net points', 'Captain', 'Bench', 'Transfers']
     await expect(chart.getByRole('button')).toHaveText(expectedModes)
     for (const mode of [locale === 'zh-CN' ? '转会' : 'Transfers', locale === 'zh-CN' ? '净积分' : 'Net points']) {
      await chart.getByRole('button', { name: mode, exact: true }).click()
      await expect(chart.getByRole('button', { name: mode, exact: true })).toHaveAttribute('aria-pressed', 'true')
      await expect(chart.locator('[aria-live="polite"]')).not.toContainText('GW3')
      const ticks = chart.locator('.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value')
      await expect(ticks.first()).toBeVisible()
      const labels = await ticks.allTextContents()
      expect(labels.length).toBeGreaterThan(1)
      expect(new Set(labels).size, `${mode} labels for ${counts}`).toBe(labels.length)
      expect(labels.every(label => /^-?\d+$/.test(label))).toBe(true)
      if (counts[2] === 3) {
       const summary = chart.locator('[aria-live=\"polite\"]')
       await chart.locator('.recharts-bar-rectangle path').last().hover()
       await expect(summary).toContainText('GW3')
       await expect(summary).toContainText('Saka')
       await page.mouse.move(0, 0)
       await expect(summary).not.toContainText('GW3')
      }
      if (mode === (locale === 'zh-CN' ? '净积分' : 'Net points')) expect(labels.some(label => Number(label) < 0)).toBe(true)
     }
     if (counts[2] === 3) {
      const history = page.locator('div.bg-card').filter({ has: page.getByRole('heading', { name: locale === 'zh-CN' ? '往年赛季' : 'Past Seasons', exact: true }) })
      await expect(history).toHaveCount(1)
      const firstDot = history.locator('.recharts-line-dot').first()
      await firstDot.scrollIntoViewIfNeeded()
      const dotBox = await firstDot.boundingBox()
      expect(dotBox).not.toBeNull()
      const plotBox = await history.locator('.recharts-cartesian-grid').boundingBox()
      expect(plotBox).not.toBeNull()
      const center = { x: dotBox!.x + dotBox!.width / 2, y: dotBox!.y + dotBox!.height / 2 }
      const inside = { x: Math.max(plotBox!.x + 1, Math.min(plotBox!.x + plotBox!.width - 1, center.x)), y: Math.max(plotBox!.y + 1, Math.min(plotBox!.y + plotBox!.height - 1, center.y)) }
      // Keep the pointer inside the plot at fractional endpoint coordinates.
      await page.mouse.move(inside.x, inside.y)
      await expect(history.locator('[aria-live="polite"]')).toContainText(/202[456]\//)
      await page.mouse.move(0, 0)
      await expect(history.locator('[aria-live="polite"]')).toHaveCount(0)
      await history.locator('.recharts-line-dot').nth(1).hover()
      await expect(history.locator('[aria-live="polite"]')).toContainText(/202[456]\//)
      await page.mouse.move(0, 0)
      await expect(history.locator('[aria-live="polite"]')).toHaveCount(0)
      for (const mode of (locale === 'zh-CN' ? ['总排名', '总得分', '队长', '板凳'] : ['Overall rank', 'Total points', 'Captain', 'Bench'])) {
       await chart.getByRole('button', { name: mode, exact: true }).click()
      await expect(chart.getByRole('button', { name: mode, exact: true })).toHaveAttribute('aria-pressed', 'true')
      await expect(chart.locator('[aria-live="polite"]')).not.toContainText('GW3')
       const summary = chart.locator('[aria-live="polite"]')
       await chart.locator('.recharts-bar-rectangle path').last().hover()
       await expect(summary).toContainText('GW3')
       await expect(summary).toContainText('Saka')
       await page.mouse.move(0, 0)
       await expect(summary).not.toContainText('GW3')
      }
      await testInfo.attach('C07-extreme-chart', {
       contentType: 'application/json',
       body: JSON.stringify({
        caseId: 'C07',
        stepIds: ['C07.04'],
        state: 'extreme-chart',
        locale,
        viewport: { width, height: 900 },
        assertions: ['integer chart ticks remain unique and readable', 'bar tooltip exposes GW3 and Saka', 'past-season line tooltip exposes season and clears on pointer leave', 'chart units remain explicit for rank/points/captain/bench modes'],
        functionalStatus: 'PASS',
        performanceStatus: 'NOT_OBSERVED',
        readyMs: null,
        eventToPaintMs: null,
        wholeCaseComplete: false
       })
      })
     }
    }
    const variantId = planned ? noHistory ? 'TEAM02.state.02' : 'TEAM02.state.01' : `TEAM02.B.${locale}.${width === 390 ? 'mobile390' : 'desktop1440'}.base`
    await testInfo.attach(variantId, { contentType: 'application/json', body: JSON.stringify({ variantId, identity: 'B', locale, viewport: { width, height: 900 }, theme: planned ? 'dark' : 'system', timezone: planned ? 'UTC' : 'Australia/Perth', scenario: noHistory ? 'no-history' : planned ? 'ready' : 'baseline', modes: noHistory ? [] : ['rank', 'totalPoints', 'netPoints', 'captain', 'bench', 'transfers'], functionalStatus: 'PASS', performanceStatus: 'NOT_RUN', readyMs: null, scope: noHistory ? 'Empty current-season history has textual empty state, no fake chart/table/GW action' : 'Six actual modes, selected buttons, unique integer ticks including negative/zero/single-point ranges, native pointer tooltip GW3/Saka and leave clearing; past-season tooltip clearing', notApplicable: 'Chart itself has no GW navigation control; navigation is in history section and separately tested' }) })
   } finally {
    await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
    await session.cleanup()
   }
  })
 })
}

for (const locale of ['en', 'zh-CN'] as const) {
 for (const width of [1440, 390]) {
  test(`SSR remediation manager selection uses one read path ${locale} ${width}px`, async ({ page }) => {
   test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Isolated serial manager fixture')
   const session = await createSession({ entryId: 15702 })
   const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
   const prefix = locale === 'zh-CN' ? '/zh-CN' : ''
   const path = `${prefix}/my-fpl/team`
   const identity = { ...managerReview.entry!, id: session.entryId! }
   const rules = [
    { operation: 'GetMyFplManagerReview', data: { myFplManagerReview: { ...managerReview, entry: identity, currentGameweek: { ...managerGameweek(3), entry: identity } } } },
    ...[1, 2, 3].map(eventId => ({ operation: 'GetMyFplManagerGameweek', variables: { eventId }, data: { myFplManagerGameweek: { ...managerGameweek(eventId), entry: identity } } }))
   ]
   try {
    expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules }) })).ok).toBe(true)
    await addSessionCookie(page, session.cookie)
    await page.setViewportSize({ width, height: 900 })
    await page.goto(path)
    const ready = page.locator('[data-manager-ready]')
    await expect(ready).toHaveAttribute('data-manager-ready', 'true')
    const navigations: string[] = []
    const reads: number[] = []
    page.on('request', request => {
     if (new URL(request.url()).pathname === path && request.headers().rsc === '1') navigations.push(request.url())
     if (new URL(request.url()).pathname === '/api/graphql' && request.postData()?.includes('GetMyFplManagerGameweek')) reads.push(request.postDataJSON().variables.eventId)
    })
    const history = page.locator('div.bg-card').filter({ has: page.getByRole('heading', { name: locale === 'zh-CN' ? '队长历史' : 'Captain History', exact: true }) })
    await expect(history).toHaveCount(1)
    const open = history.getByRole('button', { name: locale === 'zh-CN' ? '打开第 1 轮' : 'Open gameweek 1', exact: true })
    await expect(open).toHaveCount(1)
    await open.click()
    await expect(page).toHaveURL(url => url.pathname === path && url.searchParams.get('gw') === '1' && url.searchParams.get('view') === 'gameweek')
    await expect(ready).toHaveAttribute('data-manager-gw', '1')
    await expect(ready).toHaveAttribute('data-manager-ready', 'true')
    await expect(ready).toHaveAttribute('data-manager-revision', '101')
    expect(navigations, 'client-owned view changes must not repeat the server loader').toEqual([])
    expect(reads).toEqual([1])
    await page.getByRole('tab', { name: locale === 'zh-CN' ? '赛季复盘' : 'Season Review', exact: true }).click()
    await expect(ready).toHaveAttribute('data-manager-view', 'season')
    await open.click()
    await expect(ready).toHaveAttribute('data-manager-view', 'gameweek')
    await expect(ready).toHaveAttribute('data-manager-ready', 'true')
    expect(reads, 'completed historical data is reused').toEqual([1])
    expect(navigations).toEqual([])
    await page.goto(prefix || '/')
    await page.goBack()
    await expect(page).toHaveURL(url => url.pathname === path && url.searchParams.get('gw') === '1')
    await expect(ready).toHaveAttribute('data-manager-revision', '101')
    await expect(ready).toHaveAttribute('data-manager-ready', 'true')
    await page.goForward()
    await expect(page).toHaveURL(url => url.pathname === (prefix || '/'))
    // Direct entry must retain its server seed and not re-fetch on mount.
    reads.length = 0
    await page.goto(`${path}?view=gameweek&gw=2`)
    await expect(ready).toHaveAttribute('data-manager-revision', '102')
    await expect(ready).toHaveAttribute('data-manager-ready', 'true')
    expect(reads).toEqual([])
   } finally {
    await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
    await session.cleanup()
   }
  })
 }
}

// PROFILE01.03 and PROFILE03.01: isolated accounts and intercepted uploads only.
for (const profile of ['baseline', 'invalid-file', 'error'] as const) {
const planned = profile !== 'baseline'
const timezone = planned ? 'UTC' : 'Australia/Perth'
test.describe(`profile history and avatar fixture coverage ${profile}`, () => {
 test.use({ timezoneId: timezone, colorScheme: planned ? 'dark' : 'light' })
 for (const locale of ['en', 'zh-CN'] as const) {
  for (const width of [1440, 390]) {
   if (planned && (locale !== 'zh-CN' || width !== 390)) continue
   test(`PROFILE01 long name history and PROFILE03 avatar recovery ${locale} ${width}`, async ({ page }, testInfo) => {
    test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Requires isolated database and FPL fixture')
    const prefix = locale === 'en' ? '' : '/zh-CN'
    const t = (locale === 'en' ? enMessages : zhMessages).Profile
    const session = await createSession({ entryId: 15702 })
    const sql = postgres(process.env.E2E_DIRECT_DATABASE_URL!, { max: 1, prepare: false })
    const names = Array.from({ length: 40 }, (_, i) => `History ${String(i).padStart(2, '0')} 中文 United`)
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6R1sAAAAASUVORK5CYII=', 'base64')
    const avatarSrc = `data:image/png;base64,${png.toString('base64')}`
    try {
     for (const [i, name] of Array.from(names.entries())) {
      await sql`INSERT INTO bauth.fpl_entry_name_history (id,user_id,entry_id,team_name,last_seen_at)
       VALUES (${randomUUID()},${session.userId},${session.entryId},${name},${new Date(Date.UTC(2025,0,1,0,i))})`
     }
     await addSessionCookie(page, session.cookie)
     await page.setViewportSize({ width, height: 900 })
     await page.addInitScript(theme => localStorage.setItem('theme', theme), planned ? 'dark' : 'system')
     await page.goto(`${prefix}/profile`)
     expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(timezone)
     await expect(page.locator('html')).toHaveClass(planned ? /dark/ : /light/)
     const main = page.locator('#main-content')
     await expect(main).toContainText('E2E Synced United')
     const history = main.locator('li').filter({ hasText: /^· History / })
     await expect(history).toHaveCount(40)
     expect(await history.allTextContents()).toEqual([...names].reverse().map(name => `· ${name}`))
     const upload = main.getByTitle(t.changeAvatar, { exact: true })
     await expect(upload).toBeEnabled()
     await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
     const statuses = [
      { code: 'fileTooLarge', status: 413, file: { name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) } },
      { code: 'invalidFile', status: 400, file: { name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') } },
      { code: 'uploadFailed', status: 502, file: { name: 'valid.png', mimeType: 'image/png', buffer: png } },
      { code: 'network', status: 0, file: { name: 'valid.png', mimeType: 'image/png', buffer: png } },
      { code: 'success', status: 200, file: { name: 'valid.png', mimeType: 'image/png', buffer: png } }
     ] as const
     const observations: Array<{ scenario: string; requestCount: number; requestBytes: number }> = []
     for (const scenario of statuses) {
      if (profile === 'invalid-file' && !['invalidFile', 'success'].includes(scenario.code)) continue
      if (profile === 'error' && !['uploadFailed', 'network', 'success'].includes(scenario.code)) continue
      let release!: () => void
      const held = new Promise<void>(resolve => { release = resolve })
      let requests = 0
      let bytes = 0
      await page.route('**/api/profile/avatar', async route => {
       requests++
       expect(route.request().method()).toBe('POST')
       bytes = route.request().postDataBuffer()?.length ?? 0
       expect(bytes).toBeGreaterThan(scenario.file.buffer.length)
       await held
       if (scenario.code === 'network') await route.abort('failed')
       else await route.fulfill({ status: scenario.status, json: scenario.code === 'success'
        ? { success: true, imageUrl: avatarSrc } : { success: false, errorCode: scenario.code } })
      })
      const chooser = page.waitForEvent('filechooser')
      await upload.click()
      await (await chooser).setFiles(scenario.file)
      await expect.poll(() => requests).toBe(1)
      await expect(upload).toBeDisabled()
      release()
      await expect(upload).toBeEnabled()
      const message = scenario.code === 'success' ? t.avatarUpdated : scenario.code === 'network' ? t.avatarFailed : t.errors[scenario.code]
      await expect(page.locator('[data-sonner-toast]').filter({ hasText: message }).last()).toBeVisible()
      if (scenario.code === 'success') {
       await expect(upload.locator('img')).toHaveAttribute('src', avatarSrc)
       await expect.poll(() => upload.locator('img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
      } else await expect(upload.locator('img')).toHaveCount(0)
      expect(requests).toBe(1)
      observations.push({ scenario: scenario.code, requestCount: requests, requestBytes: bytes })
      await page.unroute('**/api/profile/avatar')
     }
     const [user] = await sql`SELECT image FROM bauth."user" WHERE id=${session.userId}`
     expect(user.image).toBeNull()
     await expect(page).toHaveURL(url => url.pathname === `${prefix}/profile`)
     await expect(history).toHaveCount(40)
     await testInfo.attach('profile-state-evidence', { contentType: 'application/json', body: JSON.stringify({
      stepIds: ['PROFILE01.03', 'PROFILE03.01'], locale, width, identity: 'B isolated bound account',
      variantId: profile === 'invalid-file' ? 'PROFILE03.state.01' : profile === 'error' ? 'PROFILE03.state.02' : null,
      scenario: profile, timezone, theme: planned ? 'dark' : 'system',
      history: { count: 40, order: 'last_seen_at descending', preservedAfterUpload: true }, uploads: observations,
      validationScope: 'UI upload response handling; server file validation and storage not exercised',
      readyMs: null, eventToPaintMs: null, performanceStatus: 'NOT_OBSERVED', databaseImageUnchanged: true
     }) })
    } finally {
     await sql.end()
     await session.cleanup()
    }
   })
  }
 }
})

}

test.describe('PROFILE01 planned unbound long-history applicability', () => {
 test.use({ timezoneId: 'UTC', colorScheme: 'dark', viewport: { width: 390, height: 900 } })
 test('old history is not displayed without a verified entry', async ({ page }, testInfo) => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Isolated account and database only')
  const session = await createSession()
  const sql = postgres(process.env.E2E_DIRECT_DATABASE_URL!, { max: 1, prepare: false })
  try {
   const names = Array.from({ length: 40 }, (_, i) => `Unbound history ${i}`)
   for (const [i, name] of Array.from(names.entries())) {
    await sql`INSERT INTO bauth.fpl_entry_name_history (id,user_id,entry_id,team_name,last_seen_at)
     VALUES (${randomUUID()},${session.userId},15702,${name},${new Date(Date.UTC(2025,0,1,0,i))})`
   }
   await addSessionCookie(page, session.cookie)
   await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
   await page.goto('/zh-CN/profile')
   await expect(page).toHaveURL(url => url.pathname === '/zh-CN/profile')
   expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('UTC')
   await expect(page.locator('html')).toHaveClass(/dark/)
   const main = page.locator('#main-content')
   await expect(main.getByRole('heading', { name: 'E2E Manager', exact: true })).toBeVisible()
   await expect(main.getByText(zhMessages.Profile.noPreviousTeamNames, { exact: true })).toBeVisible()
   await expect(main.locator('li').filter({ hasText: /^· Unbound history / })).toHaveCount(0)
   const [user] = await sql`SELECT fpl_entry_id, fpl_entry_verified_at FROM bauth."user" WHERE id=${session.userId}`
   expect(user.fpl_entry_id).toBeNull()
   expect(user.fpl_entry_verified_at).toBeNull()
   const [history] = await sql`SELECT count(*)::int AS count FROM bauth.fpl_entry_name_history WHERE user_id=${session.userId}`
   expect(history.count).toBe(40)
   await testInfo.attach('profile-history-applicability', { contentType: 'application/json', body: JSON.stringify({
    variantId: 'PROFILE01.state.03', stepId: 'PROFILE01.03', identity: 'U', locale: 'zh-CN', width: 390,
    theme: 'dark', timezone: 'UTC', storedHistoryCount: 40, renderedHistoryCount: 0,
    applicability: 'Long-history display requires verified entry; original unbound variant is N/A for that display.',
    observedAssertion: 'PASS: unbound profile does not disclose retained entry history',
    readyMs: null, eventToPaintMs: null, performanceStatus: 'NOT_OBSERVED'
   }) })
  } finally {
   await sql.end()
   await session.cleanup()
  }
 })
})

for (const mode of ['delayed', 'failed'] as const) {
 for (const locale of ['en', 'zh-CN'] as const) {
  for (const width of [1440, 390]) {
   test(`PROFILE01 identity refresh ${mode} ${locale} ${width}`, async ({ page }, testInfo) => {
    test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Isolated database and server FPL fixture required')
    const session = await createSession({ entryId: 15702 })
    const prefix = locale === 'en' ? '' : '/zh-CN'
    const t = (locale === 'en' ? enMessages : zhMessages).Profile
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    let requests = 0
    let completed = 0
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    try {
     await addSessionCookie(page, session.cookie)
     await page.setViewportSize({ width, height: 900 })
     await page.route('**/api/auth/get-session?*', async route => {
      if (!new URL(route.request().url()).searchParams.has('disableCookieCache')) return route.continue()
      requests++
      await held
      if (mode === 'failed') await route.fulfill({ status: 503, json: { code: 'INTERNAL_SERVER_ERROR', message: 'Isolated session dependency unavailable' } })
      else await route.continue()
      completed++
     })
     await page.goto(`${prefix}/profile`)
     await expect.poll(() => requests).toBeGreaterThan(0)
     const main = page.locator('#main-content')
     await expect(main.getByRole('heading', { name: t.title, exact: true })).toBeVisible()
     await expect(main).toContainText('E2E Synced United')
     await expect(main.getByTitle(t.changeAvatar, { exact: true })).toBeEnabled()
     expect(completed).toBe(0)
     const before = requests
     release()
     await expect.poll(() => completed).toBeGreaterThanOrEqual(before)
     await expect(main).toContainText('E2E Synced United')
     await expect(page).toHaveURL(url => url.pathname === `${prefix}/profile`)
     // Bounded observation for an accidental refresh/re-fetch loop after settlement.
     await page.waitForTimeout(1200)
     expect(requests).toBe(before)
     expect(errors).toEqual([])
     await testInfo.attach('profile-refresh-evidence', { contentType: 'application/json', body: JSON.stringify({
      stepId: 'PROFILE01.02', locale, width, mode, requests, completed,
      asserted: ['authorized SSR content visible while client fresh-session request held', 'avatar control enabled', 'same profile after settlement', 'no additional fresh-session requests in 1200ms observation', 'no pageerror'],
      scope: 'Client identity-session refresh only; server FPL identity sync timeout is not injected',
      readyMs: null, performanceStatus: 'NOT_OBSERVED'
     }) })
    } finally {
     release()
     await session.cleanup()
    }
   })
  }
 }
}

for (const directed of [false, true]) {
test.describe(directed ? 'PROFILE04 directed contexts' : 'PROFILE04 existing contexts', () => {
 if (directed) {
  test.use({ timezoneId: 'UTC', colorScheme: 'dark' })
  test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('theme', 'dark')) })
  test.afterEach(async ({ page }, testInfo) => {
   await expect(page.locator('html')).toHaveClass(/dark/)
   expect(await page.evaluate(() => ({ width: innerWidth, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, theme: localStorage.getItem('theme'), locale: document.documentElement.lang }))).toEqual({ width: 390, timezone: 'UTC', theme: 'dark', locale: 'zh-CN' })
   const state = testInfo.title.includes('retry recovery') ? '03' : testInfo.title.includes('terminal empty') ? '01' : '02'
   await testInfo.attach('PROFILE04-directed-context', { contentType: 'application/json', body: JSON.stringify({ variantId: `PROFILE04.state.${state}`, identity: 'isolated bound session', width: 390, timezone: 'UTC', theme: 'dark', locale: 'zh-CN', functionalStatus: testInfo.status === 'passed' ? 'PASS' : 'FAIL', performanceStatus: 'NOT_RUN', readyMs: null, wholeVariantComplete: false, scope: 'Existing list terminal or error-retry assertions in planned context; no revoke' }) })
  })
 }
for (const locale of ['en', 'zh-CN'] as const) {
 for (const width of [1440, 390]) {
  if (directed && (locale !== 'zh-CN' || width !== 390)) continue
  test(`PROFILE04 session list retry recovery ${locale} ${width}`, async ({ page }, testInfo) => {
   test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Isolated session fixture only')
   const session = await createSession({ entryId: 15702 })
   const prefix = locale === 'en' ? '' : '/zh-CN'
   const t = (locale === 'en' ? enMessages : zhMessages).Sessions
   let reads = 0
   let writes = 0
   try {
    await addSessionCookie(page, session.cookie)
    await page.setViewportSize({ width, height: 900 })
    page.on('request', request => {
     if (new URL(request.url()).pathname.startsWith('/api/auth/') && !['GET', 'HEAD'].includes(request.method())) writes++
    })
    await page.route('**/api/auth/list-sessions', async route => {
     reads++
     if (reads === 1) await route.fulfill({ status: 500, json: { code: 'INTERNAL_SERVER_ERROR', message: 'Isolated session read failure' } })
     else await route.continue()
    })
    await page.goto(`${prefix}/profile/sessions`)
    const main = page.locator('#main-content')
    await expect(main.getByText(t.loadFailed, { exact: true })).toBeVisible()
    await expect(main.getByText(t.thisDevice, { exact: true })).toHaveCount(0)
    expect(reads).toBe(1)
    await main.getByRole('button', { name: t.retry, exact: true }).click()
    await expect(main.getByText(t.thisDevice, { exact: true })).toHaveCount(1)
    await expect(main.getByText(t.loadFailed, { exact: true })).toHaveCount(0)
    await expect(main.getByRole('button', { name: t.retry, exact: true })).toHaveCount(0)
    await expect(page).toHaveURL(url => url.pathname === `${prefix}/profile/sessions`)
    expect(reads).toBe(2)
    expect(writes).toBe(0)
    await testInfo.attach('session-retry-evidence', { contentType: 'application/json', body: JSON.stringify({
     stepIds: ['PROFILE04.02', 'PROFILE04.03'], locale, width, reads, writes,
     identity: 'isolated bound current session', environment: 'isolated-fixture',
     assertions: ['failed read shown without a false current-session row', 'actual retry click issues one further read', 'real current session restored exactly once', 'error and retry removed', 'no auth writes'],
     readyMs: null, eventToPaintMs: null, performanceStatus: 'NOT_RUN', wholeCaseComplete: false
    }) })
   } finally {
    await session.cleanup()
   }
  })
 }
}

for (const mode of ['empty', 'unauthorized', 'stale'] as const) {
 if (directed && mode === 'stale') continue
 for (const locale of ['en', 'zh-CN'] as const) {
  for (const width of [1440, 390]) {
  if (directed && (locale !== 'zh-CN' || width !== 390)) continue
   test(`PROFILE04 session list terminal ${mode} ${locale} ${width}`, async ({ page }, testInfo) => {
    test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Isolated session fixture only')
    const session = await createSession({ entryId: 15702 })
    const prefix = locale === 'en' ? '' : '/zh-CN'
    const t = (locale === 'en' ? enMessages : zhMessages).Sessions
    let reads = 0
    let writes = 0
    try {
     await addSessionCookie(page, session.cookie)
     await page.setViewportSize({ width, height: 900 })
     page.on('request', request => {
      if (new URL(request.url()).pathname.startsWith('/api/auth/') && !['GET', 'HEAD'].includes(request.method())) writes++
     })
     await page.route('**/api/auth/list-sessions', async route => {
      reads++
      await route.fulfill(mode === 'empty'
       ? { status: 200, json: [] }
       : { status: mode === 'unauthorized' ? 401 : 403, json: { code: mode === 'unauthorized' ? 'UNAUTHORIZED' : 'SESSION_NOT_FRESH', message: 'Isolated session state' } })
     })
     await page.goto(`${prefix}/profile/sessions`)
     const main = page.locator('#main-content')
     const expected = mode === 'empty' ? t.empty : mode === 'unauthorized' ? t.loadFailed : t.reauthTitle
     await expect(main.getByText(expected, { exact: true })).toBeVisible()
     for (const other of [t.empty, t.loadFailed, t.reauthTitle].filter(text => text !== expected)) {
      await expect(main.getByText(other, { exact: true })).toHaveCount(0)
     }
     await expect(main.getByText(t.thisDevice, { exact: true })).toHaveCount(0)
     if (mode === 'unauthorized') await expect(main.getByRole('button', { name: t.retry, exact: true })).toBeEnabled()
     if (mode === 'stale') await expect(main.getByRole('link', { name: t.reauthAction, exact: true })).toHaveAttribute('href', `${prefix}/auth/login?next=/profile/sessions&reason=reauth`)
     await expect(page).toHaveURL(url => url.pathname === `${prefix}/profile/sessions`)
     expect(reads).toBe(1)
     expect(writes).toBe(0)
     await testInfo.attach('session-terminal-evidence', { contentType: 'application/json', body: JSON.stringify({
      stepId: 'PROFILE04.03', locale, width, mode, reads, writes, expected,
      scope: 'Authenticated route with isolated list response; expired route authorization remains separate',
      readyMs: null, performanceStatus: 'NOT_RUN', wholeCaseComplete: false
     }) })
    } finally {
     await session.cleanup()
    }
   })
  }
 }
}

})
}

test.describe('live board layout fixture', () => {
 test.describe.configure({ mode: 'serial' })
for (const width of [1440, 390]) {
 for (const remembered of [false, true]) {
  test(`live board initial layout budget ${width} remembered=${remembered}`, async ({ page }, testInfo) => {
   test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Dedicated isolated fixture suite')
   const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}`
   const session = await createSession({ entryId: 15702 })
   let release!: () => void
   const held = new Promise<void>(resolve => { release = resolve })
   let boardRequests = 0
   const targetId = remembered ? 7 : 6
   try {
    await fetch(`${fixture}/__performance`, { method: 'POST', body: JSON.stringify({ rules: [] }) })
    const response = await fetch(`${fixture}/graphql`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'query GetEntryTournaments { entryTournaments { id } }', variables: { entryId: session.entryId } }) })
    const catalog = (await response.json()).data.entryTournaments
    const second = { ...catalog[0], id: 7, name: 'Remembered Fixture League', sourceLeagueName: 'Remembered Fixture League', leagueId: 315 }
    expect((await fetch(`${fixture}/__performance`, { method: 'POST', body: JSON.stringify({ rules: [
     { operation: 'GetEntryTournaments', data: { entryTournaments: [...catalog, second] } }
    ] }) })).ok).toBe(true)
    await addSessionCookie(page, session.cookie)
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(({ entryId, targetId, remembered }) => {
     if (remembered) localStorage.setItem(`letletme:live-tournament-selection:v1:${entryId}`, String(targetId))
     const state = { shifts: [] as Array<{ value: number; startTime: number; hadRecentInput: boolean }>, observer: null as PerformanceObserver | null }
     ;(window as unknown as { __liveLayout: typeof state }).__liveLayout = state
     state.observer = new PerformanceObserver(list => {
      for (const item of list.getEntries()) {
       const e = item as PerformanceEntry & { value: number; hadRecentInput: boolean; sources: Array<{ node?: Element; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }> }
       state.shifts.push(Object.assign({ value: e.value, startTime: e.startTime, hadRecentInput: e.hadRecentInput }, { sources: e.sources.map(source => ({ tag: source.node?.tagName, className: source.node?.className, before: source.previousRect.toJSON(), after: source.currentRect.toJSON() })) }))
      }
     })
     state.observer.observe({ type: 'layout-shift', buffered: true })
    }, { entryId: session.entryId, targetId, remembered })
    await page.route(`**/api/live/competitions/${targetId}/board`, async route => {
     boardRequests++
     await held
     await route.continue()
    })
    await page.goto('/live/competitions')
    await expect.poll(() => boardRequests).toBe(1)
    await expect(page.locator('[data-competition-perf-ready]')).toHaveCount(0)
    // Deliberately delayed fixture response: allow initial loading layout to paint.
    await page.waitForTimeout(650)
    const before = await page.getByRole('contentinfo').boundingBox()
    release()
    const ready = page.locator('[data-competition-perf-ready="detail"]')
    await expect(ready).toHaveAttribute('data-competition-tournament-id', String(targetId))
    await expect(page.getByRole('link', { name: /E2E United/ }).filter({ visible: true })).toBeVisible()
    const shifts = await page.evaluate(async () => {
     await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
     const state = (window as unknown as { __liveLayout: { shifts: Array<{ value: number; startTime: number; hadRecentInput: boolean }>; observer: PerformanceObserver } }).__liveLayout
     state.observer.disconnect()
     return state.shifts.filter(e => !e.hadRecentInput)
    })
    let max = 0, sum = 0, start = 0, previous = -Infinity
    for (const shift of shifts) {
     if (shift.startTime - previous >= 1000 || shift.startTime - start >= 5000) { sum = 0; start = shift.startTime }
     sum += shift.value
     max = Math.max(max, sum)
     previous = shift.startTime
    }
    await testInfo.attach('live-layout-evidence', { contentType: 'application/json', body: JSON.stringify({ width, remembered, targetId, before, after: await page.getByRole('contentinfo').boundingBox(), shifts, cls: max, budget: 0.1, fixtureDelayMs: 650, performanceDistributionEligible: false }) })
    expect(max).toBeLessThanOrEqual(0.1)
    await page.unroute(`**/api/live/competitions/${targetId}/board`)
    let releaseReload!: () => void
    const reloadGate = new Promise<void>(resolve => { releaseReload = resolve })
    let reloadRequested = false
    await page.route(`**/api/live/competitions/${targetId}/board`, async route => {
     reloadRequested = true
     await reloadGate
     await route.continue()
    })
    await page.evaluate(() => window.scrollTo(0, 500))
    await page.reload()
    await expect.poll(() => reloadRequested).toBe(true)
    await page.waitForTimeout(650)
    const reloadBefore = await page.evaluate(() => ({ scrollY, footerTop: document.querySelector('footer')!.getBoundingClientRect().top }))
    expect(reloadBefore.scrollY, 'reload must preserve the scrolled test precondition').toBeGreaterThanOrEqual(490)
    expect(reloadBefore.scrollY).toBeLessThanOrEqual(510)
    releaseReload()
    await expect(page.locator('[data-competition-perf-ready="detail"]')).toHaveAttribute('data-competition-tournament-id', String(targetId))
    const reloadShifts = await page.evaluate(async () => {
     await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
     const state = (window as unknown as { __liveLayout: { shifts: Array<{ value: number; startTime: number; hadRecentInput: boolean }>; observer: PerformanceObserver } }).__liveLayout
     state.observer.disconnect()
     return state.shifts.filter(e => !e.hadRecentInput)
    })
    await testInfo.attach('live-layout-scrolled-reload', { contentType: 'application/json', body: JSON.stringify({ width, remembered, reloadBefore, shifts: reloadShifts }) })
    let reloadMax = 0, reloadSum = 0, reloadStart = 0, reloadPrevious = -Infinity
    for (const shift of reloadShifts) {
     if (shift.startTime - reloadPrevious >= 1000 || shift.startTime - reloadStart >= 5000) { reloadSum = 0; reloadStart = shift.startTime }
     reloadSum += shift.value
     reloadMax = Math.max(reloadMax, reloadSum)
     reloadPrevious = shift.startTime
    }
    expect(reloadMax).toBeLessThanOrEqual(0.1)
   } finally {
    release()
    await fetch(`${fixture}/__performance`, { method: 'POST', body: JSON.stringify({ rules: [] }) })
    await session.cleanup()
   }
  })
 }
}
 for (const width of [1440, 390]) {
  for (const mode of ['preparing', 'h2h', 'retry'] as const) {
   test(`live board layout boundary ${mode} ${width}`, async ({ page }) => {
    test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Isolated fixture')
    const session = await createSession({ entryId: 15702 })
    const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}`
    let release = () => {}
    try {
     await fetch(`${fixture}/__performance`, { method: 'POST', body: JSON.stringify({ rules: [] }) })
     const seed = await (await fetch(`${fixture}/graphql`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'query GetEntryTournaments { entryTournaments { id } }', variables: { entryId: session.entryId } }) })).json()
     const catalog = seed.data.entryTournaments
     const target = { ...catalog[0], id: 7, name: 'Restored boundary league', sourceLeagueName: 'Restored boundary league', ...(mode === 'preparing' ? { standingsReadyAt: null, setupStatus: 'PENDING' } : {}), ...(mode === 'h2h' ? { leagueType: 'H2H', groupMode: 'BATTLE_RACES', rosterMode: 'OFFICIAL_SYNC' } : {}) }
     const h2h = officialH2HFixture(4, 7)
     const rules = [
      { operation: 'GetEntryTournaments', data: { entryTournaments: [...catalog, target] } },
      { operation: 'GetTournamentOfficialH2H', data: { tournamentOfficialH2H: h2h.snapshot } },
      { operation: 'GetLeagueLiveHead', data: { leagueLiveHead: h2h.head } },
     ]
     expect((await fetch(`${fixture}/__performance`, { method: 'POST', body: JSON.stringify({ rules }) })).ok).toBe(true)
     await addSessionCookie(page, session.cookie)
     await page.setViewportSize({ width, height: 900 })
     await page.addInitScript(entryId => localStorage.setItem(`letletme:live-tournament-selection:v1:${entryId}`, '7'), session.entryId)
     if (mode === 'retry') {
      let requests = 0
      const held = new Promise<void>(resolve => { release = resolve })
      await page.route('**/api/live/competitions/7/board', async route => {
       if (++requests === 1) await route.fulfill({ status: 400, json: { error: 'INVALID_FILTER_INPUT' } })
       else { await held; await route.continue() }
      })
      await page.goto('/live/competitions?gw=4')
      const retry = page.getByRole('button', { name: 'Try again', exact: true })
      await expect(retry).toBeVisible()
      await expect(page.getByText('Loading competition standings…', { exact: true })).toHaveCount(0)
      await retry.click()
      await expect.poll(() => requests).toBe(2)
      await expect(retry).toBeDisabled()
      await expect(page.locator('[aria-busy="true"]').filter({ hasText: 'Loading competition standings…' })).toBeVisible()
      release()
      await expect(page.locator('[data-competition-perf-ready="detail"]')).toHaveAttribute('data-competition-tournament-id', '7')
      await expect(retry).toHaveCount(0)
      expect(requests).toBe(2)
     } else {
      await page.goto('/live/competitions?gw=4')
      const terminal = mode === 'preparing' ? page.getByText('Preparing accurate standings', { exact: true }) : page.getByRole('tab', { name: /Head-to-Head table/ })
      await expect(terminal).toBeVisible()
      // Reservation must survive replacing the SSR classic seed with either restored branch.
      const reservation = terminal.locator('xpath=ancestor::div[contains(@class,"min-h-[100svh]")]')
      await expect(reservation).toHaveCount(1)
      expect((await reservation.boundingBox())!.height).toBeGreaterThanOrEqual(900)
      await page.evaluate(() => scrollTo(0, 500))
      await page.reload()
      await expect(terminal).toBeVisible()
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThanOrEqual(490)
      expect((await reservation.boundingBox())!.height).toBeGreaterThanOrEqual(900)
      if (mode === 'preparing') await expect(page.locator('[data-competition-perf-ready]')).toHaveCount(0)
      else await expect(page.locator('[data-competition-perf-ready="detail"]')).toHaveAttribute('data-competition-tournament-id', '7')
     }
    } finally {
     release()
     await fetch(`${fixture}/__performance`, { method: 'POST', body: JSON.stringify({ rules: [] }) })
     await session.cleanup()
    }
   })
  }
 }
})


test.describe('GOV isolated admin REST evidence', () => {
 test.describe.configure({ mode: 'serial' })
 test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_GOVERNANCE !== '1' || process.env.PLATFORM_ADMIN_USER_IDS !== 'e2e-governance-admin' || process.env.PLATFORM_ADMIN_FPL_ENTRY_IDS !== '909090', 'Dedicated isolated governance runtime only')
 const contexts = [
  ...['en', 'zh-CN'].flatMap(locale => [1440, 390].map(width => ({ locale, width, timezone: 'Australia/Perth', theme: 'system', planned: false }))),
  { locale: 'zh-CN', width: 390, timezone: 'UTC', theme: 'dark', planned: true }
 ]
 for (const { locale, width, timezone, theme, planned } of contexts) {
 test.describe(`${locale} ${width} ${timezone} ${theme}`, () => {
  test.use({ timezoneId: timezone, colorScheme: theme === 'dark' ? 'dark' : 'light' })
  test.beforeEach(async ({ page }) => { await page.addInitScript(theme => localStorage.setItem('theme', theme), theme) })
  for (const identity of planned ? ['anonymous'] : ['ordinary', 'entry-only', 'user-only', 'anonymous']) {
   test(`GOV REST sections denied ${identity} ${locale} ${width}px`, async ({ page }, testInfo) => {
    const session = identity === 'anonymous' ? null : await createSession({ entryId: identity === 'entry-only' ? 909090 : undefined, userId: identity === 'user-only' ? 'e2e-governance-admin' : undefined })
    const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
    try {
     expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })).ok).toBe(true)
     await page.setViewportSize({ width, height: 900 })
     if (session) await addSessionCookie(page, session.cookie)
     const homePath = locale === 'zh-CN' ? '/zh-CN' : '/'
     await page.goto(homePath)
     await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
     const path = `${locale === 'zh-CN' ? '/zh-CN' : ''}/admin/data-governance`
     for (const navigate of [() => page.goto(path), () => page.reload()]) {
      const response = await navigate()
      expect(response?.status()).toBe(404)
      await expect(page).toHaveURL(url => url.pathname === path)
      await expect(page.getByRole('heading', { name: locale === 'zh-CN' ? '找不到页面' : 'Page not found', exact: true })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'GW governance', exact: true })).toHaveCount(0)
     }
     expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(timezone)
     expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe(theme)
     await expect(page.locator('html')).toHaveClass(new RegExp(`(?:^|\\s)${theme === 'dark' ? 'dark' : 'light'}(?:\\s|$)`))
     await page.goBack()
     await expect(page).toHaveURL(url => url.pathname === homePath)
     await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
     await page.goForward()
     await expect(page).toHaveURL(url => url.pathname === path)
     await expect(page.getByRole('heading', { name: locale === 'zh-CN' ? '找不到页面' : 'Page not found', exact: true })).toBeVisible()
     const requests = (await (await fetch(fixture)).json()).requests.filter((row: { operation: string }) => row.operation === 'DataGovernance')
     expect(requests).toEqual([])
     await testInfo.attach('GOV-denied-identity', { body: JSON.stringify({ caseId: 'R02', stepIds: ['R02.01', 'R02.02', 'R02.04', 'R02.05'], variantId: identity === 'anonymous' ? (planned ? 'R02.state.03' : `R02.A.${locale}.${width === 1440 ? 'desktop1440' : 'mobile390'}.base`) : null, identity, locale, width, timezone, theme, status: 404, dataRequests: 0, reload: true, backForward: true, readyMs: null, wholeVariantComplete: false }), contentType: 'application/json' })
    } finally { await session?.cleanup() }
   })
  }
  for (const failed of ['none', 'overview', 'windows', 'cases', 'large']) {
   test(`GOV REST sections ${failed} ${locale} ${width}px`, async ({ page }, testInfo) => {
    const session = await createSession({ entryId: 909090, userId: 'e2e-governance-admin' })
    const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
    const paths = { overview: '/ops/data-governance/overview?window=1h', windows: '/ops/data-governance/windows?limit=100&window=1h', cases: '/ops/data-governance/cases?limit=100' }
    const seeds = {
     overview: { success: true, generatedAt: '2026-09-19T00:00:00Z', registry: [{ contractKey: 'fixture-contract', queueName: 'fixture-queue', criticality: 'MET', cadence: 'every minute' }], freshness: { pending: 3, breached: 2, invalid: 1, notApplicable: 4 }, queues: [{ name: 'fixture-queue', counts: { waiting: 7 }, health: { backlogClass: 'HEALTHY', oldestRunnableAgeMs: 3000, drainEtaMs: 4000 } }], queueHealthWindows: [], runtime: { fixtureProducer: { healthy: true, heartbeat: { releaseSha: 'fixture-release-gov' } } }, publicationConsistency: { fixtureRevisionAgreement: true }, errorBudgetBurn: { burnRate: 0.25, breached: 2, eligible: 8 } },
     windows: { success: true, windows: [{ contractKey: 'fixture-window', scopeKey: 'GW5-fixture', status: 'BREACHED', breachCode: 'FIXTURE_LATE', dueAt: '2026-09-19T00:00:00Z' }] },
     cases: { success: true, cases: [{ caseId: 'fixture-case-1746', contractKey: 'fixture-contract', lane: 'fixture', status: 'OPEN', errorCode: 'FIXTURE_CASE', updatedAt: '2026-09-19T00:00:00Z' }], openCount: 1, total: 1 }
    }
    const largeQueues = Array.from({ length: 40 }, (_, index) => ({ name: `fixture-long-queue-${String(index).padStart(2, '0')}-${'segment-'.repeat(12)}`, counts: { waiting: index }, health: { backlogClass: 'HEALTHY', oldestRunnableAgeMs: 3000, drainEtaMs: 4000 } }))
    const queueHistory = largeQueues.flatMap(queue => Array.from({ length: 30 }, (_, index) => ({ queueName: queue.name, windowStart: new Date(Date.UTC(2026, 8, 19, 0, index)).toISOString(), backlogClass: index % 2 ? 'HEALTHY' : 'BURST' }))).reverse()
    if (failed === 'large') {
     seeds.overview.queues = largeQueues
     Object.assign(seeds.overview, { queueHealthWindows: queueHistory })
    }
    try {
     const rules = Object.entries(paths).map(([key, path]) => ({ path, status: key === failed ? 503 : 200, data: key === failed ? { success: false } : seeds[key as keyof typeof seeds] }))
     expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules }) })).ok).toBe(true)
     await page.setViewportSize({ width, height: 900 })
     await addSessionCookie(page, session.cookie)
     const path = `${locale === 'zh-CN' ? '/zh-CN' : ''}/admin/data-governance`
     const homePath = locale === 'zh-CN' ? '/zh-CN' : '/'
     if (failed === 'none') { await page.goto(homePath); await expect(page.getByRole('heading', { level: 1 })).toBeVisible() }
     const response = await page.goto(path)
     expect(response?.status()).toBe(200)
     expect(response?.request().redirectedFrom()).toBeNull()
     await expect(page).toHaveURL(url => url.pathname === path)
     await expect(page.getByRole('heading', { name: 'GW governance', exact: true })).toBeVisible()
     if (failed === 'overview') {
      await expect(page.getByRole('heading', { name: 'Data governance API did not answer', exact: true })).toBeVisible()
      await expect(page.getByText('fixture-release-gov', { exact: true })).toHaveCount(0)
     } else {
      await expect(page.getByText('fixture-release-gov', { exact: true })).toBeVisible()
      await expect(page.getByText('fixtureRevisionAgreement', { exact: true })).toBeVisible()
      await expect(page.getByRole('row').filter({ hasText: 'every minute' })).toContainText('fixture-contract')
      if (failed === 'windows') await expect(page.getByText('freshness window evidence unavailable', { exact: true })).toBeVisible()
      else await expect(page.getByRole('row').filter({ hasText: 'GW5-fixture' })).toContainText('FIXTURE_LATE')
      if (failed === 'cases') await expect(page.getByRole('cell', { name: 'case evidence unavailable', exact: true })).toBeVisible()
      else await expect(page.getByRole('row').filter({ hasText: 'fixture-case-1746' })).toContainText('FIXTURE_CASE')
     }
     if (failed === 'large') {
      const rows = page.getByRole('row').filter({ hasText: 'fixture-long-queue-' })
      await expect(rows).toHaveCount(40)
      for (const queue of largeQueues) {
       const history = page.locator(`[aria-label="${queue.name} queue health history"]`)
       await expect(history.locator('span')).toHaveCount(24)
       const titles = await history.locator('span').evaluateAll(nodes => nodes.map(node => node.getAttribute('title')))
       expect(titles[0]).toContain('BURST')
       expect(titles[0]).toContain('08:06:00')
       expect(titles[23]).toContain('HEALTHY')
       expect(titles[23]).toContain('08:29:00')
      }
      const layout = await page.evaluate(() => ({ viewport: innerWidth, documentWidth: document.documentElement.scrollWidth }))
      await testInfo.attach('GOV-large-layout', { body: JSON.stringify(layout), contentType: 'application/json' })
      expect(layout.documentWidth, 'Long queue names must not overflow the entire page').toBeLessThanOrEqual(layout.viewport + 1)
     }
     const requests = (await (await fetch(fixture)).json()).requests.filter((row: { operation: string }) => row.operation === 'DataGovernance')
     expect(requests.map((row: { path: string }) => row.path).sort()).toEqual(Object.values(paths).sort())
     if (['overview', 'windows', 'cases'].includes(failed)) {
      const restored = Object.entries(paths).map(([key, path]) => ({ path, status: 200, data: seeds[key as keyof typeof seeds] }))
      expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: restored }) })).ok).toBe(true)
      await page.reload()
      await expect(page).toHaveURL(url => url.pathname === path)
      await expect(page.getByText('fixture-release-gov', { exact: true })).toBeVisible()
      await expect(page.getByRole('row').filter({ hasText: 'GW5-fixture' })).toContainText('FIXTURE_LATE')
      await expect(page.getByRole('row').filter({ hasText: 'fixture-case-1746' })).toContainText('FIXTURE_CASE')
      await expect(page.getByText('evidence unavailable', { exact: true })).toHaveCount(0)
      await expect(page.getByRole('cell', { name: 'case evidence unavailable', exact: true })).toHaveCount(0)
      await expect(page.getByText('freshness window evidence unavailable', { exact: true })).toHaveCount(0)
     }
     expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(timezone)
     expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe(theme)
     if (failed === 'none') {
      for (const navigate of [() => page.reload(), async () => {
       await page.goBack()
       await expect(page).toHaveURL(url => url.pathname === homePath)
       await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
       return page.goForward()
      }]) {
       await navigate()
       await expect(page).toHaveURL(url => url.pathname === path)
       await expect(page.getByText('fixture-release-gov', { exact: true })).toBeVisible()
       await expect(page.getByRole('row').filter({ hasText: 'GW5-fixture' })).toContainText('FIXTURE_LATE')
       await expect(page.getByRole('row').filter({ hasText: 'fixture-case-1746' })).toContainText('FIXTURE_CASE')
      }
     }
     if (planned) {
      expect(await page.evaluate(() => ({ width: innerWidth, language: document.documentElement.lang }))).toEqual({ width: 390, language: 'zh-CN' })
      await expect(page.locator('html')).toHaveClass(/dark/)
      await testInfo.attach('GOV-directed-binding', { contentType: 'application/json', body: JSON.stringify({ variantIds: failed === 'none' ? ['GOV01.state.01'] : failed === 'large' ? ['GOV02.state.02'] : ['GOV01.state.02', 'GOV02.state.01'], failed, timezone, theme, locale, width, functionalStatus: 'PASS', performanceStatus: 'NOT_RUN', readyMs: null, wholeVariantComplete: false }) })
     }
     await testInfo.attach('GOV-section-evidence', { body: JSON.stringify({ caseId: 'R02', stepIds: ['R02.01', 'R02.02', 'R02.04', 'R02.05'], variantId: failed === 'none' && !planned ? `R02.PA.${locale}.${width === 1440 ? 'desktop1440' : 'mobile390'}.base` : null, identity: 'platform-admin', locale, width, timezone, theme, failed, backForward: failed === 'none', reloadRecovery: ['overview', 'windows', 'cases'].includes(failed), paths: requests.map((row: { path: string }) => row.path), functionalStatus: 'PASS', performanceStatus: 'NOT_RUN', readyMs: null, eventToPaintMs: null, limitation: 'Overview failure intentionally closes the whole current page. No production or complete variant claim.' }), contentType: 'application/json' })
    } finally {
     try { await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) }) } finally { await session.cleanup() }
    }
   })
  }
 })
 }
})

test.describe('LP02 bound-account squad detail coverage', () => {
 test.use({ timezoneId: 'Australia/Perth' })
 for (const locale of ['en', 'zh-CN'] as const) {
  for (const width of [1440, 390]) {
   test(`LP02 bound squad positions ${locale} ${width}`, async ({ page }, testInfo) => {
    test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Requires isolated identity and data fixture')
    const session = await createSession({ entryId: 15702 })
    const chinese = locale === 'zh-CN'
    try {
     await page.setViewportSize({ width, height: 900 })
     await addSessionCookie(page, session.cookie)
     const auth = await page.request.get('/api/auth/get-session')
     expect(auth.ok()).toBe(true)
     expect((await auth.json()).user.id).toBe(session.userId)
     await page.goto(`/${locale}/live/points/${session.entryId}?gw=33`)
     await expect(page).toHaveURL(new RegExp(`/${locale}/live/points/${session.entryId}\\?gw=33$`))
     await expect(page.locator('[data-live-points-ready="true"]')).toHaveAttribute('data-live-gw', '33')
     const pitch = page.getByRole('region', { name: chinese ? /阵型/ : /formation/ })
     await expect(pitch.getByRole('button', { name: chinese ? /查看 Player/ : /View details for Player/ })).toHaveCount(15)
     await expect(pitch.getByRole('img', { name: chinese ? '队长' : 'Captain', exact: true })).toHaveCount(1)
     await expect(pitch.getByRole('img', { name: chinese ? '副队长' : 'Vice-captain', exact: true })).toHaveCount(1)
     for (const [id, position] of [[1, 'GKP'], [3, 'DEF'], [8, 'MID'], [15, 'FWD']] as const) {
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
     testInfo.annotations.push({ type: 'coverage', description: `LP02.B.${locale}.${width === 1440 ? 'desktop1440' : 'mobile390'}.base; scoped identity/squad/position detail assertions only; chips/autosubs/performance remain separate` })
    } finally {
     await session.cleanup()
    }
   })
  }
 }
})

// R23.03: href assertions alone do not prove the internal legacy entry path.
test.describe('R23 actual internal competition entry', () => {
 test.use({ timezoneId: 'Australia/Perth', colorScheme: 'light' })
 for (const locale of ['en', 'zh-CN'] as const) {
  for (const width of [1440, 390]) {
   test(`home league link commits canonical board ${locale} ${width}px`, async ({ page }) => {
    test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_LIVE_HYDRATION !== '1', 'Requires isolated live fixture and bound session')
    const prefix = locale === 'en' ? '' : '/zh-CN'
    const session = await createSession({ entryId: 15702 })
    try {
     await page.setViewportSize({ width, height: 900 })
     await addSessionCookie(page, session.cookie)
     await page.goto(prefix || '/')
     const main = page.locator('#main-content')
     await expect(main.locator('[data-home-league-ranks-ready]')).toBeVisible()
     await main.getByRole('tab', { name: /H2H|对战联赛/ }).click()
     const link = main.locator(`a[href="${prefix}/live/competitions/6?gw=1"]`).filter({ visible: true })
     await expect(link).toHaveCount(1)
     await link.click()
     const assertBoard = async () => {
      await expect(page).toHaveURL(url => url.pathname === `${prefix}/live/competitions` && url.searchParams.get('tournamentId') === '6' && url.searchParams.get('gw') === '1')
      const board = page.locator('[data-competition-perf-ready="detail"][data-competition-tournament-id="6"][data-competition-gameweek="1"]')
      await expect(board).toBeVisible()
      await expect(board.getByRole('link', { name: 'E2E United Test Manager', exact: true }).filter({ visible: true })).toHaveCount(1)
     }
     await assertBoard()
     await page.reload()
     await assertBoard()
     await page.goBack()
     await expect(page).toHaveURL(url => url.pathname === (prefix || '/'))
     await expect(main.locator('[data-home-personal-ready]')).toBeVisible()
     await page.goForward()
     await assertBoard()
    } finally { await session.cleanup() }
   })
  }
 }
})

test.describe('J10 planned state contexts', () => {
 test.use({ timezoneId: 'UTC', colorScheme: 'dark', viewport: { width: 390, height: 900 } })
 for (const scenario of managerStateScenarios) {
  test(`manager ${scenario}`, async ({ page }, testInfo) => {
   test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Isolated manager fixture only')
   const session = await createSession({ entryId: 15702 })
   const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
   const seed = managerStateReview(scenario)
   const identity = { ...seed.entry!, id: session.entryId! }
   const review = { ...seed, entry: identity, currentGameweek: { ...seed.currentGameweek!, entry: identity } }
   const result = review.currentGameweek.result!
   const expected = scenario === 'BB' ? 64 : scenario === 'TC' ? 70 : 60
   expect(result.picks.reduce((sum, pick) => sum + pick.totalPoints * pick.multiplier, 0)).toBe(expected)
   expect(result.eventNetPoints).toBe(expected)
   expect(result.picks.filter(pick => pick.multiplier > 0)).toHaveLength(scenario === 'BB' ? 15 : 11)
   expect(result.picks.find(pick => pick.isCaptain)?.multiplier).toBe(scenario === 'TC' ? 3 : 2)
   try {
    expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [
     { operation: 'GetMyFplManagerReview', data: { myFplManagerReview: review } },
     { operation: 'GetMyFplManagerGameweek', variables: { eventId: 3 }, data: { myFplManagerGameweek: review.currentGameweek } }
    ] }) })).ok).toBe(true)
    await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
    await addSessionCookie(page, session.cookie)
    await page.goto('/zh-CN')
    const nav = page.getByRole('navigation').first()
    await nav.locator('[data-navigation-mobile] > summary').click()
    const link = nav.locator('a[href="/zh-CN/my-fpl/team"]').filter({ visible: true })
    await expect(link).toHaveCount(1)
    await link.click()
    await expect(page).toHaveURL(url => url.pathname === '/zh-CN/my-fpl/team')
    await page.getByRole('tab', { name: '赛季复盘', exact: true }).click()
    const ready = page.locator('[data-manager-ready]')
    await expect(ready).toHaveAttribute('data-manager-ready', 'true')
    await expect(ready).toHaveAttribute('data-manager-entry', String(session.entryId))
    await expect(ready).toHaveAttribute('data-manager-revision', '103')
    const transfers = page.locator('div.bg-card').filter({ has: page.getByRole('heading', { name: '转会历史', exact: true }) })
    await expect(transfers.locator('[aria-busy]')).toHaveAttribute('aria-busy', 'false')
    if (scenario === 'no-transfers') {
     await expect(transfers.getByText(zhMessages.TeamStats.transferFilterEmpty, { exact: true })).toBeVisible()
     await transfers.getByRole('button', { name: zhMessages.TeamStats.transferShowAllGameweeks, exact: true }).click()
     await expect(transfers.getByRole('button', { name: zhMessages.TeamStats.transferFilterAll, exact: true })).toHaveAttribute('aria-pressed', 'true')
     await expect(transfers.getByText(zhMessages.TeamStats.noTransfer, { exact: true })).toBeVisible()
     await expect(transfers.locator('button[aria-expanded]')).toHaveCount(0)
    } else if (scenario === 'WC' || scenario === 'FH') {
     const opener = transfers.getByRole('button').filter({ hasText: scenario })
     await expect(opener).toHaveCount(1)
     await opener.click()
     const dialog = page.getByRole('dialog')
     await expect(dialog.locator('li')).toHaveCount(2)
     for (const move of [1, 2]) {
      await expect(dialog.getByText(`Incoming 3-${move}`, { exact: true })).toBeVisible()
      await expect(dialog.getByText(`Outgoing 3-${move}`, { exact: true })).toBeVisible()
     }
     await dialog.getByRole('button', { name: '关闭', exact: true }).click()
     await expect(dialog).toHaveCount(0)
     await expect(opener).toBeFocused()
    } else {
     await expect(transfers.getByText('Incoming 3-1', { exact: true })).toBeVisible()
     await expect(transfers.getByText('Outgoing 3-1', { exact: true })).toBeVisible()
    }
    const history = page.locator('div.bg-card').filter({ has: page.getByRole('heading', { name: '轮次历史', exact: true }) })
    await history.getByRole('button', { name: '打开第 3 轮', exact: true }).click()
    await expect(ready).toHaveAttribute('data-manager-view', 'gameweek')
    await expect(ready).toHaveAttribute('data-manager-gw', '3')
    await expect(ready).toHaveAttribute('data-manager-ready', 'true')
    const scoreboard = page.locator('section[aria-labelledby="team-gw-scoreboard-title"]')
    await expect(scoreboard.getByText(String(expected), { exact: true })).toHaveCount(2)
    await expect(scoreboard.getByText(`Saka (${scenario === 'TC' ? 30 : 20})`, { exact: true })).toBeVisible()
    const chipKey = ({ ready: 'chipNone', WC: 'wildcard', FH: 'freeHit', BB: 'benchBoost', TC: 'tripleCaptain', 'no-transfers': 'chipNone' } as const)[scenario]
    await expect(scoreboard.getByText(zhMessages.TeamStats[chipKey], { exact: true })).toBeVisible()
    const transferMetric = scoreboard.getByText(zhMessages.TeamStats.gameweekTransfers, { exact: true }).locator('..').locator('p').nth(1)
    await expect(transferMetric).toHaveText(String(scenario === 'no-transfers' ? 0 : 2))
    await expect(page.locator('html')).toHaveClass(/dark/)
    expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('UTC')
    await testInfo.attach('J10-planned-state', { body: JSON.stringify({ variantId: `J10.state.0${managerStateScenarios.indexOf(scenario) + 1}`, scenario, identity: 'B', locale: 'zh-CN', viewport: page.viewportSize(), timezone: 'UTC', theme: 'dark', eventId: 3, revision: '103', expectedPoints: expected, functionalScope: 'Homepage menu to season review and selected GW3 scoreboard; fixture multiplier arithmetic', wholeJourneyPass: false, performanceStatus: 'NOT_RUN', readyMs: null }), contentType: 'application/json' })
   } finally {
    await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
    await session.cleanup()
   }
  })
 }
})

// R32 route assertions complement J14's actual account-menu journey.
test.describe('R32 bound and unbound route baselines', () => {
 test.use({ timezoneId: 'Australia/Perth', colorScheme: 'light' })
 for (const locale of ['en', 'zh-CN'] as const) for (const width of [1440, 390]) for (const identity of ['U', 'B'] as const) {
  test(`R32 profile direct reload history ${identity} ${locale} ${width}`, async ({ page }, testInfo) => {
   test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Isolated account and FPL fetch fixture only')
   const session = await createSession(identity === 'B' ? { entryId: 15702 } : {})
   const sql = postgres(process.env.E2E_DIRECT_DATABASE_URL!, { max: 1, prepare: false })
   const prefix = locale === 'en' ? '' : '/zh-CN'
   const path = `${prefix}/profile`
   const start = `${prefix}/explore/gameweek`
   const labels = (locale === 'en' ? enMessages : zhMessages).Profile
   const writes: string[] = []
   const pageErrors: string[] = []
   page.on('pageerror', error => pageErrors.push(error.message))
   page.on('request', request => {
    const pathname = new URL(request.url()).pathname
    if (request.headers()['next-action'] || (request.method() !== 'GET' && /^\/api\/(auth|profile\/avatar|fpl\/bind)/.test(pathname))) writes.push(pathname)
   })
   try {
    await page.addInitScript(() => localStorage.setItem('theme', 'system'))
    await page.setViewportSize({ width, height: 900 })
    await addSessionCookie(page, session.cookie)
    await page.goto(start)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const main = page.locator('#main-content')
    const assertProfile = async () => {
     await expect(page).toHaveURL(url => url.pathname === path)
     await expect(main.getByRole('heading', { name: labels.title, exact: true })).toBeVisible()
     await expect(main.getByRole('heading', { name: 'E2E Manager', exact: true })).toBeVisible()
     if (identity === 'B') {
      await expect(main).toContainText('E2E Synced United')
      await expect(main).toContainText('Fixture Manager')
      await expect(main.getByText('· E2E United', { exact: true })).toBeVisible()
      await expect(main.getByRole('button', { name: locale === 'en' ? 'Unlink' : '解除关联', exact: true })).toBeEnabled()
     } else {
      await expect(main.locator('input[name="entryId"]')).toBeVisible()
      await expect(main.getByText(labels.noPreviousTeamNames, { exact: true })).toBeVisible()
      await expect(main).not.toContainText('E2E Synced United')
      await expect(main.getByRole('button', { name: locale === 'en' ? 'Unlink' : '解除关联', exact: true })).toHaveCount(0)
     }
    }
    const statuses: number[] = []
    for (const navigate of [() => page.goto(path), () => page.reload()]) {
     const response = await navigate()
     expect(response?.status()).toBe(200)
     expect(response?.request().redirectedFrom()).toBeNull()
     statuses.push(response!.status())
     await assertProfile()
    }
    await page.goBack()
    await expect(page).toHaveURL(url => url.pathname === start)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.goForward()
    await assertProfile()
    expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('Australia/Perth')
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('system')
    await expect(page.locator('html')).toHaveClass(/\blight\b/)
    const [stored] = await sql`SELECT fpl_entry_id, fpl_entry_verified_at FROM bauth."user" WHERE id=${session.userId}`
    expect(stored.fpl_entry_id).toBe(session.entryId)
    expect(Boolean(stored.fpl_entry_verified_at)).toBe(identity === 'B')
    expect(writes).toEqual([])
    expect(pageErrors).toEqual([])
    await testInfo.attach('R32-route-context', { contentType: 'application/json', body: JSON.stringify({ caseId: 'R32', variantId: `R32.${identity}.${locale}.${width === 1440 ? 'desktop1440' : 'mobile390'}.base`, stepIds: ['R32.01', 'R32.02', 'R32.04', 'R32.05'], identity, locale, viewport: { width, height: 900 }, theme: 'system', timezone: 'Australia/Perth', statuses, pageErrors, entryId: session.entryId, backForward: true, readyMs: null, performanceStatus: 'NOT_OBSERVED', wholeVariantComplete: false }) })
   } finally {
    await sql`DELETE FROM bauth.fpl_entry_name_history WHERE user_id=${session.userId}`
    await sql.end()
    await session.cleanup()
   }
  })
 }
})
for (const variant of [
 ...['en', 'zh-CN'].flatMap(locale => [1440, 390].map(width => ({ id: `HOME01.A.${locale}.${width === 390 ? 'mobile390' : 'desktop1440'}.base`, locale, width, theme: 'system', timezone: 'Australia/Perth' }))),
 { id: 'HOME01.state.01', locale: 'zh-CN', width: 390, theme: 'dark', timezone: 'UTC' }
]) {
 test.describe(`HOME01 anonymous context ${variant.id}`, () => {
  test.use({ locale: variant.locale, viewport: { width: variant.width, height: 900 }, timezoneId: variant.timezone, colorScheme: variant.theme === 'dark' ? 'dark' : 'light' })
  test('SSR remediation anonymous public regions do not start personal reads', async ({ page, context }, testInfo) => {
   test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Isolated fixture only')
   const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
   await page.addInitScript(theme => localStorage.setItem('theme', theme), variant.theme)
   expect((await context.cookies()).filter(cookie => /session/i.test(cookie.name))).toHaveLength(0)
   try {
    expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [{ operation: 'GetHomePersonalDesk', delayMs: 3500 }] }) })).ok).toBe(true)
    const zh = variant.locale === 'zh-CN'
    await page.goto(zh ? '/zh-CN' : '/')
    await expect(page.locator('html')).toHaveClass(variant.theme === 'dark' ? /dark/ : /light/)
    expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(variant.timezone)
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe(variant.theme)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('region', { name: zh ? '本轮表现' : 'Matchday performance', exact: true })).toContainText('101')
    await expect(page.getByRole('region', { name: zh ? '市场看板' : 'Market desk', exact: true })).toContainText('Saka')
    const matches = page.locator('[data-home-matches]')
    await expect(matches).toHaveAttribute('data-home-fixtures-event', '33')
    await expect(matches).toContainText('ARS')
    await matches.getByRole('button', { name: zh ? '下一轮' : 'Next gameweek', exact: true }).click()
    await expect(matches).toHaveAttribute('data-home-fixtures-event', '34')
    await expect(page.locator('[data-home-personal-ready]')).toHaveCount(0)
    const personal = (await (await fetch(fixture)).json()).requests.filter((row: { operation: string }) => row.operation === 'GetHomePersonalDesk')
    expect(personal).toEqual([])
    await testInfo.attach('HOME01-anonymous-context', { contentType: 'application/json', body: JSON.stringify({ ...variant, identity: 'A', personalRequests: 0, committedGW: 34, assertions: ['hero/stats/market/fixtures present', 'actual nextGW click', 'no personal desk or request'], slowPersonalBranch: 'N/A for anonymous identity', readyMs: null, performanceStatus: 'NOT_RUN' }) })
   } finally { await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) }) }
  })
 })
}

for (const scenario of ['baseline', 'ready', 'unavailable'] as const) {
 for (const locale of scenario === 'baseline' ? ['en', 'zh-CN'] as const : ['zh-CN'] as const) {
  for (const width of scenario === 'baseline' ? [1440, 390] : [390]) {
   test.describe(`HOME03 planned ${scenario} ${locale} ${width}`, () => {
    const timezone = scenario === 'baseline' ? 'Australia/Perth' : 'UTC'
    const theme = scenario === 'baseline' ? 'system' : 'dark'
    test.use({ viewport: { width, height: 900 }, timezoneId: timezone, colorScheme: theme === 'dark' ? 'dark' : 'light' })
    test('SSR remediation binds personal league types and unavailable recovery', async ({ page }, testInfo) => {
     test.skip(process.env.E2E_SSR_REMEDIATION !== '1', 'Uses isolated fixture controls')
     const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
     const session = await createSession({ entryId: 15702 })
     const zh = locale === 'zh-CN'
     const homeUrl = zh ? '/zh-CN' : '/en'
     const homeOperations: string[] = []
     page.on('request', request => { if (request.url().includes('/api/graphql')) homeOperations.push(request.postData() ?? '') })
     const variantId = scenario === 'baseline' ? `HOME03.B.${locale}.${width === 390 ? 'mobile390' : 'desktop1440'}.base` : `HOME03.state.${scenario === 'ready' ? '01' : '02'}`
     try {
      expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })).ok).toBe(true)
      const seed = await (await fetch(fixture.replace('/__performance', '/graphql'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'query GetHomePersonalDesk { __typename }' }) })).json()
      expect(seed.errors).toBeUndefined()
      const desk = seed.data.homePersonalDesk
      desk.rankState = 'READY'
      desk.leagueRanks.forEach((row: { rankState: string }) => { row.rankState = 'READY' })

	const phase = { phaseId: 'points-1', format: 'POINTS', startEventId: 1, endEventId: 4, state: 'READY', revision: '1', semanticSha256: 'a'.repeat(64), settledAt: '2026-09-15T00:00:00Z', publishedAt: '2026-09-15T01:00:00Z', correctedAt: null }
	const points = {
		headlineMetric: 'GROSS_POINTS', grossPointsTotal: 75, grossPointsAverage: 75, netPointsTotal: 71,
		seasonGrossPointsTotal: 300, seasonGrossPointsAverage: 300, seasonNetPointsTotal: 296,
		nextCursor: null, hasNextPage: false,
		rows: [{ entryId: 123, entryName: 'Season Fixture United', playerName: 'Fixture Manager', applicable: true, groupId: null, rank: 1, previousRank: 2, grossPoints: 75, transferCost: 4, netPoints: 71, tournamentScore: 300, seasonGrossPoints: 300, seasonNetPoints: 296, eventRank: 1, overallPoints: 300, overallRank: 100 }]
	}
	const pageInfo = { hasNextPage: false, endCursor: null }
	const scope = { ...phase, tournamentId: 77, eventId: 4, rowCount: 1, expectedSubjectCount: 1, readySubjectCount: 1, notApplicableSubjectCount: 0 }
	const reviewRules = [
		{ operation: 'GetMyTournamentReviewCatalog', data: { myTournamentReviewCatalog: { state: 'READY', asOf: phase.publishedAt, viewerEntryId: 123, adminReadAll: false, pageInfo, edges: [{ cursor: '77', node: { tournamentId: 77, name: 'Fixture Review Cup', creator: 'Fixture', leagueId: 77, leagueType: 'CLASSIC', totalTeamNum: 1, latestFinalizedEventId: 4, previousReadyEventId: 3, setupStatus: 'READY', latestFinalizedScope: { ...scope, repairState: 'NONE' }, phaseSummaries: [phase], state: 'READY' } }] } } },
		{ operation: 'GetMyTournamentSeasonReview', data: { myTournamentSeasonReview: { state: 'READY', tournamentId: 77, throughEventId: 4, latestFinalizedEventId: 4, phases: [phase] } } },
		{ operation: 'GetMyTournamentGameweekReview', data: { myTournamentGameweekReview: { state: 'READY', scope, payload: { format: 'POINTS', points } } } },
		...['POINTS_STANDINGS', 'POINTS_TRAJECTORIES'].map(section => ({ operation: 'GetMyTournamentSeasonReviewPointsSection', variables: { section }, data: { myTournamentSeasonReviewSection: { ...phase, tournamentId: 77, throughEventId: 4, section, points, h2h: null, knockout: null, pageInfo } } }))
	]

      const install = async (unavailable: boolean) => {
       expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [{ operation: 'GetHomePersonalDesk', data: { homePersonalDesk: unavailable ? { ...desk, state: 'UNAVAILABLE', leagueRanks: [] } : desk } }, ...reviewRules] }) })).ok).toBe(true)
      }
      await install(scenario === 'unavailable')
      await page.addInitScript(value => localStorage.setItem('theme', value), theme)
      await addSessionCookie(page, session.cookie)
      await page.goto(zh ? '/zh-CN' : '/en')
      expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(timezone)
      expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe(theme)
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /light/)
      if (scenario === 'unavailable') {
       await expect(page.locator('#main-content [data-home-personal-ready="unavailable"]')).toBeVisible()
       await expect(page.getByText(zh ? '球队数据暂时无法加载。' : 'Team data is temporarily unavailable.', { exact: true })).toBeVisible()
       await expect(page.locator('#main-content [data-home-carousel="personal-league"]')).toHaveCount(0)
       await install(false)
       await page.reload()
      }
      await expect(page.locator('#main-content [data-home-personal-ready]')).toBeVisible()
      const carousel = page.locator('#main-content [data-home-carousel="personal-league"]')
      const classic = carousel.getByRole('tab', { name: zh ? /积分联赛/ : /Classic/ })
      const h2h = carousel.getByRole('tab', { name: zh ? /对战联赛/ : /H2H/ })
      await expect(classic).toHaveAttribute('aria-selected', 'true')
      await expect(carousel.getByText('E2E Classic', { exact: true })).toBeVisible()
      const custom = carousel.getByRole('link', { name: /E2E League 2/ })
      const customHref = await custom.getAttribute('href')
      expect(customHref).toContain('tournamentId=77')
      await h2h.click()
      await expect(h2h).toHaveAttribute('aria-selected', 'true')
      const matchup = carousel.locator('[data-home-h2h-matchup="2071743"]')
      await expect(matchup.getByText('24', { exact: true })).toBeVisible()
      await expect(matchup.getByText('43', { exact: true })).toBeVisible()
      const h2hHref = await carousel.getByRole('link', { name: /E2E H2H/ }).getAttribute('href')
      expect(h2hHref).toMatch(/\/live\/competitions\/6\?gw=1$/)
      await classic.click()
      await expect(classic).toHaveAttribute('aria-selected', 'true')
      await expect(custom).toBeVisible()
      await expect(carousel.getByText('E2E Classic', { exact: true }).locator('xpath=ancestor::li[1]').locator('a')).toHaveCount(0)
      expect(homeOperations.some(operation => operation.includes('tournamentOfficialH2H'))).toBe(false)
      await h2h.click()
      await carousel.getByRole('link', { name: /E2E H2H/ }).click()
      await expect(page).toHaveURL(url => url.pathname === `${zh ? '/zh-CN' : ''}/live/competitions` && url.searchParams.get('tournamentId') === '6' && url.searchParams.get('gw') === '1')
      const board = page.locator('[data-competition-perf-ready="detail"][data-competition-tournament-id="6"][data-competition-gameweek="1"]')
      await expect(board).toBeVisible()
      await expect(board.getByRole('link', { name: 'E2E United Test Manager' }).filter({ visible: true })).toHaveCount(1)
      await page.goBack()
      await expect(page).toHaveURL(url => url.pathname === homeUrl)
      await expect(page.locator('#main-content [data-home-personal-ready="true"]')).toBeVisible()
      await expect(carousel).toBeVisible()
      await carousel.getByRole('tab', { name: zh ? /积分联赛/ : /Classic/ }).click()
      await custom.click()
      const assertCustomReview = async () => {
       await expect(page).toHaveURL(url => url.pathname === `${zh ? '/zh-CN' : ''}/my-fpl/competitions` && url.searchParams.get('tournamentId') === '77' && url.searchParams.get('view') === null)
       const ready = page.locator('[data-review-ready="true"]')
       await expect(ready).toHaveAttribute('data-review-tournament', '77')
       await expect(ready).toHaveAttribute('data-review-view', 'season')
       await expect(ready).toHaveAttribute('data-review-gw', '4')
       await expect(ready).toHaveAttribute('data-review-revision', '1')
       await expect(page.getByRole('cell', { name: /Season Fixture United/ })).toBeVisible()
       await expect(page.getByRole('row').filter({ has: page.getByRole('cell', { name: /Season Fixture United/ }) }).getByRole('cell', { name: '300', exact: true })).toHaveCount(2)
      }
      await assertCustomReview()
      await page.goBack()
      await expect(page).toHaveURL(url => url.pathname === homeUrl)
      await expect(page.locator('#main-content [data-home-personal-ready="true"]')).toBeVisible()
      await page.goForward()
      await assertCustomReview()
      await testInfo.attach('HOME03-planned-context', { contentType: 'application/json', body: JSON.stringify({ variantId, caseId: 'HOME03', stepIds: ['HOME03.01', 'HOME03.02'], locale, viewport: page.viewportSize(), timezone, theme, scenario, identity: 'B', leagueCount: desk.leagueRanks.length, customHref, h2hHref, unavailableRecovery: scenario === 'unavailable', scope: 'Classic non-navigable row; actual H2H navigation tournament6/GW1 and Back; actual custom tournament77 season review with 300 points and Back/Forward; no home H2H polling; unavailable desk recovery. Performance remains unverified.', wholeCaseComplete: false, wholeVariantComplete: false, readyMs: null, performanceStatus: 'NOT_RUN' }) })
     } finally {
      await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
      await session.cleanup()
     }
    })
   })
  }
 }
}

test.describe('FIX04 planned unavailable and unbound', () => {
 test.use({ viewport: { width: 390, height: 900 }, timezoneId: 'UTC', colorScheme: 'dark' })
 for (const scenario of ['unbound', 'unavailable'] as const) {
  test(`FIX04 ${scenario} preserves public fixtures and recovers only the personal region`, async ({ page }) => {
   test.skip(process.env.E2E_SSR_REMEDIATION !== '1', 'Requires isolated fixture-control runtime')
   const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
   const session = await createSession(scenario === 'unbound' ? {} : { entryId: 15702 })
   try {
    await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
    await addSessionCookie(page, session.cookie)
    expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: scenario === 'unavailable' ? [{ operation: 'GetEntryHistory', error: true }, { operation: 'GetEntryEventResult', error: true }] : [] }) })).ok).toBe(true)
    await page.goto('/zh-CN/explore/fixtures#my-squad')
    const squad = page.locator('#my-squad')
    await expect(squad).toHaveAttribute('open', '')
    await expect(page.locator('html')).toHaveClass(/dark/)
    expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('UTC')
    const matrix = page.getByRole('region', { name: '球队 FDR', exact: true })
    await expect(matrix.locator('tbody tr')).toHaveCount(3)
    if (scenario === 'unbound') {
     await expect(squad.getByRole('link', { name: zhMessages.Fixtures.actionsBindCta, exact: true })).toHaveAttribute('href', '/zh-CN/onboarding/bind-entry')
     await expect(squad.getByRole('button', { name: /^查看 Player/ })).toHaveCount(0)
     const observations = await (await fetch(fixture)).json()
     expect(observations.requests.filter((r: { operation: string }) => ['GetEntryHistory', 'GetEntryEventResult'].includes(r.operation))).toHaveLength(0)
    } else {
     await expect(squad.getByRole('alert')).toHaveText(zhMessages.Fixtures.mySquadLoadFailed)
     await expect(squad.getByRole('button', { name: /^查看 Player/ })).toHaveCount(0)
     expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })).ok).toBe(true)
     await squad.getByRole('button', { name: zhMessages.Fixtures.squadRetry, exact: true }).click()
     await expect(squad.getByRole('button', { name: /^查看 Player 1 的赛程详情/ })).toBeVisible()
     await expect(squad.getByRole('alert')).toHaveCount(0)
     await expect(matrix.locator('tbody tr')).toHaveCount(3)
    }
   } finally {
    await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
    await session.cleanup()
   }
  })
 }
})


test.describe('HOME01 anonymous public partial failure', () => {
 test.use({ locale: 'zh-CN', viewport: { width: 390, height: 900 }, timezoneId: 'UTC', colorScheme: 'dark' })
 test('SSR remediation HOME01.state.02 preserves other public regions during fixture failure and recovery', async ({ page, context }, testInfo) => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Isolated fixture only')
  const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
  const control = async (failed: boolean) => {
   expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: failed ? [{ operation: 'GetHomeEventFixtures', variables: { eventId: 34 }, error: true }] : [] }) })).ok).toBe(true)
  }
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
  expect((await context.cookies()).filter(cookie => /session/i.test(cookie.name))).toHaveLength(0)
  try {
   await control(true)
   await page.goto('/zh-CN')
   await expect(page.locator('html')).toHaveClass(/dark/)
   expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('UTC')
   const matches = page.locator('#main-content [data-home-matches]')
   const assertPublic = async () => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('region', { name: '本轮表现', exact: true })).toContainText('101')
    await expect(page.getByRole('region', { name: '市场看板', exact: true })).toContainText('Saka')
    await expect(page.locator('[data-home-personal-ready]')).toHaveCount(0)
   }
   await expect(matches).toHaveAttribute('data-home-fixtures-event', '33')
   await assertPublic()
   await matches.getByRole('button', { name: '下一轮', exact: true }).click()
   await expect(matches.getByRole('alert')).toBeVisible()
   await expect(matches).toHaveAttribute('data-home-fixtures-event', '33')
   await expect(matches).toContainText('ARS')
   await assertPublic()
   const failedReads = (await (await fetch(fixture)).json()).requests
   expect(failedReads.some((row: { operation: string; variables: { eventId?: number } }) => row.operation === 'GetHomeEventFixtures' && row.variables.eventId === 34)).toBe(true)
   expect(failedReads.filter((row: { operation: string }) => row.operation === 'GetHomePersonalDesk')).toHaveLength(0)
   await control(false)
   await matches.getByRole('button', { name: '下一轮', exact: true }).click()
   await expect(matches).toHaveAttribute('data-home-fixtures-event', '34')
   await expect(matches.getByRole('alert')).toHaveCount(0)
   await assertPublic()
   await testInfo.attach('HOME01-state02-public-partial', { contentType: 'application/json', body: JSON.stringify({ variantId: 'HOME01.state.02', identity: 'A', locale: 'zh-CN', width: 390, theme: 'dark', timezone: 'UTC', failedEvent: 34, retainedEvent: 33, recoveredEvent: 34, personalRequests: 0, readyMs: null, performanceStatus: 'N/A', scope: 'Public fixture switch failure preserves other regions; personal failure branch inapplicable to anonymous identity' }) })
  } finally { await control(false) }
 })
})


// Original LP03 variants; real isolated bound sessions, no production mutation.
for (const scenario of ['baseline', 'empty', 'error', '401'] as const) {
 const contexts = scenario === 'baseline'
  ? [{ locale: 'en', width: 1440 }, { locale: 'en', width: 390 }, { locale: 'zh-CN', width: 1440 }, { locale: 'zh-CN', width: 390 }]
  : [{ locale: 'zh-CN', width: 390 }]
 for (const { locale, width } of contexts) {
  const stateIndex = { empty: '01', error: '02', '401': '03' }[scenario as 'empty' | 'error' | '401']
  const variantId = scenario === 'baseline' ? `LP03.B.${locale}.${width === 390 ? 'mobile390' : 'desktop1440'}.base` : `LP03.state.${stateIndex}`
  test.describe(`LP03 bound context ${variantId}`, () => {
   test.use({ viewport: { width, height: 900 }, timezoneId: scenario === 'baseline' ? 'Australia/Perth' : 'UTC', colorScheme: scenario === 'baseline' ? 'light' : 'dark' })
   test('transfer terminal and explicit recovery preserve bound identity', async ({ page }, testInfo) => {
    test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Isolated bound-session fixtures only')
    const session = await createSession({ entryId: 15702 })
    const sql = postgres(process.env.E2E_DIRECT_DATABASE_URL!, { max: 1, prepare: false })
    const chinese = locale === 'zh-CN'
    let inject = false
    let recovered = false
    let reads = 0
    const liveFixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/graphql`
    try {
     await addSessionCookie(page, session.cookie)
     if (scenario === 'error') await page.clock.install()
     await page.addInitScript(theme => localStorage.setItem('theme', theme), scenario === 'baseline' ? 'system' : 'dark')
     const auth = await page.request.get('/api/auth/get-session')
     expect(auth.ok()).toBe(true)
     expect((await auth.json()).user.id).toBe(session.userId)
     const [identity] = await sql`SELECT fpl_entry_id, fpl_entry_verified_at FROM bauth."user" WHERE id=${session.userId}`
     expect(identity.fpl_entry_id).toBe(session.entryId)
     expect(identity.fpl_entry_verified_at).not.toBeNull()
     await page.route('**/api/graphql', async route => {
      const payload = route.request().postDataJSON() as { query?: string; variables?: { entryId?: number } }
      if (!payload.query?.includes('GetEntryTransferHistory')) { await route.continue({ url: liveFixture }); return }
      if (!inject) { await route.fulfill({ json: { data: { entryTransferHistory: [] } } }); return }
      reads += 1
      expect(payload.variables?.entryId).toBe(session.entryId)
      if (!recovered && (scenario === 'error' || scenario === '401')) {
       await route.fulfill({ status: scenario === '401' ? 401 : 503, json: { errors: [{ message: 'Controlled transfer failure', extensions: { code: scenario === '401' ? 'UNAUTHENTICATED' : 'SERVICE_UNAVAILABLE' } }] } })
       return
      }
      await route.fulfill({ json: { data: { entryTransferHistory: scenario === 'empty' || recovered ? [] : [{ eventId: 33, transfers: [{ event: 33, elementOutWebName: 'Bound Out', elementOutTeamShortName: 'OUT', elementOutTypeName: 'MID', elementOutCost: 5.5, elementInWebName: 'Bound In', elementInTeamShortName: 'IN', elementInTypeName: 'MID', elementInCost: 6.2, time: '2026-08-04T10:00:00Z' }] }] } } })
     })
     await page.goto(`/${locale}/live/points/${session.entryId}?gw=33&tournamentId=3`)
     const ready = page.locator('[data-live-points-ready="true"]')
     await expect(ready).toHaveAttribute('data-live-entry', String(session.entryId))
     await expect(ready).toHaveAttribute('data-live-gw', '33')
     const section = page.getByRole('region', { name: chinese ? /本周转会\s*GW33/ : /Gameweek transfers\s*GW33/ })
     const refresh = section.getByRole('button', { name: chinese ? '刷新转会' : 'Refresh transfers', exact: true })
     await expect(refresh).toBeEnabled()
     expect(await page.evaluate(() => ({ width: innerWidth, locale: document.documentElement.lang, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }))).toEqual({ width, locale, timezone: scenario === 'baseline' ? 'Australia/Perth' : 'UTC' })
     if (scenario !== 'baseline') await expect(page.locator('html')).toHaveClass(/dark/)
     inject = true
     await refresh.click()
     if (scenario === 'error' || scenario === '401') {
      await expect(section.getByRole('alert')).toBeVisible()
      await expect(section).not.toContainText(chinese ? '本轮暂无已同步的转会记录。' : 'No synced transfer records')
      await expect(section.getByRole('link')).toHaveCount(0)
      await expect(ready).toHaveAttribute('data-live-gw', '33')
      expect(reads).toBe(1)
      recovered = true
      await refresh.click()
      if (scenario === 'error') {
       // A 503 activates the existing 30-second dependency fence.
       await expect(section.getByRole('alert')).toBeVisible()
       expect(reads).toBe(1)
       await page.clock.fastForward(30_000)
       await refresh.click()
      }
     }
     if (scenario === 'baseline') {
      await expect(section).toContainText('Bound In')
      await expect(section).toContainText('Bound Out')
      await expect(section).toContainText('£5.5m')
      await expect(section).toContainText('£6.2m')
     } else await expect(section).toContainText(chinese ? '本轮暂无已同步的转会记录。' : 'No synced transfer records for this gameweek.')
     await expect(section.getByRole('alert')).toHaveCount(0)
     await expect(section.getByRole('status')).toHaveCount(0)
     await expect(refresh).toBeEnabled()
     expect(reads).toBe(scenario === 'error' || scenario === '401' ? 2 : 1)
     const finalAuth = await page.request.get('/api/auth/get-session')
     expect((await finalAuth.json()).user.id).toBe(session.userId)
     expect(new URL(page.url()).pathname).toBe(`/${locale}/live/points/${session.entryId}`)
     expect(new URL(page.url()).searchParams.get('gw')).toBe('33')
     await testInfo.attach(variantId, { contentType: 'application/json', body: JSON.stringify({ variantId, persona: 'B', locale, width, theme: scenario === 'baseline' ? 'system' : 'dark', timezone: scenario === 'baseline' ? 'Australia/Perth' : 'UTC', scenario, authenticatedBeforeAndAfter: true, verifiedBinding: true, reads, functionalStatus: 'PASS', performanceStatus: 'NOT_RUN', readyMs: null, scope: 'Transfer records or confirmed empty, failure distinct from empty, explicit recovery with unchanged bound session; removed reauthorization link is not applicable to public transfer contract.' }) })
    } finally { await sql.end(); await session.cleanup() }
   })
  })
 }
}

for (const large of [false, true]) {
test.describe(`LC02 planned state ${large ? 'large' : 'empty'} canonical board`, () => {
 test.use({ locale: 'zh-CN', viewport: { width: 390, height: 900 }, timezoneId: 'UTC', colorScheme: 'dark' })
 test('retains the requested identity without fabricated standings', async ({ page }, testInfo) => {
  test.skip(process.env.E2E_SSR_REMEDIATION !== '1', 'Requires isolated board fixtures')
  const session = await createSession({ entryId: 123 })
  const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
  let boardRequests = 0
  const variantId = large ? 'LC02.state.01' : 'LC02.state.02'
  const cursors: Array<string | null> = []
  try {
   const seed = await (await fetch(fixture.replace('/__performance', '/graphql'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'query GetLiveContext { __typename }' }) })).json()
   expect(seed.errors).toBeUndefined()
   Object.assign(seed.data.coreEventContext, { currentEventId: 4, nextEventId: 5, latestFinishedEventId: 3 })
   Object.assign(seed.data.liveContext, { eventId: 4, nextEventId: 5, anchorEventId: 4, latestFinalizedEventId: 3 })
   expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [
    { operation: 'GetLiveContext', data: seed.data },
    { operation: 'GetEntryTournaments', data: { entryTournaments: [{ ...managedTournament, id: 6, name: 'Empty Coverage League', adminEntryId: 15702 }] } }
   ] }) })).ok).toBe(true)
   await addSessionCookie(page, session.cookie)
   await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
   await page.route('**/api/live/competitions/6/board', async route => {
    expect(route.request().postDataJSON().eventId).toBe(4)
    boardRequests++
    const response = await route.fetch()
    expect(response.ok()).toBe(true)
    const body = await response.json()
    const board = body.entryLiveCompetitionBoard
    const cursor = route.request().postDataJSON().input?.after ?? null
    cursors.push(cursor)
    const offset = cursor === null ? 0 : Number(cursor.replace('coverage-offset-', ''))
    expect([0, 50, 100]).toContain(offset)
    const template = board.rows[0]
    const allRows = Array.from({ length: large ? 125 : 0 }, (_, index) => ({ ...template, entry: 15702 + index, entryName: `Coverage ${String(index + 1).padStart(3, '0')}`, score: { ...template.score, eventPoints: 200 - index, totalPoints: 1000 - index } }))
    board.rows = allRows.slice(offset, offset + 50)
    board.viewerRow = null
    board.totalEntries = allRows.length
    board.filteredEntries = allRows.length
    board.pageInfo = { hasNextPage: large && offset < 100, endCursor: large && offset < 100 ? `coverage-offset-${offset + 50}` : null }
    await route.fulfill({ response, json: body })
   })
   await page.goto('/zh-CN/live/competitions?tournamentId=6&gw=4')
   const ready = page.locator('[data-competition-perf-ready="detail"]')
   await expect(ready).toHaveAttribute('data-competition-tournament-id', '6')
   await expect(ready).toHaveAttribute('data-competition-gameweek', '4')
   await expect(page.locator('html')).toHaveClass(/dark/)
   expect(await page.evaluate(() => ({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, theme: localStorage.getItem('theme'), language: navigator.language, width: innerWidth }))).toEqual({ timezone: 'UTC', theme: 'dark', language: 'zh-CN', width: 390 })
   if (large) {
    const teams = ready.getByRole('link', { name: /Coverage \d{3}/ }).filter({ visible: true })
    await expect(teams).toHaveCount(50)
    await page.getByRole('button', { name: '对比', exact: true }).click()
    const first = page.getByRole('checkbox', { name: '选择 Coverage 001 进行对比', exact: true }).filter({ visible: true })
    await first.check()
    await page.getByRole('button', { name: /再显示/ }).click()
    await expect(teams).toHaveCount(100)
    await expect(first).toBeChecked()
    await page.getByRole('button', { name: /再显示/ }).click()
    await expect(teams).toHaveCount(125)
    await expect(first).toBeChecked()
    const names = await teams.allTextContents()
    expect(names.map(name => name.match(/Coverage \d{3}/)?.[0])).toEqual(Array.from({ length: 125 }, (_, i) => `Coverage ${String(i + 1).padStart(3, '0')}`))
    const hrefs = await teams.evaluateAll(links => links.map(link => link.getAttribute('href')))
    expect(new Set(hrefs).size).toBe(125)
    expect(cursors).toEqual([null, 'coverage-offset-50', 'coverage-offset-100'])
    await page.getByRole('checkbox', { name: '选择 Coverage 125 进行对比', exact: true }).filter({ visible: true }).check()
    await expect(page.getByRole('button', { name: '对比（2）', exact: true })).toBeEnabled()
    await page.getByRole('button', { name: '取消', exact: true }).click()
   } else {
    await expect(page.getByText('没有球队符合搜索条件。', { exact: true }).filter({ visible: true })).toBeVisible()
    await expect(ready.locator('a[href*="/live/points/"]').filter({ visible: true })).toHaveCount(0)
   }
   await expect(page.getByRole('button', { name: /再显示|显示全部|收起/ }).filter({ visible: true })).toHaveCount(0)
   expect(boardRequests).toBeGreaterThan(0)
   await testInfo.attach(`${variantId}-context`, { contentType: 'application/json', body: JSON.stringify({ variantId, boundEntryId: session.entryId, locale: 'zh-CN', width: 390, theme: 'dark', timezone: 'UTC', tournamentId: 6, gameweek: 4, boardRequests, readyMs: null, performanceStatus: 'NOT_OBSERVED', wholeCaseComplete: false }) })
  } finally {
   await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
   await session.cleanup()
  }
 })
})

}

test('J10 first historical gameweek overlaps UI chunks and data', async ({ page }) => {
 test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Isolated manager fixture only')
 const session = await createSession({ entryId: 15702 })
 const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
 let releaseData: (() => void) | undefined
 let releaseScripts: (() => void) | undefined
 try {
  expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [
   { operation: 'GetMyFplManagerReview', data: { myFplManagerReview: { ...managerReview, entry: { ...managerReview.entry!, id: session.entryId! } } } },
   { operation: 'GetMyFplManagerGameweek', variables: { eventId: 1 }, data: { myFplManagerGameweek: { ...managerGameweek(1), entry: { ...managerReview.entry!, id: session.entryId! } } } }
  ] }) })).ok).toBe(true)
  await addSessionCookie(page, session.cookie)
  await page.goto('/my-fpl/team')
  const ready = page.locator('[data-manager-ready]')
  await expect(ready).toHaveAttribute('data-manager-view', 'season')
  await expect(ready).toHaveAttribute('data-manager-ready', 'true')
  const dataGate = new Promise<void>(resolve => { releaseData = resolve })
  const scriptGate = new Promise<void>(resolve => { releaseScripts = resolve })
  let dataRequests = 0
  let scriptRequests = 0
  await page.route('**/api/graphql', async route => {
   const payload = route.request().postDataJSON()
   if (payload?.query?.includes('GetMyFplManagerGameweek') && payload.variables?.eventId === 1) {
    dataRequests++
    await dataGate
   }
   await route.continue()
  })
  await page.route('**/_next/static/chunks/*.js*', async route => {
   scriptRequests++
   await scriptGate
   await route.continue()
  })
  const history = page.locator('div.bg-card').filter({ has: page.getByRole('heading', { name: 'Gameweek History', exact: true }) })
  await history.getByRole('button', { name: 'Open gameweek 1', exact: true }).click()
  // Neither response is released: both requests must already be in flight.
  await expect.poll(() => dataRequests).toBe(1)
  await expect.poll(() => scriptRequests).toBeGreaterThan(0)
  await expect(ready).toHaveAttribute('data-manager-ready', 'false')
  await expect(page.getByRole('tab', { name: 'Season Review', exact: true })).toBeVisible()
  releaseData!()
  await expect(ready).toHaveAttribute('data-manager-revision', '101')
  await expect(ready).toHaveAttribute('data-manager-ready', 'false')
  releaseScripts!()
  await expect(ready).toHaveAttribute('data-manager-ready', 'true')
  await expect(ready).toHaveAttribute('data-manager-gw', '1')
  await expect(ready).toHaveAttribute('data-manager-entry', String(session.entryId))
  await expect(page.getByText('Review Player 1', { exact: true }).filter({ visible: true }).first()).toBeVisible()
 } finally {
  releaseData?.()
  releaseScripts?.()
  await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
  await session.cleanup()
 }
})


test.describe('management API real handler authorization', () => {
 for (const scenario of ['anonymous', 'unbound', 'unverified', 'expired', 'cross-site', 'forged-entry-PATCH', 'forged-role-PATCH', 'forged-entry-POST', 'forged-role-POST', 'upstream-forbidden', 'genuine-admin'] as const) {
  test(`management API boundary ${scenario}`, async ({ request, baseURL }, testInfo) => {
   test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_TOURNAMENT_BOUNDARY !== '1', 'Dedicated local upstream sink only')
   const { createServer } = await import('node:http')
   const upstream = new URL(process.env.LETLETME_DATA_URL!)
   expect(upstream.hostname).toBe('127.0.0.1')
   const received: Array<{ method: string; path: string; body: unknown }> = []
   const server = createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    received.push({ method: req.method!, path: req.url!, body: JSON.parse(body || '{}') })
    if (scenario === 'upstream-forbidden' && !body.includes('Control Fixture Cup')) {
     res.writeHead(403, { 'Content-Type': 'application/json' })
     res.end(JSON.stringify({ error: 'internal fixture database detail', code: 'PRIVATE_OWNER_CHECK', stack: 'private-stack-fixture', ownerEntryId: 808080 }))
     return
    }
    res.writeHead(501, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Isolated sink: no business mutation implemented' }))
   })
   await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(Number(upstream.port), '127.0.0.1', resolve) })
   const sessions: Awaited<ReturnType<typeof createSession>>[] = []
   const sql = postgres(process.env.E2E_DIRECT_DATABASE_URL!, { max: 1, prepare: false })
   const results: Array<{ method: string; status: number }> = []
   try {
    const session = scenario === 'anonymous' ? null : await createSession(scenario === 'unbound' ? {} : { entryId: 909090, ...(scenario === 'genuine-admin' ? { userId: 'e2e-management-platform-admin' } : {}) })
    if (session) sessions.push(session)
    if (scenario === 'unverified') await sql`UPDATE bauth."user" SET fpl_entry_verified_at = null WHERE id = ${session!.userId}`
    if (scenario === 'expired') await sql`UPDATE bauth.session SET expires_at = ${new Date(Date.now() - 60000)} WHERE user_id = ${session!.userId}`
    const forged = scenario.startsWith('forged-')
    const methods = forged ? [scenario.endsWith('PATCH') ? 'PATCH' : 'POST'] : ['PATCH', 'POST', 'DELETE']
    for (const method of methods) {
     const body: Record<string, unknown> = method === 'PATCH' ? { name: 'Authorization Fixture Cup' } : { action: 'pause' }
     if (forged) body[scenario.includes('-entry-') ? 'adminEntryId' : 'platformAdmin'] = scenario.includes('-entry-') ? 808080 : true
     const response = await request.fetch('/api/tournaments/77', {
      method,
      headers: { origin: scenario === 'cross-site' ? 'https://attacker.invalid' : baseURL!, 'sec-fetch-site': scenario === 'cross-site' ? 'cross-site' : 'same-origin', ...(session ? { cookie: session.cookie } : {}) },
      ...(method === 'DELETE' ? {} : { data: body }),
      maxRedirects: 0
     })
     if (scenario === 'genuine-admin') {
      expect(response.status()).toBe(501)
      expect(received.at(-1)).toEqual({ method: method === 'POST' ? 'PATCH' : method, path: method === 'POST' ? '/tournaments/77/state' : '/tournaments/77', body: { ...(method === 'PATCH' ? { name: 'Authorization Fixture Cup' } : method === 'POST' ? { state: 'inactive' } : {}), adminEntryId: session!.entryId, platformAdmin: true } })
      results.push({ method, status: response.status() })
      expect(received).toHaveLength(results.length)
      continue
     }
     const expected = forged ? 400 : ['anonymous', 'expired'].includes(scenario) ? 401 : 403
     expect(response.status()).toBe(expected)
     const payload = await response.json()
     if (expected === 401) expect(payload).toEqual({ error: 'Unauthenticated' })
     else expect(payload.success).toBe(false)
     expect(payload.error).toBeTruthy()
     results.push({ method, status: response.status() })
     if (scenario === 'upstream-forbidden') {
      expect(payload).toEqual({ success: false, error: 'You are not allowed to perform this tournament action.', code: 'TOURNAMENT_FORBIDDEN' })
      expect(received).toHaveLength(results.length)
      expect(received.at(-1)).toEqual({ method: method === 'POST' ? 'PATCH' : method, path: method === 'POST' ? '/tournaments/77/state' : '/tournaments/77', body: { ...(method === 'PATCH' ? { name: 'Authorization Fixture Cup' } : method === 'POST' ? { state: 'inactive' } : {}), adminEntryId: session!.entryId, platformAdmin: false } })
     } else expect(received).toEqual([])
    }
    const deniedUpstreamRequests = received.length
    received.length = 0
    const control = await createSession({ entryId: 15702 })
    sessions.push(control)
    const response = await request.patch('/api/tournaments/77', { headers: { origin: baseURL!, 'sec-fetch-site': 'same-origin', cookie: control.cookie }, data: { name: 'Control Fixture Cup' } })
    expect(response.status()).toBe(501)
    expect(received).toEqual([{ method: 'PATCH', path: '/tournaments/77', body: { name: 'Control Fixture Cup', adminEntryId: control.entryId, platformAdmin: false } }])
    await testInfo.attach('management-api-boundary', { contentType: 'application/json', body: JSON.stringify({ scenario, results, rejectedUpstreamRequests: scenario === 'genuine-admin' ? 0 : deniedUpstreamRequests, admittedAdminRequests: scenario === 'genuine-admin' ? deniedUpstreamRequests : 0, controlUpstreamRequests: 1, upstreamBusinessMutation: false, environment: 'local isolated', functionalStatus: 'PASS', performanceStatus: 'NOT_OBSERVED', readyMs: null, wholeVariantComplete: false }) })
   } finally {
    for (const session of sessions) await session.cleanup()
    await sql.end()
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
   }
  })
 }
})

// TEAM01.state.02: exercise the pagination thresholds with a real 20-GW fixture.
test.describe('manager twenty-GW pagination', () => {
 test.use({ viewport: { width: 390, height: 900 }, timezoneId: 'UTC', colorScheme: 'dark' })
 test('filters, expands, collapses and opens an appended historical GW', async ({ page }) => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Local fixture only')
  const session = await createSession({ entryId: 15702 })
  const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
  const context = { ...managerReview.context!, currentEventId: 20, nextEventId: 21, latestFinalizedEventId: 20, latestPublishedEventId: 20 }
  const entry = { ...managerReview.entry!, id: session.entryId!, overallPoints: 1200, overallRank: 1000, totalTransfers: 16 }
  const timeline = Array.from({ length: 20 }, (_, i) => ({ ...managerReview.timeline[0], eventId: i + 1, eventChip: 'NONE', eventTransfers: (i + 1) % 5 === 0 ? 0 : 1, overallPoints: (i + 1) * 60, overallRank: 1200 - (i + 1) * 10, overallRankDelta: 10 }))
  const gameweek = (id: number) => ({ ...managerGameweek(1), context, entry, eventId: id, result: { ...managerGameweek(1).result!, ...timeline[id - 1] }, snapshotMeta: { ...managerGameweek(1).snapshotMeta!, eventId: id, revision: String(100 + id) } })
  const review = { ...managerReview, context, entry, throughEventId: 20, timeline, currentGameweek: gameweek(20), snapshotMeta: gameweek(20).snapshotMeta,
   summary: { ...managerReview.summary!, gameweeksReviewed: 20, totalNetPoints: 1200, totalBenchPoints: 80, totalCaptainPoints: 400, topCaptainGameweeks: 20, bestOverallRank: 1000, worstOverallRank: 1190, overallRankChange: 190, currentImprovementStreak: 19, longestImprovementStreak: 19, formations: [{ formation: '4-4-2', gameweeks: 20 }], positionPoints: { goalkeeper: 80, defender: 320, midfielder: 400, forward: 200, assistantManager: 0, total: 1000 }, chips: [] },
   transfers: timeline.map(row => ({ ...managerReview.transfers[0], eventId: row.eventId, eventTransfers: row.eventTransfers, transfers: row.eventTransfers ? [{ ...managerReview.transfers[0].transfers[0], eventId: row.eventId, evaluatedThroughEventId: row.eventId, elementInWebName: `Incoming GW${row.eventId}`, elementOutWebName: `Outgoing GW${row.eventId}` }] : [] })) }
  try {
   expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [
    { operation: 'GetMyFplManagerReview', data: { myFplManagerReview: review } },
    ...timeline.map(({ eventId }) => ({ operation: 'GetMyFplManagerGameweek', variables: { eventId }, data: { myFplManagerGameweek: gameweek(eventId) } }))
   ] }) })).ok).toBe(true)
   await addSessionCookie(page, session.cookie)
   await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
   await page.goto('/zh-CN/my-fpl/team')
   await page.getByRole('tab', { name: '赛季复盘', exact: true }).click()
   const ready = page.locator('[data-manager-ready]')
   await expect(ready).toHaveAttribute('data-manager-ready', 'true')
   await expect(ready).toHaveAttribute('data-manager-revision', '120')
   const transfers = page.locator('div.bg-card').filter({ has: page.getByRole('heading', { name: '转会历史', exact: true }) })
   const history = page.locator('div.bg-card').filter({ has: page.getByRole('heading', { name: '轮次历史', exact: true }) })
   const links = (section: typeof transfers) => section.getByRole('button', { name: /^打开第 \d+ 轮$/ })
   const ids = (values: number[]) => values.map(id => `打开第 ${id} 轮`)
   const all = timeline.map(row => row.eventId).reverse()
   const active = all.filter(id => id % 5 !== 0)
   const assertRows = async (section: typeof transfers, values: number[]) => expect.poll(() => links(section).evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')))).toEqual(ids(values))
   await assertRows(transfers, active.slice(0, 6))
   await transfers.getByRole('button', { name: zhMessages.TeamStats.transferShowMore.replace('{count}', '8'), exact: true }).click()
   await assertRows(transfers, active.slice(0, 14))
   await transfers.getByRole('button', { name: zhMessages.TeamStats.transferShowMore.replace('{count}', '2'), exact: true }).click()
   await assertRows(transfers, active)
   await transfers.getByRole('button', { name: zhMessages.TeamStats.transferShowLess, exact: true }).click()
   await assertRows(transfers, active.slice(0, 6))
   await transfers.getByRole('button', { name: zhMessages.TeamStats.transferShowAllRemaining.replace('{count}', '10'), exact: true }).click()
   await assertRows(transfers, active)
   await transfers.getByRole('button', { name: zhMessages.TeamStats.transferFilterAll, exact: true }).click()
   await assertRows(transfers, all.slice(0, 6))
   await transfers.getByRole('button', { name: zhMessages.TeamStats.transferFilterWith, exact: true }).click()
   await assertRows(transfers, active.slice(0, 6))
   await assertRows(history, all.slice(0, 12))
   await history.getByRole('button', { name: zhMessages.TeamStats.historyShowMore.replace('{count}', '8'), exact: true }).click()
   await assertRows(history, all)
   await history.getByRole('button', { name: zhMessages.TeamStats.historyShowLess, exact: true }).click()
   await assertRows(history, all.slice(0, 12))
   await history.getByRole('button', { name: zhMessages.TeamStats.historyShowMore.replace('{count}', '8'), exact: true }).click()
   await history.getByRole('button', { name: '打开第 4 轮', exact: true }).click()
   await expect(ready).toHaveAttribute('data-manager-ready', 'true')
   await expect(ready).toHaveAttribute('data-manager-gw', '4')
   await expect(ready).toHaveAttribute('data-manager-revision', '104')
   await expect(ready).toHaveAttribute('data-manager-entry', String(session.entryId))
   await expect(page.locator('section[aria-labelledby="team-gw-scoreboard-title"]')).toContainText('Saka (20)')
   let expectedTabs = [20, 4]
   for (const eventId of [11, 12, 13, 14, 15, 16, 17, 18, 19]) {
    await page.getByRole('tab', { name: '赛季复盘', exact: true }).click()
    await history.getByRole('button', { name: `打开第 ${eventId} 轮`, exact: true }).click()
    expectedTabs = [...expectedTabs, eventId].slice(-8)
    await expect(page.getByRole('tab', { name: /^GW\d+$/ })).toHaveText(expectedTabs.map(id => `GW${id}`))
    await expect(page.getByRole('tab', { name: `GW${eventId}`, exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(ready).toHaveAttribute('data-manager-ready', 'true')
    await expect(ready).toHaveAttribute('data-manager-entry', String(session.entryId))
    await expect(ready).toHaveAttribute('data-manager-gw', String(eventId))
    await expect(ready).toHaveAttribute('data-manager-revision', String(100 + eventId))
    await expect(page).toHaveURL(url => url.searchParams.get('gw') === String(eventId))
    await expect(page.locator('section[aria-labelledby="team-gw-scoreboard-title"]')).toContainText('Saka (20)')
   }
   await expect(page.getByRole('tab', { name: 'GW11', exact: true })).toHaveCount(0)
   await page.getByRole('button', { name: '关闭第 19 轮', exact: true }).click()
   await expect(page.getByRole('tab', { name: 'GW18', exact: true })).toHaveAttribute('aria-selected', 'true')
   await expect(ready).toHaveAttribute('data-manager-gw', '18')
   await expect(ready).toHaveAttribute('data-manager-revision', '118')
   expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('UTC')
   await expect(page.locator('html')).toHaveClass(/dark/)
  } finally {
   await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
   await session.cleanup()
  }
 })
})

// S19.directed.04: the real UI submits only to browser substitutes.
for (const context of [
 { kind: 'directed', locale: 'zh-CN', width: 390, timezone: 'UTC', theme: 'dark' },
 ...['en', 'zh-CN'].flatMap(locale => [1440, 390].map(width => ({ kind: 'baseline', locale, width, timezone: 'Australia/Perth', theme: 'system' })))
]) {
test.describe(`isolated classic import submission ${context.kind} ${context.locale} ${context.width}`, () => {
 test.use({ locale: context.locale, timezoneId: context.timezone, colorScheme: context.theme === 'dark' ? 'dark' : 'light', viewport: { width: context.width, height: 900 } })
 test('S19 import failure recovers without upstream mutation', async ({ page }, testInfo) => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Local substitutes only')
  const prefix = context.locale === 'zh-CN' ? '/zh-CN' : ''
  const messages = context.locale === 'zh-CN' ? zhMessages : enMessages
  const session = await createSession({ entryId: 15702 })
  const submitted: unknown[] = []
  const unexpected: string[] = []
  let previews = 0
  await page.route('**/api/tournaments{,/**}', async route => {
   const path = new URL(route.request().url()).pathname
   if (path === '/api/tournaments/check-name') return route.fulfill({ json: { available: true } })
   if (path === '/api/tournaments/preview') {
    previews++
    expect(route.request().method()).toBe('POST')
    expect(route.request().postDataJSON()).toEqual({ leagueUrl: 'https://fantasy.premierleague.com/leagues/123/standings/c' })
    return route.fulfill({ json: { previewToken: 'isolated-import-preview', expiresAt: new Date(Date.now() + 600000).toISOString(), leagueId: 123, leagueType: 'classic', leagueName: 'Isolated Import Cup', startEvent: 4, participants: [1, 2].map(id => ({ id: String(id), team: `Import Team ${id}`, manager: `Manager ${id}`, overallRank: id, totalPoints: 100 })) } })
   }
   if (path === '/api/tournaments' && route.request().method() === 'POST') {
    const body = route.request().postDataJSON()
    expect(body).toMatchObject({ creationMode: 'classic', participantSource: 'official', tournamentType: 'standard', groupFormat: 'points', startGameweek: 'GW4', endGameweek: 'GW38', groupNum: '1', qualifiersPerGroup: '', knockoutFormat: 'none', selectedParticipantIds: ['1', '2'], previewToken: 'isolated-import-preview' })
    submitted.push(body)
    return submitted.length === 1
     ? route.fulfill({ status: 503, json: { success: false, code: 'DEPENDENCY_UNAVAILABLE' } })
     : route.fulfill({ json: { success: true, tournament: { id: 77001, participantCount: 2 }, setupStatus: 'ready' } })
   }
   unexpected.push(path)
   await route.abort()
  })
  try {
   await addSessionCookie(page, session.cookie)
   await page.addInitScript(theme => localStorage.setItem('theme', theme), context.theme)
   await page.goto(`${prefix}/competitions/create`)
   await page.locator('label[for="creation-mode-classic"]').click()
   await page.locator('#league-url').fill('https://fantasy.premierleague.com/leagues/123/standings/c')
   await page.getByRole('button', { name: messages.TournamentCreate.checkLeague, exact: true }).click()
   const submit = page.locator('#tournament-create-form button[type="submit"]')
   await expect(submit).toBeEnabled()
   await submit.click()
   await expect(page.locator('#tournament-create-form [aria-live="assertive"]')).toBeVisible()
   await expect(submit).toBeEnabled()
   expect(submitted).toHaveLength(1)
   await submit.click()
   const success = page.locator(`a[href="${prefix}/live/competitions/77001?created=1"]`)
   await expect(success).toBeVisible()
   await expect(page.locator('#tournament-create-form [aria-live="assertive"]')).toHaveCount(0)
   expect(submitted).toHaveLength(2)
   expect(submitted[1]).toEqual(submitted[0])
   expect(previews).toBe(1)
   expect(unexpected).toEqual([])
   await expect(page.locator('html')).toHaveClass(context.theme === 'dark' ? /\bdark\b/ : /\blight\b/)
   expect(page.viewportSize()?.width).toBe(context.width)
   expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(context.timezone)
   expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe(context.theme)
   await testInfo.attach('S19-import-boundary-context', { contentType: 'application/json', body: JSON.stringify({ variantIds: context.kind === 'directed' ? ['S19.directed.03', 'S19.directed.04'] : [`S19.UNRESOLVED_ROLE.${context.locale}.${context.width === 390 ? 'mobile390' : 'desktop1440'}.base`], locale: context.locale, width: context.width, theme: context.theme, timezone: context.timezone, previews, submissions: submitted.length, unexpected, realProducerInvoked: false, wholeVariantComplete: false, readyMs: null, performanceStatus: 'NOT_OBSERVED' }) })
  } finally { await session.cleanup() }
 })
})


}

test('management API boundary joined-domain genuine-admin rename persistence', async ({ request, baseURL }, testInfo) => {
 test.skip(process.env.E2E_JOINED_DOMAIN !== '1' || Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Task-owned real Data HTTP and disposable database only')
 const sql = postgres(process.env.E2E_DIRECT_DATABASE_URL!, { max: 1, prepare: false })
 const sessions: Awaited<ReturnType<typeof createSession>>[] = []
 try {
  const owner = await createSession({ entryId: 15702 }); sessions.push(owner)
  const nonowner = await createSession({ entryId: 6733550 }); sessions.push(nonowner)
  const admin = await createSession({ entryId: 909090, userId: 'e2e-management-platform-admin' }); sessions.push(admin)
  await sql`INSERT INTO fpl.seasons(season_id,season_code,display_name,start_year,end_year,lifecycle_state,is_current) VALUES(2026,'2627','Joined fixture',2026,2027,'active',true) ON CONFLICT(season_id) DO UPDATE SET is_current=true`
  const seasons = await sql`SELECT season_id FROM fpl.seasons WHERE is_current = true`
  expect(seasons).toHaveLength(1)
  const season = seasons[0].season_id
  const id = 995831
  for (const session of sessions) await sql`INSERT INTO competition.entries(season_id,entry_id,entry_name,player_name) VALUES(${season},${session.entryId!},'Joined fixture','Fixture')`
  await sql`INSERT INTO competition.tournaments(season_id,tournament_id,name,creator,admin_entry_id,league_id,league_type,total_team_num,tournament_mode,group_mode,group_auto_averages,state) VALUES(${season},${id},'Joined initial','fixture',${owner.entryId!},${id},'classic',1,'normal','no_group',false,'active')`
  const read = () => sql`SELECT * FROM competition.tournaments WHERE season_id=${season} AND tournament_id=${id}`
  const before = await read()
  const rename = (session: typeof owner, name: string) => request.patch(`/api/tournaments/${id}`, { headers: { origin: baseURL!, 'sec-fetch-site':'same-origin', cookie:session.cookie }, data:{name} })
  const denied = await rename(nonowner, 'Joined denied')
  expect(denied.status()).toBe(403)
  expect((await denied.json()).code).toBe('TOURNAMENT_FORBIDDEN')
  expect(await read()).toEqual(before)
  for (const [session, name] of [[owner,'Joined owner renamed'],[admin,'Joined admin renamed']] as const) {
   const response = await rename(session,name)
   expect(response.status()).toBe(200)
   const payload = await response.json()
   expect(payload.success).toBe(true)
   expect(payload.tournament.name).toBe(name)
   expect(payload.tournament.adminEntryId).toBe(owner.entryId)
   const rows = await read()
   expect(rows).toHaveLength(1)
   expect(rows[0].name).toBe(name)
   expect(rows[0].admin_entry_id).toBe(owner.entryId)
  }
  await testInfo.attach('joined-domain-rename', { contentType:'application/json', body:JSON.stringify({ methods:['PATCH'], nonowner:'403 unchanged', owner:'200 persisted', admin:'200 persisted owner preserved', environment:'local isolated real Web and Data HTTP with PostgreSQL', performanceStatus:'NOT_OBSERVED',readyMs:null,wholeVariantComplete:false }) })
 } finally {
  for (const session of sessions) await session.cleanup()
  await sql.end()
 }
})

test('management API boundary joined-domain genuine-admin pause persistence', async ({ request, baseURL }, testInfo) => {
 test.skip(process.env.E2E_JOINED_DOMAIN !== '1' || Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Task-owned real Data HTTP and disposable database only')
 const sql = postgres(process.env.E2E_DIRECT_DATABASE_URL!, { max: 1, prepare: false })
 const sessions: Awaited<ReturnType<typeof createSession>>[] = []
 try {
  const owner = await createSession({ entryId: 15702 }); sessions.push(owner)
  const nonowner = await createSession({ entryId: 6733550 }); sessions.push(nonowner)
  const admin = await createSession({ entryId: 909090, userId: 'e2e-management-platform-admin' }); sessions.push(admin)
  await sql`INSERT INTO fpl.seasons(season_id,season_code,display_name,start_year,end_year,lifecycle_state,is_current) VALUES(2026,'2627','Joined fixture',2026,2027,'active',true) ON CONFLICT(season_id) DO UPDATE SET is_current=true`
  const seasons = await sql`SELECT season_id FROM fpl.seasons WHERE is_current = true`
  expect(seasons).toHaveLength(1)
  const season = seasons[0].season_id
  const id = 995832
  for (const session of sessions) await sql`INSERT INTO competition.entries(season_id,entry_id,entry_name,player_name) VALUES(${season},${session.entryId!},'Joined fixture','Fixture')`
  await sql`INSERT INTO competition.tournaments(season_id,tournament_id,name,creator,admin_entry_id,league_id,league_type,total_team_num,tournament_mode,group_mode,group_auto_averages,state) VALUES(${season},${id},'Joined pause initial','fixture',${owner.entryId!},${id},'classic',1,'normal','no_group',false,'active')`
  const read = () => sql`SELECT * FROM competition.tournaments WHERE season_id=${season} AND tournament_id=${id}`
  const before = await read()
  const pause = (session: typeof owner) => request.post(`/api/tournaments/${id}`, { headers: { origin: baseURL!, 'sec-fetch-site':'same-origin', cookie:session.cookie }, data:{action:'pause'} })
  const denied = await pause(nonowner)
  expect(denied.status()).toBe(403)
  expect((await denied.json()).code).toBe('TOURNAMENT_FORBIDDEN')
  expect(await read()).toEqual(before)
  for (const session of [owner, admin]) {
   // Reset only disposable fixture state so each actor must perform the transition.
   await sql`UPDATE competition.tournaments SET state='active' WHERE season_id=${season} AND tournament_id=${id}`
   const response = await pause(session)
   expect(response.status()).toBe(200)
   const payload = await response.json()
   expect(payload.success).toBe(true)
   expect(payload.tournament.state).toBe('inactive')
   expect(payload.tournament.adminEntryId).toBe(owner.entryId)
   const rows = await read()
   expect(rows).toHaveLength(1)
   expect(rows[0].state).toBe('inactive')
   expect(rows[0].admin_entry_id).toBe(owner.entryId)
  }
  await testInfo.attach('joined-domain-pause', { contentType:'application/json', body:JSON.stringify({ methods:['POST pause -> Data PATCH state'], nonowner:'403 unchanged', owner:'200 persisted', admin:'200 persisted owner preserved', environment:'local isolated real Web and Data HTTP with PostgreSQL', performanceStatus:'NOT_OBSERVED',readyMs:null,wholeVariantComplete:false }) })
 } finally {
  for (const session of sessions) await session.cleanup()
  await sql.end()
 }
})

test('management API boundary joined-domain genuine-admin delete persistence', async ({ request, baseURL }, testInfo) => {
 test.skip(process.env.E2E_JOINED_DOMAIN !== '1' || Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Task-owned real Data HTTP and disposable database only')
 const sql = postgres(process.env.E2E_DIRECT_DATABASE_URL!, { max: 1, prepare: false })
 const sessions: Awaited<ReturnType<typeof createSession>>[] = []
 try {
  const owner = await createSession({ entryId: 15702 }); sessions.push(owner)
  const nonowner = await createSession({ entryId: 6733550 }); sessions.push(nonowner)
  const admin = await createSession({ entryId: 909090, userId: 'e2e-management-platform-admin' }); sessions.push(admin)
  await sql`INSERT INTO fpl.seasons(season_id,season_code,display_name,start_year,end_year,lifecycle_state,is_current) VALUES(2026,'2627','Joined fixture',2026,2027,'active',true) ON CONFLICT(season_id) DO UPDATE SET is_current=true`
  const seasons = await sql`SELECT season_id FROM fpl.seasons WHERE is_current = true`
  expect(seasons).toHaveLength(1)
  const season = seasons[0].season_id
  for (const session of sessions) await sql`INSERT INTO competition.entries(season_id,entry_id,entry_name,player_name) VALUES(${season},${session.entryId!},'Joined fixture','Fixture')`
  const seed = async (id: number) => {
   await sql`INSERT INTO competition.tournaments(season_id,tournament_id,name,creator,admin_entry_id,league_id,league_type,total_team_num,tournament_mode,group_mode,group_auto_averages,state) VALUES(${season},${id},${'Joined delete '+id},'fixture',${owner.entryId!},${id},'classic',1,'normal','no_group',false,'active')`
   await sql`INSERT INTO competition.tournament_entries(season_id,tournament_id,league_id,entry_id) VALUES(${season},${id},${id},${owner.entryId!})`
  }
  const read = (id: number) => sql`SELECT * FROM competition.tournaments WHERE season_id=${season} AND tournament_id=${id}`
  const children = (id: number) => sql`SELECT * FROM competition.tournament_entries WHERE season_id=${season} AND tournament_id=${id}`
  const inspectQueue = async (id: number) => {
   const response = await request.get(`http://127.0.0.1:4318/__fixture/queue/${id}`)
   expect(response.status()).toBe(200)
   return await response.json() as string[]
  }
  const withQueue = process.env.E2E_JOINED_QUEUE === '1'
  const sentinelJobs = withQueue ? await inspectQueue(995839) : []
  if (withQueue) expect(sentinelJobs).toHaveLength(6)
  await seed(995839)
  const sentinel = await read(995839), sentinelChildren = await children(995839)
  for (const [actor,id] of [[owner,995833],[admin,995834]] as const) {
   await seed(id)
   const before = await read(id), childBefore = await children(id)
   expect(childBefore).toHaveLength(1)
   const jobsBefore = withQueue ? await inspectQueue(id) : []
   if (withQueue) expect(jobsBefore).toHaveLength(6)
   const remove = (session: typeof owner) => request.delete(`/api/tournaments/${id}`, { headers:{origin:baseURL!,'sec-fetch-site':'same-origin',cookie:session.cookie} })
   const denied = await remove(nonowner)
   expect(denied.status()).toBe(403)
   expect((await denied.json()).code).toBe('TOURNAMENT_FORBIDDEN')
   expect(await read(id)).toEqual(before)
   expect(await children(id)).toEqual(childBefore)
   if (withQueue) expect(await inspectQueue(id)).toEqual(jobsBefore)
   const allowed = await remove(actor)
   expect(allowed.status()).toBe(200)
   expect(await allowed.json()).toMatchObject({success:true,tournamentId:id,deletedName:'Joined delete '+id})
   expect(await read(id)).toHaveLength(0)
   expect(await children(id)).toHaveLength(0)
   expect(await read(995839)).toEqual(sentinel)
   expect(await children(995839)).toEqual(sentinelChildren)
   if (withQueue) {
    expect(await inspectQueue(id)).toEqual([])
    expect(await inspectQueue(995839)).toEqual(sentinelJobs)
   }
  }
  await testInfo.attach('joined-domain-delete', { contentType:'application/json', body:JSON.stringify({ methods:['DELETE'], queueFixture:withQueue, nonowner:'403 unchanged', owner:'200 parent and child removed', admin:'200 parent and child removed; unrelated rows preserved', environment:'local isolated real Web and Data HTTP with PostgreSQL', performanceStatus:'NOT_OBSERVED',readyMs:null,wholeVariantComplete:false }) })
 } finally {
  for (const session of sessions) await session.cleanup()
  await sql.end()
 }
})

for (const context of [
 { id: 'S08.directed.01', locale: 'zh-CN', width: 390, theme: 'dark', timezone: 'UTC' },
 ...['en', 'zh-CN'].flatMap(locale => [1440, 390].map(width => ({ id: `S08.UNRESOLVED_ROLE.${locale}.${width === 1440 ? 'desktop1440' : 'mobile390'}.base`, locale, width, theme: 'system', timezone: 'Australia/Perth' })))
]) test.describe(`S08 anonymous ${context.id}`, () => {
 test.use({ locale: context.locale, viewport: { width: context.width, height: 900 }, colorScheme: context.theme === 'dark' ? 'dark' : 'light', timezoneId: context.timezone })
 test(`${context.id} anonymous actual team navigation is denied`, async ({ page }, testInfo) => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Local isolated anonymous session only')
  const prefix = context.locale === 'zh-CN' ? '/zh-CN' : ''
  const messages = context.locale === 'zh-CN' ? zhMessages : enMessages
  await page.addInitScript(theme => localStorage.setItem('theme', theme), context.theme)
  const mutations: string[] = []
  page.on('request', request => {
   if (request.headers()['next-action'] || (request.method() !== 'GET' && /\/api\/(auth|fpl|tournaments)/.test(new URL(request.url()).pathname))) mutations.push(new URL(request.url()).pathname)
  })
  await page.goto(prefix || '/')
  const nav = page.getByRole('navigation').first()
  if (context.width === 390) await nav.locator('[data-navigation-mobile] > summary').click()
  else await nav.locator('details[data-navigation-group]').filter({ has: page.locator(`a[href="${prefix}/my-fpl/team"]`) }).locator(':scope > summary').click()
  const team = nav.locator(`a[href="${prefix}/my-fpl/team"]`).filter({ visible: true })
  await expect(team).toHaveCount(1)
  await team.click()
  const assertDenied = async () => {
   await expect(page).toHaveURL(url => url.pathname === `${prefix}/auth/login` && url.searchParams.get('next') === `${prefix}/my-fpl/team`)
   await expect(page.getByLabel(messages.Auth.email, { exact: true })).toBeEnabled()
   await expect(page.locator('[data-manager-entry]')).toHaveCount(0)
   await expect(page.locator('#main-content')).not.toContainText('E2E United')
  }
  await assertDenied()
  await page.reload()
  await assertDenied()
  expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(context.timezone)
  await expect(page.locator('html')).toHaveClass(context.theme === 'dark' ? /dark/ : /light/)
  expect(page.viewportSize()?.width).toBe(context.width)
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe(context.theme)
  expect(mutations).toEqual([])
  await testInfo.attach('S08-anonymous-denied', { contentType: 'application/json', body: JSON.stringify({ variantId: context.id, owner: 'anonymous-protected-team', identity: 'A', locale: context.locale, width: context.width, theme: context.theme, timezone: context.timezone, wholeVariantComplete: false, actualClick: true, reload: true, mutations, readyMs: null }) })
 })
})

for (const context of [
 { kind: 'directed', locale: 'zh-CN', width: 390, theme: 'dark', timezone: 'UTC' },
 ...['en', 'zh-CN'].flatMap(locale => [1440, 390].map(width => ({ kind: 'baseline', locale, width, theme: 'system', timezone: 'Australia/Perth' })))
]) test.describe(`S08 role genuine-admin ${context.kind} ${context.locale} ${context.width}`, () => {
 test.use({ locale: context.locale, viewport: { width: context.width, height: 900 }, colorScheme: context.theme === 'dark' ? 'dark' : 'light', timezoneId: context.timezone })
 const parentVariantId = `S08.UNRESOLVED_ROLE.${context.locale}.${context.width === 1440 ? 'desktop1440' : 'mobile390'}.base`
 const prefix = context.locale === 'zh-CN' ? '/zh-CN' : ''
 const zh = context.locale === 'zh-CN'
 for (const [role, variantId] of [['owner', 'S08.directed.04'], ['admin', 'S08.directed.05'], ['nonowner', 'S08.directed.06']] as const) {
  test(`${context.kind === 'baseline' ? parentVariantId : variantId} ${role} actual menu and management boundary`, async ({ page }, testInfo) => {
   test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Isolated trusted role configuration only')
   const session = await createSession({ entryId: 909090, ...(role === 'admin' ? { userId: 'e2e-management-platform-admin' } : {}) })
   const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
   const tournament = { ...managedTournament, adminEntryId: role === 'owner' ? session.entryId : 808080 }
   const mutations: string[] = []
   await page.route('**/api/tournaments/**', async route => {
    if (['PATCH','POST','DELETE'].includes(route.request().method())) {
     mutations.push(route.request().method()); await route.fulfill({ status: 409, body: 'Unexpected write blocked' })
    } else await route.continue()
   })
   try {
    expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [
     { operation: 'GetEntryTournamentsList', variables: { entryId: session.entryId }, data: { entryTournaments: [tournament] } },
     { operation: 'GetManagedTournament', variables: { tournamentId: 77, entryId: session.entryId }, data: { managedTournament: role === 'nonowner' ? null : tournament } }
    ] }) })).ok).toBe(true)
    await page.addInitScript(theme => localStorage.setItem('theme',theme), context.theme)
    await addSessionCookie(page, session.cookie)
    await page.goto(`${prefix}/competitions/browse`)
    await page.getByRole('button',{ name:zh ? 'J12 Owned Cup 的操作' : 'Actions for J12 Owned Cup',exact:true }).click()
    const manage = page.getByRole('menuitem',{ name:zh ? '管理赛事' : 'Manage tournament',exact:true })
    if (role === 'nonowner') {
     await expect(manage).toHaveCount(0)
     await page.keyboard.press('Escape')
     await page.goto(`${prefix}/competitions/77/manage`)
     await expect(page.getByRole('heading',{name:zh ? '需要管理员权限' : 'Administrator access required',exact:true})).toBeVisible()
     await expect(page.locator('#tournament-name')).toHaveCount(0)
     await expect(page.locator('[data-competition-perf-ready="manage"]')).toHaveCount(0)
    } else {
     await expect(manage).toHaveCount(1)
     await manage.click()
     await expect(page).toHaveURL(url=>url.pathname===`${prefix}/competitions/77/manage`)
     await expect(page.locator('[data-competition-perf-ready="manage"]')).toHaveAttribute('data-competition-tournament-id','77')
     await expect(page.locator('#tournament-name')).toHaveValue('J12 Owned Cup')
     await expect(page.getByRole('button',{name:zh ? '删除赛事' : 'Delete tournament',exact:true})).toBeEnabled()
    }
    expect(await page.evaluate(()=>Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(context.timezone)
    await expect(page.locator('html')).toHaveClass(context.theme === 'dark' ? /dark/ : /light/)
    expect(page.viewportSize()?.width).toBe(context.width)
    const observations = await (await fetch(fixture)).json()
    expect(observations.requests.some((row: { operation:string;variables:{entryId?:number;tournamentId?:number} })=>row.operation==='GetManagedTournament'&&row.variables.entryId===session.entryId&&row.variables.tournamentId===77)).toBe(true)
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe(context.theme)
    expect(mutations).toEqual([])
    await testInfo.attach('S08-role-boundary',{contentType:'application/json',body:JSON.stringify({variantId:context.kind === 'baseline' ? parentVariantId : variantId,role,locale:context.locale,width:context.width,theme:context.theme,timezone:context.timezone,wholeVariantComplete:false,actualClick:role!=='nonowner',nonownerDeepLink:role==='nonowner',graphql:'controlled domain response',writes:0,readyMs:null})})
   } finally {
    await fetch(fixture,{method:'POST',body:JSON.stringify({rules:[]})})
    await session.cleanup()
   }
  })
 }
})


test('management API boundary joined-domain active roster worker delete', async ({ request, baseURL }, testInfo) => {
 test.skip(process.env.E2E_JOINED_DOMAIN !== '1' || Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Task-owned active worker fixture only')
 const owner = await createSession({ entryId: 15702 })
 const nonowner = await createSession({ entryId: 6733550 })
 const sql = postgres(process.env.E2E_DIRECT_DATABASE_URL!, { max: 1, prepare: false })
 const control = (path: string) => request.post(`http://127.0.0.1:4318/__fixture/${path}`, { headers: {'x-api-key':'isolated-e2e-sink-key'} })
 const id=995843
 try {
  await sql`INSERT INTO fpl.seasons(season_id,season_code,display_name,start_year,end_year,lifecycle_state,is_current) VALUES(2026,'2627','Owned concurrency fixture',2026,2027,'active',true)`
  await sql`INSERT INTO fpl.events(season_id,event_id,name,finished,data_checked) VALUES(2026,4,'Owned GW4',false,false)`
  await sql`INSERT INTO competition.entries(season_id,entry_id,entry_name,player_name) VALUES(2026,${owner.entryId!},'Fixture owner','Fixture')`
  await sql`INSERT INTO competition.tournaments(season_id,tournament_id,name,creator,admin_entry_id,league_id,league_type,total_team_num,tournament_mode,group_mode,group_auto_averages,state,roster_mode,roster_sync_status,setup_status) VALUES(2026,${id},'Active worker fixture','fixture',${owner.entryId!},${id},'classic',1,'normal','no_group',false,'active','official_sync','ready','ready')`
  await sql`INSERT INTO competition.tournament_entries(season_id,tournament_id,league_id,entry_id) VALUES(2026,${id},${id},${owner.entryId!})`
  const start=await control('start');expect(start.status()).toBe(200);expect(await start.json()).toEqual({state:'active',providerCalls:1})
  const remove = (cookie: string) => request.delete(`/api/tournaments/${id}`, { headers: {origin:baseURL!,'sec-fetch-site':'same-origin',cookie} })
  const denied=await remove(nonowner.cookie);expect(denied.status()).toBe(403);expect((await denied.json()).code).toBe('TOURNAMENT_FORBIDDEN')
  expect(await sql`SELECT 1 FROM competition.tournaments WHERE season_id=2026 AND tournament_id=${id}`).toHaveLength(1)
  const deleted=await remove(owner.cookie);expect(deleted.status()).toBe(200);expect(await deleted.json()).toMatchObject({success:true,tournamentId:id})
  const settle=await control('release');expect(settle.status()).toBe(200);const outcome=await settle.json()
  expect(outcome).toMatchObject({state:'completed',result:{changed:false,participantCount:0},pending:[],failures:[],providerCalls:1})
  expect(await sql`SELECT 1 FROM competition.tournaments WHERE season_id=2026 AND tournament_id=${id}`).toHaveLength(0)
  expect(await sql`SELECT 1 FROM competition.tournament_entries WHERE season_id=2026 AND tournament_id=${id}`).toHaveLength(0)
  await testInfo.attach('joined-active-worker-delete', {contentType:'application/json',body:JSON.stringify({outcome,path:'Real Web auth and DELETE -> real Data HTTP -> canonical delete during real roster worker provider wait',wholeVariantComplete:false,readyMs:null,performanceStatus:'NOT_OBSERVED'})})
 } finally {
  const stopped=await control('stop');expect(stopped.status()).toBe(200)
  await owner.cleanup();await nonowner.cleanup();await sql.end()
 }
})


test.describe('J12 management polling authorization loss', () => {
 for (const deniedStatus of [401, 403] as const) {
  test(`J12 management polling ${deniedStatus} removes private controls without manual reload`, async ({ page }) => {
   test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Isolated authorization-loss fixture')
   const session = await createSession({ entryId: 909090 })
   const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
   let release!: () => void
   const gate = new Promise<void>(resolve => { release = resolve })
   let polls = 0
   const configure = async (available: boolean) => {
    expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [{ operation: 'GetManagedTournament', variables: { tournamentId: 77, entryId: 909090 }, data: { managedTournament: available ? { ...managedTournament, setupStatus: 'PROCESSING', setupPhase: 'BUILDING_STRUCTURE' } : null } }] }) })).ok).toBe(true)
   }
   await page.route('**/api/tournaments/77/status?**', async route => {
    polls += 1
    await gate
    await route.fulfill({ status: deniedStatus, json: { error: deniedStatus === 401 ? 'Unauthenticated.' : 'Forbidden.' } })
   })
   try {
    await configure(true)
    await addSessionCookie(page, session.cookie)
    await page.goto('/en/competitions/77/manage')
    const ready = page.locator('[data-competition-perf-ready="manage"]')
    await expect(ready).toHaveAttribute('data-competition-tournament-id', '77')
    await expect(page.locator('#tournament-name')).toBeVisible()
    await expect.poll(() => polls).toBeGreaterThan(0)
    await configure(false)
    if (deniedStatus === 401) {
     const sql = postgres(process.env.E2E_DIRECT_DATABASE_URL!, { max: 1 })
     try { await sql`UPDATE bauth.session SET expires_at = ${new Date(Date.now() - 60000)} WHERE user_id = ${session.userId}` } finally { await sql.end() }
    }
    release()
    await expect(ready).toHaveCount(0)
    await expect(page.locator('#tournament-name')).toHaveCount(0)
    if (deniedStatus === 401) {
     await expect(page).toHaveURL(url => url.pathname === '/auth/login' && url.searchParams.get('next') === '/en/competitions/77/manage')
     await expect(page.getByLabel(enMessages.Auth.email, { exact: true })).toBeEnabled()
    }
    else await expect(page.getByRole('heading', { name: 'Administrator access required', exact: true })).toBeVisible()
   } finally {
    release()
    await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
    await session.cleanup()
   }
  })
 }
})


test('J12 management polling 503 preserves content and recovers on the next poll', async ({ page }) => {
 test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Isolated polling recovery fixture')
 const session = await createSession({ entryId: 909090 })
 const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
 let attempts = 0
 let release!: () => void
 const gate = new Promise<void>(resolve => { release = resolve })
 await page.route('**/api/tournaments/77/status?**', async route => {
  attempts += 1
  await gate
  await route.fulfill(attempts === 1 ? { status: 503, json: { error: 'Unavailable' } } : { json: { revision: managedTournament.updatedAt, updatedAt: managedTournament.updatedAt, state: 'INACTIVE', setupStatus: 'PROCESSING', rosterSyncStatus: 'READY' } })
 })
 try {
  expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [{ operation: 'GetManagedTournament', variables: { tournamentId: 77, entryId: 909090 }, data: { managedTournament: { ...managedTournament, setupStatus: 'PROCESSING', setupPhase: 'BUILDING_STRUCTURE' } } }] }) })).ok).toBe(true)
  await addSessionCookie(page, session.cookie)
  await page.goto('/en/competitions/77/manage')
  const ready = page.locator('[data-competition-perf-ready="manage"]')
  await expect(ready).toHaveAttribute('data-competition-tournament-id', '77')
  await expect.poll(() => attempts).toBe(1)
  await expect(page.getByRole('button', { name: enMessages.TournamentManage.pause, exact: true })).toBeVisible()
  const failure = page.waitForResponse(response => response.url().includes('/api/tournaments/77/status?') && response.status() === 503)
  release()
  await failure
  await expect(page.locator('#tournament-name')).toBeVisible()
  await expect(ready).toHaveAttribute('data-competition-tournament-id', '77')
  await expect.poll(() => attempts, { timeout: 10000 }).toBeGreaterThanOrEqual(2)
  await expect(page.getByRole('button', { name: enMessages.TournamentManage.pause, exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: enMessages.TournamentManage.resume, exact: true })).toBeVisible()
  await expect(page.locator('#tournament-name')).toBeVisible()
  await expect(page).toHaveURL(/\/en\/competitions\/77\/manage$/)
 } finally {
  release()
  await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
  await session.cleanup()
 }
})

test('MANAGE02 private status never reuses the preceding owner response', async ({ request }) => {
 test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Isolated private-read fixture')
 const owner = await createSession({ entryId: 909090 })
 const other = await createSession({ entryId: 808080 })
 const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
 const revision = 'private-owner-revision-fixture'
 try {
  expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [
   { operation: 'GetManagedTournamentStatus', variables: { tournamentId: 77, entryId: 909090 }, data: { managedTournamentStatus: { revision, state: 'ACTIVE', setupStatus: 'READY', issues: [{ issueKey: 'owner-only-fixture' }] } } },
   { operation: 'GetManagedTournamentStatus', variables: { tournamentId: 77, entryId: other.entryId }, data: { managedTournamentStatus: null } }
  ] }) })).ok).toBe(true)
  for (const identity of ['owner', 'other', 'anonymous', 'owner', 'other'] as const) {
   const response = await request.get('/api/tournaments/77/status', { headers: { cookie: identity === 'owner' ? owner.cookie : identity === 'other' ? other.cookie : '' } })
   expect(response.status()).toBe(identity === 'owner' ? 200 : identity === 'other' ? 403 : 401)
   const body = await response.text()
   if (identity === 'owner') expect(JSON.parse(body)).toMatchObject({ revision, issues: [{ issueKey: 'owner-only-fixture' }] })
   else {
    expect(body).not.toContain(revision)
    expect(body).not.toContain('owner-only-fixture')
    expect(JSON.parse(body)).toEqual({ error: identity === 'other' ? 'Forbidden.' : 'Unauthenticated' })
   }
   if (identity !== 'anonymous') {
    expect(response.headers()['cache-control']).toContain('private')
    expect(response.headers()['cache-control']).toContain('no-store')
   }
  }
  const observed = await (await fetch(fixture)).json()
  const reads = observed.requests.filter((x: { operation: string }) => x.operation === 'GetManagedTournamentStatus')
  expect(reads.map((x: { variables: { entryId: number } }) => x.variables.entryId)).toEqual([owner.entryId, other.entryId, owner.entryId, other.entryId])
 } finally {
  await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
  await owner.cleanup()
  await other.cleanup()
 }
})

for (const denied of [{ code: 'FORBIDDEN', status: 403 }, { code: 'UNAUTHENTICATED', status: 401 }]) {
 test(`MANAGE02 upstream ${denied.code} keeps authorization status`, async ({ request }) => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Isolated upstream authorization fixture')
  const session = await createSession({ entryId: 909090 })
  const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
  try {
   expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [{ operation: 'GetManagedTournamentStatus', error: true, errorCode: denied.code, httpStatus: denied.status }] }) })).ok).toBe(true)
   const response = await request.get('/api/tournaments/77/status', { headers: { cookie: session.cookie } })
   expect(response.status()).toBe(denied.status)
   expect(await response.json()).toEqual({ error: denied.status === 403 ? 'Forbidden.' : 'Unauthenticated.' })
   expect(response.headers()['cache-control']).toContain('private')
   expect(response.headers()['cache-control']).toContain('no-store')
  } finally {
   await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
   await session.cleanup()
  }
 })
}

for (const code of ['FORBIDDEN', 'UNAUTHENTICATED'] as const) {
 test(`MANAGE02 mounted upstream ${code} removes private management content`, async ({ page }) => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Isolated upstream-to-render fixture')
  const session = await createSession({ entryId: 909090 })
  const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
  const status = code === 'FORBIDDEN' ? 403 : 401
  let release!: () => void
  let started!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const pending = new Promise<void>(resolve => { started = resolve })
  const configure = async (available: boolean) => {
   expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [
    { operation: 'GetManagedTournament', variables: { tournamentId: 77, entryId: session.entryId }, data: { managedTournament: available ? { ...managedTournament, setupStatus: 'PROCESSING', setupPhase: 'BUILDING_STRUCTURE' } : null } },
    { operation: 'GetManagedTournamentStatus', error: true, errorCode: code, httpStatus: status }
   ] }) })).ok).toBe(true)
  }
  await page.route('**/api/tournaments/77/status?**', async route => {
   started()
   await gate
   await route.continue()
  })
  try {
   await configure(true)
   await addSessionCookie(page, session.cookie)
   await page.goto('/en/competitions/77/manage')
   const ready = page.locator('[data-competition-perf-ready="manage"]')
   await expect(ready).toHaveAttribute('data-competition-tournament-id', '77')
   await expect(page.locator('#tournament-name')).toBeVisible()
   await pending
   await configure(false)
   const responsePromise = page.waitForResponse(response => response.url().includes('/api/tournaments/77/status?'))
   release()
   const response = await responsePromise
   expect(response.status()).toBe(status)
   expect(response.headers()['cache-control']).toContain('no-store')
   await expect(ready).toHaveCount(0)
   await expect(page.locator('#tournament-name')).toHaveCount(0)
   await expect(page.getByRole('button', { name: 'Delete tournament', exact: true })).toHaveCount(0)
   await expect(page.getByRole('heading', { name: 'Administrator access required', exact: true })).toBeVisible()
   const observed = await (await fetch(fixture)).json()
   expect(observed.requests.filter((x: { operation: string }) => x.operation === 'GetManagedTournamentStatus')).toHaveLength(1)
   expect(observed.requests.some((x: { operation: string }) => x.operation === 'GetManagedTournament')).toBe(true)
  } finally {
   release()
   await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
   await session.cleanup()
  }
 })
}

for (const code of ['FORBIDDEN'] as const) {
 test(`MANAGE02 mounted upstream ${code} recovers after fresh server authorization`, async ({ page }) => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Isolated upstream-to-render fixture')
  const session = await createSession({ entryId: 909090 })
  const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
  const status = code === 'FORBIDDEN' ? 403 : 401
  let release!: () => void
  let started!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const pending = new Promise<void>(resolve => { started = resolve })
  const configure = async (available: boolean, restored = false) => {
   expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [
    { operation: 'GetManagedTournament', variables: { tournamentId: 77, entryId: session.entryId }, data: { managedTournament: available ? { ...managedTournament, setupStatus: restored ? 'READY' : 'PROCESSING', setupPhase: 'BUILDING_STRUCTURE' } : null } },
    { operation: 'GetManagedTournamentStatus', error: true, errorCode: code, httpStatus: status }
   ] }) })).ok).toBe(true)
  }
  await page.route('**/api/tournaments/77/status?**', async route => {
   started()
   await gate
   await route.continue()
  })
  try {
   await configure(true)
   await addSessionCookie(page, session.cookie)
   await page.goto('/en/competitions/77/manage')
   const ready = page.locator('[data-competition-perf-ready="manage"]')
   await expect(ready).toHaveAttribute('data-competition-tournament-id', '77')
   await expect(page.locator('#tournament-name')).toBeVisible()
   await pending
   await configure(true, true)
   const responsePromise = page.waitForResponse(response => response.url().includes('/api/tournaments/77/status?'))
   release()
   const response = await responsePromise
   expect(response.status()).toBe(status)
   expect(response.headers()['cache-control']).toContain('no-store')
   // The RSC read authorizes the same entity with an unchanged key/revision.
   await expect.poll(async () => {
    const state = await (await fetch(fixture)).json()
    return state.requests.filter((x: { operation: string }) => x.operation === 'GetManagedTournament').length
   }).toBeGreaterThan(0)
   await expect(ready).toHaveAttribute('data-competition-tournament-id', '77')
   await expect(page.locator('#tournament-name')).toBeVisible()
   await expect(page.getByRole('heading', { name: 'Administrator access required', exact: true })).toHaveCount(0)
   const observed = await (await fetch(fixture)).json()
   expect(observed.requests.filter((x: { operation: string }) => x.operation === 'GetManagedTournamentStatus')).toHaveLength(1)
   expect(observed.requests.some((x: { operation: string }) => x.operation === 'GetManagedTournament')).toBe(true)
  } finally {
   release()
   await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
   await session.cleanup()
  }
 })
}

test.describe('LP02 bound baseline', () => {
 test.use({ timezoneId: 'Australia/Perth', colorScheme: 'light' })
 for (const locale of ['en', 'zh-CN']) for (const width of [1440, 390]) {
  test(`LP02 bound entry pitch and modal ${locale} ${width}`, async ({ page }, testInfo) => {
   const session = await createSession({ entryId: 123 })
   const zh = locale === 'zh-CN'
   try {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(() => localStorage.setItem('theme', 'system'))
    await addSessionCookie(page, session.cookie)
    await page.goto(`${zh ? '/zh-CN' : ''}/live/points`)
    await expect(page).toHaveURL(url => url.pathname === `${zh ? '/zh-CN' : ''}/live/points`)
    await expect(page.locator('#live-points-entry-id')).toHaveValue(String(session.entryId))
    const pitch = page.getByRole('region', { name: zh ? /阵型/ : /formation/ })
    await expect(pitch.getByRole('button', { name: zh ? /查看 Player/ : /View details for Player/ })).toHaveCount(15)
    await expect(page.locator('#gameweek-jump-input')).toHaveValue('33')
    expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('Australia/Perth')
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('system')
    expect(await page.evaluate(() => innerWidth)).toBe(width)
    for (const [id, label] of [[1, zh ? '队长' : 'Captain'], [2, zh ? '副队长' : 'Vice-captain']] as const) {
     const player = pitch.getByRole('button', { name: zh ? `查看 Player ${id} 的详情` : `View details for Player ${id}`, exact: true })
     await expect(pitch.getByRole('img', { name: label, exact: true })).toHaveCount(1)
     await expect(player.getByRole('img', { name: label, exact: true })).toBeVisible()
    }
    for (const [id, position] of [[1, 'GKP'], [3, 'DEF'], [8, 'MID'], [13, 'FWD'], [15, 'FWD']] as const) {
     const opener = pitch.getByRole('button', { name: zh ? `查看 Player ${id} 的详情` : `View details for Player ${id}`, exact: true })
     await opener.click()
     const dialog = page.getByRole('dialog')
     await expect(dialog).toHaveCount(1)
     await expect(dialog.getByRole('heading', { name: `Player ${id}`, exact: true })).toBeVisible()
     await expect(dialog.getByText(zh ? '正在加载积分明细…' : 'Loading breakdown…', { exact: true })).toHaveCount(0)
     await expect(dialog.getByText(position, { exact: true })).toBeVisible()
     await expect(dialog.getByText(zh ? '估算' : 'Estimated', { exact: true })).toHaveCount(0)
     await expect(dialog.getByText(zh ? '（45 分钟）' : '(45 min)', { exact: true })).toBeVisible()
     await expect(dialog.getByText(`+${id === 1 ? 6 : 1}`, { exact: true }).last()).toBeVisible()
     await dialog.getByRole('button', { name: zh ? '关闭' : 'Close', exact: true }).click()
     await expect(dialog).toHaveCount(0)
     await expect(opener).toBeFocused()
    }
    await testInfo.attach('LP02-bound-context', { contentType: 'application/json', body: JSON.stringify({ variantId: `LP02.B.${locale}.${width === 1440 ? 'desktop1440' : 'mobile390'}.base`, entryId: session.entryId, gw: 33, identity: 'isolated verified bound session', readyMs: null, wholeVariantComplete: false }) })
   } finally { await session.cleanup() }
  }) }
})

test.describe('LP02 bound chip states', () => {
 test.use({ timezoneId: 'UTC', colorScheme: 'dark' })
for (const chip of ['3xc', 'bboost'] as const) {
 test(`LP02 bound state chip ${chip}`, async ({ page }, testInfo) => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Isolated chip payload only')
  const session = await createSession({ entryId: 123 })
  try {
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
  await addSessionCookie(page, session.cookie)
  await page.setViewportSize({ width: 390, height: 844 })
  const expectedTeamPoints = chip === '3xc' ? 28 : 26
  let chipReads = 0
  let contributionSum: number | null = null
  await page.route('**/api/graphql', async route => {
   const request = route.request().postDataJSON() as { query?: string }
   if (!request.query?.includes('GetLiveCalcPoints')) {
    await route.continue()
    return
   }
   const response = await route.fetch({ url: `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/graphql` })
   const body = await response.json()
   const live = body.data.calcLivePointsByEntry
   live.chip = chip
   live.score.eventPoints = expectedTeamPoints
   live.score.netEventPoints = expectedTeamPoints
   for (const pick of live.pickList) {
    pick.multiplier = pick.element === 1 ? (chip === '3xc' ? 3 : 2) : (pick.position <= 11 || chip === 'bboost' ? 1 : 0)
    pick.pickActive = pick.position <= 11 || chip === 'bboost'
   }
   contributionSum = live.pickList.reduce((sum: number, pick: { totalPoints: number; multiplier: number }) => sum + pick.totalPoints * pick.multiplier, 0)
   chipReads += 1
   await route.fulfill({ response, json: body })
  })
  await page.goto('/zh-CN/live/points')
  await expect(page.locator('#live-points-entry-id')).toHaveValue(String(session.entryId))
  await expect(page.locator('#gameweek-jump-input')).toHaveValue('33')
  expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('UTC')
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark')
  await expect(page.locator('html')).toHaveClass(/dark/)
  expect(await page.evaluate(() => innerWidth)).toBe(390)
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  await expect.poll(() => chipReads).toBeGreaterThan(0)
  expect(contributionSum).toBe(expectedTeamPoints)
  const pitch = page.getByRole('region', { name: /阵型/ })
  await expect(pitch.getByText(chip === '3xc' ? 'TC' : 'BB', { exact: true }).first()).toBeVisible()
  await expect(pitch.getByText(String(expectedTeamPoints), { exact: true }).first()).toBeVisible()
  for (const [id, rawPoints] of [[1, 6], [15, 1]] as const) {
   await pitch.getByRole('button', { name: `查看 Player ${id} 的详情`, exact: true }).click()
   const dialog = page.getByRole('dialog')
   await expect(dialog.getByRole('heading', { name: `Player ${id}`, exact: true })).toBeVisible()
   await expect(dialog.getByText('正在加载积分明细…', { exact: true })).toHaveCount(0)
   await expect(dialog.getByText('估算', { exact: true })).toHaveCount(0)
   await expect(dialog.getByText(`+${rawPoints}`, { exact: true }).last()).toBeVisible()
   if (id === 1) await expect(dialog.getByText(chip === '3xc' ? '+18' : '+12', { exact: true })).toHaveCount(0)
   await dialog.getByRole('button', { name: '关闭', exact: true }).click()
  }
  await testInfo.attach('LP02-state-context', { contentType: 'application/json', body: JSON.stringify({ variantId: chip === '3xc' ? 'LP02.state.03' : 'LP02.state.02', entryId: session.entryId, gw: 33, chip, expectedTeamPoints, contributionSum, locale: 'zh-CN', width: 390, theme: 'dark', timezone: 'UTC', readyMs: null, wholeVariantComplete: false }) })
  } finally { await session.cleanup() }
 })
}

})

test.describe('LP02 bound automatic substitution', () => {
 test.use({ timezoneId: 'UTC', colorScheme: 'dark', viewport: { width: 390, height: 844 } })
 for (const lifecycle of ['published', 'official'] as const) {
 test(`LP02 state01 ${lifecycle} defender swap retains bound context`, async ({ page }, testInfo) => {
  const session = await createSession({ entryId: 123 })
  let reads = 0
  try {
   await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
   await addSessionCookie(page, session.cookie)
   await page.route('**/api/graphql', async route => {
    if (!route.request().postDataJSON().query?.includes('GetLiveCalcPoints')) return route.continue()
    const response = await route.fetch({ url: `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/graphql` })
    const body = await response.json()
    const live = body.data.calcLivePointsByEntry
    const order = [1, 3, 4, 5, 8, 9, 10, 11, 13, 14, 15, 2, 6, 7, 12]
    for (const pick of live.pickList) {
     pick.position = order.indexOf(pick.element) + 1
     pick.pickActive = (pick.position <= 11 && pick.element !== 3) || pick.element === 6
     pick.multiplier = pick.pickActive ? (pick.element === 1 ? 2 : 1) : 0
     pick.autoSub = pick.element === 6
     if (pick.element === 3) { pick.minutes = 0; pick.totalPoints = 0; pick.isGwFinished = true; pick.isPlayed = false }
    }
    if (lifecycle === 'official') {
     live.score.delivery = { ...live.score.delivery, state: 'FINAL' }
     live.score.source = 'FPL_FINAL_RESULT'
     live.score.calculationMode = 'FINAL_RESULT'
    }
    live.score.eventPoints = 22
    live.score.netEventPoints = 22
    reads++
    await route.fulfill({ response, json: body })
   })
   await page.goto('/zh-CN/live/points')
   await expect(page.locator('#live-points-entry-id')).toHaveValue(String(session.entryId))
   await page.getByRole('button', { name: '刷新', exact: true }).click()
   await expect.poll(() => reads).toBeGreaterThan(0)
   await expect(page.locator('#gameweek-jump-input')).toHaveValue('33')
   expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('UTC')
   expect(await page.evaluate(() => innerWidth)).toBe(390)
   await expect(page.locator('html')).toHaveClass(/dark/)
   const pitch = page.getByRole('region', { name: /阵型/ })
   const incoming = pitch.getByRole('button', { name: lifecycle === 'official' ? /查看 Player 6 的详情.*官方已换入 Player 6，替下 Player 3/ : /查看 Player 6 的详情.*实时自动换人：Player 6 换入，替下 Player 3/ })
   const outgoing = pitch.getByRole('button', { name: lifecycle === 'official' ? /查看 Player 3 的详情.*官方已用 Player 6 替下 Player 3/ : /查看 Player 3 的详情.*实时自动换人：Player 3 被 Player 6 替下/ })
   await expect(incoming).toBeVisible()
   await expect(outgoing).toBeVisible()
   for (const [position, ids] of [['GKP', [1]], ['DEF', [6, 4, 5]], ['MID', [8, 9, 10, 11]], ['FWD', [13, 14, 15]]] as const) {
    const row = pitch.getByRole('list', { name: position, exact: true })
    await expect(row.getByRole('button')).toHaveCount(ids.length)
    const names = await row.getByRole('button').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')?.match(/Player (\d+)/)?.[1]))
    expect(names).toEqual(ids.map(String))
   }
   const bench = pitch.locator('ol:not([aria-label])')
   await expect(bench.getByRole('button')).toHaveCount(4)
   expect(await bench.getByRole('button').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')?.match(/Player (\d+)/)?.[1]))).toEqual(['2', '3', '7', '12'])

   await expect(pitch.getByText('22', { exact: true }).first()).toBeVisible()
   await incoming.click()
   const dialog = page.getByRole('dialog')
   await expect(dialog.getByRole('heading', { name: 'Player 6', exact: true })).toBeVisible()
   await expect(dialog.getByText('+1', { exact: true }).last()).toBeVisible()
   await dialog.getByRole('button', { name: '关闭', exact: true }).click()
   await expect(incoming).toBeFocused()
   await testInfo.attach('LP02-auto-sub', { contentType: 'application/json', body: JSON.stringify({ variantId: 'LP02.state.01', lifecycle, entryId: session.entryId, gw: 33, incoming: 6, outgoing: 3, expectedTeamPoints: 22, readyMs: null, wholeVariantComplete: false }) })
  } finally { await session.cleanup() }
 })
 }
})

test.describe('LP02 bound double gameweek', () => {
 test.use({ timezoneId: 'UTC', colorScheme: 'dark', viewport: { width: 390, height: 844 } })
 test('LP02 state04 aggregated two-fixture captain points', async ({ page }, testInfo) => {
  const session = await createSession({ entryId: 123 })
  let liveReads = 0
  let explainReads = 0
  // Two fixture inputs: 90 minutes + fifteen saves, then 90 minutes, total 9.
  const contributions = [{ identifier: 'minutes', value: 180, points: 4 }, { identifier: 'saves', value: 15, points: 5 }]
  try {
   await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
   await addSessionCookie(page, session.cookie)
   await page.route('**/api/graphql', async route => {
    const query = route.request().postDataJSON().query ?? ''
    if (!query.includes('GetLiveCalcPoints') && !query.includes('EventLiveExplainBatch')) return route.continue()
    const response = await route.fetch({ url: `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/graphql` })
    const body = await response.json()
    if (query.includes('GetLiveCalcPoints')) {
     const live = body.data.calcLivePointsByEntry
     const captain = live.pickList.find((pick: { element: number }) => pick.element === 1)
     captain.minutes = 180
     captain.goalsScored = 0
     captain.saves = 15
     captain.totalPoints = 9
     captain.multiplier = 2
     live.score.eventPoints = 28
     live.score.netEventPoints = 28
     liveReads++
    } else {
     const captain = body.data.eventLiveExplains.find((item: { elementId: number }) => item.elementId === 1)
     captain.stats.minutes = 180
     captain.stats.goalsScored = 0
     captain.stats.saves = 15
     captain.contributions = contributions
     explainReads++
    }
    await route.fulfill({ response, json: body })
   })
   await page.goto('/zh-CN/live/points')
   await expect(page.locator('#live-points-entry-id')).toHaveValue(String(session.entryId))
   await page.getByRole('button', { name: '刷新', exact: true }).click()
   await expect.poll(() => liveReads).toBeGreaterThan(0)
   await expect.poll(() => explainReads).toBeGreaterThan(0)
   await expect(page.locator('#gameweek-jump-input')).toHaveValue('33')
   expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('UTC')
   expect(await page.evaluate(() => innerWidth)).toBe(390)
   await expect(page.locator('html')).toHaveClass(/dark/)
   const pitch = page.getByRole('region', { name: /阵型/ })
   await expect(pitch.getByText('28', { exact: true }).first()).toBeVisible()
   const captain = pitch.getByRole('button', { name: '查看 Player 1 的详情', exact: true })
   await captain.click()
   const dialog = page.getByRole('dialog')
   await expect(dialog.getByRole('heading', { name: 'Player 1', exact: true })).toBeVisible()
   await expect(dialog.getByText('（180 分钟）', { exact: true })).toBeVisible()
   await expect(dialog.getByText('+9', { exact: true }).last()).toBeVisible()
   await expect(dialog.getByText('估算', { exact: true })).toHaveCount(0)
   await expect(dialog.getByText('+18', { exact: true })).toHaveCount(0)
   await dialog.getByRole('button', { name: '关闭', exact: true }).click()
   await expect(captain).toBeFocused()
   await testInfo.attach('LP02-DGW-context', { contentType: 'application/json', body: JSON.stringify({ variantId: 'LP02.state.04', entryId: session.entryId, gw: 33, fixturePoints: [7, 2], rawPoints: 9, captainContribution: 18, teamTotal: 28, readyMs: null, wholeVariantComplete: false }) })
  } finally { await session.cleanup() }
 })
})

test.describe('LP03 bound transfer states', () => {
 test.use({ timezoneId: 'UTC', colorScheme: 'dark', viewport: { width: 390, height: 844 } })
 for (const status of [503, 401]) {
  test(`LP03 bound transfer ${status} recovers to explicit empty`, async ({ page }, testInfo) => {
   const session = await createSession({ entryId: 123 })
   let reads = 0
   let recovered = false
   try {
    await page.clock.install()
    await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
    await addSessionCookie(page, session.cookie)
    await page.route('**/api/graphql', async route => {
     const payload = route.request().postDataJSON()
     if (!payload.query?.includes('GetEntryTransferHistory')) return route.continue()
     expect(payload.variables.entryId).toBe(session.entryId)
     reads++
     await route.fulfill(!recovered ? { status, json: { errors: [{ message: 'Controlled unavailable transfer history' }] } } : { status: 200, json: { data: { entryTransferHistory: [] } } })
    })
    await page.goto('/zh-CN/live/points')
    await expect(page.locator('#live-points-entry-id')).toHaveValue(String(session.entryId))
    expect(await page.evaluate(() => ({ width: innerWidth, lang: document.documentElement.lang, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }))).toEqual({ width: 390, lang: 'zh-CN', timezone: 'UTC' })
    await expect(page.locator('html')).toHaveClass(/dark/)
    const section = page.getByRole('region', { name: /本周转会/ })
    await section.getByRole('button', { name: '刷新转会', exact: true }).click()
    await expect(section.getByRole('alert')).toContainText('转会记录加载失败')
    expect(reads).toBeGreaterThan(0)
    const failedReads = reads
    if (status === 503) {
     await section.getByRole('button', { name: '刷新转会', exact: true }).click()
     await expect(section.getByRole('alert')).toContainText('转会记录加载失败')
     expect(reads).toBe(failedReads)
     await page.clock.fastForward(30_000)
    }
    recovered = true
    await section.getByRole('button', { name: '刷新转会', exact: true }).click()
    await expect(section.getByText('本轮暂无已同步的转会记录。', { exact: true })).toBeVisible()
    await expect(section.getByRole('alert')).toHaveCount(0)
    await expect.poll(() => reads).toBeGreaterThan(failedReads)
    await expect(page.locator('#live-points-entry-id')).toHaveValue(String(session.entryId))
    await testInfo.attach('LP03-bound-state', { contentType: 'application/json', body: JSON.stringify({ variantIds: ['LP03.state.01', status === 401 ? 'LP03.state.03' : 'LP03.state.02'], entryId: session.entryId, status, readyMs: null, scope: 'Bound public transfer request error to empty recovery, not session reauthorization', wholeVariantComplete: false }) })
   } finally { await session.cleanup() }
  })
 }
})

for (const locale of ['en', 'zh-CN'] as const) for (const width of [1440, 390]) {
 test.describe(`LP03 bound baseline ${locale} ${width}`, () => {
  test.use({ timezoneId: 'Australia/Perth', colorScheme: 'light', viewport: { width, height: 900 } })
  test('LP03 bound transfer content preserves entry identity', async ({ page }, testInfo) => {
   const session = await createSession({ entryId: 123 })
   let reads = 0
   try {
    await page.addInitScript(() => localStorage.setItem('theme', 'system'))
    await addSessionCookie(page, session.cookie)
    await page.route('**/api/graphql', async route => {
     const payload = route.request().postDataJSON()
     if (!payload.query?.includes('GetEntryTransferHistory')) return route.continue()
     expect(payload.variables.entryId).toBe(session.entryId)
     reads++
     await route.fulfill({ json: { data: { entryTransferHistory: [{ eventId: 33, eventTransfers: 1, eventTransfersCost: 0, transfers: [{ event: 33, elementOutWebName: 'Outgoing Player', elementOutTeamShortName: 'OUT', elementOutTypeName: 'MID', elementOutCost: 5.5, elementInWebName: 'Incoming Player', elementInTeamShortName: 'IN', elementInTypeName: 'MID', elementInCost: 6.2, time: '2026-08-04T10:00:00Z' }] }] } } })
    })
    await page.goto(`${locale === 'en' ? '' : '/zh-CN'}/live/points`)
    await expect(page.locator('#live-points-entry-id')).toHaveValue(String(session.entryId))
    expect(await page.evaluate(() => ({ width: innerWidth, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, theme: localStorage.getItem('theme'), language: document.documentElement.lang }))).toEqual({ width, timezone: 'Australia/Perth', theme: 'system', language: locale })
    const section = page.getByRole('region', { name: locale === 'en' ? /Gameweek transfers.*GW33/ : /本周转会.*GW33/ })
    await section.getByRole('button', { name: locale === 'en' ? 'Refresh transfers' : '刷新转会', exact: true }).click()
    for (const text of ['Incoming Player', 'Outgoing Player', '£5.5m', '£6.2m']) await expect(section).toContainText(text)
    await expect(section.getByRole('alert')).toHaveCount(0)
    expect(reads).toBeGreaterThan(0)
    expect(await section.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
    await testInfo.attach('LP03-baseline', { contentType: 'application/json', body: JSON.stringify({ variantId: `LP03.B.${locale}.${width === 390 ? 'mobile390' : 'desktop1440'}.base`, entryId: session.entryId, readyMs: null, wholeVariantComplete: false }) })
   } finally { await session.cleanup() }
  })
 })
}

test.describe('MATCH03 stale FULL boundary', () => {
 test.use({ timezoneId: 'UTC', colorScheme: 'dark', viewport: { width: 390, height: 844 } })
 test('MATCH03 old FULL does not roll back accepted desk generation', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
  const response = await fetch(`http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/graphql`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'query GetLiveMatchdayV3 { liveMatchday { availability } }', variables: { eventId: 33 } }) })
  const seed = await response.json()
  expect(seed.errors).toBeUndefined()
  const newer = structuredClone(seed.data)
  newer.liveMatchday.snapshot.revisions.deskGeneration += 2
  newer.liveMatchday.snapshot.revisions.deskPublicationId = 'match03-new-desk'
  newer.liveMatchday.snapshot.revisions.scoreState = 'f'.repeat(24)
  const oldMatch = seed.data.liveMatchday.snapshot.matches[0]
  const oldScore = `${oldMatch.homeScore}–${oldMatch.awayScore}`
  newer.liveMatchday.snapshot.matches[0].homeScore = oldMatch.homeScore + 3
  const newScore = `${oldMatch.homeScore + 3}–${oldMatch.awayScore}`
  let reads = 0
  await page.route('**/api/live/matches?*', async route => {
   reads++
   await route.fulfill({ status: 200, json: reads === 1 ? newer : seed.data })
  })
  await page.goto('/zh-CN/live/matches')
  expect(await page.evaluate(() => ({ width: innerWidth, language: document.documentElement.lang, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }))).toEqual({ width: 390, language: 'zh-CN', timezone: 'UTC' })
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.getByText(oldScore, { exact: true })).toBeVisible()
  const refresh = page.getByRole('button', { name: '刷新比赛', exact: true }).filter({ visible: true })
  await refresh.click()
  await expect(page.getByText(newScore, { exact: true })).toBeVisible()
  await expect.poll(() => reads).toBe(1)
  await refresh.click()
  await expect.poll(() => reads).toBe(2)
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('错误：最新比赛更新失败，正在显示上次可用的比分。')
  await expect(page.getByText(newScore, { exact: true })).toBeVisible()
  await expect(page.getByText(oldScore, { exact: true })).toHaveCount(0)
  const currentView = page.locator('[data-live-matchday-view="true"]')
  await expect(currentView).toHaveAttribute('data-event-id', '33')
  await expect(currentView).toHaveAttribute('data-revisions', JSON.stringify(newer.liveMatchday.snapshot.revisions))
  await expect(currentView).toHaveAttribute('data-loading', 'false')
  await testInfo.attach('MATCH03-stale-FULL', { contentType: 'application/json', body: JSON.stringify({ variantId: 'MATCH03.state.02', acceptedGeneration: newer.liveMatchday.snapshot.revisions.deskGeneration, rejectedGeneration: seed.data.liveMatchday.snapshot.revisions.deskGeneration, reads, readyMs: null, wholeVariantComplete: false }) })
 })
})

test.describe('MATCH03 stale detail boundary', () => {
 test.use({ timezoneId: 'UTC', colorScheme: 'dark', viewport: { width: 390, height: 844 } })
 test('MATCH03 newer desk retains accepted player details', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
  const response = await fetch(`http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/graphql`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'query GetLiveMatchdayV3 { liveMatchday { availability } }', variables: { eventId: 33 } }) })
  const seed = await response.json()
  expect(seed.errors).toBeUndefined()
  const newer = structuredClone(seed.data)
  newer.liveMatchday.snapshot.revisions.deskGeneration += 2
  newer.liveMatchday.snapshot.revisions.deskPublicationId = 'match03-new-desk'
  newer.liveMatchday.snapshot.revisions.scoreState = 'f'.repeat(24)
  const oldMatch = seed.data.liveMatchday.snapshot.matches[0]
  const oldScore = `${oldMatch.homeScore}–${oldMatch.awayScore}`
  newer.liveMatchday.snapshot.matches[0].homeScore = oldMatch.homeScore + 3
  const newScore = `${oldMatch.homeScore + 3}–${oldMatch.awayScore}`
  newer.liveMatchday.snapshot.revisions.detailGeneration = 10
  newer.liveMatchday.snapshot.revisions.detailPublicationId = 'detail10'
  newer.liveMatchday.snapshot.revisions.playerDetail = 'd'.repeat(24)
  newer.liveMatchday.snapshot.matches[0].players = [{ id: 257, webName: 'Accepted Bassey', position: 'DEFENDER', teamId: oldMatch.homeTeamId, price: 45, totalPoints: 6, stats: [{ identifier: 'minutes', value: 90 }] }]
  newer.liveMatchday.snapshot.matches[0].players.push({ id: 9999, webName: 'Accepted Away Player', position: 'MIDFIELDER', teamId: oldMatch.awayTeamId, price: 55, totalPoints: 2, stats: [{ identifier: 'minutes', value: 90 }] })
  const staleDetail = structuredClone(newer)
  staleDetail.liveMatchday.snapshot.revisions.deskGeneration++
  staleDetail.liveMatchday.snapshot.revisions.deskPublicationId = 'new-desk-old-detail'
  staleDetail.liveMatchday.snapshot.revisions.scoreState = 'e'.repeat(24)
  staleDetail.liveMatchday.snapshot.revisions.detailGeneration = 1
  staleDetail.liveMatchday.snapshot.revisions.detailPublicationId = 'detail1'
  staleDetail.liveMatchday.snapshot.revisions.playerDetail = 'a'.repeat(24)
  staleDetail.liveMatchday.snapshot.matches[0].homeScore++
  staleDetail.liveMatchday.snapshot.matches[0].players[0].webName = 'Obsolete Bassey'
  const latestScore = `${oldMatch.homeScore + 4}–${oldMatch.awayScore}`
  let reads = 0
  await page.route('**/api/live/matches?*', async route => {
   reads++
   await route.fulfill({ status: 200, json: reads === 1 ? newer : staleDetail })
  })
  await page.goto('/zh-CN/live/matches')
  expect(await page.evaluate(() => ({ width: innerWidth, language: document.documentElement.lang, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }))).toEqual({ width: 390, language: 'zh-CN', timezone: 'UTC' })
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.getByText(oldScore, { exact: true })).toBeVisible()
  const refresh = page.getByRole('button', { name: '刷新比赛', exact: true }).filter({ visible: true })
  await refresh.click()
  await expect(page.getByText(newScore, { exact: true })).toBeVisible()
  await expect.poll(() => reads).toBe(1)
  await page.getByRole('button', { name: '球员列表', exact: true }).click()
  await expect(page.getByText('Accepted Bassey', { exact: true })).toBeVisible()
  const teamTabs = page.getByRole('region', { name: zhMessages.LiveMatches.playerPoints, exact: true }).getByRole('tab')
  await expect(teamTabs).toHaveCount(2)
  await expect(teamTabs.nth(0)).toHaveAttribute('aria-selected', 'true')
  await teamTabs.nth(1).click()
  await expect(teamTabs.nth(1)).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('Accepted Away Player', { exact: true })).toBeVisible()
  await expect(page.getByText('Accepted Bassey', { exact: true })).toHaveCount(0)
  await teamTabs.nth(0).click()
  await expect(teamTabs.nth(0)).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('Accepted Bassey', { exact: true })).toBeVisible()
  await expect(page.getByText('Accepted Away Player', { exact: true })).toHaveCount(0)
  await refresh.click()
  await expect.poll(() => reads).toBe(2)
  await expect(page.getByText(latestScore, { exact: true })).toBeVisible()
  await expect(page.getByText('Accepted Bassey', { exact: true })).toBeVisible()
  await expect(page.getByText('Obsolete Bassey', { exact: true })).toHaveCount(0)
  await expect(teamTabs.nth(0)).toHaveAttribute('aria-selected', 'true')
  await testInfo.attach('MATCH03-stale-detail', { contentType: 'application/json', body: JSON.stringify({ variantId: 'MATCH03.state.02', acceptedDetailGeneration: 10, rejectedDetailGeneration: 1, acceptedDeskGeneration: staleDetail.liveMatchday.snapshot.revisions.deskGeneration, displayedScore: latestScore, reads, readyMs: null, wholeVariantComplete: false }) })
 })
})

test.describe('MATCH03 delayed HEAD boundary', () => {
 test.use({ timezoneId: 'UTC', colorScheme: 'dark', viewport: { width: 390, height: 844 } })
 test('MATCH03 delayed HEAD cannot roll back newer FULL', async ({ page }, testInfo) => {
  await page.clock.install({ time: new Date('2026-08-04T18:30:00.000Z') })
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
  const response = await fetch(`http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/graphql`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'query GetLiveMatchdayV3 { liveMatchday { availability } }', variables: { eventId: 33 } }) })
  const seed = await response.json()
  expect(seed.errors).toBeUndefined()
  const newer = structuredClone(seed.data)
  newer.liveMatchday.snapshot.revisions.deskGeneration += 2
  newer.liveMatchday.snapshot.revisions.deskPublicationId = 'match03-new-desk'
  newer.liveMatchday.snapshot.revisions.scoreState = 'f'.repeat(24)
  const oldMatch = seed.data.liveMatchday.snapshot.matches[0]
  const oldScore = `${oldMatch.homeScore}–${oldMatch.awayScore}`
  newer.liveMatchday.snapshot.matches[0].homeScore = oldMatch.homeScore + 3
  const newScore = `${oldMatch.homeScore + 3}–${oldMatch.awayScore}`
  let headReads = 0
  let releaseHead!: () => void
  const headGate = new Promise<void>(resolve => { releaseHead = resolve })
  const head = structuredClone(seed.data)
  delete head.liveMatchday.snapshot.matches
  head.liveMatchday.snapshot.detailDelivery.state = 'PENDING'
  for (const key of ['detailPublicationId', 'detailGeneration', 'playerDetail']) delete head.liveMatchday.snapshot.revisions[key]
  await page.route('**/api/graphql', async route => {
   if (!route.request().postData()?.includes('GetLiveMatchdayHead')) return route.continue()
   headReads++
   await headGate
   await route.fulfill({ json: { data: head } })
  })
  let reads = 0
  await page.route('**/api/live/matches?*', async route => {
   reads++
   await route.fulfill({ status: 200, json: newer })
  })
  await page.goto('/zh-CN/live/matches')
  expect(await page.evaluate(() => ({ width: innerWidth, language: document.documentElement.lang, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }))).toEqual({ width: 390, language: 'zh-CN', timezone: 'UTC' })
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.getByText(oldScore, { exact: true })).toBeVisible()
  const refresh = page.getByRole('button', { name: '刷新比赛', exact: true }).filter({ visible: true })
  const { resolveLiveRefreshProfile } = await import('../lib/live-refresh')
  const interval = resolveLiveRefreshProfile(process.env.NEXT_PUBLIC_LIVE_REFRESH_PROFILE, 'production') === 'conserve' ? 120_000 : 30_000
  await page.clock.fastForward(Math.ceil(interval * 1.1) + 1_000)
  await expect.poll(() => headReads).toBeGreaterThan(0)
  await refresh.click()
  await expect(page.getByText(newScore, { exact: true })).toBeVisible()
  await expect.poll(() => reads).toBe(1)
  const settledHead = page.waitForResponse(response => response.request().postData()?.includes('GetLiveMatchdayHead') === true)
  releaseHead()
  await settledHead
  await page.clock.fastForward(1000)
  await expect(page.getByText(newScore, { exact: true })).toBeVisible()
  await expect(page.getByText(oldScore, { exact: true })).toHaveCount(0)
  const currentView = page.locator('[data-live-matchday-view="true"]')
  await expect(currentView).toHaveAttribute('data-event-id', '33')
  await expect(currentView).toHaveAttribute('data-revisions', JSON.stringify(newer.liveMatchday.snapshot.revisions))
  await expect(currentView).toHaveAttribute('data-loading', 'false')
  await testInfo.attach('MATCH03-delayed-HEAD', { contentType: 'application/json', body: JSON.stringify({ variantId: 'MATCH03.state.02', acceptedGeneration: newer.liveMatchday.snapshot.revisions.deskGeneration, rejectedGeneration: seed.data.liveMatchday.snapshot.revisions.deskGeneration, reads, readyMs: null, wholeVariantComplete: false }) })
 })
})

test.describe('MATCH03 unchanged HEAD boundary', () => {
 test.use({ timezoneId: 'UTC', colorScheme: 'dark', viewport: { width: 390, height: 844 } })
 test('MATCH03 unchanged HEAD avoids FULL reads', async ({ page }, testInfo) => {
  await page.clock.install({ time: new Date('2026-08-04T18:30:00.000Z') })
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
  const response = await fetch(`http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/graphql`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'query GetLiveMatchdayV3 { liveMatchday { availability } }', variables: { eventId: 33 } }) })
  const seed = await response.json()
  expect(seed.errors).toBeUndefined()
  const oldMatch = seed.data.liveMatchday.snapshot.matches[0]
  const oldScore = `${oldMatch.homeScore}–${oldMatch.awayScore}`
  let headReads = 0
  const head = structuredClone(seed.data)
  delete head.liveMatchday.snapshot.matches
  head.liveMatchday.snapshot.detailDelivery.state = 'PENDING'
  for (const key of ['detailPublicationId', 'detailGeneration', 'playerDetail']) delete head.liveMatchday.snapshot.revisions[key]
  await page.route('**/api/graphql', async route => {
   if (!route.request().postData()?.includes('GetLiveMatchdayHead')) return route.continue()
   headReads++
   await route.fulfill({ json: { data: head } })
  })
  let reads = 0
  await page.route('**/api/live/matches?*', async route => {
   reads++
   await route.fulfill({ status: 200, json: seed.data })
  })
  await page.goto('/zh-CN/live/matches')
  expect(await page.evaluate(() => ({ width: innerWidth, language: document.documentElement.lang, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }))).toEqual({ width: 390, language: 'zh-CN', timezone: 'UTC' })
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.getByText(oldScore, { exact: true })).toBeVisible()
  const { resolveLiveRefreshProfile } = await import('../lib/live-refresh')
  const interval = resolveLiveRefreshProfile(process.env.NEXT_PUBLIC_LIVE_REFRESH_PROFILE, 'production') === 'conserve' ? 120_000 : 30_000
  for (let index = 0; index < 3; index++) {
   const before = headReads
   const settled = page.waitForResponse(response => response.request().postData()?.includes('GetLiveMatchdayHead') === true)
   await page.clock.fastForward(Math.ceil(interval * 1.1) + 1_000)
   await settled
   await expect.poll(() => headReads).toBeGreaterThan(before)
   await expect(page.getByText(oldScore, { exact: true })).toBeVisible()
   expect(reads).toBe(0)
  }
  await testInfo.attach('MATCH03-unchanged-HEAD', { contentType: 'application/json', body: JSON.stringify({ variantId: 'MATCH03.state.01', headReads, fullReads: reads, headFixtureBodyBytes: Buffer.byteLength(JSON.stringify(head)), fullFixtureBodyBytes: Buffer.byteLength(JSON.stringify(seed.data)), byteScope: 'Uncompressed fixture JSON only, not network transfer bytes', readyMs: null, wholeVariantComplete: false }) })
 })
})

test.describe('MATCH03 partial detail boundary', () => {
 test.use({ timezoneId: 'UTC', colorScheme: 'dark', viewport: { width: 390, height: 844 } })
 test('MATCH03 delayed detail keeps scores and recovers', async ({ page }, testInfo) => {
  await page.clock.install({ time: new Date('2026-08-04T18:30:00.000Z') })
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
  const response = await fetch(`http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/graphql`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'query GetLiveMatchdayV3 { liveMatchday { availability } }', variables: { eventId: 33 } }) })
  const seed = await response.json()
  expect(seed.errors).toBeUndefined()
  const oldMatch = seed.data.liveMatchday.snapshot.matches[0]
  const oldScore = `${oldMatch.homeScore}–${oldMatch.awayScore}`
  const delayed = structuredClone(seed.data)
  delayed.liveMatchday.snapshot.revisions.deskGeneration += 1
  delayed.liveMatchday.snapshot.revisions.deskPublicationId = 'match03-partial-desk'
  delayed.liveMatchday.snapshot.revisions.scoreState = 'e'.repeat(24)
  delayed.liveMatchday.snapshot.matches[0].homeScore += 1
  delayed.liveMatchday.snapshot.detailDelivery = { state: 'DEGRADED', servedFrom: 'REDIS_CURRENT', reasonCodes: ['DETAIL_PENDING'] }
  const recovered = structuredClone(delayed)
  recovered.liveMatchday.snapshot.revisions.deskGeneration += 1
  recovered.liveMatchday.snapshot.revisions.deskPublicationId = 'match03-recovered-desk'
  recovered.liveMatchday.snapshot.detailDelivery = seed.data.liveMatchday.snapshot.detailDelivery
  let reads = 0
  await page.route('**/api/live/matches?*', async route => {
   reads++
   await route.fulfill({ json: reads === 1 ? delayed : recovered })
  })
  await page.goto('/zh-CN/live/matches')
  expect(await page.evaluate(() => ({ width: innerWidth, language: document.documentElement.lang, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }))).toEqual({ width: 390, language: 'zh-CN', timezone: 'UTC' })
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.getByText(oldScore, { exact: true })).toBeVisible()
  const refresh = page.getByRole('button', { name: '刷新比赛', exact: true }).filter({ visible: true })
  await refresh.click()
  await expect.poll(() => reads).toBe(1)
  await expect(page.getByText(`${oldMatch.homeScore + 1}–${oldMatch.awayScore}`, { exact: true })).toBeVisible()
  await expect(page.getByText(/球员数据正在更新/)).toBeVisible()
  await refresh.click()
  await expect.poll(() => reads).toBe(2)
  await expect(page.getByText(`${oldMatch.homeScore + 1}–${oldMatch.awayScore}`, { exact: true })).toBeVisible()
  await expect(page.getByText(/球员数据正在更新/)).toHaveCount(0)
  await testInfo.attach('MATCH03-partial-detail', { contentType: 'application/json', body: JSON.stringify({ variantId: 'MATCH03.state.03', fullReads: reads, scope: 'READY desk with DEGRADED detail then recovery', readyMs: null, wholeVariantComplete: false }) })
 })
})

test.describe('MATCH03 initial unavailable boundary', () => {
 test.use({ timezoneId: 'UTC', colorScheme: 'dark', viewport: { width: 390, height: 844 } })
 test('MATCH03 unavailable publication has no fake cards and recovers', async ({ page }, testInfo) => {
  const endpoint = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}`
  const seed = await (await fetch(`${endpoint}/graphql`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'query GetLiveMatchdayV3 { liveMatchday { availability } }', variables: { eventId: 33 } }) })).json()
  expect(seed.errors).toBeUndefined()
  const match = seed.data.liveMatchday.snapshot.matches[0]
  const unavailable = { liveMatchday: { availability: 'UNAVAILABLE', delivery: { state: 'UNAVAILABLE', servedFrom: null, reasonCodes: ['DESK_UNAVAILABLE'] }, snapshot: null } }
  const control = (rules: unknown[]) => fetch(`${endpoint}/__performance`, { method: 'POST', body: JSON.stringify({ rules }) })
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
  try {
   expect((await control([{ operation: 'GetLiveMatchdayV3', data: unavailable }])).ok).toBe(true)
   await page.goto('/zh-CN/live/matches')
   expect(await page.evaluate(() => ({ width: innerWidth, language: document.documentElement.lang, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }))).toEqual({ width: 390, language: 'zh-CN', timezone: 'UTC' })
   await expect(page.locator('html')).toHaveClass(/dark/)
   await expect(page.locator('[data-letletme-contract="live_matches"]')).toHaveAttribute('data-status', 'UNAVAILABLE')
   await expect(page.getByText('官方数据正在更新，比赛发布后会自动显示。', { exact: true })).toBeVisible()
   await expect(page.locator('[data-live-match-card="true"]')).toHaveCount(0)
   expect((await control([])).ok).toBe(true)
   const response = page.waitForResponse(response => new URL(response.url()).pathname === '/api/live/matches')
   await page.getByRole('button', { name: '刷新比赛', exact: true }).filter({ visible: true }).click()
   const result = await response
   expect(result.status()).toBe(200)
   expect((await result.json()).liveMatchday.snapshot.eventId).toBe(33)
   await expect(page.locator('[data-live-match-card="true"]')).toHaveCount(seed.data.liveMatchday.snapshot.matches.length)
   await expect(page.getByText(`${match.homeScore}–${match.awayScore}`, { exact: true })).toBeVisible()
   await expect(page.getByText('官方数据正在更新，比赛发布后会自动显示。', { exact: true })).toHaveCount(0)
   const currentView = page.locator('[data-live-matchday-view="true"]')
   await expect(currentView).toHaveAttribute('data-event-id', '33')
   await expect(currentView).toHaveAttribute('data-season', String(seed.data.liveMatchday.snapshot.season))
   await expect(currentView).toHaveAttribute('data-revisions', JSON.stringify(seed.data.liveMatchday.snapshot.revisions))
   await expect(currentView).toHaveAttribute('data-loading', 'false')
   // This server marker describes the initial seed, not the refreshed client state.
   await expect(page.locator('[data-letletme-contract="live_matches"]')).toHaveAttribute('data-status', 'UNAVAILABLE')
   await expect(page.locator('[data-letletme-contract="live_matches"]')).toHaveAttribute('data-revision', 'unavailable')
   await testInfo.attach('MATCH03-unavailable', { contentType: 'application/json', body: JSON.stringify({ variantId: 'MATCH03.state.03', eventId: 33, readyMs: null, wholeVariantComplete: false }) })
  } finally {
   expect((await control([])).ok).toBe(true)
  }
 })
})

for (const locale of ['en', 'zh-CN'] as const) {
 for (const width of [1440, 390]) {
 test.describe(`MATCH03 baseline ${locale} ${width}`, () => {
 test.use({ timezoneId: 'Australia/Perth', colorScheme: 'light', viewport: { width, height: 900 } })
 test('MATCH03 HEAD changes fetch one FULL and preserve revision', async ({ page }, testInfo) => {
  await page.clock.install({ time: new Date('2026-08-04T18:30:00.000Z') })
  await page.addInitScript(() => localStorage.setItem('theme', 'system'))
  const response = await fetch(`http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/graphql`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'query GetLiveMatchdayV3 { liveMatchday { availability } }', variables: { eventId: 33 } }) })
  const seed = await response.json()
  expect(seed.errors).toBeUndefined()
  const oldMatch = seed.data.liveMatchday.snapshot.matches[0]
  const oldScore = `${oldMatch.homeScore}–${oldMatch.awayScore}`
  let headReads = 0
  const head = structuredClone(seed.data)
  delete head.liveMatchday.snapshot.matches
  head.liveMatchday.snapshot.detailDelivery.state = 'PENDING'
  for (const key of ['detailPublicationId', 'detailGeneration', 'playerDetail']) delete head.liveMatchday.snapshot.revisions[key]
  await page.route('**/api/graphql', async route => {
   if (!route.request().postData()?.includes('GetLiveMatchdayHead')) return route.continue()
   headReads++
   await route.fulfill({ json: { data: head } })
  })
  let reads = 0
  await page.route('**/api/live/matches?*', async route => {
   reads++
   await route.fulfill({ status: 200, json: seed.data })
  })
  await page.goto(`/${locale}/live/matches`)
  expect(await page.evaluate(() => ({ width: innerWidth, language: document.documentElement.lang, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }))).toEqual({ width, language: locale, timezone: 'Australia/Perth' })
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await expect(page.getByText(oldScore, { exact: true })).toBeVisible()
  const { resolveLiveRefreshProfile } = await import('../lib/live-refresh')
  const interval = resolveLiveRefreshProfile(process.env.NEXT_PUBLIC_LIVE_REFRESH_PROFILE, 'production') === 'conserve' ? 120_000 : 30_000
  for (let index = 0; index < 3; index++) {
   const before = headReads
   const settled = page.waitForResponse(response => response.request().postData()?.includes('GetLiveMatchdayHead') === true)
   await page.clock.fastForward(Math.ceil(interval * 1.1) + 1_000)
   await settled
   await expect.poll(() => headReads).toBeGreaterThan(before)
   await expect(page.getByText(oldScore, { exact: true })).toBeVisible()
   expect(reads).toBe(0)
  }
  await expect(page.locator('[data-live-matchday-view="true"]')).toHaveAttribute('data-revisions', JSON.stringify(seed.data.liveMatchday.snapshot.revisions))
  seed.data.liveMatchday.snapshot.revisions.deskGeneration += 1
  seed.data.liveMatchday.snapshot.revisions.deskPublicationId = 'match03-baseline-new-desk'
  seed.data.liveMatchday.snapshot.revisions.scoreState = 'c'.repeat(24)
  seed.data.liveMatchday.snapshot.matches[0].homeScore += 1
  Object.assign(head.liveMatchday.snapshot.revisions, seed.data.liveMatchday.snapshot.revisions)
  for (const key of ['detailPublicationId', 'detailGeneration', 'playerDetail']) delete head.liveMatchday.snapshot.revisions[key]
  const changedFull = page.waitForResponse(response => new URL(response.url()).pathname === '/api/live/matches')
  await page.clock.fastForward(Math.ceil(interval * 1.1) + 1_000)
  expect((await changedFull).status()).toBe(200)
  await expect.poll(() => reads).toBe(1)
  await expect(page.getByText(`${oldMatch.homeScore}–${oldMatch.awayScore}`, { exact: true })).toBeVisible()
  const currentView = page.locator('[data-live-matchday-view="true"]')
  await expect(currentView).toHaveAttribute('data-revisions', JSON.stringify(seed.data.liveMatchday.snapshot.revisions))
  await expect(currentView).toHaveAttribute('data-event-id', '33')
  await expect(currentView).toHaveAttribute('data-loading', 'false')
  const nextHead = page.waitForResponse(response => response.request().postData()?.includes('GetLiveMatchdayHead') === true)
  await page.clock.fastForward(Math.ceil(interval * 1.1) + 1_000)
  await nextHead
  expect(reads).toBe(1)
  await testInfo.attach('MATCH03-unchanged-HEAD', { contentType: 'application/json', body: JSON.stringify({ variantId: `MATCH03.A.${locale}.${width === 390 ? 'mobile390' : 'desktop1440'}.base`, headReads, fullReads: reads, headFixtureBodyBytes: Buffer.byteLength(JSON.stringify(head)), fullFixtureBodyBytes: Buffer.byteLength(JSON.stringify(seed.data)), byteScope: 'Uncompressed fixture JSON only, not network transfer bytes', readyMs: null, wholeVariantComplete: false }) })
 })
})
 }
}

test.describe('PS02 bound squad slot lifecycle', () => {
 test.use({ timezoneId: 'Australia/Perth', colorScheme: 'light' })
 for (const locale of ['en', 'zh-CN'] as const) for (const width of [1440, 390]) {
  test(`PS02 continuous bound lifecycle ${locale} ${width}px`, async ({ page }, testInfo) => {
   test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Isolated session and fixture controls required')
   const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
   const session = await createSession({ entryId: 15702 })
   const zh = locale === 'zh-CN'
   const errors: string[] = []
   page.on('pageerror', error => errors.push(error.message))
   try {
    expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })).ok).toBe(true)
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(() => localStorage.setItem('theme', 'system'))
    await addSessionCookie(page, session.cookie)
    await page.goto(`/${locale}/explore/player-stats?p1=1`)
    const overall = page.getByRole('region', { name: zh ? '球员总览' : 'Player overall', exact: true })
    const rail = page.locator('[data-player-stats-navigation-id]')
    const players = page.getByRole('region', { name: zh ? '球员' : 'Players', exact: true })
    const add = page.getByRole('button', { name: zh ? '添加对比' : 'Add comparison', exact: true })
    const remove = page.getByRole('button', { name: zh ? '移除' : 'Remove', exact: true })
    const firstEdit = players.locator('[data-player-stats-edit-slot="first"]')
    const steps: string[] = []
    await expect(overall).toContainText('Saka')
    await expect(overall).not.toContainText('Palmer')
    await expect(page).toHaveURL(url => url.searchParams.get('p1') === '1' && !url.searchParams.has('p2'))
    steps.push('PS02.01')
    await add.click()
    await players.getByRole('button', { name: /^Palmer MID / }).click()
    await expect(overall).toContainText('Palmer')
    await expect(overall).toContainText('Saka')
    await expect(page).toHaveURL(url => url.searchParams.get('p1') === '1' && url.searchParams.get('p2') === '2')
    steps.push('PS02.02')
    await remove.click()
    await expect(page).toHaveURL(url => url.searchParams.get('p1') === '1' && !url.searchParams.has('p2'))
    await expect(overall).not.toContainText('Palmer')
    steps.push('PS02.03')
    await firstEdit.click()
    await players.getByRole('button', { name: /^Palmer MID / }).click()
    await expect(page).toHaveURL(url => url.searchParams.get('p1') === '2' && !url.searchParams.has('p2'))
    await expect(overall).toContainText('Palmer')
    await expect(overall).not.toContainText('Saka')
    steps.push('PS02.04')
    await add.click()
    await players.getByRole('button', { name: /^Saka MID / }).click()
    await expect(overall).toContainText('Saka')
    await players.locator('[data-player-stats-edit-slot="second"]').click()
    await players.locator('[data-player-stats-recent-player="2"]').click()
    await expect(players.locator('[data-player-stats-edit-slot="second"]')).toBeVisible()
    await expect(page).toHaveURL(url => url.searchParams.get('p1') === '2' && url.searchParams.get('p2') === '1')
    await expect(overall).toContainText('Saka')
    await expect(overall).toContainText('Palmer')
    steps.push('PS02.05')
    await remove.click()
    await firstEdit.click()
    await players.getByRole('button', { name: /^Saka MID / }).click()
    await expect(overall).toContainText('Saka')
    await firstEdit.click()
    await players.locator('[data-player-stats-recent-player="2"]').click()
    await expect(overall).toContainText('Palmer')
    await expect(overall).not.toContainText('Saka')
    await expect(page).toHaveURL(url => url.searchParams.get('p1') === '2' && !url.searchParams.has('p2'))
    await firstEdit.click()
    await players.locator('[data-player-stats-recent-player="1"]').click()
    await expect(overall).toContainText('Saka')
    await add.click()
    await players.getByRole('button', { name: /^Palmer MID / }).click()
    await expect(overall).toContainText('Palmer')
    await expect(page).toHaveURL(url => url.searchParams.get('p1') === '1' && url.searchParams.get('p2') === '2')
    await expect(rail).toHaveAttribute('aria-busy', 'false')
    await expect(rail.getByRole('button')).toHaveCount(15)
    const second = rail.getByRole('button', { name: 'GKP Player 2', exact: true })
    await expect(second).toHaveCount(1)
    await second.click()
    await expect(page).toHaveURL(url => url.searchParams.get('p1') === '2' && !url.searchParams.has('p2'))
    await expect(overall).toContainText('Palmer')
    await expect(overall).not.toContainText('Saka')
    await expect(page.locator('[data-player-stats-edit-slot="second"]')).toHaveCount(0)
    await page.getByRole('button', { name: zh ? '添加对比' : 'Add comparison', exact: true }).click()
    await players.getByRole('button', { name: /^Saka MID / }).click()
    await expect(page).toHaveURL(url => url.searchParams.get('p1') === '2' && url.searchParams.get('p2') === '1')
    await expect(overall).toContainText('Saka')
    await second.click()
    await expect(page).toHaveURL(url => url.searchParams.get('p1') === '2' && url.searchParams.get('p2') === '1')
    await expect(overall).toContainText('Palmer')
    await expect(overall).toContainText('Saka')
    await rail.getByRole('button', { name: 'GKP Player 1', exact: true }).click()
    await expect(page).toHaveURL(url => url.searchParams.get('p1') === '1' && !url.searchParams.has('p2'))
    await expect(overall).toContainText('Saka')
    await expect(overall).not.toContainText('Palmer')
    await expect(page.locator('[data-player-stats-edit-slot="second"]')).toHaveCount(0)
    steps.push('PS02.06')
    expect(steps).toEqual(['PS02.01', 'PS02.02', 'PS02.03', 'PS02.04', 'PS02.05', 'PS02.06'])
    const requests = (await (await fetch(fixture)).json()).requests as Array<{ operation: string; variables: { entryId?: number; eventId?: number } }>
    const personalReads = requests.filter(row => ['GetEntryHistory', 'GetEntryEventResult'].includes(row.operation))
    expect(personalReads.some(row => row.operation === 'GetEntryEventResult')).toBe(true)
    expect(personalReads.every(row => row.variables.entryId === session.entryId)).toBe(true)
    expect(await page.evaluate(() => ({ width: innerWidth, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, theme: localStorage.getItem('theme'), locale: document.documentElement.lang }))).toEqual({ width, timezone: 'Australia/Perth', theme: 'system', locale })
    expect(errors).toEqual([])
    await testInfo.attach('PS02-bound-squad-proof', { contentType: 'application/json', body: JSON.stringify({ variantId: `PS02.B.${locale}.${width === 390 ? 'mobile390' : 'desktop1440'}.base`, entryId: session.entryId, personalReads, steps, functionalStatus: 'PASS', performanceStatus: 'NOT_RUN', readyMs: null, wholeVariantComplete: false, scope: 'Continuous PS02.01–06: initial player, add and clear second, replace first, duplicate via recent, recent and MySquad selection in one bound context', remaining: 'Performance metrics not measured; directed races have separate execution evidence' }) })
   } finally {
    await session.cleanup()
    await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
   }
  })
 }
})

test.describe('PS02 bound directed races', () => {
 test.use({ viewport: { width: 390, height: 900 }, timezoneId: 'UTC', colorScheme: 'dark' })
 for (const scenario of ['slow', 'out-of-order'] as const) {
  test(`PS02 bound selection ${scenario}`, async ({ page }, testInfo) => {
   test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Isolated session and browser fault injection only')
   const session = await createSession({ entryId: 15702 })
   let release = () => {}
   const held = new Promise<void>(resolve => { release = resolve })
   const events: string[] = []
   const errors: string[] = []
   page.on('pageerror', error => errors.push(error.message))
   try {
    await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
    if (scenario === 'out-of-order') await page.addInitScript(() => {
     const originalFetch = window.fetch.bind(window)
     window.fetch = (input, init) => {
      const url = typeof input === 'string' ? new URL(input, location.origin) : null
      return url?.pathname === '/api/player-stats/desk' && url.searchParams.get('playerIds')?.split(',').includes('2')
       ? originalFetch(input, { ...init, signal: undefined }) : originalFetch(input, init)
     }
    })
    await addSessionCookie(page, session.cookie)
    await page.goto('/zh-CN/explore/player-stats?p1=1')
    const overall = page.getByRole('region', { name: '球员总览', exact: true })
    const rail = page.locator('[data-player-stats-navigation-id]')
    await expect(overall).toContainText('Saka')
    await expect(rail.getByRole('button')).toHaveCount(15)
    await expect(rail).toHaveAttribute('aria-busy', 'false')
    let requests = 0
    await page.route('**/api/player-stats/desk?**', async route => {
     const url = new URL(route.request().url())
     if (!url.searchParams.get('playerIds')?.split(',').includes('2')) return route.continue()
     requests++
     events.push('player2-request-held')
     await held
     const response = await route.fetch()
     await route.fulfill({ response })
     events.push('player2-response-released')
    })
    await rail.getByRole('button', { name: 'GKP Player 2', exact: true }).click()
    await expect.poll(() => requests).toBe(1)
    // The committed player remains in the URL until the requested detail arrives.
    await expect(page).toHaveURL(url => url.searchParams.get('p1') === '1')
    await expect(overall).not.toContainText('Palmer')
    if (scenario === 'out-of-order') {
     await rail.getByRole('button', { name: 'GKP Player 1', exact: true }).click()
     await expect(page).toHaveURL(url => url.searchParams.get('p1') === '1' && !url.searchParams.has('p2'))
     await expect(overall).toContainText('Saka')
     events.push('player1-committed-before-player2-response')
    }
    const responseFinished = page.waitForResponse(response => new URL(response.url()).pathname === '/api/player-stats/desk' && new URL(response.url()).searchParams.get('playerIds')?.split(',').includes('2') === true)
    release()
    const response = await responseFinished
    expect(response.status()).toBe(200)
    expect(await response.finished()).toBeNull()
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    await expect(overall).toContainText(scenario === 'slow' ? 'Palmer' : 'Saka')
    await expect(overall).not.toContainText(scenario === 'slow' ? 'Saka' : 'Palmer')
    await expect(page).toHaveURL(url => url.searchParams.get('p1') === (scenario === 'slow' ? '2' : '1') && !url.searchParams.has('p2'))
    expect(requests).toBe(1)
    expect(events).toEqual(scenario === 'slow' ? ['player2-request-held', 'player2-response-released'] : ['player2-request-held', 'player1-committed-before-player2-response', 'player2-response-released'])
    await expect(page.locator('html')).toHaveClass(/dark/)
    expect(await page.evaluate(() => ({ width: innerWidth, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, theme: localStorage.getItem('theme'), locale: document.documentElement.lang }))).toEqual({ width: 390, timezone: 'UTC', theme: 'dark', locale: 'zh-CN' })
    expect(errors).toEqual([])
    await testInfo.attach('PS02-directed-proof', { contentType: 'application/json', body: JSON.stringify({ variantId: `PS02.state.0${scenario === 'slow' ? 1 : 2}`, entryId: session.entryId, events, requests, functionalStatus: 'PASS', performanceStatus: 'NOT_RUN', readyMs: null, wholeVariantComplete: false, scope: 'Bound MySquad first-slot slow read or stale response after newer selection; successful late response awaited', remaining: 'Complete combined slot lifecycle and performance' }) })
   } finally {
    release()
    await page.unrouteAll({ behavior: 'wait' })
    await session.cleanup()
   }
  })
 }
})

test.describe('PROFILE04 bound list controls', () => {
 test.use({ timezoneId: 'Australia/Perth', colorScheme: 'light' })
 for (const locale of ['en', 'zh-CN'] as const) for (const width of [1440, 390]) {
  test(`PROFILE04 current and other sessions ${locale} ${width}px`, async ({ page }, testInfo) => {
   test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Isolated session only; never revoke a session')
   const session = await createSession({ entryId: 15702 })
   const t = (locale === 'en' ? enMessages : zhMessages).Sessions
   const errors: string[] = []
   const writes: string[] = []
   let reads = 0
   let count = 2
   page.on('pageerror', error => errors.push(error.message))
   page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/auth/') && !['GET', 'HEAD'].includes(request.method())) writes.push(new URL(request.url()).pathname)
   })
   try {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(() => localStorage.setItem('theme', 'system'))
    await addSessionCookie(page, session.cookie)
    await page.route('**/api/auth/list-sessions', async route => {
     reads++
     const response = await route.fetch()
     expect(response.status()).toBe(200)
     const rows = await response.json()
     expect(rows).toHaveLength(1)
     expect(rows[0].userId).toBe(session.userId)
     const other = { ...rows[0], id: 'isolated-other-session', token: 'isolated-other-session-token', userAgent: 'Mozilla/5.0 Firefox/120.0' }
     await route.fulfill({ response, json: count === 2 ? [rows[0], other] : count === 1 ? rows : [] })
    })
    await page.goto(`/${locale}/profile/sessions`)
    const main = page.locator('#main-content')
    const list = main.getByRole('list', { name: t.listLabel, exact: true })
    const others = main.getByRole('button', { name: t.signOutOthers, exact: true })
    const all = main.getByRole('button', { name: t.signOutEverywhere, exact: true })
    for (const expected of [2, 1, 0]) {
     if (expected !== 2) { count = expected; await page.reload() }
     await expect.poll(() => reads).toBe(3 - expected)
     await expect(main.getByText(t.thisDevice, { exact: true })).toHaveCount(expected ? 1 : 0)
     if (expected) {
      await expect(list.getByRole('listitem')).toHaveCount(expected)
      await expect(list.getByRole('listitem').filter({ hasText: t.thisDevice })).toHaveCount(1)
      await expect(list.getByRole('button', { name: t.signOut, exact: true })).toHaveCount(expected)
      for (const button of await list.getByRole('button', { name: t.signOut, exact: true }).all()) await expect(button).toBeEnabled()
      await expect(all).toBeEnabled()
     } else {
      await expect(list).toHaveCount(0)
      await expect(main.getByText(t.empty, { exact: true })).toBeVisible()
      await expect(all).toBeDisabled()
     }
     if (expected > 1) await expect(others).toBeEnabled()
     else await expect(others).toBeDisabled()
     await expect(main.getByText(t.loadFailed, { exact: true })).toHaveCount(0)
     await expect(main.getByText(t.reauthTitle, { exact: true })).toHaveCount(0)
    }
    expect(writes).toEqual([])
    expect(errors).toEqual([])
    expect(await page.evaluate(() => ({ width: innerWidth, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, theme: localStorage.getItem('theme'), locale: document.documentElement.lang }))).toEqual({ width, timezone: 'Australia/Perth', theme: 'system', locale })
    await testInfo.attach('PROFILE04-list-controls', { contentType: 'application/json', body: JSON.stringify({ variantId: `PROFILE04.B.${locale}.${width === 390 ? 'mobile390' : 'desktop1440'}.base`, stepIds: ['PROFILE04.01', 'PROFILE04.02', 'PROFILE04.03'], listCounts: [2, 1, 0], reads, writes, functionalStatus: 'PASS', performanceStatus: 'NOT_RUN', readyMs: null, wholeVariantComplete: false, scope: 'Real isolated current session plus synthetic other list row; reload reads and count-dependent disabled controls; no revoke clicks', remaining: 'Error/401 historical evidence separate; expired identity and complete performance unproved' }) })
   } finally {
    await page.unrouteAll({ behavior: 'wait' })
    await session.cleanup()
   }
  })
 }
})

test.describe('TEAM04 private identity cache boundary', () => {
 test.use({ timezoneId: 'Australia/Perth', colorScheme: 'light' })
 for (const locale of ['en', 'zh-CN'] as const) for (const width of [1440, 390]) {
  test(`TEAM04 same URL isolates accounts ${locale} ${width}px`, async ({ page }, testInfo) => {
   test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1', 'Task-owned database and serial fixture only')
   const accounts = [await createSession({ entryId: 15702 }), await createSession({ entryId: 15702 })]
   expect(accounts[0].entryId).not.toBe(accounts[1].entryId)
   const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
   const observations: Array<{ account: number; entryId: number | null; revision: string; cacheControl: string; managerReads: number }> = []
   const errors: string[] = []
   page.on('pageerror', error => errors.push(error.message))
   try {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(() => localStorage.setItem('theme', 'system'))
    for (const [index, account] of [0, 1, 0].entries()) {
     const session = accounts[account]
     const revision = String(103 + index * 100)
     const identity = { ...managerReview.entry!, id: session.entryId!, entryName: `Private Account ${account} Team` }
     const snapshotMeta = { ...managerSnapshot(3), revision }
     const review = { ...managerReview, entry: identity, snapshotMeta, currentGameweek: { ...managerGameweek(3), entry: identity, snapshotMeta } }
     expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [{ operation: 'GetMyFplManagerReview', data: { myFplManagerReview: review } }] }) })).ok).toBe(true)
     await addSessionCookie(page, session.cookie)
     const response = await page.goto(`/${locale}/my-fpl/team`)
     expect(response?.status()).toBe(200)
     const cacheControl = response!.headers()['cache-control'] ?? ''
     expect(cacheControl).toMatch(/\bprivate\b/)
     expect(cacheControl).toMatch(/\bno-store\b/)
     expect(cacheControl).not.toMatch(/\bpublic\b|s-maxage=[1-9]/)
     const ready = page.locator('[data-manager-ready]')
     await expect(ready).toHaveAttribute('data-manager-ready', 'true')
     await expect(ready).toHaveAttribute('data-manager-entry', String(session.entryId))
     await expect(ready).toHaveAttribute('data-manager-revision', revision)
     await expect(page.getByRole('heading', { name: identity.entryName, exact: true })).toBeVisible()
     await expect(page.locator('#main-content')).not.toContainText(`Private Account ${1 - account} Team`)
     const requests = (await (await fetch(fixture)).json()).requests as Array<{ operation: string }>
     const managerReads = requests.filter(row => row.operation === 'GetMyFplManagerReview').length
     expect(managerReads).toBe(1)
     observations.push({ account, entryId: session.entryId, revision, cacheControl, managerReads })
    }
    expect(await page.evaluate(() => ({ width: innerWidth, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, theme: localStorage.getItem('theme'), locale: document.documentElement.lang }))).toEqual({ width, timezone: 'Australia/Perth', theme: 'system', locale })
    expect(errors).toEqual([])
    await testInfo.attach('TEAM04-private-cache-proof', { contentType: 'application/json', body: JSON.stringify({ variantId: `TEAM04.B.${locale}.${width === 390 ? 'mobile390' : 'desktop1440'}.base`, observations, functionalStatus: 'PASS', performanceStatus: 'NOT_RUN', readyMs: null, wholeVariantComplete: false, scope: 'A/B/A on identical document URL: private no-store headers, current entry/revision, no other team name, fresh upstream read each visit', remaining: 'GraphQL authorization, SPA transition, production cache and timings not proved' }) })
   } finally {
    await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) })
    for (const account of accounts) await account.cleanup()
   }
  })
 }
})
