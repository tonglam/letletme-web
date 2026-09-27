import { expect, test } from '@playwright/test'
import { createHmac, randomUUID } from 'node:crypto'
import postgres from 'postgres'

// This navigation intentionally writes only the isolated account database.
// A production profile GET must not inherit read-only eligibility from it.
test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Isolated runtime database and server FPL fixture only')
const contexts = [
 ...(['en', 'zh-CN'] as const).flatMap(locale => [1440, 390].map(width => ({
  locale, width, theme: 'system' as const, timezone: 'Australia/Perth', outcome: 'success',
  variantId: `S19.UNRESOLVED_ROLE.${locale}.${width === 1440 ? 'desktop1440' : 'mobile390'}.base`
 }))),
 ...['success', 'failure'].map(outcome => ({ locale: 'zh-CN' as const, width: 390,
  theme: 'dark' as const, timezone: 'UTC', outcome, variantId: 'S19.directed.01' }))
]
for (const context of contexts) {
 const { locale, width, theme, timezone, outcome, variantId } = context
 test.describe(`${variantId} ${outcome}`, () => {
  test.use({ viewport: { width, height: 900 }, colorScheme: theme === 'dark' ? 'dark' : 'light', timezoneId: timezone })
  test('profile navigation confines identity snapshot writes to the isolated account', async ({ page }, testInfo) => {
   const direct = process.env.E2E_DIRECT_DATABASE_URL
   if (!direct) throw new Error('Isolated direct database required')
   const sql = postgres(direct, { max: 1, prepare: false })
   const id = `profile-read-${randomUUID()}`
   const token = `${id}-token`
   const entryId = outcome === 'failure' ? 999999991 : 1000000 + Number.parseInt(randomUUID().slice(0, 6), 16)
   const beforeTime = new Date('2025-01-01T00:00:00Z')
   const unexpectedBusinessWrites: string[] = []
   try {
    await sql`INSERT INTO bauth."user" (id,name,email,email_verified,fpl_entry_id,fpl_entry_verified_at,fpl_team_name,fpl_manager_name,fpl_identity_refreshed_at)
     VALUES (${id},'Isolated Profile',${`${id}@example.invalid`},true,${entryId},${beforeTime},'Before Fixture United','Before Manager',${beforeTime})`
    await sql`INSERT INTO bauth.session (id,expires_at,token,user_id) VALUES (${id},${new Date(Date.now()+3600000)},${token},${id})`
    const signature = createHmac('sha256','playwright-better-auth-secret-at-least-32-bytes').update(token).digest('base64')
    await page.context().addCookies([{ name:'__Secure-letletme.session_token',value:encodeURIComponent(`${token}.${signature}`),domain:'localhost',path:'/',httpOnly:true,secure:true,sameSite:'Lax' }])
    await page.addInitScript(theme => localStorage.setItem('theme', theme), theme)
    await page.route('**/*', route => {
     const request = route.request()
     if (!['GET','HEAD'].includes(request.method()) && new URL(request.url()).pathname !== '/api/vitals') {
      unexpectedBusinessWrites.push(`${request.method()} ${new URL(request.url()).pathname}`)
      return route.abort()
     }
     return route.continue()
    })
    const url = `${locale === 'en' ? '' : '/zh-CN'}/profile`
    await page.goto(url)
    await expect(page).toHaveURL(value => value.pathname === url)
    await expect(page.locator('#main-content')).toContainText(outcome === 'success' ? 'E2E Synced United' : 'Before Fixture United')
    await expect(page.locator('html')).toHaveClass(new RegExp(`(?:^|\\s)${theme === 'dark' ? 'dark' : 'light'}(?:\\s|$)`))
    expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(timezone)
    const [after] = await sql`SELECT fpl_entry_id,fpl_team_name,fpl_manager_name,fpl_identity_refreshed_at FROM bauth."user" WHERE id=${id}`
    const history = await sql`SELECT team_name FROM bauth.fpl_entry_name_history WHERE user_id=${id} ORDER BY team_name`
    expect(after.fpl_entry_id).toBe(entryId)
    if (outcome === 'success') {
     expect(after.fpl_team_name).toBe('E2E Synced United')
     expect(after.fpl_manager_name).toBe('Fixture Manager')
     expect(new Date(after.fpl_identity_refreshed_at).getTime()).toBeGreaterThan(beforeTime.getTime())
     expect(history.map(row => row.team_name)).toEqual(['Before Fixture United','E2E Synced United'])
    } else {
     expect(after.fpl_team_name).toBe('Before Fixture United')
     expect(after.fpl_manager_name).toBe('Before Manager')
     expect(after.fpl_identity_refreshed_at).toBeNull()
     expect(history).toHaveLength(0)
    }
    expect(unexpectedBusinessWrites).toEqual([])
    await testInfo.attach('S19-profile-read-side-effects', { contentType:'application/json',body:JSON.stringify({
     variantId,caseId:'S19',stepId:'S19.01',identity:'B isolated bound account',locale,width,theme,timezone,outcome,
     environment:'isolated-fixture',after,history,unexpectedBusinessWrites,
     productionEligibility:'BLOCKED: profile GET writes the bound identity snapshot or refresh timestamp',
     functionalStatus:'PASS',performanceStatus:'NOT_RUN',readyMs:null,wholeVariantComplete:false,
     scope:'Profile read-side effects only; unknown-entry, preview and import remain separate assertions'
    }) })
   } finally {
    try { await sql`DELETE FROM bauth.session WHERE id=${id}`; await sql`DELETE FROM bauth."user" WHERE id=${id}` } finally { await sql.end() }
   }
  })
 })
}
