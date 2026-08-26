const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const { readFile } = require('node:fs/promises')
const { join } = require('node:path')
const test = require('node:test')

const CURRENT_R2_OBJECT_SHA256 =
	'8dc8e5e74ff0a9b8d5a5192359e799aba8bdf8a7ee14223b0e9eb79891d0fc90'

test('keeps the Vercel replacement byte-identical to the current R2 object', async () => {
	const image = await readFile(join(__dirname, '../public/images/miniprogram.webp'))

	assert.equal(image.byteLength, 62_328)
	assert.equal(
		createHash('sha256').update(image).digest('hex'),
		CURRENT_R2_OBJECT_SHA256
	)
})
