import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.describe('maintenance mode', () => {
	test.skip(
		process.env.MAINTENANCE_MODE !== 'true',
		'Run with MAINTENANCE_MODE=true to exercise the maintenance surface.'
	)

	test('replaces English and Chinese data pages without exposing stale content', async ({
		page
	}) => {
		const englishResponse = await page.goto('/data/player-stats')
		expect(englishResponse?.status()).toBe(503)
		expect(englishResponse?.headers()['cache-control']).toContain('no-store')
		expect(englishResponse?.headers()['retry-after']).toBe('420')
		expect(page.url()).toMatch(/\/data\/player-stats$/)
		await expect(
			page.getByRole('heading', { name: 'The data room is between seasons.' })
		).toBeVisible()
		await expect(
			page.getByText('Player Statistics', { exact: true })
		).toHaveCount(0)

		const accessibility = await new AxeBuilder({ page }).analyze()
		expect(accessibility.violations).toEqual([])

		await page.setViewportSize({ width: 390, height: 844 })
		const chineseResponse = await page.goto('/zh-CN/live/matches')
		expect(chineseResponse?.status()).toBe(503)
		expect(page.url()).toMatch(/\/zh-CN\/live\/matches$/)
		await expect(
			page.getByRole('heading', { name: '新赛季数据正在就位。' })
		).toBeVisible()
		await expect(page.getByText('实时比赛', { exact: true })).toHaveCount(0)
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= window.innerWidth
			)
		).toBe(true)
	})

	test('returns a bounded machine-readable 503 only for Data-dependent APIs', async ({
		request
	}) => {
		for (const pathname of ['/api/graphql', '/api/tournaments']) {
			const response = await request.post(pathname, {
				data: { query: 'query MaintenanceProbe { __typename }' }
			})
			expect(response.status(), pathname).toBe(503)
			expect(response.headers()['cache-control'], pathname).toContain(
				'no-store'
			)
			expect(response.headers()['retry-after'], pathname).toBe('420')
			const payload = await response.json()
			expect(payload.code, pathname).toBe('MAINTENANCE_MODE')
			expect(payload.retryAfterSeconds, pathname).toBe(420)
		}

		const authResponse = await request.get('/api/auth/session')
		expect(authResponse.status()).not.toBe(503)
	})
})
