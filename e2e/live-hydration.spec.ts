import { expect, test } from '@playwright/test'

test.use({ timezoneId: 'Australia/Perth' })

test('live match kickoff uses UTC on the server and browser local time after hydration', async ({
	page
}) => {
	test.skip(
		Boolean(process.env.PLAYWRIGHT_BASE_URL),
		'Uses the deterministic local GraphQL fixture'
	)
	test.skip(
		process.env.E2E_LIVE_HYDRATION !== '1',
		'Runs only through the dedicated hydration fixture command'
	)

	const reactHydrationErrors: string[] = []
	const isHydrationError = (message: string) =>
		/hydration|react(?:\.dev\/errors\/418)|minified react error #418/i.test(
			message
		)

	page.on('console', message => {
		if (message.type() === 'error' && isHydrationError(message.text())) {
			reactHydrationErrors.push(message.text())
		}
	})
	page.on('pageerror', error => {
		if (isHydrationError(error.message))
			reactHydrationErrors.push(error.message)
	})

	const response = await page.goto('/live/matches')
	expect(response?.status()).toBe(200)
	const serverHtml = await response?.text()
	expect(serverHtml).toContain('August 4, 2026 at 19:00')

	await expect(
		page.getByRole('heading', { level: 1, name: 'Live Matches' })
	).toBeVisible()
	await expect(page.getByText('Arsenal', { exact: true })).toBeVisible()
	await expect(page.getByText('Chelsea', { exact: true })).toBeVisible()
	await expect(page.getByText(/2\s*[–-]\s*0/)).toBeVisible()
	await expect(page.getByText(/45.*live/)).toBeVisible()
	await expect(page.getByText('August 5, 2026 at 03:00')).toBeVisible()
	expect(page.url()).toMatch(/\/live\/matches$/)
	expect(reactHydrationErrors).toEqual([])
})
