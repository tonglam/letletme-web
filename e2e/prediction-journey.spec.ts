import { expect, test } from '@playwright/test'
import en from '../messages/en.json'
import zh from '../messages/zh-CN.json'

const variants = [
 ...['en', 'zh-CN'].flatMap(locale => [1440, 390].map(width => ({ id: `J03.A.${locale}.${width === 390 ? 'mobile390' : 'desktop1440'}.base`, locale, width, theme: 'system', timezone: 'Australia/Perth', scenario: 'baseline' }))),
 ...['ready', 'not-published', 'empty'].map((scenario, index) => ({ id: `J03.state.0${index + 1}`, locale: 'zh-CN', width: 390, theme: 'dark', timezone: 'UTC', scenario }))
]
for (const variant of variants) {
 test.describe(`J03 prediction journey ${variant.id}`, () => {
  test.use({ viewport: { width: variant.width, height: 900 }, timezoneId: variant.timezone, colorScheme: variant.theme === 'dark' ? 'dark' : 'light' })
  test('actual carousel, filters, player and return', async ({ page, context }, testInfo) => {
   test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_MARKET_READINESS !== '1' || process.env.E2E_SSR_REMEDIATION !== '1', 'Requires an isolated standalone cache and fixture controls')
   const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}`
   const prefix = variant.locale === 'en' ? '' : '/zh-CN'
   const t = (variant.locale === 'en' ? en : zh).PriceChanges
   const h = (variant.locale === 'en' ? en : zh).Home
   const unavailable = variant.scenario === 'not-published'
   const empty = variant.scenario === 'empty'
   if (unavailable) {
    const contextSeed = await (await fetch(`${fixture}/graphql`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-letletme-contract': 'live-points-v2' }, body: JSON.stringify({ query: 'query GetLiveContext { liveContext { producerState dataAvailability } }' }) })).json()
    expect(['PICKS_WAIT', 'PICKS_PROBE', 'PICKS_SYNC']).toContain(contextSeed.data.liveContext.producerState)
    expect(contextSeed.data.liveContext.dataAvailability).toBe('UNAVAILABLE')
   }
   const seed = await (await fetch(`${fixture}/graphql`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: 'query GetPriceChangeBoard { priceChangeBoard { revision } }' }) })).json()
   const board = seed.data.priceChangeBoard
   board.players = empty || unavailable ? [] : Array.from({ length: 25 }, (_, i) => ({ ...board.players[0], playerId: i === 0 ? 1 : 7000 + i, playerCode: 8000 + i, webName: i === 0 ? 'Saka' : `Journey ${i}`, progressPercent: 99, status: i === 24 ? 'LOCKED' : 'LIKELY_RISE', currentPrice: 100 + i, lockedUntil: i === 24 ? '2099-01-01T00:00:00Z' : null }))
   Object.assign(board, { status: unavailable ? 'UNAVAILABLE' : 'READY', revision: unavailable ? null : 'j03-board', expectedPlayerCount: unavailable ? 25 : board.players.length, observedPlayerCount: board.players.length })
   board.latestEvent = { outcome: 'CHANGED', observedAt: '2026-08-03T09:40:00Z', deadline: '2026-08-03T09:00:00Z', changeDate: '2026-08-03', changedPlayerCount: 1, changes: [{ player: { playerId: 1, playerCode: 1, webName: 'Saka', teamId: 1, teamName: 'Arsenal', teamShortName: 'ARS', position: 'MIDFIELDER', price: 100, selectedByPercent: 20 }, changeDate: '2026-08-03', oldPrice: 99, newPrice: 100, change: 1, direction: 'RISE' }] }
   const vitals: Array<{ metricName?: string; value?: number }> = []
   await page.route('**/api/vitals', async route => { vitals.push(...(route.request().postDataJSON()?.samples ?? [])); await route.fulfill({ status: 204, body: '' }) })
   await page.addInitScript(theme => localStorage.setItem('theme', theme), variant.theme)
   expect((await context.cookies()).filter(c => /session/i.test(c.name))).toHaveLength(0)
   try {
    expect((await fetch(`${fixture}/__performance`, { method: 'POST', body: JSON.stringify({ rules: [{ operation: 'GetPriceChangeBoard', data: seed.data }] }) })).ok).toBe(true)
    await page.goto(prefix || '/')
    expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(variant.timezone)
    await expect(page.locator('html')).toHaveClass(variant.theme === 'dark' ? /dark/ : /light/)
    const carousel = page.locator('[data-home-carousel="home-price-changes"]')
    const pause = carousel.getByRole('checkbox', { name: h.homeCarouselPause, exact: true })
    if (await pause.isVisible()) await pause.check()
    await carousel.getByRole('tab', { name: h.homePriceChangesToday, exact: true }).click()
    await expect(carousel).toContainText('£9.9m')
    await expect(carousel).toContainText('£10.0m')
    await carousel.getByRole('tab', { name: h.homePriceChangesLikely, exact: true }).click()
    if (!unavailable && !empty) {
     const full = carousel.getByRole('button', { name: /View all \d|查看全部 \d/ })
     await full.click()
     const dialog = page.getByRole('dialog')
     await expect(dialog.getByRole('link', { name: /^(Saka|Journey )/ })).toHaveCount(24)
     await page.keyboard.press('Escape')
     await expect(dialog).toHaveCount(0)
     await expect(full).toBeFocused()
    }
    await carousel.getByRole('link', { name: h.openPredictions, exact: true }).click()
    await expect(page).toHaveURL(`${prefix}/explore/price-predictions`)
    const rendered = page.locator('[data-price-predictions-board]')
    await expect(rendered).toHaveAttribute('data-price-change-status', unavailable ? 'UNAVAILABLE' : 'READY')
    await expect(rendered).toHaveAttribute('data-price-change-refreshing', 'false')
    if (unavailable || empty) {
     await expect(rendered.getByRole('link', { name: /^(Saka|Journey )/ })).toHaveCount(0)
     if (unavailable) {
      await expect(rendered).toContainText(t.statusUpdating)
      await expect(rendered).not.toContainText(t.statusUnavailable)
     }
     await testInfo.attach('J03-state-binding', { contentType: 'application/json', body: JSON.stringify({ ...variant, executedThrough: 'J03.06', omitted: ['J03.04','J03.05','J03.07','J03.08','J03.09','J03.10','J03.11','J03.12','J03.13','J03.14','J03.15'], reason: 'No prediction rows: full-list, sort, pagination and player steps lack their data prerequisite. Available filter/Back controls remain NOT_RUN, not N/A. No fabricated player navigation.', status: unavailable ? 'UNAVAILABLE' : 'READY', revision: board.revision }) })
     return
    }
    const choose = async (label: string, option: string) => { await rendered.getByRole('combobox', { name: label, exact: true }).click(); await page.getByRole('option', { name: option, exact: true }).click() }
    await choose(t.scopeLabel, t.scopeAll)
    await choose(t.filterLabel, t.filterLocked)
    await expect(rendered.getByRole('link', { name: 'Journey 24', exact: true }).filter({ visible: true })).toHaveCount(1)
    await rendered.getByRole('combobox', { name: t.scopeLabel, exact: true }).click()
    await expect(page.getByRole('option', { name: t.scopeLikely, exact: true })).toBeDisabled()
    await page.keyboard.press('Escape')
    await choose(t.filterLabel, t.filterAll)
    await choose(t.filterByTeam, 'ARS · Arsenal')
    await choose(t.sortLabel, `${t.price} ↓`)
    const rows = rendered.getByRole('link', { name: /^(Saka|Journey )/ }).filter({ visible: true })
    await expect(rows).toHaveCount(20)
    await rendered.locator('button').filter({ hasText: t.nextPage }).click()
    await expect(rows).toHaveCount(5)
    await choose(t.filterLabel, t.filterLocked)
    await expect(rows).toHaveCount(1)
    await choose(t.filterLabel, t.filterAll)
    await expect(rows).toHaveCount(20)
    await rendered.locator('button').filter({ hasText: t.nextPage }).click()
    await rendered.getByRole('link', { name: 'Saka', exact: true }).filter({ visible: true }).click()
    await expect(page).toHaveURL(`${prefix}/explore/player-stats?p1=1`)
    await expect(page.getByRole('region', { name: variant.locale === 'en' ? 'Player overall' : '球员总览', exact: true })).toContainText('Saka')
    await expect.poll(() => vitals.some(v => v.metricName === 'PLAYER_DETAIL_PAINT')).toBe(true)
    await page.goBack()
    await expect(page).toHaveURL(`${prefix}/explore/price-predictions?scope=all`)
    await expect(rendered).toHaveAttribute('data-price-change-revision', 'j03-board')
    await expect(rendered.getByRole('combobox', { name: t.scopeLabel, exact: true })).toContainText(t.scopeAll)
    await testInfo.attach('J03-journey-binding', { contentType: 'application/json', body: JSON.stringify({ ...variant, playerId: 1, revision: 'j03-board', returnedUrl: page.url(), vitals, performanceStatus: 'NOT_RUN', readyMs: null }) })
   } finally { await fetch(`${fixture}/__performance`, { method: 'POST', body: JSON.stringify({ rules: [] }) }) }
  })
 })
}
