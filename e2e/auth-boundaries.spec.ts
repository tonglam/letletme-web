import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
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


test.describe('AUTH03.state.02 expired token', () => {
 test.use({ viewport: { width: 390, height: 900 }, colorScheme: 'dark', timezoneId: 'UTC' })
 test('real auth endpoint rejects expired fixture token without success navigation', async ({ page }) => {
  const direct = process.env.E2E_DIRECT_DATABASE_URL
  if (!direct) throw new Error('E2E_DIRECT_DATABASE_URL is required')
  const sql = postgres(direct, { max: 1, prepare: false })
  const token = `auth-expired-${randomUUID()}`
  const identifier = `reset-password:${token}`
  try {
   await sql`INSERT INTO bauth.verification (id, identifier, value, expires_at)
    VALUES (${token}, ${identifier}, ${`absent-${token}`}, ${new Date(Date.now() - 60000)})`
   await page.goto(`/zh-CN/auth/reset-password?token=${token}`)
   await page.getByLabel(zh.Auth.password, { exact: true }).fill('IsolatedFixturePassword-42')
   await page.getByLabel(zh.Auth.confirmPassword, { exact: true }).fill('IsolatedFixturePassword-42')
   const responsePromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/auth/reset-password' && response.request().method() === 'POST')
   await page.getByRole('button', { name: zh.Auth.setNewPassword, exact: true }).click()
   const response = await responsePromise
   expect(response.status()).toBe(400)
   expect((await response.json()).code).toBe('INVALID_TOKEN')
   await expect(page.getByRole('alert').filter({ hasText: zh.Auth.errors.invalidResetLink })).toHaveText(zh.Auth.errors.invalidResetLink)
   await expect(page).toHaveURL(url => url.pathname === '/zh-CN/auth/reset-password' && url.searchParams.get('token') === token)
   await expect(page.getByRole('button', { name: zh.Auth.setNewPassword, exact: true })).toBeEnabled()
   await expect(page.locator('form')).toHaveAttribute('aria-busy', 'false')
  } finally {
   await sql`DELETE FROM bauth.verification WHERE id = ${token}`
   await sql.end()
  }
 })
})

for (const locale of ['en', 'zh-CN'] as const) {
 for (const width of [1440, 390]) {
  const prefix = locale === 'en' ? '' : '/zh-CN'
  const t = (locale === 'en' ? en : zh).Auth
  const forms = [
   { path: '/auth/login', fields: [t.email, t.password] },
   { path: '/auth/signup', fields: [t.name, t.email, t.password, t.confirmPassword] },
   { path: '/auth/forgot-password', fields: [t.email] },
   { path: '/auth/reset-password?token=unsubmitted-fixture-token', fields: [t.password, t.confirmPassword] }
  ]
  for (const form of forms) {
   test(`AUTH01 focus input clear ${locale} ${width} ${form.path}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    let authWrites = 0
    page.on('request', request => {
     if (new URL(request.url()).pathname.startsWith('/api/auth/') && request.method() !== 'GET') authWrites++
    })
    await page.goto(`${prefix}${form.path}`)
    for (const label of form.fields) {
     const field = page.getByLabel(label, { exact: true })
     await expect(field).toBeEnabled()
     await field.focus()
     await expect(field).toBeFocused()
     const value = label === t.email ? 'input-only@example.invalid' : 'FixtureInput-42'
     await field.fill(value)
     await expect(field).toHaveValue(value)
     if (label === t.password || label === t.confirmPassword) await expect(field).toHaveAttribute('type', 'password')
     await field.fill('')
     await expect(field).toHaveValue('')
    }
    expect(authWrites).toBe(0)
   })
  }
  test(`AUTH01 help links actual click journey ${locale} ${width}`, async ({ page }) => {
   await page.setViewportSize({ width, height: 900 })
   await page.goto(`${prefix}/auth/login`)
   await page.getByRole('link', { name: t.forgotPassword, exact: true }).click()
   await expect(page).toHaveURL(url => url.pathname === `${prefix}/auth/forgot-password`)
   await expect(page.getByLabel(t.email, { exact: true })).toBeEnabled()
   await page.getByRole('link', { name: t.backToLogin, exact: true }).click()
   await expect(page).toHaveURL(url => url.pathname === `${prefix}/auth/login`)
   await expect(page.getByLabel(t.password, { exact: true })).toBeEnabled()
   await page.getByRole('link', { name: t.signUp, exact: true }).click()
   await expect(page).toHaveURL(url => url.pathname === `${prefix}/auth/signup`)
   await expect(page.getByLabel(t.confirmPassword, { exact: true })).toBeEnabled()
   await page.locator('#main-content').getByRole('link', { name: t.signIn, exact: true }).click()
   await expect(page).toHaveURL(url => url.pathname === `${prefix}/auth/login`)
   await expect(page.getByLabel(t.password, { exact: true })).toBeEnabled()
  })
 }
}

for (const locale of ['en', 'zh-CN'] as const) {
 for (const width of [1440, 390]) {
  const prefix = locale === 'en' ? '' : '/zh-CN'
  const t = (locale === 'en' ? en : zh).Auth
  const routes = [
   { caseId: 'R03', path: '/auth/forgot-password', field: t.email, link: t.backToLogin, target: '/auth/login', targetField: t.password },
   { caseId: 'R04', path: '/auth/login', field: t.password, link: t.forgotPassword, target: '/auth/forgot-password', targetField: t.email },
   { caseId: 'R05', path: '/auth/reset-password', field: null, link: t.requestNewLink, target: '/auth/forgot-password', targetField: t.email },
   { caseId: 'R06', path: '/auth/signup', field: t.confirmPassword, link: t.signIn, target: '/auth/login', targetField: t.password }
  ]
  for (const route of routes) {
   test(`${route.caseId}.05 auth reload Back Forward ${locale} ${width}`, async ({ page }, testInfo) => {
    test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Isolated anonymous session only')
    await page.setViewportSize({ width, height: 900 })
    const visited: string[] = []
    let authWrites = 0
    page.on('request', request => {
     if (new URL(request.url()).pathname.startsWith('/api/auth/') && request.method() !== 'GET') authWrites++
    })
    const assertSource = async () => {
     await expect(page).toHaveURL(url => url.pathname === `${prefix}${route.path}`)
     if (route.field) await expect(page.getByLabel(route.field, { exact: true })).toBeEnabled()
     else {
      await expect(page.getByText(t.invalidResetLink, { exact: false })).toBeVisible()
      await expect(page.locator('input[type="password"]')).toHaveCount(0)
     }
     visited.push(page.url())
    }
    const assertTarget = async () => {
     await expect(page).toHaveURL(url => url.pathname === `${prefix}${route.target}`)
     await expect(page.getByLabel(route.targetField, { exact: true })).toBeEnabled()
     visited.push(page.url())
    }
    const response = await page.goto(`${prefix}${route.path}`)
    expect(response?.status()).toBe(200)
    expect(response?.request().redirectedFrom()).toBeNull()
    await testInfo.attach('auth-direct-response', { contentType: 'application/json', body: JSON.stringify({ caseId: route.caseId, locale, width, requested: `${prefix}${route.path}`, finalUrl: page.url(), httpStatus: response!.status(), redirects: [], functionalStatus: 'PASS', performanceStatus: 'NOT_RUN', readyMs: null }) })
    await assertSource()
    await page.reload()
    await assertSource()
    await page.locator('#main-content').getByRole('link', { name: route.link, exact: true }).click()
    await assertTarget()
    await page.goBack()
    await assertSource()
    await page.goForward()
    await assertTarget()
    expect(authWrites).toBe(0)
    await testInfo.attach('auth-history-journey', { body: JSON.stringify({ caseId: route.caseId, locale, width, visited, authWrites }), contentType: 'application/json' })
   })
  }
 }
}
