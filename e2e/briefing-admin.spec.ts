import { expect, test } from '@playwright/test'
import { createHmac, randomUUID } from 'node:crypto'
import postgres from 'postgres'

test.describe.configure({ mode: 'serial' })
test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_BRIEFING_ADMIN !== '1', 'Explicit isolated admin fixture only')

for (const locale of ['en', 'zh-CN'] as const) {
 for (const width of [1440, 390]) {
  for (const role of ['editor', 'publisher', 'both', 'neither', 'anonymous'] as const) {
   test(`BRIEF03 ${role} ${locale} ${width} observes capabilities without submitting`, async ({ page }, testInfo) => {
    const enabled = process.env.BRIEFING_ADMIN_ENABLED === 'true'
    const canEdit = enabled && (role === 'editor' || role === 'both')
    const canPublish = enabled && (role === 'publisher' || role === 'both')
    const direct = process.env.E2E_DIRECT_DATABASE_URL
    if (!direct) throw new Error('Isolated direct database required')
    const sql = postgres(direct, { max: 1, prepare: false })
    const id = `brief-admin-${randomUUID()}`
    const token = `${id}-token`
    const writes: string[] = []
    const telemetry: string[] = []
    try {
     if (role !== 'anonymous') {
      await sql`INSERT INTO bauth."user" (id, name, email, email_verified) VALUES (${id}, 'Briefing Fixture', ${`${role}@briefing.e2e.test`}, true)`
      await sql`INSERT INTO bauth.session (id, expires_at, token, user_id) VALUES (${id}, ${new Date(Date.now() + 3600000)}, ${token}, ${id})`
      const signature = createHmac('sha256', 'playwright-better-auth-secret-at-least-32-bytes').update(token).digest('base64')
      await page.context().addCookies([{ name: '__Secure-letletme.session_token', value: encodeURIComponent(`${token}.${signature}`), domain: 'localhost', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' }])
     }
     await page.route('**/*', route => {
      const request = route.request()
      const pathname = new URL(request.url()).pathname
      if (request.method() === 'POST' && pathname === '/api/vitals') { telemetry.push(`${request.method()} ${pathname}`); return route.continue() }
      if (!['GET', 'HEAD'].includes(request.method())) { writes.push(`${request.method()} ${pathname}`); return route.abort() }
      return route.continue()
     })
     await page.setViewportSize({ width, height: 900 })
     const prefix = locale === 'en' ? '' : '/zh-CN'
     const homeUrl = prefix || '/'
     const url = `${locale === 'en' ? '' : '/zh-CN'}/briefing/admin`
     const navigationChain = async (response: Awaited<ReturnType<typeof page.goto>>) => {
      const requests = [] as Array<import('@playwright/test').Request>
      let request: import('@playwright/test').Request | null | undefined = response?.request()
      while (request) {
       requests.push(request)
       request = request.redirectedFrom()
      }
      requests.reverse()
      return Promise.all(requests.map(async item => ({
       url: item.url(),
       method: item.method(),
       status: (await item.response())?.status() ?? null
      })))
     }
     const homeResponse = await page.goto(homeUrl)
     await expect(page).toHaveURL(new RegExp(`${homeUrl}$`))
     await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
     const homeChain = await navigationChain(homeResponse)
     const directResponse = await page.goto(url)
     await expect(page).toHaveURL(new RegExp(`${url}$`))
     const directChain = await navigationChain(directResponse)
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
     const reloadResponse = await page.reload()
     await expect(page).toHaveURL(new RegExp(`${url}$`))
     if (canEdit || canPublish) {
      await expect(page.getByRole('heading', { level: 1, name: 'Week publication desk', exact: true })).toBeVisible()
     } else {
      await expect(page.getByRole('heading', { name: locale === 'en' ? 'Page not found' : '找不到页面', exact: true })).toBeVisible()
     }
     const backResponse = await page.goBack()
     await expect(page).toHaveURL(new RegExp(`${homeUrl}$`))
     await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
     const forwardResponse = await page.goForward()
     await expect(page).toHaveURL(new RegExp(`${url}$`))
     if (canEdit || canPublish) {
      await expect(page.getByRole('heading', { level: 1, name: 'Week publication desk', exact: true })).toBeVisible()
     } else {
      await expect(page.getByRole('heading', { name: locale === 'en' ? 'Page not found' : '找不到页面', exact: true })).toBeVisible()
     }
     expect(writes).toEqual([])
     await testInfo.attach('R08-scope', { body: JSON.stringify({
      caseId: 'R08',
      stepIds: ['R08.01', 'R08.02', 'R08.04', 'R08.05'],
      environment: 'isolated-fixture',
      role,
      locale,
      width,
      requested: url,
      homeUrl,
      homeChain,
      directChain,
      directStatus: directResponse?.status() ?? null,
      reloadStatus: reloadResponse?.status() ?? null,
      backStatus: backResponse?.status() ?? null,
      forwardStatus: forwardResponse?.status() ?? null,
      terminal: canEdit || canPublish ? 'ready' : 'not-found',
      returnUrl: page.url(),
      writes,
      telemetry,
      functionalStatus: 'PASS',
      performanceStatus: 'NOT_OBSERVED',
      readyMs: null,
      wholeVariantComplete: false,
      missingReason: 'R08.03 requires an actual site entry; source inspection found no rendered link to /briefing/admin.'
     }), contentType: 'application/json' })
     await testInfo.attach('BRIEF03-scope', { body: JSON.stringify({ caseId: 'BRIEF03', stepIds: ['BRIEF03.01', 'BRIEF03.02'], environment: 'isolated-fixture', role, locale, width, enabled, canEdit, canPublish, writes, functionalStatus: 'PASS', performanceStatus: 'NOT_OBSERVED', readyMs: null, wholeVariantComplete: false }), contentType: 'application/json' })
    } finally {
     try { await sql`DELETE FROM bauth.session WHERE id = ${id}`; await sql`DELETE FROM bauth."user" WHERE id = ${id}` } finally { await sql.end() }
    }
   })
  }
 }
}
