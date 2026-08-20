import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	buildGraphQLProxyIngress,
	graphQLWorkloadForDocument,
	validateMiniProgramDeviceId
} from '../lib/graphql-ingress'

const decode = (headers: Record<string, string>) =>
	JSON.parse(
		Buffer.from(headers['X-Ingress-Context']!, 'base64url').toString('utf8')
	) as Record<string, unknown>

describe('GraphQL ingress v2', () => {
	it('validates and HMACs a Mini device without forwarding the raw ID', () => {
		const rawDeviceId = 'mini-device-12345678'
		const headers = new Headers({
			host: 'preview.vercel.app',
			'x-vercel-id': 'iad1::request',
			'x-vercel-forwarded-for': '203.0.113.7',
			'x-letletme-client': 'wechat-miniprogram',
			'x-letletme-device-id': rawDeviceId
		})
		const ingress = buildGraphQLProxyIngress({
			headers,
			secret: 'test-secret',
			workload: 'market'
		})
		assert.equal(ingress.ok, true)
		if (!ingress.ok) return
		const envelope = decode(ingress.headers)
		assert.deepEqual(
			{
				v: envelope.v,
				aud: envelope.aud,
				trafficClass: envelope.trafficClass,
				workload: envelope.workload
			},
			{
				v: 2,
				aud: 'letletme-graphql',
				trafficClass: 'mini',
				workload: 'market'
			}
		)
		assert.match(String(envelope.subject), /^[a-f0-9]{64}$/)
		assert.match(String(envelope.abuseSubject), /^[a-f0-9]{64}$/)
		assert.equal(JSON.stringify(ingress.headers).includes(rawDeviceId), false)
		assert.equal('X-Letletme-Device-Id' in ingress.headers, false)
	})

	it('rejects unsafe or missing Mini device IDs', () => {
		for (const deviceId of [null, 'short', 'unsafe/device']) {
			const headers = new Headers({
				'x-letletme-client': 'wechat-miniprogram'
			})
			if (deviceId) headers.set('x-letletme-device-id', deviceId)
			assert.deepEqual(
				buildGraphQLProxyIngress({
					headers,
					secret: 'test-secret',
					workload: 'market'
				}),
				{ ok: false, message: 'Invalid Mini Program device ID' }
			)
		}
		assert.equal(validateMiniProgramDeviceId('device_123'), 'device_123')
	})

	it('gives devices behind one NAT separate subjects and one abuse subject', () => {
		const envelopeFor = (deviceId: string) => {
			const ingress = buildGraphQLProxyIngress({
				headers: new Headers({
					host: 'preview.vercel.app',
					'x-vercel-id': 'iad1::request',
					'x-vercel-forwarded-for': '203.0.113.7',
					'x-letletme-client': 'wechat-miniprogram',
					'x-letletme-device-id': deviceId
				}),
				secret: 'test-secret',
				workload: 'fixtures'
			})
			assert.equal(ingress.ok, true)
			return decode(ingress.ok ? ingress.headers : {})
		}
		const devices = Array.from({ length: 100 }, (_, index) =>
			envelopeFor(`mini-device-${String(index).padStart(3, '0')}`)
		)
		assert.equal(new Set(devices.map(item => item.subject)).size, 100)
		assert.equal(new Set(devices.map(item => item.abuseSubject)).size, 1)
	})

	it('keeps old Mini clients on the signed v1 legacy path', () => {
		const ingress = buildGraphQLProxyIngress({
			headers: new Headers({ 'user-agent': 'MicroMessenger miniProgram' }),
			secret: 'test-secret',
			workload: 'market'
		})
		assert.equal(ingress.ok, true)
		if (!ingress.ok) return
		assert.equal(ingress.trafficClass, 'legacy')
		assert.deepEqual(Object.keys(decode(ingress.headers)).sort(), [
			'aud',
			'exp',
			'iat',
			'sub'
		])
	})

	it('does not treat an ordinary WeChat webview as a legacy Mini client', () => {
		const ingress = buildGraphQLProxyIngress({
			headers: new Headers({
				'user-agent':
					'Mozilla/5.0 MicroMessenger/8.0.50 NetType/WIFI Language/en'
			}),
			secret: 'test-secret',
			workload: 'market'
		})
		assert.equal(ingress.ok, true)
		if (!ingress.ok) return
		assert.equal(ingress.trafficClass, 'web_browser')
		assert.equal(decode(ingress.headers).trafficClass, 'web_browser')
	})

	it('derives workload from the selected root fields, not operation names', () => {
		assert.equal(
			graphQLWorkloadForDocument({
				operationName: 'GetFixtureWindow',
				query: 'query GetFixtureWindow { marketPulse(days: 7) { coverage } }'
			}),
			'market'
		)
		assert.equal(
			graphQLWorkloadForDocument({
				operationName: 'Chosen',
				query: `
					query Other { eventFixtures(eventId: 1) { id } }
					query Chosen { ...PlayerRoot }
					fragment PlayerRoot on Query { playerStatsDesk(playerIds: [1]) { state } }
				`
			}),
			'player-stats'
		)
		assert.equal(
			graphQLWorkloadForDocument({
				query: 'query Mixed { eventFixtures(eventId: 1) { id } marketPulse(days: 7) { coverage } }'
			}),
			'market'
		)
		assert.equal(
			graphQLWorkloadForDocument({
				query: 'query MetaMixed { marketPulse(days: 7) { coverage } __typename }'
			}),
			'market'
		)
		assert.equal(graphQLWorkloadForDocument({ query: 'not graphql' }), 'public-other')
	})

	it('keeps equivalent public live roots in the gameweek workload', () => {
		for (const field of [
			'liveContext',
			'liveMatchdayDesk',
			'liveFixturePlayers',
			'liveScores'
		]) {
			assert.equal(
				graphQLWorkloadForDocument({
					query: `query PublicLive { ${field} { __typename } }`
				}),
				'gameweek'
			)
		}
		assert.equal(
			graphQLWorkloadForDocument({
				query: 'query PersonalLive { myFplLivePoints { __typename } }'
			}),
			'interactive'
		)
	})
})
