import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { InvalidAvatarError, normalizeAvatar } from '../lib/avatar-processing'

const onePixelPng = Uint8Array.from(
	Buffer.from(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
		'base64'
	)
)

describe('avatar processing', () => {
	it('normalizes an accepted image and rejects a forged MIME type', async () => {
		const output = await normalizeAvatar(onePixelPng, 'image/png')
		assert.ok(output.byteLength > 0)
		assert.deepEqual(output.subarray(0, 2), Buffer.from([0xff, 0xd8]))
		await assert.rejects(
			() => normalizeAvatar(onePixelPng, 'image/jpeg'),
			InvalidAvatarError
		)
	})

	it('rejects empty and oversized input before decoding', async () => {
		await assert.rejects(() => normalizeAvatar(new Uint8Array()), InvalidAvatarError)
		await assert.rejects(
			() => normalizeAvatar(new Uint8Array(5 * 1024 * 1024 + 1)),
			InvalidAvatarError
		)
	})
})
