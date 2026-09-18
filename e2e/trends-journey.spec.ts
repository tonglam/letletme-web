import { expect, test } from '@playwright/test'

for (const locale of ['en', 'zh-CN']) {
	for (const width of [1440, 390]) {
		test(`J05 public trends click journey ${locale} ${width}px`, async ({ page }, testInfo) => {
			const zh = locale === 'zh-CN'
			const prefix = zh ? '/zh-CN' : ''
			const path = `${prefix}/explore/selections`
			await page.setViewportSize({ width, height: 900 })
			testInfo.annotations.push({ type: 'coverage-case', description: 'J05 public ready journey only; empty, unavailable, late response and performance remain separate' })
			await page.goto(prefix || '/')
			await expect(page.getByRole('button', { name: zh ? '最高分球员: Saka (12)' : 'Top Scorer: Saka (12)', exact: true })).toBeVisible()
			const nav = page.getByRole('navigation').first()
			if (width === 390) await nav.locator('[data-navigation-mobile] > summary').click()
			else await nav.locator('details').filter({ has: page.locator(`a[href="${path}"]`) }).locator('summary').filter({ visible: true }).click()
			const link = nav.locator(`a[href="${path}"]`).filter({ visible: true })
			await expect(link).toHaveCount(1)
			await link.click()
			await expect(page).toHaveURL(url => url.pathname === path)
			const cohort = page.getByRole('combobox', { name: zh ? '当前联赛' : 'Active league', exact: true })
			const gw = page.getByRole('combobox', { name: zh ? '观察轮次' : 'Gameweek', exact: true })
			const checkPanels = async (player: string, percent: number) => {
				await expect(cohort).toHaveAttribute('aria-busy', 'false')
				for (const name of zh ? ['持有率', '队长选择', '转会'] : ['Ownership', 'Captaincy', 'Transfers']) {
					await page.getByRole('tab', { name, exact: true }).click()
					const panel = page.getByRole('tabpanel')
					const rows = panel.getByRole('listitem')
					await expect(rows).toHaveCount(name === 'Transfers' || name === '转会' ? 1 : 2)
					for (const row of await rows.all()) {
						await expect(row.getByRole('link', { name: player, exact: true })).toBeVisible()
						await expect(row.getByText(`${percent}%`, { exact: true })).toBeVisible()
					}
				}
			}
			await cohort.selectOption('competition:777')
			await gw.selectOption('33')
			await checkPanels('Saka', 72)
			const beforeDetail = page.url()
			const playerLink = page.getByRole('tabpanel').getByRole('link', { name: 'Saka', exact: true })
			await expect(playerLink).toHaveAttribute('href', `${prefix}/explore/player-stats?p1=1`)
			await playerLink.click()
			await expect(page).toHaveURL(url => url.pathname === `${prefix}/explore/player-stats` && url.searchParams.get('p1') === '1')
			await expect(page.getByRole('region', { name: zh ? '球员总览' : 'Player overall', exact: true })).toContainText('Saka')
			await page.goBack()
			await expect(page).toHaveURL(beforeDetail)
			await expect(cohort).toHaveValue('competition:777')
			await expect(gw).toHaveValue('33')
			await checkPanels('Saka', 72)
			await cohort.selectOption('competition:779')
			await checkPanels('Palmer', 61)
			await gw.selectOption('32')
			await checkPanels('Palmer', 53)
			await expect(page).toHaveURL(url => url.searchParams.get('gw') === '32')
			await expect(cohort).toHaveValue('competition:779')
			await expect(gw).toHaveValue('32')
			await page.reload()
			await expect(cohort).toHaveValue('competition:779')
			await expect(gw).toHaveValue('32')
			await checkPanels('Palmer', 53)
		})
	}
}

for (const locale of ['en', 'zh-CN']) {
	for (const width of [1440, 390]) {
		for (const state of ['failure', 'empty', 'unavailable'] as const) {
			test(`J05 ${state} recovery ${locale} ${width}px`, async ({ page }) => {
				const zh = locale === 'zh-CN'
				await page.setViewportSize({ width, height: 900 })
				await page.goto(`${zh ? '/zh-CN' : ''}/explore/selections?scope=public&tournament=777&gw=33`)
				const cohort = page.getByRole('combobox', { name: zh ? '当前联赛' : 'Active league', exact: true })
				const gw = page.getByRole('combobox', { name: zh ? '观察轮次' : 'Gameweek', exact: true })
				await expect(page.getByRole('tabpanel').getByRole('link', { name: 'Saka', exact: true }).first()).toBeVisible()
				let inject = true
				let requests = 0
				await page.route('**/api/trends/public-desk?**', async route => {
					requests++
					const requestUrl = new URL(route.request().url())
					expect(requestUrl.searchParams.get('cohortId')).toBe('competition:779')
					expect(requestUrl.searchParams.get('eventId')).toBe(state === 'empty' && !inject ? '32' : '33')
					if (!inject) return route.continue()
					if (state === 'failure') return route.fulfill({ status: 503, json: { error: 'isolated read failure' } })
					const response = await route.fetch()
					const payload = await response.json()
					const desk = payload.trendCohortSnapshot ?? payload
					for (const section of desk.sections) {
						section.rows = state === 'empty' ? [] : null
						section.state = state === 'empty' ? 'CONFIRMED_EMPTY' : 'UNAVAILABLE'
						section.evidenceContext.availabilityState = section.state
					}
					await route.fulfill({ response, json: payload })
				})
				await cohort.selectOption('competition:779')
				await expect.poll(() => requests).toBe(1)
				await expect(cohort).toHaveAttribute('aria-busy', 'false')
				if (state === 'failure') {
					await expect(page.getByText(zh ? '联赛趋势加载失败。本次失败不会被伪装成空数据。' : 'League trends could not be loaded. Your request was not treated as an empty result.', { exact: true })).toBeVisible()
					await expect(cohort).toHaveValue('competition:777')
					await expect(page).toHaveURL(url => url.searchParams.get('cohort') === 'competition:777' && url.searchParams.get('gw') === '33' && url.searchParams.get('scope') === 'public')
					await expect(gw).toHaveValue('33')
					await expect(page.getByRole('tabpanel').getByRole('link', { name: 'Saka', exact: true }).first()).toBeVisible()
					inject = false
					await cohort.selectOption('competition:779')
				} else {
					for (const name of zh ? ['持有率', '队长选择', '转会'] : ['Ownership', 'Captaincy', 'Transfers']) {
						await page.getByRole('tab', { name, exact: true }).click()
						const panel = page.getByRole('tabpanel')
						await expect(panel.getByRole('link')).toHaveCount(0)
						const message = state === 'empty'
							? (zh ? '已完成采集，本轮暂无记录。' : 'Collection is complete; this gameweek has no records.')
							: (zh ? '选人数据暂时无法加载。' : 'Selection data is temporarily unavailable.')
						await expect(panel.getByText(message, { exact: true }).first()).toBeVisible()
					}
					await expect(cohort).toHaveValue('competition:779')
					inject = false
					if (state === 'unavailable') await page.getByRole('tabpanel').getByRole('button', { name: zh ? '重试' : 'Retry', exact: true }).click()
					else await gw.selectOption('32')
				}
				await expect(page.getByRole('tabpanel').getByRole('link', { name: 'Palmer', exact: true }).first()).toBeVisible()
				await expect(cohort).toHaveAttribute('aria-busy', 'false')
				await expect(cohort).toHaveValue('competition:779')
				await expect(page).toHaveURL(url => url.searchParams.get('cohort') === 'competition:779' && url.searchParams.get('gw') === (state === 'empty' ? '32' : '33'))
				expect(requests).toBe(2)
			})
		}

		test(`J05 ignores late cohort response ${locale} ${width}px`, async ({ page }) => {
			const zh = locale === 'zh-CN'
			// Isolated fault injection: deliver an old response despite cancellation.
			await page.addInitScript(() => {
				const original = window.fetch.bind(window)
				window.fetch = (input, init) => {
					if (String(input).includes('/api/trends/public-desk?')) {
						return original(input, { ...init, signal: undefined })
					}
					return original(input, init)
				}
			})
			await page.setViewportSize({ width, height: 900 })
			await page.goto(`${zh ? '/zh-CN' : ''}/explore/selections?scope=public&tournament=777&gw=33`)
			const cohort = page.getByRole('combobox', { name: zh ? '当前联赛' : 'Active league', exact: true })
			const gw = page.getByRole('combobox', { name: zh ? '观察轮次' : 'Gameweek', exact: true })
			await expect(page.getByRole('tabpanel').getByRole('link', { name: 'Saka', exact: true }).first()).toBeVisible()
			let release!: () => void
			const gate = new Promise<void>(resolve => { release = resolve })
			let oldReady = false
			await page.route('**/api/trends/public-desk?**', async route => {
				if (new URL(route.request().url()).searchParams.get('cohortId') !== 'competition:779') return route.continue()
				const response = await route.fetch()
				oldReady = true
				await gate
				await route.fulfill({ response })
			})
			await cohort.selectOption('competition:779')
			await expect.poll(() => oldReady).toBe(true)
			await cohort.selectOption('competition:777')
			await gw.selectOption('32')
			await expect(cohort).toHaveAttribute('aria-busy', 'false')
			await expect(page.getByRole('tabpanel').getByRole('listitem').first().getByText('64%', { exact: true })).toBeVisible()
			const oldResponse = page.waitForResponse(response => new URL(response.url()).searchParams.get('cohortId') === 'competition:779')
			release()
			await (await oldResponse).finished()
			await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
			await expect(cohort).toHaveValue('competition:777')
			await expect(gw).toHaveValue('32')
			await expect(page.getByRole('tabpanel').getByRole('link', { name: 'Palmer', exact: true })).toHaveCount(0)
			await expect(page).toHaveURL(url => url.searchParams.get('cohort') === 'competition:777' && url.searchParams.get('gw') === '32')
			await expect(cohort).toHaveAttribute('aria-busy', 'false')
			for (const name of zh ? ['持有率', '队长选择', '转会'] : ['Ownership', 'Captaincy', 'Transfers']) {
				await page.getByRole('tab', { name, exact: true }).click()
				const rows = page.getByRole('tabpanel').getByRole('listitem')
				await expect(rows).toHaveCount(name === 'Transfers' || name === '转会' ? 1 : 2)
				for (const row of await rows.all()) {
					await expect(row.getByRole('link', { name: 'Saka', exact: true })).toBeVisible()
					await expect(row.getByText('64%', { exact: true })).toBeVisible()
				}
			}
		})
	}
}

for (const locale of ['en', 'zh-CN']) {
	for (const width of [1440, 390]) {
		for (const retained of [false, true]) {
			test(`TR03 stale section retains truthful availability ${locale} ${width}px rows=${retained}`, async ({ page }) => {
				const zh = locale === 'zh-CN'
				await page.setViewportSize({ width, height: 900 })
				await page.goto(`${zh ? '/zh-CN' : ''}/explore/selections?scope=public&cohort=competition:777&gw=33`)
				await expect(page.getByRole('tabpanel')).toContainText('Saka')
				await page.route('**/api/trends/public-desk?**', async route => {
					const response = await route.fetch()
					const payload = await response.json()
					const desk = payload.trendCohortSnapshot ?? payload
					for (const section of desk.sections) {
						section.state = 'STALE'
						section.evidenceContext.availabilityState = 'STALE'
						if (!retained) section.rows = null
					}
					await route.fulfill({ response, json: payload })
				})
				const cohort = page.getByRole('combobox', { name: zh ? '当前联赛' : 'Active league', exact: true })
				await cohort.selectOption('competition:779')
				await expect(cohort).toHaveAttribute('aria-busy', 'false')
				await expect(page).toHaveURL(url => url.searchParams.get('cohort') === 'competition:779' && url.searchParams.get('gw') === '33')
				for (const name of zh ? ['持有率', '队长选择', '转会'] : ['Ownership', 'Captaincy', 'Transfers']) {
					await page.getByRole('tab', { name, exact: true }).click()
					const panel = page.getByRole('tabpanel')
					await expect(panel.getByText(zh ? '数据较旧' : 'Stale data', { exact: true }).first()).toBeVisible()
					await expect(panel.getByRole('button', { name: zh ? '重试' : 'Retry', exact: true })).toHaveCount(0)
					if (retained) await expect(panel.getByRole('link', { name: 'Palmer', exact: true }).first()).toBeVisible()
					else {
						await expect(panel.getByRole('link')).toHaveCount(0)
						await expect(panel.getByText(zh ? '当前显示上次成功采集的选人数据。' : 'Showing the last successfully collected selection data.', { exact: true }).first()).toBeVisible()
					}
					await expect(panel).not.toContainText('Saka')
				}
			})
		}
	}
}
