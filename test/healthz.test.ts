import assert from 'node:assert/strict'
import test from 'node:test'

import { GET } from '../app/healthz/route'

test('healthz reports the self-hosted origin and release without caching', async () => {
	const previousOrigin = process.env.LETLETME_ORIGIN
	const previousRelease = process.env.LETLETME_RELEASE_SHA
	process.env.LETLETME_ORIGIN = 'tencent'
	process.env.LETLETME_RELEASE_SHA = 'abc1234'
	try {
		const response = await GET()
		assert.equal(response.status, 200)
		assert.equal(response.headers.get('cache-control'), 'no-store')
		assert.equal(response.headers.get('x-letletme-origin'), 'tencent')
		assert.equal(response.headers.get('x-letletme-release'), 'abc1234')
		assert.deepEqual(await response.json(), {
			status: 'ok',
			origin: 'tencent',
			release: 'abc1234'
		})
	} finally {
		if (previousOrigin === undefined) delete process.env.LETLETME_ORIGIN
		else process.env.LETLETME_ORIGIN = previousOrigin
		if (previousRelease === undefined) delete process.env.LETLETME_RELEASE_SHA
		else process.env.LETLETME_RELEASE_SHA = previousRelease
	}
})
