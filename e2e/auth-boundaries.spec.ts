import { expect, test } from '@playwright/test'
import en from '../messages/en.json'
import zh from '../messages/zh-CN.json'

// AUTH03: anonymous fixture-only token states and redirect boundaries.
// No real token, email delivery, or account mutation is used here.
for (const locale of ['en', 'zh-CN'] as const) {
	for (const width of [1440, 390]) {
		const prefix = locale === 'en' ? '' : '/zh-CN'
		const t = (locale === 'en' ? en : zh).Auth
		test(`AUTH03 missing reset token recovers through link ${locale} ${width}`, async ({ page }) => {
			await page.setViewportSize({ width, height: 900 })
			await page.goto(`${prefix}/auth/reset-password`)
			await expect(page.getByText(t.invalidResetLink, { exact: false })).toBeVisible()
			await expect(page.locator('input[type="password"]')).toHaveCount(0)
			await page.getByRole('link', { name: t.requestNewLink, exact: true }).click()
			await expect(page).toHaveURL(url => url.pathname === `${prefix}/auth/forgot-password`)
			await expect(page.getByLabel(t.email, { exact: true })).toBeEnabled()
		})
		test(`AUTH03 verification error exposes recovery ${locale} ${width}`, async ({ page }) => {
			await page.setViewportSize({ width, height: 900 })
			await page.goto(`${prefix}/auth/verify-email?error=token_expired`)
			await expect(page.getByRole('heading', { name: t.verificationFailed, exact: true })).toBeVisible()
			await expect(page).toHaveURL(url => url.searchParams.get('error') === 'token_expired')
			await page.getByRole('link', { name: t.signUpAgain, exact: true }).click()
			await expect(page).toHaveURL(url => url.pathname === `${prefix}/auth/signup`)
			await expect(page.getByLabel(t.email, { exact: true })).toBeEnabled()
		})
		for (const next of ['/auth/forgot-password', 'https://outside.example.invalid/account', '//outside.example.invalid/account']) {
			test(`AUTH03 verification next boundary ${locale} ${width} ${next}`, async ({ page }) => {
				await page.setViewportSize({ width, height: 900 })
				let externalRequests = 0
				await page.route('https://outside.example.invalid/**', route => {
					externalRequests++
					return route.abort()
				})
				await page.goto(`${prefix}/auth/verify-email?next=${encodeURIComponent(next)}`)
				const expected = next === '/auth/forgot-password' ? `${prefix}${next}` : (prefix || '/')
				await expect(page).toHaveURL(url => url.pathname === expected && !url.searchParams.has('next'))
				expect(externalRequests).toBe(0)
				if (next === '/auth/forgot-password') {
					await expect(page.getByLabel(t.email, { exact: true })).toBeEnabled()
				}
				// The unsafe-next assertion proves the routing boundary only; it does
				// not claim the destination dashboard's data is fully ready.
			})
		}
	}
}

test.describe('AUTH03.state.01 invalid-next planned context', () => {
	test.use({ viewport: { width: 390, height: 900 }, colorScheme: 'dark', timezoneId: 'UTC' })
	for (const next of ['https://outside.example.invalid/account', '//outside.example.invalid/account']) {
		test(`rejects ${next} in Chinese dark UTC mobile`, async ({ page }) => {
			let externalRequests = 0
			await page.route('https://outside.example.invalid/**', route => {
				externalRequests++
				return route.abort()
			})
			await page.goto(`/zh-CN/auth/verify-email?next=${encodeURIComponent(next)}`)
			await expect(page).toHaveURL(url => url.pathname === '/zh-CN' && !url.searchParams.has('next'))
			expect(externalRequests).toBe(0)
		})
	}
})
