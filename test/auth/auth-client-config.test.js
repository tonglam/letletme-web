const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const test = require('node:test')
const { resolve } = require('node:path')

test('browser auth requests stay on the page origin', () => {
	const source = readFileSync(
		resolve(process.cwd(), 'lib/auth-client.ts'),
		'utf8'
	)
	assert.doesNotMatch(source, /baseURL\s*:/)
	assert.doesNotMatch(source, /NEXT_PUBLIC_(?:APP|BETTER_AUTH)_URL/)
})
