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

test.describe('S20.directed.03 unpublished is not a zero ranking', () => {
 test.use({ viewport: { width: 390, height: 900 }, timezoneId: 'UTC', colorScheme: 'dark' })
 test('renders publication closure without synthetic ranking rows', async ({ page }, testInfo) => {
  const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
  try {
   expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [{ operation: 'TrendCohorts', variables: { access: 'PUBLIC' }, data: {
    trendCohorts: { season: '2627', revision: 'unpublished-fixture', state: 'NOT_PUBLISHED', sourceCheckedAt: null, cohorts: [] }
   } }] }) })).ok).toBe(true)
   await page.goto('/zh-CN/explore/selections?scope=public')
   await expect(page.getByRole('heading', { name: '本赛季公共趋势尚未发布。', exact: true })).toBeVisible()
   await expect(page.getByRole('tabpanel')).toHaveCount(0)
   await expect(page.locator('tbody tr')).toHaveCount(0)
   await expect(page.getByRole('button', { name: '重试', exact: true })).toHaveCount(0)
   await expect(page.locator('html')).toHaveClass(/dark/)
   expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('UTC')
   const observations = await (await fetch(fixture)).json()
   expect(observations.requests.filter((r: { operation: string }) => r.operation === 'TrendCohortSnapshot')).toEqual([])
   await testInfo.attach('S20-unpublished', { contentType: 'application/json', body: JSON.stringify({ caseId: 'S20', stepId: 'S20.01', variantId: 'S20.directed.03', locale: 'zh-CN', width: 390, theme: 'dark', timezone: 'UTC', identity: 'A anonymous', environment: 'isolated-fixture', currentBehavior: 'not-published-without-ranking', targetOracle: 'not-published-without-ranking', contractGap: false, assertion: 'Closed public catalog displays not-published; no ranking rows, tabpanel, retry or dependent snapshot request', functionalStatus: 'PASS', performanceStatus: 'NOT_RUN', readyMs: null, wholeVariantComplete: false, scope: 'Trends public catalog only, not every publication consumer' }) })
  } finally { await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules: [] }) }) }
 })
})
