import { expect, test } from '@playwright/test'

// Run alone against a fresh task-owned standalone build: the public catalog is cached.
test.skip(process.env.E2E_TRENDS_UNPUBLISHED !== '1', 'Requires isolated public catalog cache')

test('TR03 unpublished public catalog is distinct from unavailable data', async ({ page }, testInfo) => {
	const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}`
	const control = await fetch(`${fixture}/__performance`, {
		method: 'POST',
		body: JSON.stringify({ rules: [{ operation: 'TrendCohorts', variables: { access: 'PUBLIC' }, data: {
			trendCohorts: { season: '2627', revision: 'unpublished-fixture', state: 'NOT_PUBLISHED', sourceCheckedAt: null, cohorts: [] }
		} }] })
	})
	expect(control.ok).toBe(true)
	try {
		for (const locale of ['en', 'zh-CN']) {
			for (const width of [1440, 390]) {
				const zh = locale === 'zh-CN'
				await page.setViewportSize({ width, height: 900 })
				await page.goto(`${zh ? '/zh-CN' : ''}/explore/selections?scope=public`)
				await expect(page.getByRole('heading', { name: zh ? '本赛季公共趋势尚未发布。' : 'Public trends have not been published for this season yet.', exact: true })).toBeVisible()
				await expect(page.getByText(zh ? '本赛季公共趋势目录仍处于关闭状态；指定联赛及当前轮次发布完成后才会显示。' : 'The public trend catalog is still closed for this season. It will appear after the selected cohorts and their current-gameweek publications are ready.', { exact: true })).toBeVisible()
				await expect(page.getByRole('tabpanel')).toHaveCount(0)
				await expect(page.getByRole('button', { name: zh ? '重试' : 'Retry', exact: true })).toHaveCount(0)
			}
		}
		const observations = await (await fetch(`${fixture}/__performance`)).json()
		expect(observations.requests.some((row: {operation: string; variables: {access?: string}; finishedAt: number | null}) => row.operation === 'TrendCohorts' && row.variables.access === 'PUBLIC' && row.finishedAt !== null)).toBe(true)
		await testInfo.attach('unpublished-upstream-requests', { body: JSON.stringify(observations), contentType: 'application/json' })
	} finally {
		await fetch(`${fixture}/__performance`, { method: 'POST', body: JSON.stringify({ rules: [] }) })
	}
})

for (const context of [
 { kind: 'directed', locale: 'zh-CN', width: 390, timezone: 'UTC', theme: 'dark' },
 ...['en', 'zh-CN'].flatMap(locale => [1440, 390].map(width => ({ kind: 'baseline', locale, width, timezone: 'Australia/Perth', theme: 'system' })))
]) {
test.describe(`S20 unpublished required context ${context.kind} ${context.locale} ${context.width}`, () => {
 test.use({ locale: context.locale, viewport: { width: context.width, height: 900 }, colorScheme: context.theme === 'dark' ? 'dark' : 'light', timezoneId: context.timezone })
test('S20.directed.03 unpublished is not zero in required context', async ({ page }, testInfo) => {
	await page.addInitScript(theme => localStorage.setItem('theme', theme), context.theme)
	const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}`
	const control = await fetch(`${fixture}/__performance`, {
		method: 'POST',
		body: JSON.stringify({ rules: [{ operation: 'TrendCohorts', variables: { access: 'PUBLIC' }, data: {
			trendCohorts: { season: '2627', revision: 'unpublished-fixture', state: 'NOT_PUBLISHED', sourceCheckedAt: null, cohorts: [] }
		} }] })
	})
	expect(control.ok).toBe(true)
	try {
		for (const locale of [context.locale]) {
			for (const width of [context.width]) {
				const zh = locale === 'zh-CN'
				await page.setViewportSize({ width, height: 900 })
				await page.goto(`${zh ? '/zh-CN' : ''}/explore/selections?scope=public`)
				await expect(page.getByRole('heading', { name: zh ? '本赛季公共趋势尚未发布。' : 'Public trends have not been published for this season yet.', exact: true })).toBeVisible()
				await expect(page.getByText(zh ? '本赛季公共趋势目录仍处于关闭状态；指定联赛及当前轮次发布完成后才会显示。' : 'The public trend catalog is still closed for this season. It will appear after the selected cohorts and their current-gameweek publications are ready.', { exact: true })).toBeVisible()
				await expect(page.getByRole('tabpanel')).toHaveCount(0)
				await expect(page.getByRole('button', { name: zh ? '重试' : 'Retry', exact: true })).toHaveCount(0)
			}
		}
		// The public catalog is shared through Next's 60-second server cache. Each context validates the rendered state, not a fresh upstream request.
		await expect(page.locator('html')).toHaveClass(context.theme === 'dark' ? /\bdark\b/ : /\blight\b/)
		expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(context.timezone)
		expect(page.viewportSize()?.width).toBe(context.width)
		await expect(page.locator('#main-content').getByRole('table')).toHaveCount(0)
        expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe(context.theme)
        await testInfo.attach('S20-unpublished-context', { contentType: 'application/json', body: JSON.stringify({ variantId: context.kind === 'directed' ? 'S20.directed.03' : `S20.UNRESOLVED_ROLE.${context.locale}.${context.width === 390 ? 'mobile390' : 'desktop1440'}.base`, ...context, wholeVariantComplete: false, readyMs: null, performanceStatus: 'NOT_OBSERVED' }) })
	} finally {
		await fetch(`${fixture}/__performance`, { method: 'POST', body: JSON.stringify({ rules: [] }) })
	}
})

})

}
