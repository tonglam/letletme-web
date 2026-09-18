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

for (const locale of ['en', 'zh-CN'] as const) {
 for (const width of [1440, 390]) {
  test.describe(`BRIEF01 content ${locale} ${width}`, () => {
   test.use({ viewport: { width, height: 900 } })
   test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.BRIEFING_PUBLIC_ENABLED !== 'true', 'Enabled isolated runtime only')
   test.afterEach(async () => { await control() })
   test('long titles and section stories remain readable through actual detail and return links', async ({ page }) => {
    const prefix = locale === 'en' ? '' : '/zh-CN'
    const gqlLocale = locale === 'en' ? 'EN' : 'ZH_CN'
    const stories = ['lead', 'supporting', 'section'].map((kind, index) => ({
     id: `brief-content-${kind}`, slug: `brief-content-${kind}`, storyRevision: index + 1,
     title: `${kind}: ${locale === 'en' ? 'A detailed match report with a long title that wraps across multiple lines without losing the story context '.repeat(3) : '这是一篇需要在手机和桌面完整显示并保持可读性的详细比赛资讯标题'.repeat(5)}`,
     summary: `Summary for ${kind}`, sourceName: null, sourceUrl: null, sourceCheckedAt: null, expiresAt: null
    }))
    await control([
     { operation: 'BriefingWeek', variables: { locale: gqlLocale }, data: { briefingWeek: { state: 'READY', revision: 9, publicationId: 'brief-content-publication', publishedAt: null, sourceCheckedAt: null, staleAt: null, event: null, featured: stories.slice(0, 2), sections: [{ key: 'match-reports', title: 'Match reports fixture', items: [stories[2]] }] } } },
     ...stories.map(story => ({ operation: 'BriefingStory', variables: { locale: gqlLocale, slug: story.slug }, data: { briefingStory: { state: 'READY', canonicalSlug: story.slug, story } } }))
    ])
    await page.goto(`${prefix}/briefing/week`)
    for (const story of stories) {
     await expect(page.getByRole('heading', { name: 'Match reports fixture', exact: true })).toBeVisible()
     const link = page.getByRole('link', { name: story.title, exact: true })
     await expect(link).toHaveCount(1)
     await expect(link).toBeVisible()
     expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
     await link.click()
     await expect(page).toHaveURL(new RegExp(`${prefix}/briefing/story/${story.slug}$`))
     const title = page.getByRole('heading', { level: 1, name: story.title, exact: true })
     await expect(title).toBeVisible()
     await expect(page.getByText(story.summary, { exact: true })).toBeVisible()
     const geometry = await title.evaluate(element => ({ scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight, overflow: getComputedStyle(element).overflow, lineClamp: getComputedStyle(element).webkitLineClamp }))
     console.log('BRIEF-title-geometry', JSON.stringify({ locale, width, slug: story.slug, ...geometry }))
     expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1)
     expect(geometry.overflow).toBe('visible')
     expect(geometry.lineClamp).toBe('none')
     expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
     await page.locator(`article a[href="${prefix}/briefing/week"]`).click()
     await expect(page).toHaveURL(new RegExp(`${prefix}/briefing/week$`))
     await expect(link).toBeVisible()
    }
   })
  })
 }
}

test.describe('BRIEF02 exact planned states', () => {
 test.use({ viewport: { width: 390, height: 900 }, timezoneId: 'UTC', colorScheme: 'dark' })
 test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.BRIEFING_PUBLIC_ENABLED !== 'true', 'Enabled isolated runtime only')
 test.afterEach(async () => { await control() })
 for (const [variantId, state, heading] of [
  ['BRIEF02.state.01', 'READY', '本周还没有资讯'],
  ['BRIEF02.state.02', 'STALE', '这一期已经过期']
 ] as const) {
  test(`${variantId} renders the planned empty or stale terminal state`, async ({ page }, testInfo) => {
   await control([{ operation: 'BriefingWeek', variables: { locale: 'ZH_CN' }, data: { briefingWeek: {
    state, revision: 10, publicationId: 'brief-planned-states', publishedAt: '2026-09-17T23:59:00Z', sourceCheckedAt: '2026-09-17T23:58:00Z', staleAt: '2026-09-18T00:00:00Z', event: null,
    featured: state === 'STALE' ? [{ id: 'expired', slug: 'expired', storyRevision: 1, title: 'Expired content must stay hidden', summary: 'Expired summary must stay hidden', sourceName: null, sourceUrl: null, sourceCheckedAt: null, expiresAt: null }] : [], sections: []
   } } }])
   await page.goto('/zh-CN/briefing/week')
   await expect(page).toHaveURL(/\/zh-CN\/briefing\/week$/)
   await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible()
   await expect(page.locator('html')).toHaveClass(/\bdark\b/)
   expect(await page.evaluate(() => ({ width: innerWidth, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, dark: matchMedia('(prefers-color-scheme: dark)').matches }))).toEqual({ width: 390, timezone: 'UTC', dark: true })
   await expect(page.locator('main article')).toHaveCount(0)
   await expect(page.getByText('Expired content must stay hidden', { exact: true })).toHaveCount(0)
   await expect(page.getByText('Expired summary must stay hidden', { exact: true })).toHaveCount(0)
   const observations = await (await fetch(fixture)).json()
   const reads = observations.requests.filter((row: { operation: string }) => row.operation === 'BriefingWeek')
   expect(reads.length).toBeGreaterThan(0)
   expect(reads.every((row: { variables: { locale: string } }) => row.variables.locale === 'ZH_CN')).toBe(true)
   await testInfo.attach(variantId, { body: JSON.stringify({ variantId, locale: 'zh-CN', viewport: 390, timezone: 'UTC', theme: 'dark', state, readyMs: null, performanceStatus: 'NOT_OBSERVED', assertionScope: 'Planned empty/stale functional assertions only; state readiness, runtime errors and layout shift remain unmeasured and are excluded from normal performance distributions.' }), contentType: 'application/json' })
  })
 }
})
