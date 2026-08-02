import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('homepage streams its real shell and prevents CDN script rewriting', async ({ request }) => {
	const response = await request.get('/', { headers: { Accept: 'text/html' } })
	const cacheControl = response.headers()['cache-control']
	const html = await response.text()

	expect(response.ok()).toBe(true)
	expect(cacheControl).toContain('no-transform')
	expect(cacheControl).toContain('must-revalidate')
	expect(html).toContain('Every point. Every rival.')
	expect(html).not.toContain('aria-label="Loading page"')
})

test('client-only navigation controls stay unavailable until hydration', async ({ browser }) => {
	const page = await browser.newPage({ javaScriptEnabled: false })
	await page.setViewportSize({ width: 390, height: 844 })
	await page.goto('/')

	await expect(page.getByRole('button', { name: 'Open navigation menu' })).toBeDisabled()
	await expect(page.getByRole('button', { name: 'Change color theme' })).toBeDisabled()

	await page.close()
})

test('public home has a keyboard skip path and no detectable accessibility violations', async ({ page }) => {
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

test('mobile navigation expands a group and closes after navigation', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 })
	await page.goto('/')

	await page.getByRole('button', { name: 'Open navigation menu' }).click()
	const dialog = page.getByRole('dialog')
	await expect(dialog).toBeVisible()

	const dataGroup = dialog.getByRole('button', { name: 'Data' })
	await dataGroup.click()
	await expect(dataGroup).toHaveAttribute('aria-expanded', 'true')
	await dialog.getByRole('link', { name: 'Price Changes' }).click()

	await expect(page).toHaveURL(/\/data\/price-changes$/)
	await expect(dialog).toBeHidden()
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('theme choice persists across a reload', async ({ page }) => {
	await page.goto('/')
	await page.getByRole('button', { name: 'Change color theme' }).click()
	await page.getByRole('menuitemradio', { name: 'Dark' }).click()

	await expect(page.locator('html')).toHaveClass(/dark/)
	await expect.poll(() => page.evaluate(() => localStorage.getItem('theme'))).toBe('dark')
	await page.reload()
	await expect(page.locator('html')).toHaveClass(/dark/)
})

test('sign-up gives an in-app error for mismatched passwords', async ({ page }) => {
	await page.goto('/auth/signup')
	await page.getByLabel('Name').fill('Test Manager')
	await page.getByLabel('Email').fill('manager@example.com')
	await page.getByLabel('Password', { exact: true }).fill('long-password-one')
	await page.getByLabel('Confirm password').fill('long-password-two')
	await page.getByRole('button', { name: 'Create account' }).click()

	await expect(page.getByRole('alert').filter({ hasText: 'Passwords do not match' })).toBeVisible()
	await expect(page).toHaveURL(/\/auth\/signup$/)
})

test('malformed player history does not break the comparison screen', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('player-stats-recent-1', '{not-json')
		localStorage.setItem('player-stats-recent-2', JSON.stringify({ version: 99, players: [{ id: 1 }] }))
	})
	await page.route('**/api/graphql', route => route.abort('connectionfailed'))
	await page.goto('/data/player-stats')

	await expect(page.getByRole('heading', { name: 'Player Statistics' })).toBeVisible()
	await expect(page.getByRole('button', { name: 'Clear recent' })).toHaveCount(0)
	await expect(
		page.getByRole('status').filter({ hasText: 'Failed to load the team directory.' }).first(),
	).toBeVisible()
})

test('protected tournament creation returns an unauthenticated user to sign-in safely', async ({ page }) => {
	await page.goto('/tournament/create')
	await expect(page).toHaveURL(/\/auth\/login\?next=%2Ftournament%2Fcreate$/)
	await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})

test('sign-in page has no detectable accessibility violations', async ({ page }) => {
	await page.goto('/auth/login')
	await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
	const accessibility = await new AxeBuilder({ page }).analyze()
	expect(accessibility.violations).toEqual([])
})
