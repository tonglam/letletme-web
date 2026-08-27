import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	createHomeFixturesRouteHandler,
	homeFixturesEtag,
	HOME_FIXTURES_NO_STORE,
	HOME_FIXTURES_LIVE_CACHE_CONTROL,
	HOME_FIXTURES_PUBLIC_CACHE_CONTROL,
	parseHomeFixtureEventId
} from '../lib/home-fixtures-route'
import type { HomeFixturesResponse } from '../lib/graphql/operations/home'

const fixtureWindow = (eventId = 34): HomeFixturesResponse => ({
	season: '2627',
	revision: 'core-revision-7',
	eventId,
	source: 'CORE',
	state: 'CORE',
	sourceCheckedAt: '2026-08-21T00:00:00.000Z',
	publishedAt: null,
	stale: false,
	fixtures: []
})

const quietLogger = {
	info: () => undefined,
	error: () => undefined
}

describe('Home fixtures route', () => {
	it('strictly validates one integer eventId at the GW boundaries', () => {
		assert.deepEqual(
			parseHomeFixtureEventId(new URLSearchParams('eventId=1')),
			{
				ok: true,
				eventId: 1
			}
		)
		assert.deepEqual(
			parseHomeFixtureEventId(new URLSearchParams('eventId=38')),
			{
				ok: true,
				eventId: 38
			}
		)
		for (const query of [
			'',
			'eventId=0',
			'eventId=39',
			'eventId=01',
			'eventId=1.5',
			'eventId=1&eventId=2'
		]) {
			assert.equal(
				parseHomeFixtureEventId(new URLSearchParams(query)).ok,
				false
			)
		}
	})

	it('caches successful and real BGW responses with a revision ETag', async () => {
		const payload = fixtureWindow()
		const handler = createHomeFixturesRouteHandler(
			async () => payload,
			quietLogger
		)
		const response = await handler(
			new Request('https://letletme.top/api/home/fixtures?eventId=34')
		)
		assert.equal(response.status, 200)
		assert.equal(
			response.headers.get('cache-control'),
			HOME_FIXTURES_PUBLIC_CACHE_CONTROL
		)
		assert.match(HOME_FIXTURES_PUBLIC_CACHE_CONTROL, /stale-if-error=86400/)
		assert.equal(response.headers.get('etag'), homeFixturesEtag(payload))
		assert.deepEqual(await response.json(), payload)
	})

	it('returns 304 for a matching ETag without loading user data', async () => {
		const payload = fixtureWindow()
		const handler = createHomeFixturesRouteHandler(
			async () => payload,
			quietLogger
		)
		const response = await handler(
			new Request('https://letletme.top/api/home/fixtures?eventId=34', {
				headers: { 'If-None-Match': homeFixturesEtag(payload) }
			})
		)
		assert.equal(response.status, 304)
		assert.equal(await response.text(), '')
	})

	it('returns uncacheable 400 and 502 responses', async () => {
		let calls = 0
		const handler = createHomeFixturesRouteHandler(async () => {
			calls += 1
			throw new Error('upstream failed')
		}, quietLogger)
		const invalid = await handler(
			new Request('https://letletme.top/api/home/fixtures?eventId=39')
		)
		assert.equal(invalid.status, 400)
		assert.equal(invalid.headers.get('cache-control'), HOME_FIXTURES_NO_STORE)
		assert.equal(calls, 0)

		const failed = await handler(
			new Request('https://letletme.top/api/home/fixtures?eventId=34')
		)
		assert.equal(failed.status, 502)
		assert.equal(failed.headers.get('cache-control'), HOME_FIXTURES_NO_STORE)
		assert.equal(calls, 1)
	})

	it('uses the short live cache and keeps live revision in the ETag', async () => {
		const payload: HomeFixturesResponse = {
			...fixtureWindow(3),
			source: 'LIVE',
			state: 'LIVE',
			revision: 'live-9',
			sourceCheckedAt: '2026-08-21T00:00:00.000Z',
			publishedAt: '2026-08-21T00:00:05.000Z',
			stale: false
		}
		const handler = createHomeFixturesRouteHandler(
			async () => payload,
			quietLogger
		)
		const response = await handler(
			new Request('https://letletme.top/api/home/fixtures?eventId=3')
		)
		assert.equal(
			response.headers.get('cache-control'),
			HOME_FIXTURES_LIVE_CACHE_CONTROL
		)
		assert.match(HOME_FIXTURES_LIVE_CACHE_CONTROL, /stale-if-error=300/)
		assert.equal(response.headers.get('etag'), homeFixturesEtag(payload))
	})
})
