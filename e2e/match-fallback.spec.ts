import { expect, test } from '@playwright/test'
import type { LiveMatchdayResponse } from '../lib/graphql/operations/live'

test.describe('SSR remediation MATCH04 fallback publication', () => {
 test.describe.configure({ mode: 'serial' })
 for (const locale of ['en', 'zh-CN']) {
  for (const width of [1440, 390]) {
   for (const scenario of ['current', 'advance', 'unavailable', 'corroborated'] as const) {
    test(`${scenario} ${locale} ${width}px`, async ({ page }) => {
     test.skip(process.env.E2E_SSR_REMEDIATION !== '1', 'Requires isolated serial fixture controls')
     const fixture = `http://127.0.0.1:${process.env.E2E_GRAPHQL_PORT ?? '4100'}/__performance`
     const control = async (rules: unknown[]) => expect((await fetch(fixture, { method: 'POST', body: JSON.stringify({ rules }) })).ok).toBe(true)
     await control([])
     const response = await fetch(fixture.replace('/__performance', '/graphql'), {
      method: 'POST', headers: { 'content-type': 'application/json', 'X-LetLetMe-Contract': 'live-matches-v3' },
      body: JSON.stringify({ query: 'query GetLiveMatchdayV3 { __typename }', variables: { eventId: null } })
     })
     expect(response.ok).toBe(true)
     const current = (await response.json()).data as LiveMatchdayResponse
     expect(current.liveMatchday.snapshot?.eventId).toBe(33)
     const initial = structuredClone(current)
     const snapshot = initial.liveMatchday.snapshot!
     const oldEvent = scenario === 'advance' || scenario === 'unavailable'
     if (scenario !== 'current') {
      initial.liveMatchday.delivery = { state: 'STALE', servedFrom: 'REDIS_PREVIOUS', reasonCodes: ['ISOLATED_FALLBACK'] }
     }
     if (oldEvent) {
      snapshot.eventId = 32
      snapshot.revisions.scoreState = 'old-gw32-score'
      snapshot.matches.forEach(match => { match.eventId = 32; match.homeTeamName = 'Old GW32 Team' })
     }
     const explicit = scenario === 'unavailable'
      ? { liveMatchday: { availability: 'UNAVAILABLE', delivery: { state: 'UNAVAILABLE', servedFrom: null, reasonCodes: ['DESK_UNAVAILABLE'] }, snapshot: null } }
      : current
     const ready: string[] = []
     await page.route('**/api/vitals', async route => {
      for (const sample of route.request().postDataJSON().samples ?? []) if (sample.metricName === 'LIVE_MATCHDAY_READY') ready.push(sample.metricName)
      await route.fulfill({ status: 204 })
     })
     try {
      await control([
       { operation: 'GetLiveMatchdayV3', variables: { eventId: null }, data: initial },
       { operation: 'GetLiveMatchdayV3', variables: { eventId: 33 }, data: explicit }
      ])
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`${locale === 'en' ? '' : '/zh-CN'}/live/matches`)
      const marker = page.locator('[data-letletme-contract="live_matches"]')
      await expect(marker).toHaveAttribute('data-status', scenario === 'unavailable' ? 'UNAVAILABLE' : scenario === 'corroborated' ? 'STALE' : 'READY')
      await expect(marker).toHaveAttribute('data-revision', scenario === 'unavailable' ? 'unavailable' : current.liveMatchday.snapshot!.revisions.scoreState)
      await expect(page.getByText('Old GW32 Team', { exact: true })).toHaveCount(0)
      if (scenario !== 'unavailable') {
       await expect.poll(() => ready.length).toBeGreaterThan(0)
       await expect(page.getByText(current.liveMatchday.snapshot!.matches[0].homeTeamName, { exact: true }).first()).toBeVisible()
      }
      const observed = await (await fetch(fixture)).json() as { requests: { operation: string; variables: Record<string, unknown> }[] }
      const reads = observed.requests.filter(r => r.operation === 'GetLiveMatchdayV3' || r.operation === 'GetLiveContext')
      expect(reads.map(r => ({ operation: r.operation, eventId: r.variables.eventId ?? null }))).toEqual([
       { operation: 'GetLiveMatchdayV3', eventId: null },
       ...(scenario === 'current' ? [] : [{ operation: 'GetLiveContext', eventId: null }]),
       ...(oldEvent ? [{ operation: 'GetLiveMatchdayV3', eventId: 33 }] : [])
      ])
     } finally { await control([]) }
    })
   }
  }
 }
})
