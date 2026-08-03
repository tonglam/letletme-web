import assert from 'node:assert/strict'
import test from 'node:test'

import {
	getGraphQLServiceTokenHeaders,
	GRAPHQL_SERVICE_TOKEN_HEADER,
} from '@/lib/graphql-service-token'

test('adds the service token only to trusted server-side requests', () => {
	const token = 's'.repeat(43)
	assert.deepEqual(
		getGraphQLServiceTokenHeaders({
			NODE_ENV: 'production',
			GRAPHQL_SERVICE_TOKEN: token,
		}),
		{ [GRAPHQL_SERVICE_TOKEN_HEADER]: token },
	)
})

test('requires a sufficiently long service token in production', () => {
	assert.throws(
		() => getGraphQLServiceTokenHeaders({ NODE_ENV: 'production' }),
		/GRAPHQL_SERVICE_TOKEN is required/,
	)
	assert.throws(
		() =>
			getGraphQLServiceTokenHeaders({
				NODE_ENV: 'production',
				GRAPHQL_SERVICE_TOKEN: 'short',
			}),
		/at least 32 bytes/,
	)
})
