import { expect, test } from '@playwright/test'
import type { LiveMatchdayResponse } from '../lib/graphql/operations/live'

test.describe('match detail missing statistics', () => {
 test.describe.configure({ mode: 'serial' })
 for (const locale of ['en', 'zh-CN']) for (const outcome of ['success', 'failure']) {
  test(`${locale} delayed ${outcome} preserves unknown versus zero`, async ({ page }) => {
   test.skip(process.env.E2E_SSR_REMEDIATION !== '1' || Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Isolated fixture controls only')
   const zh = locale === 'zh-CN'
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
   await page.route('**/api/graphql', async route => {
    const { query, variables } = route.request().postDataJSON()
    const live = /query PlayerLive\(/.test(query)
    const explain = /query EventLiveExplainPlayer\(/.test(query)
    if (!live && !explain) return route.continue()
    expect(variables.eventId).toBe(33)
    expect(variables.playerId ?? variables.elementId).toBe(257)
    requested.push(live ? 'live' : 'explain')
    await gate
    if (outcome === 'failure') return route.fulfill({ status: 503, json: { errors: [{ message: 'isolated detail failure' }] } })
    return route.fulfill({ json: { data: live ? { playerLive: { minutes: 90, goalsScored: 0, assists: 1, cleanSheets: 0, goalsConceded: 1, defensiveContribution: 8, saves: 0, penaltiesSaved: 0, ownGoals: 0, penaltiesMissed: 0, yellowCards: 0, redCards: 0, totalPoints: 6, bps: 26, bonus: 1 } } : { eventLiveExplain: null } } })
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
    release()
    await expect(dialog.getByText(zh ? '正在加载积分明细…' : 'Loading breakdown…', { exact: true })).toHaveCount(0)
    await expect(stat(zh ? '失球' : 'Goals Conceded')).toContainText(outcome === 'success' ? '1' : '—')
    await expect(stat(zh ? '防守贡献' : 'Defensive Contribution')).toContainText(outcome === 'success' ? '8' : '—')
    await dialog.getByRole('button', { name: zh ? '关闭' : 'Close', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
   } finally { release(); await control([]) }
  })
 }
})
