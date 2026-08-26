import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

import {
	normalizeMetricPage,
	parseWebVitalPayload,
	resolveWebVitalSource
} from '../lib/analytics/web-vitals'
import { parseClientSignalBatch } from '../lib/client-signal-contract'
import { isTrustedSameSiteRequest } from '../lib/request-origin'

const validMetric = {
	name: 'LCP',
	value: 2100.5,
	delta: 2100.5,
	rating: 'good',
	metricId: 'metric-123.abc',
	page: '/live/competitions/987?token=secret',
	device: 'mobile',
	audienceHint: 'public',
	source: 'user'
}

describe('privacy-safe web vitals', () => {
	it('accepts public custom-domain beacons behind the Vercel origin', () => {
		assert.equal(
			isTrustedSameSiteRequest(
				new Request('https://letletme-web.vercel.app/api/vitals', {
					headers: {
						Origin: 'https://letletme.top',
						Referer: 'https://letletme.top/zh-CN/explore/fixtures',
						'Sec-Fetch-Site': 'cross-site'
					}
				})
			),
			true
		)
		assert.equal(
			isTrustedSameSiteRequest(
				new Request('https://letletme-web.vercel.app/api/vitals', {
					headers: {
						Origin: 'null',
						Referer: 'https://letletme.top/explore/fixtures'
					}
				})
			),
			true
		)
	})

	it('rejects malformed and untrusted browser origins', () => {
		const untrustedHeaders: Array<Record<string, string>> = [
			{ Origin: 'https://evil.example' },
			{ Origin: 'not-an-origin' },
			{
				Origin: 'https://letletme.top',
				Referer: 'https://evil.example/fixtures'
			},
			{
				Origin: 'https://letletme.top',
				Referer: 'not-a-referer'
			},
			{ 'Sec-Fetch-Site': 'cross-site' },
			{ Origin: 'null' }
		]
		for (const headers of untrustedHeaders) {
			assert.equal(
				isTrustedSameSiteRequest(
					new Request('https://letletme-web.vercel.app/api/vitals', {
						headers
					})
				),
				false
			)
		}
	})

	it('removes query strings and dynamic identifiers from page groups', () => {
		assert.equal(
			normalizeMetricPage('/live/competitions/987?token=secret'),
			'/live/competitions/:tournamentId'
		)
		assert.equal(
			normalizeMetricPage('/competitions/54/manage'),
			'/competitions/:tournamentId/manage'
		)
		assert.equal(
			normalizeMetricPage('/zh-CN/live/points/123456'),
			'/live/points/:entryId'
		)
		assert.equal(
			normalizeMetricPage('/en/competitions/54/manage'),
			'/competitions/:tournamentId/manage'
		)
	})

	it('accepts a bounded core web vital without adding user identity', () => {
		assert.deepEqual(parseWebVitalPayload(validMetric), {
			...validMetric,
			page: '/live/competitions/:tournamentId'
		})
	})

	it('classifies explicit and legacy synthetic measurement contexts', () => {
		assert.equal(
			resolveWebVitalSource({ search: '?_perfSource=synthetic' }),
			'synthetic'
		)
		assert.equal(
			resolveWebVitalSource({ search: '?_marketPerf=mobile-1' }),
			'synthetic'
		)
		assert.equal(
			resolveWebVitalSource({ search: '?cold=mobile-1' }),
			'synthetic'
		)
		assert.equal(resolveWebVitalSource({ webdriver: true }), 'synthetic')
		assert.equal(resolveWebVitalSource({ search: '?utm_source=home' }), 'user')
	})

	it('rejects unknown metrics, invalid numbers, and identifiers', () => {
		assert.equal(parseWebVitalPayload({ ...validMetric, name: 'CUSTOM' }), null)
		assert.equal(
			parseWebVitalPayload({ ...validMetric, value: Number.POSITIVE_INFINITY }),
			null
		)
		assert.equal(
			parseWebVitalPayload({ ...validMetric, metricId: 'contains spaces' }),
			null
		)
		assert.equal(
			parseWebVitalPayload({
				...validMetric,
				audienceHint: 'signed-in-user-42'
			}),
			null
		)
	})

	it('accepts the anonymous personal hydration milestone', () => {
		assert.deepEqual(
			parseWebVitalPayload({
				...validMetric,
				name: 'HOME_PERSONAL_HYDRATED',
				metricId: 'home-personal-123',
				audienceHint: 'session-hint'
			}),
			{
				...validMetric,
				name: 'HOME_PERSONAL_HYDRATED',
				metricId: 'home-personal-123',
				page: '/live/competitions/:tournamentId',
				audienceHint: 'session-hint'
			}
		)
	})

	it('accepts route-ready milestones without entity identifiers', () => {
		for (const name of [
			'FIXTURES_WINDOW_READY',
			'HOME_TEAM_DESK_READY',
			'HOME_LEAGUE_RANKS_READY',
			'MARKET_CONTENT_READY',
			'PLAYER_DIRECTORY_READY',
			'PLAYER_DETAIL_READY',
			'PLAYER_COMPARE_READY',
			'SESSION_STATE_READY'
		]) {
			assert.equal(
				parseWebVitalPayload({
					...validMetric,
					name,
					metricId: `ready-${name.toLowerCase()}`,
					page: '/explore/player-stats?p1=42'
				})?.page,
				'/explore/player-stats'
			)
		}
	})

	it('keys primary and comparison readiness independently across same-route transitions', async () => {
		const [markerSource, playerStatsSource] = await Promise.all([
			readFile(
				new URL(
					'../components/analytics/RouteReadyMarker.tsx',
					import.meta.url
				),
				'utf8'
			),
			readFile(
				new URL(
					'../app/data/player-stats/PlayerStatsClient.tsx',
					import.meta.url
				),
				'utf8'
			)
		])

		assert.match(markerSource, /reportedIdentity\.current === readyIdentity/)
		assert.match(playerStatsSource, /readyKey=\{playerDetailReadyKey\}/)
		assert.match(playerStatsSource, /readyKey=\{playerCompareReadyKey\}/)
		assert.match(playerStatsSource, /const playerDetailReadyKey =/)
		assert.match(playerStatsSource, /Boolean\(secondPlayer\.playerDetail\)/)
		assert.match(
			playerStatsSource,
			/markRouteReadyStart\(\s*window\.location\.pathname,\s*startedAt,\s*detail\.readyKey/
		)
		assert.match(playerStatsSource, /void loadPlayerStatsView\(\)/)
		assert.match(playerStatsSource, /PLAYER_DIRECTORY_PAINT/)
		assert.match(playerStatsSource, /PLAYER_DETAIL_PAINT/)
		assert.match(playerStatsSource, /PLAYER_COMPARE_PAINT/)
	})

	it('maps older clients without the hint to unknown during rollout', () => {
		const { audienceHint: _audienceHint, ...legacyMetric } = validMetric
		assert.equal(parseWebVitalPayload(legacyMetric)?.audienceHint, 'unknown')
		assert.equal(parseWebVitalPayload(legacyMetric)?.source, 'user')
	})

	it('maps older clients without a source marker to unknown', () => {
		const { source: _source, ...legacyMetric } = validMetric
		assert.equal(parseWebVitalPayload(legacyMetric)?.source, 'unknown')
	})

	it('accepts bounded player correlation metadata and cache status', () => {
		assert.deepEqual(
			parseWebVitalPayload({
				...validMetric,
				name: 'PLAYER_DESK_RESPONSE',
				navigationId: 'nav-12345678',
				interactionId: 'interaction-12345678',
				cacheStatus: 'stale'
			}),
			{
				...validMetric,
				name: 'PLAYER_DESK_RESPONSE',
				page: '/live/competitions/:tournamentId',
				navigationId: 'nav-12345678',
				interactionId: 'interaction-12345678',
				cacheStatus: 'stale'
			}
		)
	})

	it('rejects unsafe or oversized correlation metadata', () => {
		assert.equal(
			parseWebVitalPayload({ ...validMetric, navigationId: 'player-13' }),
			null
		)
		assert.equal(
			parseWebVitalPayload({
				...validMetric,
				interactionId: 'x'.repeat(65)
			}),
			null
		)
		assert.equal(
			parseWebVitalPayload({ ...validMetric, cacheStatus: 'origin-secret' }),
			null
		)
	})

	it('accepts only the fixed anonymous client signal contract', () => {
		const now = Date.parse('2026-08-27T00:00:00.000Z')
		const batch = {
			schemaVersion: 1,
			batchId: '2b37a101-8f28-47ce-8c83-d5749a2f3ce7',
			client: 'web',
			release: 'web-sha',
			sentAt: '2026-08-27T00:00:00.000Z',
			samples: [
				{
					observedAt: '2026-08-26T23:59:00.000Z',
					surface: 'live_matches',
					metric: 'graphql_proxy_ms',
					deviceGroup: 'mobile',
					sampleSource: 'real',
					result: 'ok',
					value: 250
				}
			]
		}
		assert.deepEqual(parseClientSignalBatch(batch, now), batch)
		assert.equal(
			parseClientSignalBatch(
				{ ...batch, samples: [{ ...batch.samples[0], error: 'secret' }] },
				now
			),
			null
		)
		assert.equal(
			parseClientSignalBatch({ ...batch, batchId: 'not-a-uuid' }, now),
			null
		)
	})

	it('does not accept runtime error text or identity fields', async () => {
		const { parseClientRuntimePayload } =
			await import('../lib/analytics/web-vitals')
		assert.deepEqual(
			parseClientRuntimePayload({
				kind: 'runtime_error',
				page: '/live/matches',
				device: 'desktop',
				source: 'user'
			}),
			{
				page: '/live/matches',
				device: 'desktop',
				source: 'user'
			}
		)
		assert.equal(
			parseClientRuntimePayload({
				kind: 'runtime_error',
				page: '/live/matches',
				device: 'desktop',
				source: 'user',
				message: 'secret stack'
			}),
			null
		)
	})

	it('exposes fixed SSR contract markers for live and price surfaces', async () => {
		const [live, price] = await Promise.all([
			readFile(
				new URL('../app/[locale]/live/matches/page.tsx', import.meta.url),
				'utf8'
			),
			readFile(
				new URL(
					'../app/[locale]/explore/price-changes/page.tsx',
					import.meta.url
				),
				'utf8'
			)
		])
		for (const source of [live, price]) {
			assert.match(source, /data-letletme-contract=/)
			assert.match(source, /data-status=/)
			assert.match(source, /data-revision=/)
			assert.match(source, /data-expected=/)
			assert.match(source, /data-observed=/)
		}
		assert.match(live, /data-letletme-contract="live_matches"/)
		assert.match(price, /data-letletme-contract="price_changes"/)
	})
})
