import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	normalizeMetricPage,
	parseWebVitalPayload
} from '../lib/analytics/web-vitals'

const validMetric = {
	name: 'LCP',
	value: 2100.5,
	delta: 2100.5,
	rating: 'good',
	metricId: 'metric-123.abc',
	page: '/live/tournaments/987?token=secret',
	device: 'mobile',
	audienceHint: 'public'
}

describe('privacy-safe web vitals', () => {
	it('removes query strings and dynamic identifiers from page groups', () => {
		assert.equal(
			normalizeMetricPage('/live/tournaments/987?token=secret'),
			'/live/tournaments/:tournamentId'
		)
		assert.equal(
			normalizeMetricPage('/tournament/54/manage'),
			'/tournament/:tournamentId/manage'
		)
		assert.equal(
			normalizeMetricPage('/zh-CN/live/points/123456'),
			'/live/points/:entryId'
		)
		assert.equal(
			normalizeMetricPage('/en/tournament/54/manage'),
			'/tournament/:tournamentId/manage'
		)
	})

	it('accepts a bounded core web vital without adding user identity', () => {
		assert.deepEqual(parseWebVitalPayload(validMetric), {
			...validMetric,
			page: '/live/tournaments/:tournamentId'
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
				page: '/live/tournaments/:tournamentId',
				audienceHint: 'session-hint'
			}
		)
	})

	it('accepts route-ready milestones without entity identifiers', () => {
		for (const name of [
			'MARKET_CONTENT_READY',
			'PLAYER_DIRECTORY_READY',
			'PLAYER_DETAIL_READY',
			'SESSION_STATE_READY'
		]) {
			assert.equal(
				parseWebVitalPayload({
					...validMetric,
					name,
					metricId: `ready-${name.toLowerCase()}`,
					page: '/data/player-stats?p1=42'
				})?.page,
				'/data/player-stats'
			)
		}
	})

	it('maps older clients without the hint to unknown during rollout', () => {
		const { audienceHint: _audienceHint, ...legacyMetric } = validMetric
		assert.equal(parseWebVitalPayload(legacyMetric)?.audienceHint, 'unknown')
	})
})
