import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { publicGraphQLCacheResult } from '../lib/graphql-public-cache'

describe('public GraphQL cache observability', () => {
	it('counts force-cache and positive revalidation as cache eligible', () => {
		assert.equal(publicGraphQLCacheResult({ cache: 'force-cache' }), 'eligible')
		assert.equal(
			publicGraphQLCacheResult({ next: { revalidate: 60 } }),
			'eligible'
		)
		assert.equal(
			publicGraphQLCacheResult({ next: { revalidate: false } }),
			'eligible'
		)
	})

	it('keeps no-store and non-positive revalidation on the bypass path', () => {
		assert.equal(
			publicGraphQLCacheResult({
				cache: 'no-store',
				next: { revalidate: 60 }
			}),
			'bypass'
		)
		assert.equal(
			publicGraphQLCacheResult({ next: { revalidate: 0 } }),
			'bypass'
		)
	})
})
