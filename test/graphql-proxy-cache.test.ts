import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	extractGraphQLOperationName,
	isPublicCacheableGraphQLRequest,
	PUBLIC_PROXY_CACHE_CONTROL,
} from '../lib/cache-policy'
import { resolveGraphQLProxyCacheControl } from '../lib/graphql-proxy-cache'

describe('GraphQL proxy public cache policy', () => {
	it('extracts operationName from the body field', () => {
		assert.equal(
			extractGraphQLOperationName({
				operationName: 'GetMarketPulse',
				query: 'query GetMarketPulse { marketPulse { asOf } }',
			}),
			'GetMarketPulse',
		)
	})

	it('extracts the name from the query string when operationName is absent', () => {
		assert.equal(
			extractGraphQLOperationName({
				query: 'query GetEventFixtures($eventId: Int!) { eventFixtures(eventId: $eventId) { id } }',
			}),
			'GetEventFixtures',
		)
	})

	it('allows CDN cache only for allowlisted public operations without session/auth', () => {
		assert.equal(
			isPublicCacheableGraphQLRequest({
				body: { operationName: 'GetMarketPulse', query: 'query GetMarketPulse { __typename }' },
				hasSessionUser: false,
				hasAuthorization: false,
			}),
			true,
		)
		assert.equal(
			isPublicCacheableGraphQLRequest({
				body: { operationName: 'GetMarketPulse', query: 'query GetMarketPulse { __typename }' },
				hasSessionUser: true,
				hasAuthorization: false,
			}),
			false,
		)
		assert.equal(
			isPublicCacheableGraphQLRequest({
				body: {
					operationName: 'GetEntryTournaments',
					query: 'query GetEntryTournaments { __typename }',
				},
				hasSessionUser: false,
				hasAuthorization: false,
			}),
			false,
		)
	})

	it('sets Cache-Control on successful public responses only', () => {
		const body = { operationName: 'GetCurrentAndNextEvents', query: 'query GetCurrentAndNextEvents { __typename }' }
		assert.equal(
			resolveGraphQLProxyCacheControl({
				body,
				hasSessionUser: false,
				hasAuthorization: false,
				responseOk: true,
			}),
			PUBLIC_PROXY_CACHE_CONTROL,
		)
		assert.equal(
			resolveGraphQLProxyCacheControl({
				body,
				hasSessionUser: false,
				hasAuthorization: false,
				responseOk: false,
			}),
			'no-store',
		)
	})
})
