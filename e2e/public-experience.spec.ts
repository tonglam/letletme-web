import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

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
	expect(html).not.toContain('aria-label="Loading page"')
})

test('web-vitals ingestion accepts the public proxy origin and rejects others', async ({
	request
}) => {
	const acceptedOrigin = await request.post('/api/vitals', {
		headers: {
			Origin: 'https://letletme.top',
			Referer: 'https://letletme.top/explore/fixtures',
			'Sec-Fetch-Site': 'cross-site'
		},
		data: {}
	})
	// The empty body is invalid, but the trusted proxy origin must pass the
	// cross-site guard and reach payload validation.
	expect(acceptedOrigin.status()).toBe(400)

	const rejectedOrigin = await request.post('/api/vitals', {
		headers: { Origin: 'https://evil.example' },
		data: {}
	})
	expect(rejectedOrigin.status()).toBe(403)
	expect(rejectedOrigin.headers()['cache-control']).toBe('no-store')
})

test('retired public routes return 404 instead of redirecting', async ({
	request
}) => {
	const retiredPaths = [
		'/stats/gameweek',
		'/stats/team',
		'/stats/tournament',
		'/data/price-changes',
		'/live/tournament',
		'/live/tournaments/123',
		'/tournament/list',
		'/data/gameweek/gameweek',
		'/zh-CN/stats/gameweek',
		'/zh-CN/stats/team',
		'/zh-CN/stats/tournament',
		'/zh-CN/data/price-changes',
		'/zh-CN/live/tournament',
		'/zh-CN/live/tournaments/123',
		'/zh-CN/tournament/list',
		'/zh-CN/data/gameweek/gameweek'
	]

	for (const path of retiredPaths) {
		const response = await request.get(path, { maxRedirects: 0 })
		expect(response.status(), path).toBe(404)
	}
})

test('server navigation stays usable while scripted controls remain inert', async ({
	browser
}) => {
	const page = await browser.newPage({ javaScriptEnabled: false })
	await page.setViewportSize({ width: 390, height: 844 })
	await page.goto('/')

	const mobileMenu = page.locator('details[data-navigation-mobile]')
	await mobileMenu.locator(':scope > summary').click()
	await expect(mobileMenu).toHaveAttribute('open', '')
	await expect(
		mobileMenu.getByRole('link', { name: 'Market', exact: true })
	).toBeVisible()
	const themeDisclosure = page.locator(
		'details[data-navigation-disclosure]:has(summary[aria-label="Change color theme"])'
	)
	await expect(themeDisclosure).toHaveAttribute('inert', '')
	await expect(themeDisclosure).toHaveAttribute('aria-disabled', 'true')

	await page.goto('/zh-CN?view=compact')
	const languageDisclosure = page.locator(
		'details[data-navigation-disclosure]:has(summary[aria-label="切换语言"])'
	)
	await languageDisclosure.locator(':scope > summary').click()
	await expect(
		languageDisclosure.getByRole('radio', { name: '简体中文', exact: true })
	).toHaveAttribute('tabindex', '0')
	await expect(
		languageDisclosure.getByRole('radio', { name: 'English', exact: true })
	).toHaveAttribute('tabindex', '0')
	await languageDisclosure
		.getByRole('radio', { name: 'English', exact: true })
		.click()
	await expect(page).toHaveURL(/\/en\?view=compact$/)
	await expect(page.locator('html')).toHaveAttribute('lang', 'en')

	await page.close()
})

test('footer QR disclosure stays inside the mobile viewport', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 })
	await page.goto('/')

	const disclosure = page.locator('details[data-mini-program-popover]')
	await disclosure.locator(':scope > summary').click()
	const panel = disclosure.getByRole('group')
	await expect(panel).toBeVisible()
	const bounds = await panel.boundingBox()
	expect(bounds).not.toBeNull()
	expect(bounds?.x ?? -1).toBeGreaterThanOrEqual(0)
	expect((bounds?.x ?? 0) + (bounds?.width ?? 391)).toBeLessThanOrEqual(390)
})

test('home keeps the four-section vocabulary and competition entry links aligned', async ({
	page
}) => {
	await page.goto('/')

	const header = page.getByRole('navigation', { name: 'Primary' })
	for (const id of ['live', 'myFpl', 'competitions', 'explore']) {
		await expect(
			header.locator(`details[data-navigation-group="${id}"] > summary`)
		).toBeVisible()
	}
	await header
		.locator('details[data-navigation-group="myFpl"] > summary')
		.click()
	await expect(
		header.getByRole('link', { name: 'Overview', exact: true })
	).toHaveCount(0)

	await expect(
		page.getByRole('link', { name: 'Live competition standings', exact: true })
	).toHaveAttribute('href', '/live/competitions')
	await expect(
		page
			.locator('section[aria-labelledby="home-tournament-band-title"]')
			.getByRole('link', {
				name: 'Browse competitions',
				exact: true
			})
	).toHaveAttribute('href', '/competitions/browse')
	await expect(
		page
			.locator('section[aria-labelledby="home-tournament-band-title"]')
			.getByRole('link', {
				name: 'Create competition',
				exact: true
			})
	).toHaveAttribute('href', '/competitions/create')

	await page.goto('/zh-CN')
	const chineseHeader = page.getByRole('navigation', { name: '主导航' })
	for (const id of ['live', 'myFpl', 'competitions', 'explore']) {
		await expect(
			chineseHeader.locator(`details[data-navigation-group="${id}"] > summary`)
		).toBeVisible()
	}

	await expect(
		page.getByRole('link', { name: '赛事实时积分榜', exact: true })
	).toHaveAttribute('href', '/zh-CN/live/competitions')
	await expect(
		page
			.locator('section[aria-labelledby="home-tournament-band-title"]')
			.getByRole('link', {
				name: '浏览赛事',
				exact: true
			})
	).toHaveAttribute('href', '/zh-CN/competitions/browse')
	await expect(
		page
			.locator('section[aria-labelledby="home-tournament-band-title"]')
			.getByRole('link', {
				name: '创建赛事',
				exact: true
			})
	).toHaveAttribute('href', '/zh-CN/competitions/create')
})

test('modified navigation link clicks keep their disclosure open', async ({
	page,
	context
}) => {
	await page.goto('/')
	const explore = page.locator('details[data-navigation-group="explore"]')
	await explore.locator(':scope > summary').click()
	await explore
		.getByRole('link', { name: 'Market', exact: true })
		.click({ modifiers: [process.platform === 'darwin' ? 'Meta' : 'Control'] })
	await expect(explore).toHaveAttribute('open', '')
	for (const candidate of context.pages()) {
		if (candidate !== page) await candidate.close()
	}
})

test('language switch persists through the next client navigation', async ({
	page
}) => {
	await page.goto('/zh-CN?view=compact#language-state')

	const disclosure = page.locator(
		'details[data-locale-picker]:has(summary[aria-label="切换语言"])'
	)
	const summary = disclosure.locator(':scope > summary')
	await summary.click()
	await disclosure
		.getByRole('radio', { name: '简体中文', exact: true })
		.click()
	await expect(disclosure).not.toHaveAttribute('open', '')
	await expect(summary).toBeFocused()
	await summary.click()
	const english = page.getByRole('radio', { name: 'English', exact: true })
	await expect(english).toHaveAttribute(
		'href',
		/\?view=compact#language-state$/
	)
	await page.evaluate(() => {
		window.history.pushState(null, '', '#updated-language-state')
		window.dispatchEvent(new PopStateEvent('popstate'))
	})
	await expect(english).toHaveAttribute(
		'href',
		/\?view=compact#updated-language-state$/
	)
	await english.click()
	await expect(page).toHaveURL(
		/\/(?:en)?\?view=compact#updated-language-state$/
	)
	await expect(page.getByRole('heading', { level: 1 })).toContainText(
		'Every point'
	)

	const explore = page.locator('details[data-navigation-group="explore"]')
	await explore.locator(':scope > summary').click()
	await explore.getByRole('link', { name: 'Market', exact: true }).click()

	await expect(page).toHaveURL(/\/explore\/market$/)
	await expect(explore).not.toHaveAttribute('open', '')
	await expect(
		page.getByRole('heading', { name: 'Market', exact: true })
	).toBeVisible()
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

test('server-rendered mobile navigation opens and closes after navigation', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 })
	await page.goto('/')

	const mobileMenu = page.locator('details[data-navigation-mobile]')
	await mobileMenu.locator(':scope > summary').click()
	await expect(mobileMenu).toHaveAttribute('open', '')
	for (const label of ['Live', 'My FPL', 'Competitions', 'Explore']) {
		await expect(mobileMenu.getByText(label, { exact: true })).toBeVisible()
	}

	await expect(
		mobileMenu.getByRole('link', { name: 'My Competitions', exact: true })
	).toHaveAttribute('href', '/competitions/browse?mine=true')
	await expect(
		mobileMenu.getByRole('link', { name: 'Competition', exact: true })
	).toHaveAttribute('href', '/competitions/create')

	await mobileMenu.getByRole('link', { name: 'Market' }).click()

	await expect(page).toHaveURL(/\/explore\/market$/)
	await expect(
		page.locator('details[data-navigation-mobile]')
	).not.toHaveAttribute('open', '')
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= window.innerWidth
		)
	).toBe(true)
})

test('guest mobile login closes its native disclosure before navigation', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 })
	await page.goto('/')

	const mobileMenu = page.locator('details[data-navigation-mobile]')
	await mobileMenu.locator(':scope > summary').click()
	await expect(mobileMenu).toHaveAttribute('open', '')
	await mobileMenu.getByRole('link', { name: 'Login', exact: true }).click()

	await expect(page).toHaveURL(/\/auth\/login$/)
	await expect(
		page.locator('details[data-navigation-mobile]')
	).not.toHaveAttribute('open', '')
})

test('Simplified Chinese mobile navigation uses the same competition vocabulary', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 })
	await page.goto('/zh-CN')

	const mobileMenu = page.locator('details[data-navigation-mobile]')
	await mobileMenu.locator(':scope > summary').click()
	await expect(mobileMenu).toHaveAttribute('open', '')
	for (const label of ['实时', '我的 FPL', '赛事', '探索']) {
		await expect(
			mobileMenu.locator('section > p').filter({ hasText: label })
		).toBeVisible()
	}

	await expect(
		mobileMenu.locator('a[href="/zh-CN/my-fpl/competitions"]')
	).toHaveText('赛事')
	await expect(
		mobileMenu.locator('a[href="/zh-CN/competitions/create"]')
	).toHaveText('赛事')
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
	await page.goto('/zh-CN/explore/market')

	await expect(
		page.getByRole('heading', { level: 1, name: '市场' })
	).toBeVisible()
	await expect(page.getByText(/比较区间/).first()).toBeVisible()
	const initialAccessibility = await new AxeBuilder({ page }).analyze()
	expect(initialAccessibility.violations).toEqual([])

	await expect(page.getByRole('list', { name: '上升' })).toBeVisible()
	await expect(page.getByText('+1 个百分点').first()).toBeVisible()

	await page.getByRole('link', { name: 'GW 比较' }).click()
	await expect(page).toHaveURL(/period=GAMEWEEK/)
	await expect(page.getByText('GW2 · 截止').first()).toBeVisible()

	await page.goto('/zh-CN/explore/market?period=ROLLING_7D')
	await expect(page).toHaveURL(/\/zh-CN\/explore\/market$/)
	await expect(page.getByRole('link', { name: '近 7 日' })).toHaveCount(0)

	await page.getByRole('link', { name: '每日' }).click()
	const dailyDateLink = page.getByRole('link', {
		name: '2026年8月2日',
		exact: true
	})
	await expect(dailyDateLink).toBeVisible()
	await dailyDateLink.click()
	await expect
		.poll(() => {
			const url = new URL(page.url())
			return {
				period: url.searchParams.get('period'),
				date: url.searchParams.get('date')
			}
		})
		.toEqual({ period: 'DAILY', date: '2026-08-02' })
	await expect(page.getByText('2026年8月2日').first()).toBeVisible()

	await page.getByRole('searchbox', { name: '按姓名搜索球员' }).fill('Sa')
	const searchResult = page
		.getByRole('list', { name: '球员搜索结果' })
		.getByRole('listitem')
		.filter({ has: page.getByRole('link', { name: 'Saka' }) })
	await searchResult.getByRole('button', { name: '历史' }).click()
	await expect(page.getByText('£9.9m → £10.0m')).toBeVisible()

	for (const width of [320, 375, 390, 430, 1280]) {
		await page.setViewportSize({ width, height: 844 })
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= window.innerWidth
			)
		).toBe(true)
	}
	const accessibility = await new AxeBuilder({ page }).analyze()
	expect(accessibility.violations).toEqual([])
})

test('signed-out Trends exposes only curated public aggregates on mobile', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 })
	await page.goto('/explore/selections?scope=public&tournament=777&gw=33')

	await expect(
		page.getByRole('heading', { level: 1, name: 'Trends' })
	).toBeVisible()
	await expect(
		page.getByRole('heading', { level: 2, name: 'E2E Public League' })
	).toBeVisible()
	await expect(
		page.getByText('Link an FPL entry to add My Leagues.')
	).toBeVisible()
	await expect(
		page.getByRole('link', { name: 'Saka' }).first()
	).toHaveAttribute('href', '/explore/player-stats?p1=1')
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= window.innerWidth
		)
	).toBe(true)
})

test('Gameweek keeps Dream Team and every 10+ haul independent during live play', async ({
	page
}) => {
	await page.goto('/explore/gameweek')

	await expect(page.getByText('Provisional')).toBeVisible()
	await expect(
		page.getByRole('heading', { name: 'Gameweek 33 Dream Team' })
	).toBeVisible()
	await expect(
		page.getByRole('heading', { name: 'Double-digit Hauls' })
	).toBeVisible()
	await expect(page.getByRole('link', { name: 'Palmer' })).toHaveAttribute(
		'href',
		'/explore/player-stats?p1=2'
	)
})

test('Fixtures renders every DGW match and explicit BGWs without horizontal overflow', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 })
	await page.goto('/explore/fixtures')

	await expect(
		page.getByRole('heading', { level: 1, name: 'Fixtures' })
	).toBeVisible()
	await expect(page.getByText('DGW').first()).toBeVisible()
	await expect(page.getByText('BGW').first()).toBeVisible()
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= window.innerWidth
		)
	).toBe(true)
	const fixtureAccessibility = await new AxeBuilder({ page }).analyze()
	expect(fixtureAccessibility.violations).toEqual([])
})

test('theme choice persists across a reload', async ({ page }) => {
	await page.goto('/')
	await page.locator('summary[aria-label="Change color theme"]').click()
	await page.getByRole('radio', { name: 'Dark' }).click()

	await expect(page.locator('html')).toHaveClass(/dark/)
	await expect
		.poll(() => page.evaluate(() => localStorage.getItem('theme')))
		.toBe('dark')
	await page.reload()
	await expect(page.locator('html')).toHaveClass(/dark/)
})

test('theme radio group uses one tab stop and arrow-key selection', async ({
	page
}) => {
	await page.goto('/')
	const summary = page.locator('summary[aria-label="Change color theme"]')
	await summary.click()
	const group = page.getByRole('radiogroup', { name: 'Change color theme' })
	const light = group.getByRole('radio', { name: 'Light' })
	const dark = group.getByRole('radio', { name: 'Dark' })
	const system = group.getByRole('radio', { name: 'System' })

	await expect(light).toHaveAttribute('tabindex', '-1')
	await expect(dark).toHaveAttribute('tabindex', '-1')
	await expect(system).toHaveAttribute('tabindex', '0')
	await page.evaluate(() => {
		const observer = new MutationObserver(records => {
			if (
				records.some(record =>
					Array.from(record.addedNodes).some(
						node =>
							node instanceof Element &&
							node.hasAttribute('data-theme-transition-guard')
					)
				)
			) {
				document.documentElement.dataset.themeTransitionGuardSeen = 'true'
				observer.disconnect()
			}
		})
		observer.observe(document.head, { childList: true })
	})
	await system.focus()
	await page.keyboard.press('Escape')
	await expect(summary).toBeFocused()
	await expect(summary.locator('..')).not.toHaveAttribute('open', '')
	await summary.click()
	await system.focus()
	await system.press('ArrowLeft')

	await expect(page.locator('[data-theme-choice="dark"]')).toHaveAttribute(
		'aria-checked',
		'true'
	)
	await expect(page.locator('html')).toHaveClass(/dark/)
	await expect(page.locator('html')).toHaveAttribute(
		'data-theme-transition-guard-seen',
		'true'
	)
	await expect(summary).toBeFocused()
})

test('report dialog restores focus to its activating control', async ({
	page
}) => {
	await page.goto('/')
	const trigger = page
		.getByRole('button', { name: 'Something not working?', exact: true })
		.last()
	await trigger.click()
	await expect(page.getByRole('dialog')).toBeVisible()
	await page.getByRole('button', { name: 'Close', exact: true }).click()
	await expect(page.getByRole('dialog')).toBeHidden()
	await expect(trigger).toBeFocused()
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
			JSON.stringify({ players: [{ id: 1 }] })
		)
	})
	let clientDirectoryRequests = 0
	await page.route('**/api/graphql', route => {
		clientDirectoryRequests += 1
		return route.abort('connectionfailed')
	})
	await page.goto('/explore/player-stats')

	await expect(
		page.getByRole('heading', { name: 'Player Stats' })
	).toBeVisible()
	await expect(page.getByRole('button', { name: 'Clear recent' })).toHaveCount(
		0
	)
	await expect(page.getByRole('button', { name: /Saka/ }).first()).toBeVisible()
	expect(clientDirectoryRequests).toBe(0)
	const playerStatsAccessibility = await new AxeBuilder({ page }).analyze()
	expect(playerStatsAccessibility.violations).toEqual([])
})

test('protected tournament creation returns an unauthenticated user to sign-in safely', async ({
	page
}) => {
	await page.goto('/competitions/create')
	await expect(page).toHaveURL(/\/auth\/login\?next=%2Fcompetitions%2Fcreate$/)
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
