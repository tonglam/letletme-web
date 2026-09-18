import { expect, test } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

// Public SSR reads use the existing task-owned GraphQL fixture, never production.
const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
async function control(rules: unknown[] = []) {
 const response = await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules, reset: true }) })
 expect(response.ok).toBe(true)
}

for (const locale of ['en', 'zh-CN'] as const) {
 for (const width of [1440, 390]) {
  test.describe(`J17 ${locale} ${width}`, () => {
   test.use({ viewport: { width, height: 900 }, timezoneId: 'Australia/Perth' })
   test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.BRIEFING_PUBLIC_ENABLED !== 'true', 'Requires an explicitly enabled isolated standalone server')
   test.afterEach(async () => { await control() })
   test('Week to canonical story and back preserves publication content', async ({ page }, testInfo) => {
    const prefix = locale === 'en' ? '' : '/zh-CN'
    const gqlLocale = locale === 'en' ? 'EN' : 'ZH_CN'
    const story = { id: 'j17-story', slug: 'j17-old-slug', storyRevision: 3, title: locale === 'en' ? 'J17 fixture dispatch' : 'J17 隔离周报', summary: 'J17 publication-specific summary', sourceName: 'Fixture source', sourceUrl: 'https://example.invalid/j17-source', sourceCheckedAt: '2026-09-15T10:00:00Z', expiresAt: null }
    const canonical = { ...story, slug: 'j17-canonical' }
    await control([
     { operation: 'BriefingWeek', variables: { locale: gqlLocale }, data: { briefingWeek: { state: 'READY', revision: 7, publicationId: 'j17-publication', publishedAt: '2026-09-15T11:00:00Z', sourceCheckedAt: story.sourceCheckedAt, staleAt: null, event: { seasonCode: '2627', eventId: 4, name: 'J17 GW4', deadlineTime: null }, featured: [story], sections: [] } } },
     ...['j17-old-slug', 'j17-canonical'].map(slug => ({ operation: 'BriefingStory', variables: { locale: gqlLocale, slug }, data: { briefingStory: { state: 'READY', canonicalSlug: canonical.slug, story: canonical } } }))
    ])
    const externalRequests: string[] = []
    await page.route('https://example.invalid/**', async route => { externalRequests.push(route.request().url()); await route.abort() })
    await page.goto(`${prefix}/briefing`)
    await expect(page).toHaveURL(new RegExp(`${prefix}/briefing/week$`))
    await expect(page.getByText('J17 GW4', { exact: true })).toBeVisible()
    await expect(page.getByText('7', { exact: true })).toBeVisible()
    const link = page.getByRole('link', { name: story.title, exact: true })
    await expect(link).toHaveCount(1)
    await expect(link).toBeVisible()
    await link.click()
    await expect(page).toHaveURL(new RegExp(`${prefix}/briefing/story/j17-canonical$`))
    await expect(page.getByRole('heading', { level: 1, name: story.title, exact: true })).toBeVisible()
    await expect(page.getByText(story.summary, { exact: true })).toBeVisible()
    const source = page.locator(`article a[href="${story.sourceUrl}"]`)
    await expect(source).toBeVisible()
    await expect(source).toHaveAttribute('target', '_blank')
    await expect(source).toHaveAttribute('rel', /noopener/)
    await expect(source).toHaveAttribute('rel', /noreferrer/)
    await page.locator(`article a[href="${prefix}/briefing/week"]`).click()
    await expect(page).toHaveURL(new RegExp(`${prefix}/briefing/week$`))
    await expect(link).toBeVisible()
    await expect(page.getByText('J17 GW4', { exact: true })).toBeVisible()
    await expect(page.getByText('7', { exact: true })).toBeVisible()
    expect(externalRequests).toEqual([])
    const observations = await (await fetch(fixture)).json()
    const reads = observations.requests.filter((row: { operation: string }) => row.operation.startsWith('Briefing'))
    expect(reads.some((row: { operation: string; variables: { slug?: string } }) => row.operation === 'BriefingStory' && row.variables.slug === 'j17-canonical')).toBe(true)
    expect(reads.every((row: { variables: { locale: string } }) => row.variables.locale === gqlLocale)).toBe(true)
    await testInfo.attach('J17-scope', { body: JSON.stringify({ caseId: 'J17', steps: ['J17.01','J17.02','J17.03','J17.04','J17.05','J17.06','J17.07'], variantId: `J17.A.${locale}.${width === 1440 ? 'desktop1440' : 'mobile390'}.base`, reads, readyMs: null, performanceStatus: 'NOT_RUN', wholeVariantComplete: false, limitation: 'Summary/source contract only; no full-body field. No cold/warm or browser vitals measured.' }), contentType: 'application/json' })
   })
  })
 }
}

for (const locale of ['en', 'zh-CN'] as const) {
 test.describe(`J17 states ${locale}`, () => {
  test.use({ viewport: { width: 390, height: 900 }, timezoneId: 'UTC' })
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.BRIEFING_PUBLIC_ENABLED !== 'true', 'Enabled isolated runtime only')
  test.afterEach(async () => { await control() })
  test('missing and withdrawn stories do not render stale story content', async ({ page }) => {
   const prefix = locale === 'en' ? '' : '/zh-CN'
   for (const [slug, result, heading] of [
    ['missing', null, locale === 'en' ? 'Briefing temporarily unavailable' : '资讯暂时不可用'],
    ['withdrawn', { state: 'REMOVED', canonicalSlug: null, story: { id: 'withdrawn', slug: 'withdrawn', title: 'Must not render withdrawn content', summary: 'Must not render withdrawn summary', storyRevision: 1, sourceName: null, sourceUrl: null, sourceCheckedAt: null, expiresAt: null } }, locale === 'en' ? 'This story was withdrawn' : '这篇资讯已撤下']
   ] as const) {
    await control([{ operation: 'BriefingStory', data: { briefingStory: result } }])
    await page.goto(`${prefix}/briefing/story/${slug}`)
    await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible()
    await expect(page.getByText('Must not render withdrawn content', { exact: true })).toHaveCount(0)
    await expect(page.locator('article')).toHaveCount(0)
   }
  })
 })
 test.describe(`J17 disabled ${locale}`, () => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.BRIEFING_PUBLIC_ENABLED !== 'false', 'Separate explicitly disabled isolated runtime only')
  test.afterEach(async () => { await control() })
  test('feature-disabled routes show not-found without publication reads', async ({ page }) => {
   await control()
   const prefix = locale === 'en' ? '' : '/zh-CN'
   for (const path of ['/briefing', '/briefing/week', '/briefing/story/j17-canonical']) {
    await page.goto(`${prefix}${path}`)
    await expect(page.getByRole('heading', { name: locale === 'en' ? 'Page not found' : '找不到页面', exact: true })).toBeVisible()
   }
   const observations = await (await fetch(fixture)).json()
   expect(observations.requests.filter((row: { operation: string }) => row.operation.startsWith('Briefing'))).toEqual([])
  })
 })
}

for (const locale of ['en', 'zh-CN'] as const) {
 for (const width of [1440, 390]) {
  test.describe(`BRIEF02 week states ${locale} ${width}`, () => {
   test.use({ viewport: { width, height: 900 }, timezoneId: 'Australia/Perth' })
   test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.BRIEFING_PUBLIC_ENABLED !== 'true', 'Enabled isolated runtime only')
   test.afterEach(async () => { await control() })
   test('state transitions exclude expired content and recover the published edition', async ({ page }) => {
    const prefix = locale === 'en' ? '' : '/zh-CN'
    const gqlLocale = locale === 'en' ? 'EN' : 'ZH_CN'
    const story = { id: 'brief02-story', slug: 'brief02-story', storyRevision: 1, title: 'BRIEF02 published story', summary: 'BRIEF02 publication summary', sourceName: 'Fixture source', sourceUrl: null, sourceCheckedAt: '2026-09-15T10:00:00Z', expiresAt: null }
    const base = { revision: 8, publicationId: 'brief02-publication', publishedAt: '2026-09-15T11:00:00Z', sourceCheckedAt: story.sourceCheckedAt, staleAt: null, event: { seasonCode: '2627', eventId: 4, name: 'BRIEF02 GW4', deadlineTime: null }, featured: [story], sections: [] }
    const visit = async (state: string, empty = false) => {
     await control([{ operation: 'BriefingWeek', variables: { locale: gqlLocale }, data: { briefingWeek: { ...base, state, featured: empty ? [] : [story] } } }])
     await page.goto(`${prefix}/briefing/week`)
    }
    await visit('READY')
    await expect(page.getByRole('link', { name: story.title, exact: true })).toBeVisible()
    for (const [state, title] of [
     ['STALE', locale === 'en' ? 'This edition has expired' : '这一期已经过期'],
     ['UNAVAILABLE', locale === 'en' ? 'Briefing temporarily unavailable' : '资讯暂时不可用'],
     ['NOT_PUBLISHED', locale === 'en' ? 'This briefing has not been published' : '本期资讯尚未发布'],
     ['READY', locale === 'en' ? 'No briefing stories yet' : '本周还没有资讯']
    ]) {
     await visit(state, state === 'READY')
     await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible()
     await expect(page.getByRole('link', { name: story.title, exact: true })).toHaveCount(0)
     await expect(page.getByText(story.summary, { exact: true })).toHaveCount(0)
    }
    await visit('READY')
    await expect(page.getByRole('link', { name: story.title, exact: true })).toBeVisible()
    await expect(page.getByText('BRIEF02 GW4', { exact: true })).toBeVisible()
   })
  })
 }
}
