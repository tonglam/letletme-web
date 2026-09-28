import { expect, test } from '@playwright/test'

test.describe('LP04 planned anonymous transfer context', () => {
	test.use({ viewport: { width: 390, height: 900 }, colorScheme: 'dark', timezoneId: 'UTC' })
	test('malformed successful browser transfer response ends loading and permits explicit recovery', async ({ page }) => {
		test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Isolated fixture only')
		let malformed = true
		let reads = 0
		await page.route('**/api/graphql', async route => {
			if (!route.request().postDataJSON()?.query?.includes('GetEntryTransferHistory')) {
				await route.continue({ url: `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/graphql` })
				return
			}
			reads += 1
			await route.fulfill({ json: { data: malformed ? {} : { entryTransferHistory: [] } } })
		})
		await page.goto('/zh-CN/live/points/123?gw=33')
		const section = page.getByRole('region', { name: /本周转会\s*GW33/ })
		const refresh = section.getByRole('button', { name: '刷新转会', exact: true })
		await refresh.click()
		await expect(section.getByRole('alert')).toBeVisible({ timeout: 3000 })
		await expect(section.getByRole('status')).toHaveCount(0)
		await expect(refresh).toBeEnabled()
		expect(reads).toBe(1)
		malformed = false
		await refresh.click()
		await expect(section).toContainText('本轮暂无已同步的转会记录。')
		await expect(section.getByRole('alert')).toHaveCount(0)
		expect(reads).toBe(2)
	})
	test('LP04.state.01 preserves public reads, explicit retry and confirmed empty', async ({ page, context }, testInfo) => {
		test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Isolated fixture only')
		await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
		let state: 'records' | 'failure' | 'empty' = 'records'
		let reads = 0
		let release!: () => void
		const held = new Promise<void>(resolve => { release = resolve })
		await page.route('**/api/graphql', async route => {
			const payload = route.request().postDataJSON() as { query?: string; variables?: { entryId?: number } }
			if (!payload.query?.includes('GetEntryTransferHistory')) {
				await route.continue({ url: `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/graphql` })
				return
			}
			reads += 1
			expect(payload.variables?.entryId).toBe(123)
			if (state === 'failure') {
				await held
				await route.fulfill({ status: 401, json: { errors: [{ message: 'Authentication required.', extensions: { code: 'UNAUTHENTICATED' } }] } })
				return
			}
			await route.fulfill({ json: { data: { entryTransferHistory: state === 'empty' ? [] : [{ eventId: 33, eventTransfers: 1, eventTransfersCost: 0, transfers: [{ event: 33, elementOutWebName: 'Outgoing Player', elementOutTeamShortName: 'OUT', elementOutTypeName: 'MID', elementOutCost: 5.5, elementInWebName: 'Incoming Player', elementInTeamShortName: 'IN', elementInTypeName: 'MID', elementInCost: 6.2, time: '2026-08-04T10:00:00Z' }] }] } } })
		})
		await page.goto('/zh-CN/live/points/123?gw=33&tournamentId=3')
		await expect(page.locator('html')).toHaveClass(/dark/)
		expect(await page.evaluate(() => ({ width: innerWidth, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, language: document.documentElement.lang }))).toEqual({ width: 390, timezone: 'UTC', language: 'zh-CN' })
		expect((await context.cookies()).filter(cookie => /session_token/.test(cookie.name))).toEqual([])
		const ready = page.locator('[data-live-points-ready="true"]')
		await expect(ready).toHaveAttribute('data-live-entry', '123')
		await expect(ready).toHaveAttribute('data-live-gw', '33')
		const section = page.getByRole('region', { name: /本周转会\s*GW33/ })
		const refresh = section.getByRole('button', { name: '刷新转会', exact: true })
		await refresh.click()
		await expect(section).toContainText('Incoming Player')
		await expect(section).toContainText('Outgoing Player')
		await expect(section).toContainText('£5.5m')
		await expect(section).toContainText('£6.2m')
		expect(reads).toBe(1)
		state = 'failure'
		try {
			await refresh.click()
			await expect.poll(() => reads).toBe(2)
			await expect(refresh).toBeDisabled()
			await expect(section.getByRole('status')).toBeVisible()
			await expect(ready).toHaveAttribute('data-live-gw', '33')
		} finally { release() }
		await expect(section.getByRole('alert')).toBeVisible()
		await expect(section.getByRole('link')).toHaveCount(0)
		await expect(refresh).toBeEnabled()
		state = 'empty'
		await refresh.click()
		await expect(section.getByRole('alert')).toHaveCount(0)
		await expect(section).toContainText('本轮暂无已同步的转会记录。')
		await expect(section).not.toContainText('Incoming Player')
		await expect(section.getByRole('status')).toHaveCount(0)
		expect(reads).toBe(3)
		expect(new URL(page.url()).searchParams.get('gw')).toBe('33')
		expect(new URL(page.url()).searchParams.get('tournamentId')).toBe('3')
		await testInfo.attach('LP04.state.01', { contentType: 'application/json', body: JSON.stringify({ variantId: 'LP04.state.01', persona: 'A', locale: 'zh-CN', device: 'mobile390', theme: 'dark', timezone: 'UTC', reads, functionalStatus: 'PASS', performanceStatus: 'NOT_RUN', readyMs: null, scope: 'Public transfer records, held refresh, 401 without login gate, explicit retry to confirmed empty; isolated fixture only' }) })
	})
})
