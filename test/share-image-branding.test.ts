import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	SHARE_BRAND_NAME,
	SHARE_BRAND_URL,
	buildShareBrandLayout
} from '../lib/share/image-branding'

describe('share image branding', () => {
	it('uses the product brand and keeps the signature inside the image', () => {
		assert.equal(SHARE_BRAND_NAME, 'LetLetMe')
		assert.equal(SHARE_BRAND_URL, 'letletme.top')

		for (const [width, height] of [
			[1, 1],
			[750, 938],
			[1200, 630],
			[320, 240]
		]) {
			const { signature } = buildShareBrandLayout(width, height)
			assert.ok(signature.x >= 0)
			assert.ok(signature.y >= 0)
			assert.ok(signature.x + signature.width <= width)
			assert.ok(signature.y + signature.height <= height)
		}
	})

	it('only reserves the bottom-right signature area', () => {
		const { signature } = buildShareBrandLayout(750, 938)
		assert.equal(signature.x + signature.width <= 750, true)
		assert.equal(signature.y + signature.height <= 938, true)
	})
})
