import { expect, test } from '@playwright/test'
import type { LiveMatchdayResponse } from '../lib/graphql/operations/live'

test.describe('match detail missing statistics', () => {
 test.describe.configure({ mode: 'serial' })
 for (const locale of ['en', 'zh-CN']) for (const outcome of ['success', 'failure', 'live-only', 'explain-only', 'wrong-identity']) {
  test(`${locale} delayed ${outcome} preserves unknown versus zero`, async ({ page }) => {
   test.skip(process.env.E2E_SSR_REMEDIATION !== '1' || Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Isolated fixture controls only')
   const zh = locale === 'zh-CN'
   const hasLive = outcome === 'success' || outcome === 'live-only' || outcome === 'wrong-identity'
   if (outcome === 'failure') await page.clock.install()
   const endpoint = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
   const control = async (rules: unknown[]) => expect((await fetch(endpoint, { method: 'POST', body: JSON.stringify({ rules }) })).ok).toBe(true)
   await control([])
   const response = await fetch(endpoint.replace('/__performance', '/graphql'), {
    method: 'POST', headers: { 'content-type': 'application/json', 'X-LetLetMe-Contract': 'live-matches-v3' },
    body: JSON.stringify({ query: 'query GetLiveMatchdayV3 { __typename }', variables: { eventId: null } })
   })
   const seed = (await response.json()).data as LiveMatchdayResponse
   const match = seed.liveMatchday.snapshot!.matches[0]
   match.players = [{ id: 257, webName: 'Bassey', position: 'DEFENDER', teamId: match.homeTeamId, price: 45, totalPoints: 6,
    stats: [{ identifier: 'minutes', value: 90 }, { identifier: 'assists', value: 1 }, { identifier: 'yellow_cards', value: 0 }] }]
   let release!: () => void
   const gate = new Promise<void>(resolve => { release = resolve })
   const requested: string[] = []
   let recovered = false
   await page.route('**/api/graphql', async route => {
    const { query, variables } = route.request().postDataJSON()
    const live = /query PlayerLive\(/.test(query)
    const explain = /query EventLiveExplainPlayer\(/.test(query)
    if (!live && !explain) return route.continue()
    expect(variables.eventId).toBe(33)
    expect(variables.playerId ?? variables.elementId).toBe(257)
    requested.push(live ? 'live' : 'explain')
    await gate
    if ((outcome === 'failure' && !recovered) || (outcome === 'live-only' && explain) || (outcome === 'explain-only' && live)) return route.fulfill({ status: 503, json: { errors: [{ message: 'isolated detail failure' }] } })
    return route.fulfill({ json: { data: live ? { playerLive: { minutes: 90, goalsScored: 0, assists: 1, cleanSheets: 0, goalsConceded: 1, defensiveContribution: 8, saves: 0, penaltiesSaved: 0, ownGoals: 0, penaltiesMissed: 0, yellowCards: 0, redCards: 0, totalPoints: 6, bps: 26, bonus: 1 } } : { eventLiveExplain: outcome === 'wrong-identity' ? { elementId: 258, player: { id: 258, webName: 'Wrong Player', team: null }, selectedBy: 99, contributions: [{ identifier: 'defensive_contribution', value: 99, points: 99 }] } : outcome === 'explain-only' ? { elementId: 257, player: { webName: 'Bassey Verified' }, selectedBy: 12, contributions: [] } : null } } })
   })
   try {
    await control([{ operation: 'GetLiveMatchdayV3', variables: { eventId: null }, data: seed }])
    await page.setViewportSize({ width: zh ? 390 : 1440, height: 900 })
    await page.goto(`${zh ? '/zh-CN' : ''}/live/matches`)
    const card = page.locator('[data-live-match-card="true"]').first()
    await card.getByRole('button', { name: zh ? '球员列表' : 'Player List', exact: true }).click()
    const opener = card.getByRole('button', { name: /Bassey/ })
    await opener.click()
    const dialog = page.getByRole('dialog')
    const stat = (name: string) => dialog.getByText(name, { exact: true }).locator('..')
    await expect.poll(() => requested.length).toBe(2)
    await expect(stat(zh ? '失球' : 'Goals Conceded')).toContainText('—')
    await expect(stat(zh ? '防守贡献' : 'Defensive Contribution')).toContainText('—')
    await expect(stat(zh ? '黄牌' : 'Yellow Cards')).toContainText('0')
    await expect(dialog.getByText('BPS', { exact: true })).toHaveCount(0)
    release()
    await expect(dialog.getByText(zh ? '正在加载积分明细…' : 'Loading breakdown…', { exact: true })).toHaveCount(0)
    if (outcome === 'wrong-identity') {
     await expect(dialog.getByRole('heading', { name: 'Bassey', exact: true })).toBeVisible()
     await expect(dialog.getByText('Wrong Player', { exact: true })).toHaveCount(0)
    }
    await expect(stat(zh ? '失球' : 'Goals Conceded')).toContainText(hasLive ? '1' : '—')
    await expect(stat(zh ? '防守贡献' : 'Defensive Contribution')).toContainText(hasLive ? '8' : '—')
    if (hasLive) await expect(stat('BPS')).toContainText('26')
    else await expect(dialog.getByText('BPS', { exact: true })).toHaveCount(0)
    if (hasLive) {
    // A successful stats response without explain rows is still an estimate.
    await expect(dialog.getByText(zh ? '估算' : 'Estimated', { exact: true })).toBeVisible()
    await expect(dialog.getByText(zh
     ? '官方计分明细仍在同步。以下根据实时阵容数据估算，接口就绪后会替换为正式明细。'
     : 'Official scoring events are still syncing. This estimate is built from live pick stats and may differ until the backend explain payload is ready.', { exact: true })).toBeVisible()
    const totalRow = dialog.getByText(zh ? '总计' : 'Total', { exact: true }).locator('..')
    const expectedSum = 6
    const scoringRows = totalRow.locator('..').locator('li').filter({ hasNot: page.getByText(zh ? '总计' : 'Total', { exact: true }) })
    const values = await scoringRows.locator(':scope > span:last-child').allTextContents()
    expect(values.map(value => Number(value.trim())).reduce((sum, value) => sum + value, 0)).toBe(expectedSum)
    await expect(totalRow).toContainText(`+${expectedSum}`)
    } else {
     await expect(dialog.getByText(zh ? '计分明细同步中。上方为实时总分。' : 'Scoring events still syncing. Total above is live.', { exact: true })).toBeVisible()
     await expect(dialog.getByText(zh ? '估算' : 'Estimated', { exact: true })).toHaveCount(0)
     await expect(dialog.getByRole('listitem')).toHaveCount(0)
    }
    if (outcome === 'explain-only') {
     await expect(dialog.getByRole('heading', { name: 'Bassey Verified', exact: true })).toBeVisible()
     await expect(dialog.locator(`[aria-label="${zh ? '6 得分' : '6 points'}"]`)).toBeVisible()
    }
    await dialog.getByRole('button', { name: zh ? '关闭' : 'Close', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
    if (outcome === 'failure') {
     recovered = true
     await opener.click()
     await expect(dialog).toBeVisible()
     await expect(dialog.getByText(zh ? '正在加载积分明细…' : 'Loading breakdown…', { exact: true })).toHaveCount(0)
     expect(requested).toHaveLength(2)
     const cooldownUntil = await page.evaluate(() => Number(sessionStorage.getItem('letletme:dependency-cooldown-until-v1')))
     expect(cooldownUntil).toBeGreaterThan(await page.evaluate(() => Date.now()))
     await dialog.getByRole('button', { name: zh ? '关闭' : 'Close', exact: true }).click()
     // Honor the dependency fence. Advancing wall time avoids firing unrelated polling timers.
     await page.clock.setSystemTime(cooldownUntil + 1)
     await opener.click()
     await expect.poll(() => requested.length).toBe(4)
     expect(requested.filter(operation => operation === 'live')).toHaveLength(2)
     expect(requested.filter(operation => operation === 'explain')).toHaveLength(2)
     await expect(dialog.getByText(zh ? '正在加载积分明细…' : 'Loading breakdown…', { exact: true })).toHaveCount(0)
     await expect(stat('BPS')).toContainText('26')
     await expect(dialog.getByText(zh ? '估算' : 'Estimated', { exact: true })).toBeVisible()
     const total = dialog.getByText(zh ? '总计' : 'Total', { exact: true }).locator('..')
     await expect(total).toContainText('+6')
     const rows = total.locator('..').locator('li').filter({ hasNot: page.getByText(zh ? '总计' : 'Total', { exact: true }) })
     const values = await rows.locator(':scope > span:last-child').allTextContents()
     expect(values.map(value => Number(value.trim())).reduce((sum, value) => sum + value, 0)).toBe(6)
     await dialog.getByRole('button', { name: zh ? '关闭' : 'Close', exact: true }).click()
     await expect(dialog).toHaveCount(0)
     await expect(opener).toBeFocused()
    }
   } finally { release(); await control([]) }
  })
 }
})

// MatchCard has its own detail hook; points-page race tests do not cover it.
for (const baselineContext of [null, ...['en', 'zh-CN'].flatMap(locale => [1440, 390].map(width => ({ locale, width })))])
for (const exactContext of baselineContext ? [false] : [false, true]) test.describe(baselineContext ? `S09 baseline ${baselineContext.locale} ${baselineContext.width}` : exactContext ? 'S09 exact context' : 'match detail late response boundaries', () => {
 test.describe.configure({ mode: 'serial' })
 for (const boundary of baselineContext ? ['replace', 'unmount', 'return-a'] as const : ['replace', 'reopen', 'return-a', 'close', 'unmount', 'snapshot', 'revision'] as const) {
  test.describe(boundary, () => {
  if (baselineContext) test.use({ locale: baselineContext.locale, timezoneId: 'Australia/Perth', colorScheme: 'light', viewport: { width: baselineContext.width, height: 900 } })
  else if (exactContext || boundary === 'return-a') test.use({ locale: 'zh-CN', timezoneId: 'UTC', colorScheme: 'dark', viewport: { width: 390, height: 900 } })
  test(boundary === 'reopen' ? 'reopen same source reuses pending requests and settles' : `${boundary} ignores the old player response`, async ({ page, context }, testInfo) => {
   test.skip(process.env.E2E_SSR_REMEDIATION !== '1' || process.env.E2E_LIVE_HYDRATION !== '1' || Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Isolated live fixture only')
   test.skip(exactContext && boundary !== 'replace' && boundary !== 'unmount', 'S09 exact-context delta covers only original directed01/02')
   const zh = baselineContext ? baselineContext.locale === 'zh-CN' : exactContext || boundary === 'return-a'
   if (baselineContext) await page.addInitScript(() => localStorage.setItem('theme', 'system'))
   else if (zh) await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
   const sourceUpdate = boundary === 'snapshot' || boundary === 'revision'
   if (sourceUpdate) await page.clock.install({ time: new Date('2026-08-04T18:30:00.000Z') })
   const endpoint = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
   const control = async (rules: unknown[]) => expect((await fetch(endpoint, { method: 'POST', body: JSON.stringify({ rules }) })).ok).toBe(true)
   await control([])
   const response = await fetch(endpoint.replace('/__performance', '/graphql'), {
    method: 'POST', headers: { 'content-type': 'application/json', 'X-LetLetMe-Contract': 'live-matches-v3' },
    body: JSON.stringify({ query: 'query GetLiveMatchdayV3 { __typename }', variables: { eventId: null } })
   })
   const seed = (await response.json()).data as LiveMatchdayResponse
   const match = seed.liveMatchday.snapshot!.matches[0]
   match.players = [257, 258].map(id => ({ id, webName: id === 257 ? 'Slow A' : 'Fast B', position: 'DEFENDER', teamId: match.homeTeamId, price: 45, totalPoints: 2, stats: [{ identifier: 'minutes', value: 90 }] }))
   let release!: () => void
   const gate = new Promise<void>(resolve => { release = resolve })
   let releaseB!: () => void
   const gateB = new Promise<void>(resolve => { releaseB = resolve })
   let bStarted = 0
   let bDelivered = 0
   let aStarted = 0
   let detailRequests = 0
   let aCompleted = 0
   let aDelivered = 0
   let currentSourceRequests = 0
   let currentSourceCompleted = 0
   let releaseCurrentSource!: () => void
   const currentSourceGate = new Promise<void>(resolve => { releaseCurrentSource = resolve })
   page.on('response', response => {
    if (new URL(response.url()).pathname !== '/api/graphql' || response.status() !== 200) return
    const variables = response.request().postDataJSON()?.variables
    if ((variables?.playerId ?? variables?.elementId) === 257) aDelivered++
    if ((variables?.playerId ?? variables?.elementId) === 258) bDelivered++
   })
   const errors: string[] = []
   page.on('pageerror', error => errors.push(error.message))
   await page.route('**/api/graphql', async route => {
    const { query, variables } = route.request().postDataJSON()
    const live = /query PlayerLive\(/.test(query)
    const explain = /query EventLiveExplainPlayer\(/.test(query)
    if (!live && !explain) return route.continue()
    detailRequests++
    const id = variables.playerId ?? variables.elementId
    expect(variables.eventId).toBe(33)
    expect([257, 258]).toContain(id)
    const isOld = id === 257 && (sourceUpdate ? aStarted < 2 : boundary !== 'reopen' || aStarted < 2)
    if (isOld) { aStarted++; await gate }
    else if (id === 257 && sourceUpdate) { currentSourceRequests++; await currentSourceGate }
    if (boundary === 'return-a' && id === 258) { bStarted++; await gateB }
    const currentSourcePoints = boundary === 'snapshot' ? 8 : 2
    const stats = { minutes: 90, goalsScored: 0, assists: 0, cleanSheets: 0, goalsConceded: 0, defensiveContribution: 0, saves: 0, penaltiesSaved: 0, ownGoals: 0, penaltiesMissed: 0, yellowCards: 0, redCards: 0, totalPoints: isOld ? 99 : sourceUpdate && id === 257 ? currentSourcePoints : 2, bps: isOld ? 99 : 8, bonus: 0 }
    await route.fulfill({ json: { data: live ? { playerLive: stats } : { eventLiveExplain: { elementId: id, player: { webName: isOld ? 'Late A' : sourceUpdate && id === 257 ? 'Current A' : boundary === 'reopen' ? 'Fresh A' : 'Fast B' }, contributions: [] } } } })
    if (isOld) aCompleted++
    else if (id === 257 && sourceUpdate) currentSourceCompleted++
   })
   try {
    await control([{ operation: 'GetLiveMatchdayV3', variables: { eventId: null }, data: seed }])
    if (boundary === 'unmount') {
     await page.goto(zh ? '/zh-CN/explore/market' : '/explore/market')
     await page.getByRole('contentinfo').getByRole('link', { name: zh ? '实时比赛' : 'Live Matches', exact: true }).click()
     await expect(page).toHaveURL(/\/live\/matches$/)
    } else await page.goto(zh ? '/zh-CN/live/matches' : '/live/matches')
    if (baselineContext) {
     expect(page.viewportSize()?.width).toBe(baselineContext.width)
     await expect(page.locator('html')).toHaveClass(/light/)
     expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('system')
     expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('Australia/Perth')
    } else if (zh) {
     await expect(page).toHaveURL(/\/zh-CN\/live\/matches$/)
     expect(page.viewportSize()?.width).toBe(390)
     await expect(page.locator('html')).toHaveClass(/dark/)
     expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('UTC')
    }
    const card = page.locator('[data-live-match-card="true"]').first()
    await card.getByRole('button', { name: zh ? '球员列表' : 'Player List', exact: true }).click()
    await card.getByRole('button', { name: /Slow A/ }).click()
    await expect.poll(() => aStarted).toBe(2)
    if (boundary !== 'unmount' && !sourceUpdate) {
     await page.getByRole('dialog').getByRole('button', { name: zh ? '关闭' : 'Close', exact: true }).click()
     await expect(page.getByRole('dialog')).toHaveCount(0)
    }
    if (boundary === 'return-a') {
     await card.getByRole('button', { name: /Fast B/ }).click()
     await expect.poll(() => bStarted).toBe(2)
     await expect(page.getByRole('dialog').getByText(zh ? '正在加载积分明细…' : 'Loading breakdown…', { exact: true })).toBeVisible()
     await page.getByRole('dialog').getByRole('button', { name: zh ? '关闭' : 'Close', exact: true }).click()
     await card.getByRole('button', { name: /Slow A/ }).click()
     await expect(page.getByRole('dialog').getByRole('heading', { name: 'Slow A', exact: true })).toBeVisible()
    } else if (boundary === 'replace' || boundary === 'reopen') {
     await card.getByRole('button', { name: boundary === 'reopen' ? /Slow A/ : /Fast B/ }).click()
     if (boundary === 'reopen') {
      await expect(page.getByRole('dialog').getByText(zh ? '正在加载积分明细…' : 'Loading breakdown…', { exact: true })).toBeVisible()
     } else {
      await expect(page.getByRole('dialog').getByText(zh ? '正在加载积分明细…' : 'Loading breakdown…', { exact: true })).toHaveCount(0)
      await expect(page.getByRole('dialog').getByRole('listitem').last()).toContainText('+2')
     }
    } else if (boundary === 'unmount') {
     await expect(page.getByRole('dialog')).toBeVisible()
     await page.goBack()
     await expect(page).toHaveURL(/\/explore\/market$/)
    }
    if (sourceUpdate) {
     const changed = structuredClone(seed)
     changed.liveMatchday.snapshot!.revisions.deskGeneration += 1
     changed.liveMatchday.snapshot!.revisions.deskPublicationId = 'match-detail-new-source'
     changed.liveMatchday.snapshot!.revisions.scoreState = 'd'.repeat(24)
     changed.liveMatchday.snapshot!.revisions.detailObservation = 'e'.repeat(24)
     changed.liveMatchday.snapshot!.revisions.detailGeneration! += 1
     changed.liveMatchday.snapshot!.revisions.detailPublicationId = 'match-detail-new-body'
     changed.liveMatchday.snapshot!.revisions.playerDetail = 'f'.repeat(24)
     changed.liveMatchday.snapshot!.matches[0].players![0].totalPoints = boundary === 'snapshot' ? 8 : 2
     await page.route('**/api/live/matches?*', route => route.fulfill({ json: changed }))
     const head = JSON.parse(JSON.stringify(changed))
     head.liveMatchday.snapshot.detailDelivery.state = 'PENDING'
     delete head.liveMatchday.snapshot.matches
     for (const key of ['detailPublicationId', 'detailGeneration', 'playerDetail']) delete head.liveMatchday.snapshot.revisions[key]
     await page.route('**/api/graphql', async route => {
      if (!route.request().postData()?.includes('GetLiveMatchdayHead')) return route.fallback()
      await route.fulfill({ json: { data: head } })
     })
     const refreshed = page.waitForResponse(response => new URL(response.url()).pathname === '/api/live/matches')
     await context.setOffline(true)
     await page.clock.runFor(50)
     await context.setOffline(false)
     await page.clock.runFor(50)
     const accepted = await refreshed
     expect((await accepted.json()).liveMatchday.snapshot.revisions.deskPublicationId).toBe('match-detail-new-source')
     await page.clock.runFor(50)
     await expect(page.locator('[data-live-matchday-view="true"]')).toHaveAttribute('data-revisions', /match-detail-new-source/)
     // The route contract marker is SSR-only; assert the updated client player row.
     await expect(card.getByRole('button', { name: /Slow A/, includeHidden: true })).toContainText(boundary === 'snapshot' ? '8' : '2')
     await expect.poll(() => currentSourceRequests).toBe(2)
     const dialog = page.getByRole('dialog')
     await expect(dialog.getByText(zh ? '正在加载积分明细…' : 'Loading breakdown…', { exact: true })).toBeVisible()
     releaseCurrentSource()
     await expect.poll(() => currentSourceCompleted).toBe(2)
     await expect(dialog.getByRole('heading', { name: 'Current A', exact: true })).toBeVisible()
     await expect(dialog.locator(`[aria-label="${boundary === 'snapshot' ? 8 : 2} points"]`)).toBeVisible()
     await expect(dialog.getByText(zh ? '正在加载积分明细…' : 'Loading breakdown…', { exact: true })).toHaveCount(0)
    }
    release()
    await expect.poll(() => aCompleted).toBe(2)
    if (sourceUpdate || boundary === 'reopen' || boundary === 'return-a') await expect.poll(() => aDelivered).toBe(sourceUpdate ? 4 : 2)
    // Let fulfilled network callbacks and React commits settle before the negative assertions.
    if (sourceUpdate) await page.clock.runFor(50)
    else await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    if (boundary === 'return-a') {
     const dialog = page.getByRole('dialog')
     await expect(dialog.getByRole('heading', { name: 'Late A', exact: true })).toBeVisible()
     await expect(dialog.locator(zh ? '[aria-label="99 得分"]' : '[aria-label="99 points"]')).toBeVisible()
     expect(bDelivered).toBe(0)
     releaseB()
     await expect.poll(() => bDelivered).toBe(2)
     await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
     await expect(dialog.getByRole('heading', { name: 'Late A', exact: true })).toBeVisible()
     await expect(dialog.locator(zh ? '[aria-label="99 得分"]' : '[aria-label="99 points"]')).toBeVisible()
     await expect(dialog).not.toContainText('Fast B')
     await expect(dialog.getByText(zh ? '正在加载积分明细…' : 'Loading breakdown…', { exact: true })).toHaveCount(0)
     expect(detailRequests).toBe(4)
    } else if (boundary === 'reopen') {
     const dialog = page.getByRole('dialog')
     await expect(dialog.getByRole('heading', { name: 'Late A', exact: true })).toBeVisible()
     await expect(dialog.locator(zh ? '[aria-label="99 得分"]' : '[aria-label="99 points"]')).toBeVisible()
     await expect(dialog.getByText(zh ? '正在加载积分明细…' : 'Loading breakdown…', { exact: true })).toHaveCount(0)
     expect(detailRequests).toBe(2)
    } else if (boundary === 'replace') {
     const dialog = page.getByRole('dialog')
     await expect(dialog.getByRole('heading', { name: 'Fast B', exact: true })).toBeVisible()
     await expect(dialog).not.toContainText('Late A')
     await expect(dialog).not.toContainText('99')
     await expect(dialog.getByRole('listitem').last()).toContainText('+2')
     await expect(dialog.getByText(zh ? '正在加载积分明细…' : 'Loading breakdown…', { exact: true })).toHaveCount(0)
    } else if (sourceUpdate) {
     const dialog = page.getByRole('dialog')
     await expect(dialog.getByRole('heading', { name: 'Current A', exact: true })).toBeVisible()
     await expect(dialog.locator(`[aria-label="${boundary === 'snapshot' ? 8 : 2} points"]`)).toBeVisible()
     await expect(dialog).not.toContainText('Late A')
     await expect(dialog).not.toContainText('99')
     expect(detailRequests).toBe(4)
    } else await expect(page.getByRole('dialog')).toHaveCount(0)
    if (boundary === 'unmount') await expect(page).toHaveURL(/\/explore\/market$/)
    expect(errors).toEqual([])
    if (baselineContext) await testInfo.attach('S09-baseline-owner', { contentType: 'application/json', body: JSON.stringify({ parentVariantId: `S09.UNRESOLVED_ROLE.${baselineContext.locale}.${baselineContext.width === 1440 ? 'desktop1440' : 'mobile390'}.base`, owner: boundary, identity: 'A', ...baselineContext, theme: 'system', timezone: 'Australia/Perth', eventId: 33, players: [257,258], detailRequests, aCompleted, aDelivered, bDelivered, errors, readyMs: null, wholeVariantComplete: false }) })
   } finally { release(); releaseB(); releaseCurrentSource(); await control([]) }
  })
  })
 }
})
