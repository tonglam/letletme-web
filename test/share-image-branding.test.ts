import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	SHARE_BRAND_NAME,
	SHARE_BRAND_URL,
	buildShareBrandLayout
} from '../lib/share/image-branding'

interface Crop {
	x: number
	y: number
	width: number
	height: number
}

function cropKeepsTile(
	tiles: ReturnType<typeof buildShareBrandLayout>['tiles'],
	crop: Crop
): boolean {
	return tiles.some(
		tile =>
			tile.x >= crop.x &&
			tile.x <= crop.x + crop.width &&
			tile.y >= crop.y &&
			tile.y <= crop.y + crop.height
	)
}

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

	it('keeps a repeated watermark in every sampled half-image crop', () => {
		for (const [width, height] of [
			[750, 938],
			[1200, 630],
			[320, 640]
		]) {
			const { tiles } = buildShareBrandLayout(width, height)
			assert.ok(tiles.length >= 20)

			for (let xStep = 0; xStep <= 4; xStep += 1) {
				for (let yStep = 0; yStep <= 4; yStep += 1) {
					const crop: Crop = {
						x: (width / 2) * (xStep / 4),
						y: (height / 2) * (yStep / 4),
						width: width / 2,
						height: height / 2
					}
					assert.ok(
						cropKeepsTile(tiles, crop),
						`crop ${JSON.stringify(crop)} should retain LetLetMe`
					)
				}
			}
		}
	})

	it('covers each quadrant rather than relying on one corner badge', () => {
		const width = 750
		const height = 938
		const { tiles } = buildShareBrandLayout(width, height)
		const quadrants: Crop[] = [
			{ x: 0, y: 0, width: width / 2, height: height / 2 },
			{ x: width / 2, y: 0, width: width / 2, height: height / 2 },
			{ x: 0, y: height / 2, width: width / 2, height: height / 2 },
			{
				x: width / 2,
				y: height / 2,
				width: width / 2,
				height: height / 2
			}
		]

		for (const quadrant of quadrants) {
			assert.ok(cropKeepsTile(tiles, quadrant))
		}
	})
})
