import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { appendServerTiming } from '../lib/server-timing'
import {
	cacheStatusFromHeaders,
	createPerformanceCorrelationId,
	parsePerformanceCorrelationId
} from '../lib/analytics/performance-correlation'

describe('performance correlation and server timing contracts', () => {
	it('appends timing segments without replacing existing values', () => {
		const headers = new Headers({ 'Server-Timing': 'upstream;dur=12' })
		appendServerTiming(headers, 'proxy', 23.456)
		assert.equal(
			headers.get('Server-Timing'),
			'upstream;dur=12, proxy;dur=23.46'
		)
	})

	it('keeps generated correlation IDs bounded and opaque', () => {
		const id = createPerformanceCorrelationId('interaction')
		assert.match(id, /^[A-Za-z0-9_-]{8,64}$/)
		assert.equal(parsePerformanceCorrelationId(id), id)
		assert.equal(parsePerformanceCorrelationId('player-13'), undefined)
		assert.equal(parsePerformanceCorrelationId('x'.repeat(65)), undefined)
	})

	it('normalizes provider cache headers to a fixed enum', () => {
		assert.equal(
			cacheStatusFromHeaders(new Headers({ 'x-vercel-cache': 'HIT' })),
			'hit'
		)
		assert.equal(
			cacheStatusFromHeaders(new Headers({ 'cf-cache-status': 'STALE' })),
			'stale'
		)
		assert.equal(
			cacheStatusFromHeaders(new Headers({ 'x-vercel-cache': 'DYNAMIC' })),
			'bypass'
		)
		assert.equal(cacheStatusFromHeaders(new Headers()), 'unknown')
	})
})
