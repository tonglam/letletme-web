import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

import {
	normalizeMetricPage,
	parseWebVitalPayload
} from '../lib/analytics/web-vitals'
import { isTrustedSameSiteRequest } from '../lib/request-origin'

const validMetric = {
	name: 'LCP',
	value: 2100.5,
	delta: 2100.5,
	rating: 'good',
	metricId: 'metric-123.abc',
	page: '/live/competitions/987?token=secret',
	device: 'mobile',
	audienceHint: 'public'
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
		assert.match(
			playerStatsSource,
			/const playerDetailReadyKey = firstSelectedPlayerId \?\? ''/
		)
		assert.match(playerStatsSource, /Boolean\(secondPlayer\.playerDetail\)/)
		assert.match(
			playerStatsSource,
			/markRouteReadyStart\(window\.location\.pathname\)/
		)
	})

	it('maps older clients without the hint to unknown during rollout', () => {
		const { audienceHint: _audienceHint, ...legacyMetric } = validMetric
		assert.equal(parseWebVitalPayload(legacyMetric)?.audienceHint, 'unknown')
	})
})
