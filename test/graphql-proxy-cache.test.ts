import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	extractGraphQLOperationName,
	isPublicCacheableGraphQLRequest,
	PUBLIC_PROXY_CACHE_CONTROL,
	PRICE_CHANGE_PROXY_CACHE_CONTROL
} from '../lib/cache-policy'
import {
	isSuccessfulGraphQLResponseBody,
	resolveGraphQLProxyCacheControl
} from '../lib/graphql-proxy-cache'

describe('GraphQL proxy public cache policy', () => {
	it('extracts operationName from the body field', () => {
		assert.equal(
			extractGraphQLOperationName({
				operationName: 'GetMarketPulse',
				query: 'query GetMarketPulse { marketPulse { asOf } }'
			}),
			'GetMarketPulse'
		)
	})

	it('extracts the name from the query string when operationName is absent', () => {
		assert.equal(
			extractGraphQLOperationName({
				query:
					'query GetEventFixtures($eventId: Int!) { eventFixtures(eventId: $eventId) { id } }'
			}),
			'GetEventFixtures'
		)
	})

	it('allows CDN cache only for allowlisted public operations without session/auth', () => {
		assert.equal(
			isPublicCacheableGraphQLRequest({
				body: {
					operationName: 'GetMarketPulse',
					query: 'query GetMarketPulse { __typename }'
				},
				hasSessionUser: false,
				hasAuthorization: false
			}),
			true
		)
		assert.equal(
			isPublicCacheableGraphQLRequest({
				body: {
					operationName: 'GetMarketPulse',
					query: 'query GetMarketPulse { __typename }'
				},
				hasSessionUser: true,
				hasAuthorization: false
			}),
			false
		)
		assert.equal(
			isPublicCacheableGraphQLRequest({
				body: {
					operationName: 'GetEntryTournaments',
					query: 'query GetEntryTournaments { __typename }'
				},
				hasSessionUser: false,
				hasAuthorization: false
			}),
			false
		)
		assert.equal(
			isPublicCacheableGraphQLRequest({
				body: {
					operationName: 'SearchEntries',
					query:
						'query SearchEntries($query: String!) { searchEntries(query: $query) { id } }'
				},
				hasSessionUser: false,
				hasAuthorization: false
			}),
			true
		)
	})

	it('sets Cache-Control on successful public responses only', () => {
		const body = {
			operationName: 'GetCurrentAndNextEvents',
			query: 'query GetCurrentAndNextEvents { __typename }'
		}
		assert.equal(
			resolveGraphQLProxyCacheControl({
				body,
				hasSessionUser: false,
				hasAuthorization: false,
				responseOk: true,
				responseBodyOk: true
			}),
			PUBLIC_PROXY_CACHE_CONTROL
		)
		assert.equal(
			resolveGraphQLProxyCacheControl({
				body,
				hasSessionUser: false,
				hasAuthorization: false,
				responseOk: false,
				responseBodyOk: true
			}),
			'no-store'
		)
	})

	it('uses the shorter 60/60 policy for the price-change board only', () => {
		assert.equal(
			resolveGraphQLProxyCacheControl({
				body: {
					operationName: 'GetPriceChangeBoard',
					query: 'query GetPriceChangeBoard { priceChangeBoard { status } }'
				},
				hasSessionUser: false,
				hasAuthorization: false,
				responseOk: true,
				responseBodyOk: true
			}),
			PRICE_CHANGE_PROXY_CACHE_CONTROL
		)
	})

	it('rejects HTTP-200 GraphQL error envelopes and malformed bodies', () => {
		assert.equal(
			isSuccessfulGraphQLResponseBody('{"data":{"events":[]}}'),
			true
		)
		assert.equal(
			isSuccessfulGraphQLResponseBody(
				'{"data":null,"errors":[{"message":"resolver failed"}]}'
			),
			false
		)
		assert.equal(isSuccessfulGraphQLResponseBody('not-json'), false)

		assert.equal(
			resolveGraphQLProxyCacheControl({
				body: {
					operationName: 'GetCurrentAndNextEvents',
					query: 'query GetCurrentAndNextEvents { __typename }'
				},
				hasSessionUser: false,
				hasAuthorization: false,
				responseOk: true,
				responseBodyOk: false
			}),
			'no-store'
		)
	})
})
