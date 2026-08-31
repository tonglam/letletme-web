import assert from 'node:assert/strict'
import test from 'node:test'

import {
	PRODUCTION_GRAPHQL_SELECTOR_ENDPOINT,
	isFixedGraphQLSlotEndpoint,
	resolveServerGraphQLEndpoint
} from '@/lib/graphql-endpoint'

test('routes production defaults and fixed blue/green ports through the active selector', () => {
	assert.equal(
		resolveServerGraphQLEndpoint({ NODE_ENV: 'production' }),
		PRODUCTION_GRAPHQL_SELECTOR_ENDPOINT
	)
	for (const endpoint of [
		'http://localhost:4000/graphql',
		'http://127.0.0.1:4002/graphql',
		'http://graphql-blue:4000/graphql'
	]) {
		assert.equal(isFixedGraphQLSlotEndpoint(endpoint), true)
		assert.equal(
			resolveServerGraphQLEndpoint({
				NODE_ENV: 'production',
				GRAPHQL_ENDPOINT: endpoint
			}),
			PRODUCTION_GRAPHQL_SELECTOR_ENDPOINT
		)
	}
})

test('preserves explicit stable endpoints and the local development default', () => {
	assert.equal(
		resolveServerGraphQLEndpoint({
			NODE_ENV: 'production',
			GRAPHQL_ENDPOINT: 'http://graphql-active.internal/graphql'
		}),
		'http://graphql-active.internal/graphql'
	)
	assert.equal(
		resolveServerGraphQLEndpoint({ NODE_ENV: 'development' }),
		'http://localhost:4000/graphql'
	)
})
