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
})

for (const display of [
 { kind: 'directed', locale: 'zh-CN', width: 390, timezone: 'UTC', theme: 'dark' },
 ...['en', 'zh-CN'].flatMap(locale => [1440, 390].map(width => ({ kind: 'baseline', locale, width, timezone: 'Australia/Perth', theme: 'system' })))
]) {
test.describe(`S20 public transfers ${display.kind} ${display.locale} ${display.width}`, () => {
 test.use({ locale: display.locale, viewport: { width: display.width, height: 900 }, colorScheme: display.theme === 'dark' ? 'dark' : 'light', timezoneId: display.timezone })
	test('LP04.state.01 preserves public reads, explicit retry and confirmed empty', async ({ page, context }, testInfo) => {
		test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Isolated fixture only')
		await page.addInitScript(theme => localStorage.setItem('theme', theme), display.theme)
        const zh = display.locale === 'zh-CN'
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
		await page.goto(`${zh ? '/zh-CN' : ''}/live/points/123?gw=33&tournamentId=3`)
		await expect(page.locator('html')).toHaveClass(display.theme === 'dark' ? /\bdark\b/ : /\blight\b/)
		expect(await page.evaluate(() => ({ width: innerWidth, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, language: document.documentElement.lang }))).toEqual({ width: display.width, timezone: display.timezone, language: display.locale })
		expect((await context.cookies()).filter(cookie => /session_token/.test(cookie.name))).toEqual([])
		const ready = page.locator('[data-live-points-ready="true"]')
		await expect(ready).toHaveAttribute('data-live-entry', '123')
		await expect(ready).toHaveAttribute('data-live-gw', '33')
		const section = page.getByRole('region', { name: zh ? /本周转会\s*GW33/ : /Gameweek transfers\s*GW33/ })
		const refresh = section.getByRole('button', { name: zh ? '刷新转会' : 'Refresh transfers', exact: true })
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
		await expect(section).toContainText(zh ? '本轮暂无已同步的转会记录。' : 'No synced transfer records for this gameweek.')
		await expect(section).not.toContainText('Incoming Player')
		await expect(section.getByRole('status')).toHaveCount(0)
		expect(reads).toBe(3)
		expect(new URL(page.url()).searchParams.get('gw')).toBe('33')
		expect(new URL(page.url()).searchParams.get('tournamentId')).toBe('3')
        expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe(display.theme)
		await testInfo.attach('LP04.state.01', { contentType: 'application/json', body: JSON.stringify({ variantId: display.kind === 'directed' ? 'LP04.state.01' : `S20.UNRESOLVED_ROLE.${display.locale}.${display.width === 390 ? 'mobile390' : 'desktop1440'}.base`, persona: 'A', locale: display.locale, device: display.width === 390 ? 'mobile390' : 'desktop1440', theme: display.theme, timezone: display.timezone, wholeVariantComplete: false, reads, functionalStatus: 'PASS', performanceStatus: 'NOT_RUN', readyMs: null, scope: 'Public transfer records, held refresh, 401 without login gate, explicit retry to confirmed empty; isolated fixture only' }) })
	})
})

}
