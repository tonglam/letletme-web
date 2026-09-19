import { expect, test } from '@playwright/test'
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
     if (outcome === 'shared') expect(await page.evaluate(() => document.documentElement.dataset.fixtureCopiedText)).toBeUndefined()
    } else {
     await expect(fallback).toBeVisible()
     if (outcome === 'cancelled') {
      expect(await page.evaluate(() => document.documentElement.dataset.fixtureCopiedText)).toBeUndefined()
      await expect(share).not.toContainText(zh ? '已分享' : 'Done')
     }
     await expect(fallback).toHaveValue(/\/explore\/market/)
     await expect(fallback).toHaveAttribute('readonly', '')
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
   await imageShare.click()
   await expect(imageShare).toContainText(zh ? '已分享' : 'Done', { timeout: 15000 })
   const png = await page.evaluate(() => JSON.parse(document.documentElement.dataset.fixturePng ?? '{}'))
   expect(png.type).toBe('image/png')
   expect(png.size).toBeGreaterThan(0)
   expect(png.width).toBeGreaterThan(0)
   expect(png.height).toBeGreaterThan(0)
   } finally {
    await fetch(`${fixture}/__performance`, { method: 'POST', body: JSON.stringify({ rules: [] }) })
   }
  })
 }
}
