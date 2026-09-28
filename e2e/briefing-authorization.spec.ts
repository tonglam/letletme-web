import { expect, test } from '@playwright/test'
import { createHmac, randomUUID } from 'node:crypto'
import postgres from 'postgres'

test.describe.configure({ mode: 'serial' })
test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_BRIEFING_ADMIN !== '1', 'Explicit isolated admin fixture only')

const contexts = [
 ...(['en', 'zh-CN'] as const).flatMap(locale => [1440, 390].map(width => ({
  locale, width, timezone: 'Australia/Perth', theme: 'system' as const,
  mode: 'revoked', variantId: `S08.UNRESOLVED_ROLE.${locale}.${width === 1440 ? 'desktop1440' : 'mobile390'}.base`
 }))),
 ...['expired', 'revoked'].map(mode => ({ locale: 'zh-CN' as const, width: 390,
  timezone: 'UTC', theme: 'dark' as const, mode, variantId: 'S08.directed.07' }))
]
for (const context of contexts) {
 const { locale, width, timezone, theme, mode, variantId } = context
 test.describe(`${variantId} ${mode}`, () => {
  test.use({ viewport: { width, height: 900 }, timezoneId: timezone, colorScheme: theme === 'dark' ? 'dark' : 'light' })
  const role = String('publisher')

   test(`BRIEF03 ${role} ${locale} ${width} rejects an invalidated session despite its browser cache`, async ({ page }, testInfo) => {
    await page.addInitScript(theme => localStorage.setItem('theme', theme), theme)
    const enabled = process.env.BRIEFING_ADMIN_ENABLED === 'true'
    const canEdit = enabled && (role === 'editor' || role === 'both')
    const canPublish = enabled && (role === 'publisher' || role === 'both')
    const direct = process.env.E2E_DIRECT_DATABASE_URL
    if (!direct) throw new Error('Isolated direct database required')
    const sql = postgres(direct, { max: 1, prepare: false })
    const id = `brief-admin-${randomUUID()}`
    const token = `${id}-token`
    const writes: string[] = []
    try {
     if (role !== 'anonymous') {
      await sql`INSERT INTO bauth."user" (id, name, email, email_verified) VALUES (${id}, 'Briefing Fixture', ${`${role}@briefing.e2e.test`}, true)`
      await sql`INSERT INTO bauth.session (id, expires_at, token, user_id) VALUES (${id}, ${new Date(Date.now() + 3600000)}, ${token}, ${id})`
      const signature = createHmac('sha256', 'playwright-better-auth-secret-at-least-32-bytes').update(token).digest('base64')
      await page.context().addCookies([{ name: '__Secure-letletme.session_token', value: encodeURIComponent(`${token}.${signature}`), domain: 'localhost', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' }])
     }
     await page.route('**/*', route => {
      const request = route.request()
      if (!['GET', 'HEAD'].includes(request.method())) { writes.push(`${request.method()} ${new URL(request.url()).pathname}`); return route.abort() }
      return route.continue()
     })
     await page.setViewportSize({ width, height: 900 })
     const url = `${locale === 'en' ? '' : '/zh-CN'}/briefing/admin`
     await page.goto(url)
     await expect(page).toHaveURL(new RegExp(`${url}$`))
     if (canEdit || canPublish) {
      await expect(page.getByRole('heading', { level: 1, name: 'Week publication desk', exact: true })).toBeVisible()
      for (const [label, capability] of [['Receipts → Candidates', canEdit], ['Bilingual Story → READY', canEdit], ['Week edition → Publish', canPublish]] as const) {
       const card = page.locator('section > div').filter({ has: page.getByText(label, { exact: true }) })
       await expect(card).toHaveCount(1)
       await expect(card.getByText(capability ? 'Role enabled for this session.' : 'Publisher/editor role not enabled.', { exact: true })).toBeVisible()
      }
     } else {
      await expect(page.getByRole('heading', { name: locale === 'en' ? 'Page not found' : '找不到页面', exact: true })).toBeVisible()
     }
     const submit = page.getByRole('button', { name: 'Publish immutable Week revision', exact: true })
     await expect(submit).toHaveCount(canPublish ? 1 : 0)
     for (const name of ['editionId', 'expectedFrozenSha256', 'validUntil', 'reason']) {
      const input = page.locator(`input[name="${name}"]`)
      await expect(input).toHaveCount(canPublish ? 1 : 0)
      if (canPublish) { await expect(input).toBeVisible(); expect(await input.evaluate(element => (element as HTMLInputElement).required)).toBe(name !== 'validUntil') }
     }
     expect(writes).toEqual([])
     if (!canPublish) throw new Error('Revocation regression requires enabled publisher')
     const sessionResponse = await page.request.get('/api/auth/get-session')
     expect(sessionResponse.ok()).toBe(true)
     const cookies = await page.context().cookies()
     expect(cookies.some(cookie => cookie.name.includes('session_data'))).toBe(true)
     expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(timezone)
     await expect(page.locator('html')).toHaveClass(new RegExp(`(?:^|\\s)${theme === 'dark' ? 'dark' : 'light'}(?:\\s|$)`))
     if (mode === 'expired') {
      await sql`UPDATE bauth.session SET expires_at = ${new Date(Date.now() - 60000)} WHERE id = ${id}`
     } else {
      await sql`DELETE FROM bauth.session WHERE id = ${id}`
     }
     // Browser display cache remains present when fresh server authorization is invalidated.
     expect((await page.context().cookies()).some(cookie => cookie.name.includes('session_data'))).toBe(true)
     await page.reload()
     await expect(page.getByRole('heading', { name: locale === 'en' ? 'Page not found' : '找不到页面', exact: true })).toBeVisible()
     await expect(submit).toHaveCount(0)
     await expect(page.locator('input[name="editionId"]')).toHaveCount(0)
     expect(writes).toEqual([])
     await testInfo.attach('BRIEF03-scope', { body: JSON.stringify({ variantId, sharedCaseId: 'S08', sharedStepId: 'S08.01', mode, theme, timezone, identity: 'publisher', scope: 'Publisher fresh-authorization boundary only; other S08 roles and endpoints remain unverified', caseId: 'BRIEF03', stepIds: ['BRIEF03.01', 'BRIEF03.02'], environment: 'isolated-fixture', role, locale, width, enabled, canEdit, canPublish, writes, functionalStatus: 'PASS', performanceStatus: 'NOT_OBSERVED', readyMs: null, wholeVariantComplete: false }), contentType: 'application/json' })
    } finally {
     try { await sql`DELETE FROM bauth.session WHERE id = ${id}`; await sql`DELETE FROM bauth."user" WHERE id = ${id}` } finally { await sql.end() }
    }
   })
 })
}
