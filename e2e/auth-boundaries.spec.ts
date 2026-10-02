import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { hashPassword, verifyPassword } from 'better-auth/crypto'
import en from '../messages/en.json'
import zh from '../messages/zh-CN.json'

// Baseline variants require system theme in Perth. Nested state suites retain
// their explicit dark/UTC overrides; evidence records the effective context.
test.use({ colorScheme: 'light', timezoneId: 'Australia/Perth' })
test.beforeEach(async ({ page }) => {
 await page.addInitScript(() => localStorage.setItem('theme', 'system'))
})
test.afterEach(async ({ page, timezoneId, colorScheme }, testInfo) => {
 if (testInfo.status !== 'passed') return
 const actual = await page.evaluate(() => ({
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  width: innerWidth,
  height: innerHeight,
  dark: matchMedia('(prefers-color-scheme: dark)').matches,
  theme: localStorage.getItem('theme'),
  url: location.href
 }))
 expect(actual.timezone).toBe(timezoneId)
 expect(actual.dark).toBe(colorScheme === 'dark')
 expect(actual.theme).toBe('system')
 expect({ width: actual.width, height: actual.height }).toEqual(page.viewportSize())
 await testInfo.attach('auth-effective-context', {
  contentType: 'application/json',
  body: JSON.stringify({ ...actual, persona: 'A', environment: 'isolated-fixture',
   performanceStatus: 'NOT_OBSERVED', readyMs: null, wholeVariantComplete: false })
 })
})

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
  const userId = `reset-user-${randomUUID()}`
  const validToken = `auth-valid-${randomUUID()}`
  const oldHash = await hashPassword('OldIsolatedFixturePassword-42')
  try {
   await sql`INSERT INTO bauth."user" (id, name, email, email_verified) VALUES (${userId}, 'Reset Fixture', ${`${userId}@example.invalid`}, true)`
   await sql`INSERT INTO bauth.account (id, account_id, provider_id, user_id, password) VALUES (${userId}, ${userId}, 'credential', ${userId}, ${oldHash})`
   await sql`INSERT INTO bauth.verification (id, identifier, value, expires_at)
    VALUES (${token}, ${identifier}, ${userId}, ${new Date(Date.now() - 60000)})`
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
   const [unchanged] = await sql`SELECT password FROM bauth.account WHERE id = ${userId}`
   expect(unchanged.password).toBe(oldHash)
   // Same existing account and payload; only the token validity changes.
   await sql`INSERT INTO bauth.verification (id, identifier, value, expires_at)
    VALUES (${validToken}, ${`reset-password:${validToken}`}, ${userId}, ${new Date(Date.now() + 60000)})`
   await page.goto(`/zh-CN/auth/reset-password?token=${validToken}`)
   await page.getByLabel(zh.Auth.password, { exact: true }).fill('IsolatedFixturePassword-42')
   await page.getByLabel(zh.Auth.confirmPassword, { exact: true }).fill('IsolatedFixturePassword-42')
   const validResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/reset-password' && response.request().method() === 'POST')
   await page.getByRole('button', { name: zh.Auth.setNewPassword, exact: true }).click()
   expect((await validResponse).status()).toBe(200)
   await expect(page).toHaveURL(url => url.pathname === '/zh-CN/auth/login')
   const [changed] = await sql`SELECT password FROM bauth.account WHERE id = ${userId}`
   expect(await verifyPassword({ hash: changed.password, password: 'IsolatedFixturePassword-42' })).toBe(true)
   expect(await sql`SELECT id FROM bauth.verification WHERE id = ${validToken}`).toHaveLength(0)
  } finally {
   await sql`DELETE FROM bauth.verification WHERE id IN (${token}, ${validToken})`
   await sql`DELETE FROM bauth."user" WHERE id = ${userId}`
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

test.describe('AUTH02 planned error states', () => {
 test.use({ viewport: { width: 390, height: 900 }, colorScheme: 'dark', timezoneId: 'UTC' })
 const forms = [
  { path: '/auth/login', endpoint: '/api/auth/sign-in/email', fields: ['email', 'password'] as const, button: 'signIn' as const, fallback: 'loginFailed' as const },
  { path: '/auth/signup', endpoint: '/api/auth/sign-up/email', fields: ['name', 'email', 'password', 'confirmPassword'] as const, button: 'createAccount' as const, fallback: 'signupFailed' as const },
  { path: '/auth/forgot-password', endpoint: '/api/auth/request-password-reset', fields: ['email'] as const, button: 'sendResetLink' as const, fallback: 'resetEmailFailed' as const },
  { path: '/auth/reset-password?token=isolated-unsubmitted-token', endpoint: '/api/auth/reset-password', fields: ['password', 'confirmPassword'] as const, button: 'setNewPassword' as const, fallback: 'resetFailed' as const }
 ]
 for (const form of forms) {
  for (const scenario of ['invalid', '429', 'error'] as const) {
   test(`AUTH02 ${scenario} ${form.path} ends pending and allows another attempt`, async ({ page }, testInfo) => {
    test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Isolated intercepted authentication only')
    await page.addInitScript(() => localStorage.setItem('theme', 'system'))
    const intercepted: string[] = []
    const unexpected: string[] = []
    let attempt = 0
    await page.route('**/api/auth/**', async route => {
     if (route.request().method() === 'GET') return route.continue()
     const path = new URL(route.request().url()).pathname
     intercepted.push(path)
     if (path !== form.endpoint) unexpected.push(path)
     attempt++
     const rateLimited = scenario === '429' && attempt === 1
     await route.fulfill({ status: rateLimited ? 429 : 503, contentType: 'application/json', body: JSON.stringify({ code: rateLimited ? 'TOO_MANY_REQUESTS' : 'ISOLATED_SERVICE_ERROR', message: 'Internal fixture detail must not be rendered' }) })
    })
    await page.goto(`/zh-CN${form.path}`)
    for (const field of form.fields) {
     await page.getByLabel(zh.Auth[field], { exact: true }).fill(field === 'email' ? 'fixture@example.invalid' : field === 'name' ? 'Isolated Fixture' : 'IsolatedPassword-42')
    }
    const submit = page.getByRole('button', { name: zh.Auth[form.button], exact: true })
    if (scenario === 'invalid') {
     if (form.fields.some(field => field === 'email')) {
      const email = page.getByLabel(zh.Auth.email, { exact: true })
      await email.fill('invalid-email')
      await submit.click()
      expect(await email.evaluate(node => (node as HTMLInputElement).validity.typeMismatch)).toBe(true)
      await email.fill('fixture@example.invalid')
     } else {
      await page.getByLabel(zh.Auth.confirmPassword, { exact: true }).fill('DifferentPassword-42')
      await submit.click()
      await expect(page.getByRole('main').getByRole('alert')).toHaveText(zh.Auth.errors.passwordMismatch)
      await page.getByLabel(zh.Auth.confirmPassword, { exact: true }).fill('IsolatedPassword-42')
     }
     expect(intercepted).toEqual([])
    }
    for (let round = 0; round < 2; round++) {
     await submit.click()
     const expected = scenario === '429' && round === 0 ? zh.Auth.errors.tooManyRequests : zh.Auth.errors[form.fallback]
     await expect(page.getByRole('main').getByRole('alert')).toHaveText(expected)
     await expect(submit).toBeEnabled()
     await expect(page.locator('form')).toHaveAttribute('aria-busy', 'false')
     await expect(page).toHaveURL(url => `${url.pathname}${url.search}` === `/zh-CN${form.path}`)
    }
    expect(intercepted).toEqual([form.endpoint, form.endpoint])
    expect(unexpected).toEqual([])
    await expect(page.getByText('Internal fixture detail must not be rendered', { exact: false })).toHaveCount(0)
    await expect(page.locator('html')).toHaveClass(/dark/)
    expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('UTC')
    await testInfo.attach('auth02-state', { contentType: 'application/json', body: JSON.stringify({
     variantId: `AUTH02.state.${scenario === 'invalid' ? '01' : scenario === '429' ? '02' : '03'}`, scenario, form: form.path, endpoint: form.endpoint,
     identity: 'A', locale: 'zh-CN', viewport: page.viewportSize(), theme: 'dark', timezone: 'UTC', interceptedAttempts: intercepted.length,
     upstreamAuthWrites: 0, functionalStatus: 'PASS', performanceStatus: 'N/A', readyMs: null,
     scope: 'Client validation/error/pending/retry boundary only; provider success and production recovery remain separate'
    }) })
   })
  }
 }
})
