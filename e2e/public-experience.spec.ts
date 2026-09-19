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

test('homepage deadline follows the next event rather than the active event', async ({
	page
}) => {
	await page.goto('/zh-CN')

	const deadlineCard = page.locator('[data-countdown-card="dark"]')
	await expect(deadlineCard).toBeVisible()
	await expect(
		deadlineCard.getByRole('heading', { name: '第 34 轮', exact: true })
	).toBeVisible()
	await expect(
		deadlineCard.getByRole('heading', { name: '第 33 轮', exact: true })
	).toHaveCount(0)
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

test('home keeps the five-section vocabulary and competition entry links aligned', async ({
	page
}) => {
	await page.goto('/')

	const header = page.getByRole('navigation', { name: 'Primary' })
	for (const id of ['live', 'myFpl', 'competitions', 'explore', 'data']) {
		await expect(
			header.locator(`details[data-navigation-group="${id}"] > summary`)
		).toBeVisible()
	}
	await header
		.locator('details[data-navigation-group="data"] > summary')
		.click()
	await expect(
		header.getByRole('link', { name: 'Players', exact: true })
	).toHaveAttribute('href', '/explore/player-stats')
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
	for (const id of ['live', 'myFpl', 'competitions', 'explore', 'data']) {
		await expect(
			chineseHeader.locator(`details[data-navigation-group="${id}"] > summary`)
		).toBeVisible()
	}
	await chineseHeader
		.locator('details[data-navigation-group="data"] > summary')
		.click()
	await expect(
		chineseHeader.getByRole('link', { name: '球员', exact: true })
	).toHaveAttribute('href', '/zh-CN/explore/player-stats')

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

test('localized shell navigation completes logo and menu-link navigation', async ({
	page
}) => {
	await page.goto('/zh-CN/explore/fixtures')

	const header = page.getByRole('navigation', { name: '主导航' })
	await expect(header.getByRole('link', { name: 'LETLETME' })).toHaveAttribute(
		'href',
		'/zh-CN'
	)
	await header.getByRole('link', { name: 'LETLETME' }).click()
	await expect(page).toHaveURL(/\/zh-CN\/?$/)

	await header
		.locator('details[data-navigation-group="live"] > summary')
		.click()
	await header.getByRole('link', { name: '实时比赛', exact: true }).click()
	await expect(page).toHaveURL(/\/zh-CN\/live\/matches$/)
})

test('home team of the week shows each player name, gameweek score, and detail action', async ({
	page
}) => {
	await page.goto('/zh-CN')

	const pitch = page.locator(
		'[aria-labelledby="home-team-of-week-title"] section[aria-label]:visible'
	)
	await expect(pitch).toBeVisible()

	const dreamTeamCard = page
		.locator('[aria-labelledby="home-team-of-week-title"]:visible')
		.first()
	await expect(
		dreamTeamCard.getByRole('heading', { name: /GW\d+ 梦之队/, exact: true })
	).toBeVisible()
	await expect(dreamTeamCard.getByText(/\d+ 名球员/)).toHaveCount(0)
	await expect(
		dreamTeamCard.getByRole('button', { name: '图片', exact: true })
	).toBeVisible()
	await expect(
		dreamTeamCard.getByRole('button', { name: '文字', exact: true })
	).toHaveCount(0)

	const playerCards = pitch.locator('button[aria-label^="查看 "]')
	const playerCount = await playerCards.count()
	expect(playerCount).toBeGreaterThan(0)
	for (let index = 0; index < playerCount; index += 1) {
		const playerCard = playerCards.nth(index)
		await expect(playerCard).toBeVisible()
		await expect(playerCard.locator('span').first()).not.toHaveText('')
		const playerScore = await playerCard.locator('span').nth(1).innerText()
		expect(playerScore).toMatch(/^\d+$/)
	}

	await playerCards.first().click()
	await expect(page).toHaveURL(/\/zh-CN$/)
	await expect(page.getByRole('dialog')).toContainText('Saka')
	await page.keyboard.press('Escape')

	const topScorer = page.getByRole('button', {
		name: '最高分球员: Saka (12)',
		exact: true
	})
	await expect(topScorer).toBeVisible()
	await topScorer.click()
	await expect(page.getByRole('dialog')).toContainText('Saka')
})

test('home market copy uses human-readable updated dates without signal-status wording', async ({
	page
}) => {
	await page.goto('/zh-CN')
	const marketCard = page.locator(
		'[aria-labelledby="home-market-title"]:visible'
	)
	await expect(
		marketCard.getByRole('tab', { name: '持有率变化', exact: true })
	).toBeVisible()
	await expect(
		marketCard.getByRole('tab', { name: '出场状态观察', exact: true })
	).toBeVisible()

	const updatedDate = '更新于 2026年8月3日'
	await expect(
		marketCard.locator('p:visible').filter({ hasText: updatedDate })
	).toBeVisible()
	await expect(
		page
			.locator('#home-price-changes-today:visible p:visible')
			.filter({ hasText: updatedDate })
	).toBeVisible()

	await marketCard
		.getByRole('tab', { name: '出场状态观察', exact: true })
		.click()
	await expect(
		marketCard.locator('#home-market-availability:visible')
	).toBeVisible()

	await page.locator('#home-price-changes-likely-tab:visible').click()
	const priceChangesCard = page.locator(
		'[aria-labelledby="home-price-changes-title"]:visible'
	)
	await expect(
		priceChangesCard.getByRole('heading', { name: /上涨趋势/ })
	).toBeVisible()
	await expect(
		priceChangesCard.getByRole('heading', { name: /下跌趋势/ })
	).toBeVisible()
	await expect(page.getByText('并保留信号状态', { exact: false })).toHaveCount(
		0
	)
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
	await disclosure.getByRole('radio', { name: '简体中文', exact: true }).click()
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
	for (const label of ['Live', 'My FPL', 'Competitions', 'Explore', 'Data']) {
		await expect(mobileMenu.getByText(label, { exact: true })).toBeVisible()
	}

	await expect(
		mobileMenu.getByRole('link', { name: 'Browse competitions', exact: true })
	).toHaveAttribute('href', '/competitions/browse')
	await expect(
		mobileMenu.getByRole('link', { name: 'Tournament Review', exact: true })
	).toHaveAttribute('href', '/my-fpl/competitions')
	await expect(
		mobileMenu.getByRole('link', { name: 'New Competition', exact: true })
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

test('rapid native menu interaction does not strand client navigation', async ({
	page
}) => {
	await page.goto('/')

	const navigation = page.getByRole('navigation', { name: 'Primary' })
	const explore = navigation.locator(
		'details[data-navigation-group="explore"]'
	)
	const summary = explore.locator(':scope > summary')

	for (let index = 0; index < 6; index += 1) {
		await summary.click()
		await expect(explore).toHaveAttribute('open', '')
		await summary.click()
		await expect(explore).not.toHaveAttribute('open', '')
	}

	await summary.click()
	const navigationPromise = page.waitForURL(/\/explore\/market$/)
	await explore.getByRole('link', { name: 'Market', exact: true }).click()
	await expect(explore).not.toHaveAttribute('open', '')
	await navigationPromise
	await expect(page).toHaveURL(/\/explore\/market$/)
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
	for (const label of ['实时', 'My FPL', '赛事', '探索', '数据']) {
		await expect(
			mobileMenu.locator('section > p').filter({ hasText: label })
		).toBeVisible()
	}

	await expect(
		mobileMenu.locator('a[href="/zh-CN/my-fpl/competitions"]')
	).toHaveText('赛事复盘')
	await expect(
		mobileMenu.locator('a[href="/zh-CN/competitions/create"]')
	).toHaveText('新建赛事')
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
	await expect(page.getByText('+1%').first()).toBeVisible()

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
		page.getByRole('combobox', { name: 'Active league' })
	).toHaveValue('competition:777')
	await expect(
		page.getByRole('heading', { level: 2, name: 'E2E Public League' })
	).toHaveCount(0)
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
		page.getByRole('heading', { name: 'GW33 Dream Team', exact: true })
	).toBeVisible()
	await expect(
		page.getByRole('heading', { name: 'Players Scoring 10+', exact: true })
	).toBeVisible()
	const palmer = page
		.getByRole('row', { name: /Palmer/ })
		.getByRole('button', { name: 'Palmer', exact: true })
	await expect(palmer).toBeVisible()
	await palmer.click()
	await expect(page.getByRole('dialog')).toContainText('Palmer')
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


test('the shared collector reports session-window CLS and missing navigation interaction as null', async ({ page }) => {
	const { installVitals } = await import('../scripts/performance-metrics.mjs')
	await installVitals(page)
	await page.addInitScript(() => {
		const observed = { sum: 0, max: 0 }
		Object.assign(window, { testShifts: observed })
		new PerformanceObserver(list => {
			for (const item of list.getEntries()) {
				const entry = item as PerformanceEntry & { hadRecentInput: boolean; value: number }
				if (!entry.hadRecentInput) { observed.sum += entry.value; observed.max = Math.max(observed.max, entry.value) }
			}
		}).observe({ type: 'layout-shift', buffered: true })
	})
	await page.route('**/__collector-test', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Collector test</title><div id="target" style="width:80vw;height:200px;background:#086">Stable visible content</div>' }))
	await page.goto('/__collector-test')
	await page.waitForTimeout(300)
	await page.evaluate(() => { document.getElementById('target')!.style.marginTop = '100px' })
	await page.waitForTimeout(1300)
	await page.evaluate(() => { document.getElementById('target')!.style.marginTop = '0px' })
	await page.waitForTimeout(300)
	const result = await page.evaluate(() => {
		const state = window as unknown as { __performanceMetrics: { cls: number; inp: number | null }; testShifts: { sum: number; max: number } }
		return { ...state.__performanceMetrics, ...state.testShifts }
	})
	expect(result.sum).toBeGreaterThan(result.max)
	expect(result.cls).toBeCloseTo(result.max, 5)
	expect(result.inp).toBeNull()
})


test('anonymous competition redirects cannot be counted as successful content measurements', async ({ browser, baseURL }) => {
	const { isProductionMeasurementUrl, measureNavigation } = await import('../scripts/performance-metrics.mjs')
	if (isProductionMeasurementUrl(baseURL ?? '')) {
		test.skip(true, 'Production measurements use the existing logged-in Chrome tab')
		return
	}
	const sample = await measureNavigation(browser, { name: 'desktop', viewport: { width: 1440, height: 900 } }, `${baseURL}/live/competitions?tournamentId=6`)
	expect(sample.error).toContain('Unexpected response or redirect')
	expect(sample.readyMs).toBeNull()
})

for (const locale of ['en', 'zh-CN']) {
	test(`prediction filters follow URL after browser history restoration [${locale}]`, async ({ page }) => {
		const prefix = locale === 'zh-CN' ? '/zh-CN' : ''
		const path = `${prefix}/explore/price-predictions`
		const scope = page.getByRole('combobox', { name: locale === 'zh-CN' ? '预测范围' : 'Prediction scope', exact: true })
		const movement = page.getByRole('combobox', { name: locale === 'zh-CN' ? '走势' : 'Movement', exact: true })
		await page.goto(path)
		await scope.click()
		await page.getByRole('option', { name: locale === 'zh-CN' ? '全部球员' : 'All players', exact: true }).click()
		await movement.click()
		await page.getByRole('option', { name: locale === 'zh-CN' ? '只看上涨' : 'Rises only', exact: true }).click()
		await expect(page).toHaveURL(url => url.searchParams.get('scope') === 'all' && url.searchParams.get('movement') === 'rise')
		await expect(page.getByRole('table').getByRole('link', { name: 'Saka', exact: true })).toBeVisible()
		await expect(page.getByRole('table').getByRole('link', { name: 'Palmer', exact: true })).toHaveCount(0)
		await page.getByRole('contentinfo').getByRole('link', { name: locale === 'zh-CN' ? '赛程' : 'Fixtures', exact: true }).click()
		await expect(page).toHaveURL(url => url.pathname === `${prefix}/explore/fixtures`)
		await page.goBack()
		await expect(page).toHaveURL(url => url.pathname === path && url.searchParams.get('scope') === 'all' && url.searchParams.get('movement') === 'rise')
		await expect(scope).toContainText(locale === 'zh-CN' ? '全部球员' : 'All players')
		await expect(movement).toContainText(locale === 'zh-CN' ? '只看上涨' : 'Rises only')
		await expect(page.getByRole('table').getByRole('link', { name: 'Saka', exact: true })).toBeVisible()
		await expect(page.getByRole('table').getByRole('link', { name: 'Palmer', exact: true })).toHaveCount(0)
		await page.goForward()
		await expect(page).toHaveURL(url => url.pathname === `${prefix}/explore/fixtures`)
		await page.goBack()
		await expect(scope).toContainText(locale === 'zh-CN' ? '全部球员' : 'All players')
		await page.reload()
		await expect(movement).toContainText(locale === 'zh-CN' ? '只看上涨' : 'Rises only')
		await expect(page.getByRole('table').getByRole('link', { name: 'Palmer', exact: true })).toHaveCount(0)
	})
}

test('prediction route-ready telemetry passes receiver payload validation', async ({ page, request }) => {
	// Observe the actual Blob while forwarding it through the native sender.
	await page.addInitScript(() => {
		const send = navigator.sendBeacon.bind(navigator)
		const samples: unknown[] = []
		Object.assign(window, { observedVitalPayloads: samples })
		navigator.sendBeacon = (url, data) => {
			if (String(url) === '/api/vitals' && data instanceof Blob) {
				void data.text().then(text => samples.push(JSON.parse(text)))
			}
			return send(url, data)
		}
	})
	await page.goto('/explore/price-predictions')
	const targetPayload = () => page.evaluate(() => {
		const payloads = (window as unknown as { observedVitalPayloads: Array<{ samples: Array<{ metricName: string; navigationId: string }> }> }).observedVitalPayloads
		return payloads.find(payload => payload.samples.some(sample => sample.metricName === 'HOME_PRICE_CHANGES_READY'))
	})
	await expect.poll(targetPayload).toBeTruthy()
	const payload = await targetPayload()
	expect(payload?.samples.find(sample => sample.metricName === 'HOME_PRICE_CHANGES_READY')?.navigationId).toMatch(/^nav-[A-Za-z0-9_-]{8,52}$/)
	// Replay the exact batch, so an unrelated vital cannot satisfy this check.
	// The full suite shares a rate bucket. A specific 429 proves validation
	// passed (the receiver validates before rate limiting), not ingestion.
	const response = await request.post('/api/vitals', {
		headers: { Origin: 'https://letletme.top' },
		data: payload
	})
	if (response.status() === 429) {
		expect(await response.json()).toEqual({ error: 'Too many web vital reports' })
	} else {
		expect(response.status(), await response.text()).toBe(204)
	}
})

for (const locale of ['en', 'zh-CN']) {
	test(`prediction recommendation and explicit sort remain distinct [${locale}]`, async ({ page }) => {
		const zh = locale === 'zh-CN'
		await page.setViewportSize({ width: 1440, height: 900 })
		await page.goto(`${zh ? '/zh-CN' : ''}/explore/price-predictions?scope=all`)
		const progress = page.getByRole('columnheader', { name: zh ? '进度' : 'Progress', exact: true })
		await expect(progress).toHaveAttribute('aria-sort', 'none')
		await progress.getByRole('button').click()
		await expect(progress).toHaveAttribute('aria-sort', 'descending')
		await expect(page.locator('tbody tr').first()).toContainText('Saka')
		await progress.getByRole('button').click()
		await expect(progress).toHaveAttribute('aria-sort', 'ascending')
		await expect(page.locator('tbody tr').first()).toContainText('Palmer')
		const search = page.locator('#price-change-search')
		await search.fill('Saka')
		const filteredUrl = page.url()
		await page.getByRole('combobox', { name: zh ? '排序' : 'Sort', exact: true }).click()
		await page.getByRole('option', { name: zh ? '推荐排序' : 'Recommended', exact: true }).click()
		await expect(search).toHaveValue('Saka')
		await expect(page).toHaveURL(filteredUrl)
		await expect(page.locator('tbody tr')).toHaveCount(1)
		await expect(progress).toHaveAttribute('aria-sort', 'none')
		await search.fill('')
		await page.setViewportSize({ width: 390, height: 844 })
		const mobileSort = page.getByRole('combobox', { name: zh ? '排序' : 'Sort', exact: true })
		await mobileSort.click()
		await page.getByRole('option', { name: zh ? '推荐排序' : 'Recommended', exact: true }).click()
		await expect(mobileSort).toContainText(zh ? '推荐排序' : 'Recommended')
		const cards = page.getByRole('link', { name: /^(Saka|Palmer)$/ })
		await expect(cards).toHaveText(['Saka', 'Palmer'])
		await mobileSort.click()
		await page.getByRole('option', { name: `${zh ? '进度' : 'Progress'} ↓`, exact: true }).click()
		await expect(cards).toHaveText(['Saka', 'Palmer'])
		await page.setViewportSize({ width: 1440, height: 900 })
		await expect(progress).toHaveAttribute('aria-sort', 'descending')
		await page.setViewportSize({ width: 390, height: 844 })
		await expect(mobileSort).toContainText(`${zh ? '进度' : 'Progress'} ↓`)
		await mobileSort.click()
		await page.getByRole('option', { name: `${zh ? '进度' : 'Progress'} ↑`, exact: true }).click()
		await expect(cards).toHaveText(['Palmer', 'Saka'])
		await expect(mobileSort).toContainText(`${zh ? '进度' : 'Progress'} ↑`)
	})
}

for (const locale of ['en', 'zh-CN']) {
 for (const width of [1440, 390]) {
  test(`J15 guest auth help click journey ${locale} ${width}px`, async ({ page }) => {
   let prefix = locale === 'en' ? '' : '/zh-CN'
   let zh = locale === 'zh-CN'
   const expectHomeData = async () => {
    await expect(page.getByRole('button', { name: zh ? '最高分球员: Saka (12)' : 'Top Scorer: Saka (12)', exact: true })).toBeVisible()
    await expect(page.locator(`a[href="${prefix}/live/points/15702?gw=33&from=home"]`)).toContainText('101')
    const market = page.locator('[aria-labelledby="home-market-title"]')
    await expect(market).toContainText('Saka')
    await expect(page.locator('#home-price-changes-today')).toContainText(zh ? '2026年8月3日' : 'Aug 3, 2026')
    const fixtures = page.locator('#main-content [data-home-matches]').filter({ visible: true })
    await expect(fixtures).toHaveCount(1)
    await expect(fixtures).toHaveAttribute('data-home-fixtures-event', '33')
    await expect(fixtures).toContainText(/CHE|Chelsea/)
    await expect(fixtures).toContainText(/ARS|Arsenal/)
    await expect(fixtures.locator('[aria-busy="true"]')).toHaveCount(0)
    await expect(fixtures.getByRole('alert')).toHaveCount(0)
   }
   const authWrites: string[] = []
   page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/auth/') && request.method() !== 'GET') authWrites.push(request.method() + ' ' + new URL(request.url()).pathname)
   })
   await page.addInitScript(() => {
    const protectedSelector = '#tournament-create-form, [data-competition-perf-ready="create"]'
    const inspect = (node: Node) => {
     if (node instanceof Element && (node.matches(protectedSelector) || node.querySelector(protectedSelector))) sessionStorage.setItem('j15-protected-content-observed', 'true')
    }
    const observer = new MutationObserver(records => {
     for (const record of records) {
      if (record.type === 'attributes') inspect(record.target)
      for (const node of Array.from(record.addedNodes)) inspect(node)
     }
    })
    observer.observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['id', 'data-competition-perf-ready'] })
    if (document.documentElement) inspect(document.documentElement)
   })
   await page.setViewportSize({ width, height: 900 })
   await page.goto(prefix || '/')
   await expect(page.locator('[data-home-audience-hint="public"]')).toHaveCount(1)
   await expect(page.locator('#main-content').getByRole('heading', { level: 1 })).toBeVisible()
   await expectHomeData()
   const nav = page.getByRole('navigation').first()
   const createHref = `${prefix}/competitions/create`
   if (width === 390) await nav.locator('[data-navigation-mobile] > summary').click()
   else await nav.locator('details').filter({ has: page.locator(`a[href="${createHref}"]`) }).locator('summary').filter({ visible: true }).click()
   const create = nav.locator(`a[href="${createHref}"]`).filter({ visible: true })
   await expect(create).toHaveCount(1)
   await create.click()
   await expect(page).toHaveURL(url => url.pathname === `${prefix}/auth/login` && url.searchParams.get('next') === createHref)
   const main = page.locator('#main-content')
   await expect(main.getByRole('heading', { name: zh ? '登录' : 'Sign in', exact: true })).toBeVisible()
   await main.getByLabel(zh ? '邮箱' : 'Email', { exact: true }).fill('j15@example.test')
   await main.getByLabel(zh ? '密码' : 'Password', { exact: true }).fill('Fixture-only-password-123')
   await expect(main.getByLabel(zh ? '邮箱' : 'Email', { exact: true })).toHaveValue('j15@example.test')
   await expect(main.getByLabel(zh ? '密码' : 'Password', { exact: true })).toHaveValue('Fixture-only-password-123')
   const nextLocale = zh ? 'en' : 'zh-CN'
   await nav.locator('[data-locale-picker] > summary').click()
   await nav.locator(`[data-locale-link][lang="${nextLocale}"]`).click()
   zh = nextLocale === 'zh-CN'
   prefix = zh ? '/zh-CN' : ''
   await expect(page).toHaveURL(url => (url.pathname === `${prefix}/auth/login` || (!zh && url.pathname === '/en/auth/login')) && url.searchParams.get('next') === createHref)
   await expect(main.getByRole('heading', { name: zh ? '登录' : 'Sign in', exact: true })).toBeVisible()
   await main.locator(`a[href="${prefix}/auth/forgot-password"]`).click()
   await expect(page).toHaveURL(url => url.pathname === `${prefix}/auth/forgot-password`)
   await expect(main.getByRole('heading', { name: zh ? '重置密码' : 'Reset password', exact: true })).toBeVisible()
   await main.getByLabel(zh ? '邮箱' : 'Email', { exact: true }).fill('j15@example.test')
   await expect(main.getByLabel(zh ? '邮箱' : 'Email', { exact: true })).toHaveValue('j15@example.test')
   await main.getByRole('link', { name: zh ? '返回登录' : 'Back to login', exact: true }).click()
   await expect(page).toHaveURL(url => url.pathname === `${prefix}/auth/login`)
   await main.locator(`a[href="${prefix}/auth/signup"]`).click()
   await expect(page).toHaveURL(url => url.pathname === `${prefix}/auth/signup`)
   await expect(main.getByRole('heading', { name: zh ? '创建账户' : 'Create account', exact: true })).toBeVisible()
   await main.getByLabel(zh ? '姓名' : 'Name', { exact: true }).fill('J15 Fixture')
   await main.getByLabel(zh ? '邮箱' : 'Email', { exact: true }).fill('j15@example.test')
   await main.getByLabel(zh ? '密码' : 'Password', { exact: true }).fill('Fixture-only-password-123')
   await expect(main.getByLabel(zh ? '姓名' : 'Name', { exact: true })).toHaveValue('J15 Fixture')
   await expect(main.getByLabel(zh ? '邮箱' : 'Email', { exact: true })).toHaveValue('j15@example.test')
   await expect(main.getByLabel(zh ? '密码' : 'Password', { exact: true })).toHaveValue('Fixture-only-password-123')
   await main.getByRole('link', { name: zh ? '登录' : 'Sign in', exact: true }).click()
   await expect(page).toHaveURL(url => url.pathname === `${prefix}/auth/login`)
   await expect(main.getByRole('heading', { name: zh ? '登录' : 'Sign in', exact: true })).toBeVisible()
   await nav.getByRole('link', { name: 'LetLetMe', exact: true }).click()
   await expect(page).toHaveURL(url => url.pathname === (prefix || '/'))
   await expect(page.locator('[data-home-audience-hint="public"]')).toHaveCount(1)
   await expect(page.locator('#main-content').getByRole('heading', { level: 1 })).toBeVisible()
   await expectHomeData()
   expect(await page.evaluate(() => sessionStorage.getItem('j15-protected-content-observed'))).toBeNull()
   expect(authWrites).toEqual([])
  })
 }
}

test('repeated shell bootstrap executes theme actions only once', async ({ page }) => {
 test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Injects duplicate scripts only into an isolated fixture')
 await page.goto('/')
 await expect(page.locator('html')).toHaveAttribute('data-shell-hydrated', '')
 await page.addScriptTag({ url: '/theme-bootstrap.js' })
 await page.addScriptTag({ url: '/theme-bootstrap.js' })
 await page.evaluate(() => {
  document.documentElement.dataset.themeGuardCount = '0'
  new MutationObserver(records => {
   const count = records.flatMap(record => Array.from(record.addedNodes)).filter(node => node instanceof Element && node.hasAttribute('data-theme-transition-guard')).length
   document.documentElement.dataset.themeGuardCount = String(Number(document.documentElement.dataset.themeGuardCount) + count)
  }).observe(document.head, { childList: true })
 })
 const summary = page.locator('summary[aria-label="Change color theme"]')
 await summary.click()
 await page.getByRole('radio', { name: 'System', exact: true }).focus()
 await page.keyboard.press('ArrowLeft')
 await expect(page.locator('html')).toHaveClass(/dark/)
 await expect(page.locator('[data-theme-choice="dark"]')).toHaveAttribute('aria-checked', 'true')
 await expect(page.locator('html')).toHaveAttribute('data-theme-guard-count', '1')
 await expect(summary).toBeFocused()
 await expect(summary.locator('..')).not.toHaveAttribute('open', '')
})

for (const width of [1440, 390]) {
 test(`J18 shell preferences and cancelled feedback survive navigation ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  const submissions: string[] = []
  await page.route('**/api/bug-reports', async route => { submissions.push(route.request().method()); await route.abort() })
  await page.goto('/')
  await expect(page).toHaveURL(url => url.pathname === '/')
  await expect(page.locator('[data-home-audience-hint="public"]')).toHaveCount(1)
  const homeMatches = page.locator('[data-home-matches]')
  await expect(homeMatches).toHaveAttribute('data-home-fixtures-event', '33')
  await expect(homeMatches.getByText('GW33', { exact: true })).toBeVisible()
  await expect(homeMatches.locator('[aria-busy="true"]')).toHaveCount(0)
  await expect(page.locator('[data-countdown-card="dark"]')).toContainText('Gameweek 34')
  await page.locator('details[data-locale-picker] > summary').filter({ visible: true }).click()
  await page.getByRole('radio', { name: '简体中文', exact: true }).click()
  await expect(page).toHaveURL(/\/zh-CN$/)
  await page.getByRole('contentinfo').getByRole('link', { name: '市场', exact: true }).click()
  await expect(page).toHaveURL(/\/zh-CN\/explore\/market$/)
  await page.locator('summary[aria-label="切换配色主题"]').filter({ visible: true }).click()
  await page.locator('[data-theme-choice="dark"]').filter({ visible: true }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  const feedback = page.getByRole('button', { name: '遇到问题了？', exact: true })
  await feedback.click()
  await page.locator('#bug-report-body').fill('J18 isolated draft. Do not submit.')
  await expect(page.locator('#bug-report-body')).toHaveValue('J18 isolated draft. Do not submit.')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(feedback).toBeFocused()
  const qr = page.locator('details[data-mini-program-popover]')
  await qr.locator(':scope > summary').click()
  await expect(qr.getByRole('group')).toBeVisible()
  await qr.locator(':scope > summary').click()
  await expect(qr).not.toHaveAttribute('open', '')
  await page.getByRole('navigation', { name: '主导航', exact: true }).getByRole('link', { name: 'LetLetMe', exact: true }).click()
  await expect(page).toHaveURL(/\/zh-CN$/)
  await expect(page.locator('html')).toHaveClass(/dark/)
  expect(submissions).toEqual([])
 })
}
