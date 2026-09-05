import assert from 'node:assert/strict'
import test from 'node:test'

import { trustedAuthOrigins } from '../../lib/auth-origin'

test('Better Auth accepts the production Vercel origins for OAuth callbacks', () => {
	assert.deepEqual(
		trustedAuthOrigins('https://letletme.top'),
		[
			'https://letletme.top',
			'https://vercel-origin.letletme.top',
			'https://letletme-web.vercel.app',
			'https://www.letletme.top'
		]
	)
})
