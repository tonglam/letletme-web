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

test('client-only navigation controls stay unavailable until hydration', async ({
	browser
}) => {
	const page = await browser.newPage({ javaScriptEnabled: false })
	await page.setViewportSize({ width: 390, height: 844 })
	await page.goto('/')

	await expect(
		page.getByRole('button', { name: 'Open navigation menu' })
	).toBeDisabled()
	await expect(
		page.getByRole('button', { name: 'Change color theme' })
	).toBeDisabled()

	await page.close()
})

test('home keeps the four-section vocabulary and competition entry links aligned', async ({
	page
}) => {
	await page.goto('/')

	const header = page.getByRole('navigation', { name: 'Primary' })
	for (const label of ['Live', 'My FPL', 'Competitions', 'Explore']) {
		await expect(header.getByRole('button', { name: new RegExp(`^${label}`) })).toBeVisible()
	}

	await expect(
		page.getByRole('link', { name: 'Live competition standings', exact: true })
	).toHaveAttribute('href', '/live/competitions')
	await expect(
		page.locator('section[aria-labelledby="home-tournament-band-title"]').getByRole('link', {
			name: 'Browse competitions',
			exact: true
		})
	).toHaveAttribute('href', '/competitions/browse')
	await expect(
		page.locator('section[aria-labelledby="home-tournament-band-title"]').getByRole('link', {
			name: 'Create competition',
			exact: true
		})
	).toHaveAttribute('href', '/competitions/create')

	await page.goto('/zh-CN')
	const chineseHeader = page.getByRole('navigation', { name: '主导航' })
	for (const label of ['实时', '我的 FPL', '赛事', '探索']) {
		await expect(
			chineseHeader.getByRole('button', { name: new RegExp(`^${label}`) })
		).toBeVisible()
	}

	await expect(
		page.getByRole('link', { name: '赛事实时积分榜', exact: true })
	).toHaveAttribute('href', '/zh-CN/live/competitions')
	await expect(
		page.locator('section[aria-labelledby="home-tournament-band-title"]').getByRole('link', {
			name: '浏览赛事',
			exact: true
		})
	).toHaveAttribute('href', '/zh-CN/competitions/browse')
	await expect(
		page.locator('section[aria-labelledby="home-tournament-band-title"]').getByRole('link', {
			name: '创建赛事',
			exact: true
		})
	).toHaveAttribute('href', '/zh-CN/competitions/create')
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

test('mobile navigation expands a group and closes after navigation', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 })
	await page.goto('/')

	await page.getByRole('button', { name: 'Open navigation menu' }).click()
	const dialog = page.getByRole('dialog')
	await expect(dialog).toBeVisible()
	for (const label of ['Live', 'My FPL', 'Competitions', 'Explore']) {
		await expect(dialog.getByRole('button', { name: label, exact: true })).toBeVisible()
	}

	const competitionsGroup = dialog.getByRole('button', { name: 'Competitions' })
	await competitionsGroup.click()
	await expect(
		dialog.getByRole('link', { name: 'My Competitions', exact: true })
	).toHaveAttribute('href', '/competitions/browse?mine=true')
	await expect(
		dialog.getByRole('link', { name: 'Create Competition', exact: true })
	).toHaveAttribute('href', '/competitions/create')

	const exploreGroup = dialog.getByRole('button', { name: 'Explore' })
	await exploreGroup.click()
	await expect(exploreGroup).toHaveAttribute('aria-expanded', 'true')
	await dialog.getByRole('link', { name: 'Market' }).click()

	await expect(page).toHaveURL(/\/explore\/market$/)
	await expect(dialog).toBeHidden()
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= window.innerWidth
		)
	).toBe(true)
})

test('Simplified Chinese mobile navigation uses the same competition vocabulary', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 })
	await page.goto('/zh-CN')

	await page.getByRole('button', { name: '打开导航菜单' }).click()
	const dialog = page.getByRole('dialog')
	await expect(dialog).toBeVisible()
	for (const label of ['实时', '我的 FPL', '赛事', '探索']) {
		await expect(dialog.getByRole('button', { name: label, exact: true })).toBeVisible()
	}

	await dialog.getByRole('button', { name: '赛事', exact: true }).click()
	await expect(
		dialog.getByRole('link', { name: '我的赛事', exact: true })
	).toHaveAttribute('href', '/zh-CN/competitions/browse?mine=true')
	await expect(
		dialog.getByRole('link', { name: '创建赛事', exact: true })
	).toHaveAttribute('href', '/zh-CN/competitions/create')
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
	await expect(page.getByText(/自开始追踪以来/).first()).toBeVisible()

	await expect(page.getByRole('region', { name: '上升 (1)' })).toBeVisible()
	await expect(page.getByText('+1%').first()).toBeVisible()

	await page.getByRole('combobox', { name: '按姓名搜索球员' }).fill('Sa')
	const searchResult = page
		.getByRole('list', { name: '球员搜索结果' })
		.getByRole('listitem')
		.filter({ has: page.getByRole('link', { name: 'Saka' }) })
	await searchResult.getByRole('button', { name: '历史' }).click()
	await expect(page.getByText('£9.9m → £10.0m')).toBeVisible()

	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= window.innerWidth
		)
	).toBe(true)
	const accessibility = await new AxeBuilder({ page }).analyze()
	expect(accessibility.violations).toEqual([])
})

test('signed-out League Trends exposes only curated public aggregates on mobile', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 })
	await page.goto('/explore/selections?scope=public&tournament=777&gw=33')

	await expect(
		page.getByRole('heading', { level: 1, name: 'League Trends' })
	).toBeVisible()
	await expect(page.getByText('E2E Public League').first()).toBeVisible()
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
	await page.getByRole('button', { name: 'Change color theme' }).click()
	await page.getByRole('menuitemradio', { name: 'Dark' }).click()

	await expect(page.locator('html')).toHaveClass(/dark/)
	await expect
		.poll(() => page.evaluate(() => localStorage.getItem('theme')))
		.toBe('dark')
	await page.reload()
	await expect(page.locator('html')).toHaveClass(/dark/)
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
