import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	markPrivateNoStore,
	PRIVATE_NO_STORE_CACHE_CONTROL,
} from '../lib/private-no-store'

describe('mutation response cache policy', () => {
	it('forces private no-store without disturbing other headers', () => {
		const response = new Response('ok', {
			status: 429,
			headers: {
				'Retry-After': '60',
				'X-Request-Id': 'request-1',
			},
		})
		markPrivateNoStore(response)
		assert.equal(response.headers.get('Cache-Control'), PRIVATE_NO_STORE_CACHE_CONTROL)
		assert.equal(response.headers.get('Retry-After'), '60')
		assert.equal(response.headers.get('X-Request-Id'), 'request-1')
	})
})
