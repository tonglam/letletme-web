import { expect, test } from '@playwright/test'
import enMessages from '../messages/en.json'
import zhMessages from '../messages/zh-CN.json'
import type { PriceChangeObservedEvent } from '../lib/graphql/operations/price-changes'

for (const locale of ['en', 'zh-CN']) {
 for (const width of [1440, 390]) {
  test(`MKT03 position and availability controls ${locale} ${width}`, async ({ page }) => {
   const zh = locale === 'zh-CN'
   await page.setViewportSize({ width, height: 900 })
   await page.goto(`${zh ? '/zh-CN' : ''}/explore/market`)
   const board = page.locator('#market-most-selected-share')
   await expect(board.locator('li')).toHaveCount(4)
   for (const position of ['GOALKEEPER', 'DEFENDER', 'MIDFIELDER', 'FORWARD']) {
    const button = board.locator(`[data-market-position-filter="${position}"]`)
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect(board.locator('li')).toHaveCount(1)
    await expect(board.locator('li')).toContainText(`Market ${position}`)
   }
   await board.locator('[data-market-position-filter="ALL"]').click()
   await expect(board.locator('li')).toHaveCount(4)
   const disclosure = page.getByTestId('market-availability-disclosure')
   await disclosure.locator('summary').click()
   await expect(disclosure).toHaveAttribute('open', '')
   const search = page.locator('#market-availability-search')
   await expect(search).toBeVisible()
   await expect(disclosure.locator('li')).toHaveCount(6)
   await search.fill('NoSuchFixturePlayer')
   await expect(page.locator('#market-availability-search-status')).toHaveText(zh ? '没有匹配的出场状态更新。' : 'No availability updates match that name.')
   await expect(disclosure.locator('li')).toHaveCount(0)
   await disclosure.getByRole('button', { name: zh ? '清除球员搜索' : 'Clear player search', exact: true }).click()
   await expect(search).toHaveValue('')
   await expect(disclosure.locator('li')).toHaveCount(6)
   await expect(page.locator('#market-availability-search-status')).toHaveText(zh ? '输入至少 2 个字符，在全部更新中查找球员。' : 'Enter at least 2 characters to search all updates.')
   await disclosure.getByRole('link', { name: 'Palmer', exact: true }).click()
   await expect(page).toHaveURL(new RegExp(`${zh ? '/zh-CN' : ''}/explore/player-stats\\?p1=2$`))
   await expect(page.getByRole('region', { name: zh ? '球员总览' : 'Player overall', exact: true })).toContainText('Palmer')
   await page.goBack()
   await expect(page).toHaveURL(new RegExp(`${zh ? '/zh-CN' : ''}/explore/market$`))
   await expect(page.locator('#market-most-selected-share li')).toHaveCount(4)
   for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.getByRole('searchbox', { name: zh ? '按姓名搜索球员' : 'Search players by name', exact: true }).fill('Sa')
    const results = page.getByRole('list', { name: zh ? '球员搜索结果' : 'Player search results', exact: true })
    const saka = results.getByRole('listitem').filter({ has: page.getByRole('link', { name: 'Saka', exact: true }) })
    const historyButton = saka.getByRole('button', { name: zh ? '历史' : 'History', exact: true })
    if (attempt === 0) await historyButton.click()
    else await historyButton.press('Enter')
    await expect(page.getByRole('heading', { level: 3, name: 'Saka', exact: true })).toBeVisible()
    await expect(page.getByText('£9.9m → £10.0m')).toBeVisible()
    const historyList = page.getByRole('list', { name: zh ? 'Saka 的身价历史' : 'Price history for Saka', exact: true })
    await expect(historyList.getByRole('listitem')).toHaveCount(1)
    await expect(historyList).toContainText('+£0.1m')
    await expect(historyList).toContainText('2026')
    await expect(historyList).toContainText(zh ? '8月3日' : 'Aug 3')
    await page.getByRole('button', { name: zh ? '选择其他球员' : 'Choose another player', exact: true }).click()
    await expect(page.getByRole('heading', { level: 3, name: 'Saka', exact: true })).toHaveCount(0)
    await expect(page.getByText('£9.9m → £10.0m')).toHaveCount(0)
   }
   await page.route('**/api/market/price-history?**', async route => {
    if (new URL(route.request().url()).searchParams.get('playerId') === '2') return route.fulfill({ json: { items: [] } })
    return route.continue()
   })
   await page.getByRole('searchbox', { name: zh ? '按姓名搜索球员' : 'Search players by name', exact: true }).fill('Pa')
   const palmer = page.getByRole('list', { name: zh ? '球员搜索结果' : 'Player search results', exact: true }).getByRole('listitem').filter({ has: page.getByRole('link', { name: 'Palmer', exact: true }) })
   await palmer.getByRole('button', { name: zh ? '历史' : 'History', exact: true }).press('Enter')
   await expect(page.getByRole('heading', { level: 3, name: 'Palmer', exact: true })).toBeVisible()
   await expect(page.getByText(zh ? 'Palmer 尚无真实身价变化记录。' : 'No genuine price changes have been recorded for Palmer.', { exact: true })).toBeVisible()
   await expect(page.getByText('£9.9m → £10.0m')).toHaveCount(0)
   await expect(page.getByRole('list', { name: zh ? 'Palmer 的身价历史' : 'Price history for Palmer', exact: true })).toHaveCount(0)
  })
 }
}

for (const locale of ['en', 'zh-CN']) {
 for (const width of [1440, 390]) {
  test(`MKT02 late history cannot replace a new player ${locale} ${width}`, async ({ page }) => {
   const zh = locale === 'zh-CN'
   let release!: () => void
   const held = new Promise<void>(resolve => { release = resolve })
   let started!: () => void
   const oldStarted = new Promise<void>(resolve => { started = resolve })
   let finished!: () => void
   const oldFinished = new Promise<void>(resolve => { finished = resolve })
   await page.route('**/api/market/price-history?**', async route => {
    const id = Number(new URL(route.request().url()).searchParams.get('playerId'))
    if (id === 1) { started(); await held }
    try {
     await route.fulfill({ json: { items: [{ playerId: id, changeDate: '2026-08-03', oldValue: id === 1 ? 99 : 104, newValue: id === 1 ? 100 : 105, changeType: 'RISE', transfersIn: null, transfersOut: null }] } })
    } finally { if (id === 1) finished() }
   })
   await page.setViewportSize({ width, height: 900 })
   try {
    await page.goto(`${zh ? '/zh-CN' : ''}/explore/market`)
    const search = page.getByRole('searchbox', { name: zh ? '按姓名搜索球员' : 'Search players by name', exact: true })
    const choose = async (name: string, term: string) => {
     await search.fill(term)
     const row = page.getByRole('list', { name: zh ? '球员搜索结果' : 'Player search results', exact: true }).getByRole('listitem').filter({ has: page.getByRole('link', { name, exact: true }) })
     await row.getByRole('button', { name: zh ? '历史' : 'History', exact: true }).click()
    }
    await choose('Saka', 'Sa')
    await oldStarted
    await page.getByRole('button', { name: zh ? '选择其他球员' : 'Choose another player', exact: true }).click()
    await choose('Palmer', 'Pa')
    await expect(page.getByRole('heading', { level: 3, name: 'Palmer', exact: true })).toBeVisible()
    await expect(page.getByText('£10.4m → £10.5m')).toBeVisible()
    release()
    await oldFinished
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    await expect(page.getByRole('heading', { level: 3, name: 'Palmer', exact: true })).toBeVisible()
    await expect(page.getByText('£10.4m → £10.5m')).toBeVisible()
    await expect(page.getByText('£9.9m → £10.0m')).toHaveCount(0)
   } finally { release() }
  })
 }
}

for (const locale of ['en', 'zh-CN']) {
 for (const width of [1440, 390]) {
  test(`MKT01 future date never masquerades as published data ${locale} ${width}`, async ({ page }) => {
   const prefix = locale === 'zh-CN' ? '/zh-CN' : ''
   await page.setViewportSize({ width, height: 900 })
   await page.goto(`${prefix}/explore/market?period=DAILY&date=2099-01-01`)
   await expect(page.locator('#market-most-selected-share li')).toHaveCount(4)
   await expect(page.locator('main')).not.toContainText('2099')
   await expect(page.locator('a[aria-current="date"][href*="2099"]')).toHaveCount(0)
   await expect(page.locator('a[href*="date=2026-08-03"]')).toBeVisible()
   await expect(page.locator('a[aria-current="date"]')).toHaveAttribute('href', /date=2026-08-03/)
  })
 }
}

for (const locale of ['en', 'zh-CN']) {
 for (const width of [1440, 390]) {
  test(`C09 text share outcomes and manual fallback ${locale} ${width}`, async ({ page }) => {
   test.skip(process.env.E2E_MARKET_READINESS !== '1', 'Requires standalone clone with isolated price-board cache')
   const zh = locale === 'zh-CN'
   await page.setViewportSize({ width, height: 900 })
   const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}`
   const seed = await (await fetch(`${fixture}/graphql`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: 'query GetPriceChangeBoard { priceChangeBoard { revision } }' }) })).json()
   seed.data.priceChangeBoard.latestEvent = {
    outcome: 'CHANGED', observedAt: '2026-08-03T09:40:00.000Z', deadline: '2026-08-03T09:00:00.000Z', changeDate: '2026-08-03', changedPlayerCount: 1,
    changes: [{ player: { playerId: 1, playerCode: 1, webName: 'Saka', teamId: 1, teamName: 'Arsenal', teamShortName: 'ARS', position: 'MIDFIELDER', price: 100, selectedByPercent: 20 }, changeDate: '2026-08-03', oldPrice: 99, newPrice: 100, change: 1, direction: 'RISE' }]
   } satisfies PriceChangeObservedEvent
   expect((await fetch(`${fixture}/__performance`, { method: 'POST', body: JSON.stringify({ rules: [{ operation: 'GetPriceChangeBoard', data: seed.data }] }) })).ok).toBe(true)
   try {
   await page.goto(`${zh ? '/zh-CN' : ''}/explore/market`)
   const region = page.locator('#market-prices-share')
   await expect(region.getByRole('link', { name: 'Saka', exact: true })).toBeVisible()
   await expect(region).toContainText('£9.9m → £10.0m')
   await expect(region).toContainText('+£0.1m')
   const assertObservedPriceText = (text: string | undefined) => {
    expect(text).toContain('Saka')
    expect(text).toContain('£9.9m')
    expect(text).toContain('£10.0m')
    expect(text).toContain('03/08/2026')
   }
   const share = region.getByRole('button', { name: zh ? '文字' : 'Text', exact: true })
   await expect(share).toHaveCount(1)
   await expect(share).toBeVisible()
   const fallback = region.getByRole('textbox', { name: zh ? '文字' : 'Text', exact: true })
   for (const outcome of ['unsupported', 'failed', 'cancelled', 'shared', 'copied'] as const) {
    await page.evaluate(outcome => {
     const native = outcome === 'shared' || outcome === 'cancelled'
     delete document.documentElement.dataset.fixtureCopiedText
     delete document.documentElement.dataset.fixtureSharedText
     Object.defineProperty(navigator, 'userAgentData', { configurable: true, value: { mobile: native } })
     Object.defineProperty(navigator, 'share', { configurable: true, value: native ? async (payload: ShareData) => {
      document.documentElement.dataset.fixtureSharedText = payload.text
      if (outcome === 'cancelled') throw new DOMException('Fixture user cancelled', 'AbortError')
     } : undefined })
     Object.defineProperty(navigator, 'clipboard', { configurable: true, value: outcome === 'unsupported' ? undefined : {
      writeText: async (text: string) => {
       if (outcome === 'failed') throw new Error('fixture clipboard rejected')
       document.documentElement.dataset.fixtureCopiedText = text
      }
     } })
    }, outcome)
    await share.click()
    if (outcome === 'copied' || outcome === 'shared') {
     await expect(share).toContainText(zh ? '已分享' : 'Done')
     await expect(fallback).toHaveCount(0)
     await expect.poll(() => page.evaluate(kind => kind === 'copied' ? document.documentElement.dataset.fixtureCopiedText : document.documentElement.dataset.fixtureSharedText, outcome)).toContain('/explore/market')
     assertObservedPriceText(await page.evaluate(kind => kind === 'copied' ? document.documentElement.dataset.fixtureCopiedText : document.documentElement.dataset.fixtureSharedText, outcome))
     if (outcome === 'shared') expect(await page.evaluate(() => document.documentElement.dataset.fixtureCopiedText)).toBeUndefined()
    } else {
     await expect(fallback).toBeVisible()
     if (outcome === 'cancelled') {
      expect(await page.evaluate(() => document.documentElement.dataset.fixtureCopiedText)).toBeUndefined()
      await expect(share).not.toContainText(zh ? '已分享' : 'Done')
     }
     await expect(fallback).toHaveValue(/\/explore\/market/)
     await expect(fallback).toHaveAttribute('readonly', '')
     assertObservedPriceText(await fallback.inputValue())
     await region.getByRole('button', { name: zh ? '关闭' : 'Close', exact: true }).click()
     await expect(fallback).toHaveCount(0)
    }
   }
   await page.evaluate(() => {
    Object.defineProperty(navigator, 'userAgentData', { configurable: true, value: { mobile: false } })
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
     write: async (items: ClipboardItem[]) => {
      const blob = await items[0].getType('image/png')
      const bitmap = await createImageBitmap(blob)
      document.documentElement.dataset.fixturePng = JSON.stringify({ type: blob.type, size: blob.size, width: bitmap.width, height: bitmap.height })
      bitmap.close()
     }
    } })
   })
   const imageShare = region.getByRole('button', { name: zh ? '图片' : 'Image', exact: true })
   await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob
    HTMLCanvasElement.prototype.toBlob = function () {
     HTMLCanvasElement.prototype.toBlob = original
     document.documentElement.dataset.fixtureEncoderFailed = 'true'
     throw new Error('Fixture encoder failed once')
    }
   })
   await imageShare.click()
   await expect(page.getByText(zh ? '分享失败' : 'Share failed', { exact: true })).toBeVisible()
   expect(await page.evaluate(() => document.documentElement.dataset.fixtureEncoderFailed)).toBe('true')
   expect(await page.evaluate(() => document.documentElement.dataset.fixturePng)).toBeUndefined()
   await expect(region).not.toHaveAttribute('data-share-rendering', 'true')
   await expect(imageShare).not.toContainText(zh ? '已分享' : 'Done')
   await imageShare.click()
   await expect(imageShare).toContainText(zh ? '已分享' : 'Done', { timeout: 15000 })
   const png = await page.evaluate(() => JSON.parse(document.documentElement.dataset.fixturePng ?? '{}'))
   expect(png.type).toBe('image/png')
   expect(png.size).toBeGreaterThan(0)
   expect(png.width).toBeGreaterThan(0)
   expect(png.height).toBeGreaterThan(0)
   for (const outcome of ['cancelled', 'unsupported', 'shared'] as const) {
    await page.evaluate(outcome => {
     delete document.documentElement.dataset.fixtureNativePng
     Object.defineProperty(navigator, 'userAgentData', { configurable: true, value: { mobile: true } })
     Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
     Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => outcome !== 'unsupported' })
     Object.defineProperty(navigator, 'share', { configurable: true, value: async (data: ShareData) => {
      const file = data.files?.[0]
      document.documentElement.dataset.fixtureNativePng = JSON.stringify({ name: file?.name, type: file?.type, size: file?.size })
      if (outcome === 'cancelled') throw new DOMException('Fixture cancellation', 'AbortError')
     } })
    }, outcome)
    await imageShare.click()
    await expect(page.getByText(zh ? (outcome === 'shared' ? '图片已分享' : outcome === 'unsupported' ? '请手动复制' : '分享失败') : (outcome === 'shared' ? 'Image shared' : outcome === 'unsupported' ? 'Copy manually' : 'Share failed'), { exact: true })).toBeVisible()
    const file = await page.evaluate(() => JSON.parse(document.documentElement.dataset.fixtureNativePng ?? 'null'))
    if (outcome === 'unsupported') expect(file).toBeNull()
    else {
     expect(file.name).toBe('letletme-share.png')
     expect(file.type).toBe('image/png')
     expect(file.size).toBeGreaterThan(0)
    }
    await expect(region).not.toHaveAttribute('data-share-rendering', 'true')
   }
   } finally {
    await fetch(`${fixture}/__performance`, { method: 'POST', body: JSON.stringify({ rules: [] }) })
   }
  })
 }
}

for (const locale of ['en', 'zh-CN']) {
 test(`prediction observation tracks rendered revision during refresh ${locale}`, async ({ page }) => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Requires isolated fixture')
  const zh = locale === 'zh-CN'
  const pathname = `${zh ? '/zh-CN' : ''}/explore/price-predictions`
  await page.goto(pathname)
  const board = page.locator('[data-price-predictions-board]')
  await expect(board).toHaveAttribute('data-price-change-revision', 'price-changes-7')
  await expect(board).toHaveAttribute('data-price-change-status', 'READY')
  await expect(board).toHaveAttribute('data-price-change-refreshing', 'false')
  await page.evaluate(() => {
   const board = document.querySelector('[data-price-predictions-board]')!
   const seed = document.querySelector('[data-letletme-contract="price_changes"]')!
   const state: Record<string, string | null> = {
    revision: board.getAttribute('data-price-change-revision'),
    refreshing: board.getAttribute('data-price-change-refreshing'),
    seed: seed.getAttribute('data-revision')
   }
   const violations: string[] = []
   document.documentElement.dataset.predictionSyncViolations = '[]'
   new MutationObserver(records => {
    records.forEach((record, index) => {
     const key = record.target === board
      ? record.attributeName === 'data-price-change-revision' ? 'revision' : 'refreshing'
      : record.target === seed ? 'seed' : null
     if (!key) return
     // MutationObserver batches commits. Reconstruct intermediate values from
     // the next mutation's oldValue instead of reading only the final DOM.
     const next = records.slice(index + 1).find(item => item.target === record.target && item.attributeName === record.attributeName)
     state[key] = next ? next.oldValue : (record.target as Element).getAttribute(record.attributeName!)
     if (state.seed === 'price-changes-next' && state.refreshing === 'false' && state.revision !== state.seed) violations.push(JSON.stringify(state))
    })
    document.documentElement.dataset.predictionSyncViolations = JSON.stringify(violations)
   }).observe(document.documentElement, { subtree: true, attributes: true, attributeOldValue: true,
    attributeFilter: ['data-price-change-revision', 'data-price-change-refreshing', 'data-revision'] })
  })
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let waiting = false
  await page.route(`**${pathname}?_rsc=*`, async route => {
   waiting = true
   await gate
   const response = await route.fetch()
   const body = await response.text()
   expect(body).toContain('price-changes-7')
   await route.fulfill({ response, body: body.replaceAll('price-changes-7', 'price-changes-next') })
  })
  try {
   await page.getByRole('button', { name: zh ? '刷新' : 'Refresh', exact: true }).click()
   await expect.poll(() => waiting).toBe(true)
   await expect(board).toHaveAttribute('data-price-change-refreshing', 'true')
   await expect(board).toHaveAttribute('data-price-change-revision', 'price-changes-7')
   await expect(board.getByRole('table')).toBeVisible()
  } finally {
   release()
  }
  await expect(board).toHaveAttribute('data-price-change-refreshing', 'false')
  await expect(board).toHaveAttribute('data-price-change-revision', 'price-changes-next')
  await expect(page.locator('html')).toHaveAttribute('data-prediction-sync-violations', '[]')
  await expect(board).toHaveAttribute('data-price-change-status', 'READY')
 })
}

test.describe('SSR remediation PRED03 board states', () => {
 test.describe.configure({ mode: 'serial' })
 test.use({ timezoneId: 'Australia/Perth', colorScheme: 'light' })
 for (const status of ['READY', 'PARTIAL', 'STALE', 'UNAVAILABLE'] as const) {
  for (const locale of ['en', 'zh-CN']) {
   for (const width of [1440, 390]) {
    test(`${status} ${locale} ${width}`, async ({ page }, testInfo) => {
     test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_SSR_REMEDIATION !== '1' || process.env.E2E_MARKET_READINESS !== '1', 'Run each PRED03 status in a separate isolated standalone clone')
     const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}`
     const t = (locale === 'en' ? enMessages : zhMessages).PriceChanges
     const seed = await (await fetch(`${fixture}/graphql`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: 'query GetPriceChangeBoard { priceChangeBoard { revision } }' }) })).json()
     seed.data.priceChangeBoard.status = status
     seed.data.priceChangeBoard.revision = `state-${status}`
     if (status === 'UNAVAILABLE') {
      seed.data.priceChangeBoard.players = []
      seed.data.priceChangeBoard.observedPlayerCount = 0
     }
     await page.setViewportSize({ width, height: 900 })
     await page.addInitScript(() => localStorage.setItem('theme', 'system'))
     try {
      expect((await fetch(`${fixture}/__performance`, { method: 'POST', body: JSON.stringify({ rules: [{ operation: 'GetPriceChangeBoard', data: seed.data }] }) })).ok).toBe(true)
      await page.goto(`${locale === 'en' ? '' : '/zh-CN'}/explore/price-predictions`)
      const board = page.locator('[data-price-predictions-board]')
      await expect(board).toHaveAttribute('data-price-change-status', status)
      await expect(board).toHaveAttribute('data-price-change-revision', `state-${status}`)
      await expect(board).toHaveAttribute('data-price-change-refreshing', 'false')
      const expected = status === 'PARTIAL' ? t.statusPartial : status === 'STALE' ? t.statusStale : status === 'UNAVAILABLE' ? t.statusUnavailable : null
      for (const text of [t.statusPartial, t.statusStale, t.statusUnavailable]) {
       if (text === expected) await expect(board.getByText(text, { exact: true })).toBeVisible()
       else await expect(board.getByText(text, { exact: true })).toHaveCount(0)
      }
      if (status === 'UNAVAILABLE') await expect(board.getByText('Saka', { exact: true })).toHaveCount(0)
      else await expect(board.getByRole('link', { name: 'Saka', exact: true })).toBeVisible()
      await testInfo.attach('PRED03-state', { contentType: 'application/json', body: JSON.stringify({ locale, width, status, revision: `state-${status}`, expected, performanceStatus: 'NOT_RUN', readyMs: null }) })
     } finally {
      await fetch(`${fixture}/__performance`, { method: 'POST', body: JSON.stringify({ rules: [] }) })
     }
    })
   }
  }
 }
})

test.describe('SSR remediation PRED03 cached board', () => {
 test.describe.configure({ mode: 'serial' })
 for (const cacheState of ['valid', 'expired', 'malformed'] as const) {
  for (const locale of ['en', 'zh-CN']) {
   for (const width of [1440, 390]) {
    test(`${cacheState} ${locale} ${width}`, async ({ page }, testInfo) => {
     test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.E2E_MARKET_READINESS !== '1', 'Requires isolated standalone price cache')
     const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}`
     const seed = await (await fetch(`${fixture}/graphql`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: 'query GetPriceChangeBoard { priceChangeBoard { revision } }' }) })).json()
     const cached = { ...seed.data.priceChangeBoard, revision: 'cached-price-proof', fetchedAt: new Date().toISOString() }
     const unavailable = { ...seed.data.priceChangeBoard, status: 'UNAVAILABLE', revision: 'offline-price-proof', players: [], observedPlayerCount: 0 }
     await page.setViewportSize({ width, height: 900 })
     await page.addInitScript(({ cached, cacheState }) => {
      const savedAt = Date.now() - (cacheState === 'expired' ? 3_601_000 : 30_000)
      localStorage.setItem('letletme:price-change-board:v2', cacheState === 'malformed' ? '{broken' : JSON.stringify({ savedAt, board: cached }))
     }, { cached, cacheState })
     try {
      expect((await fetch(`${fixture}/__performance`, { method: 'POST', body: JSON.stringify({ rules: [{ operation: 'GetPriceChangeBoard', data: { priceChangeBoard: unavailable } }] }) })).ok).toBe(true)
      await page.goto(`${locale === 'en' ? '' : '/zh-CN'}/explore/price-predictions`)
      const board = page.locator('[data-price-predictions-board]')
      const valid = cacheState === 'valid'
      const t = (locale === 'en' ? enMessages : zhMessages).PriceChanges
      await expect(board).toHaveAttribute('data-price-change-status', valid ? 'STALE' : 'UNAVAILABLE')
      await expect(board).toHaveAttribute('data-price-change-revision', valid ? 'cached-price-proof' : 'offline-price-proof')
      await expect(board).toHaveAttribute('data-price-change-refreshing', 'false')
      await expect(board.getByText(valid ? t.statusStale : t.statusUnavailable, { exact: true })).toBeVisible()
      if (valid) await expect(board.getByRole('link', { name: 'Saka', exact: true })).toBeVisible()
      else await expect(board.getByText('Saka', { exact: true })).toHaveCount(0)
      if (cacheState === 'expired') expect(await page.evaluate(() => localStorage.getItem('letletme:price-change-board:v2'))).toBeNull()
      await testInfo.attach('PRED03-cache', { contentType: 'application/json', body: JSON.stringify({ cacheState, locale, width, status: valid ? 'STALE' : 'UNAVAILABLE', readyMs: null, performanceStatus: 'NOT_RUN' }) })
     } finally {
      await fetch(`${fixture}/__performance`, { method: 'POST', body: JSON.stringify({ rules: [] }) })
     }
    })
   }
  }
 }
})
