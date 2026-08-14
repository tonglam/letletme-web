const assert = require('node:assert/strict')
const { describe, it } = require('node:test')
const sharp = require('sharp')

describe('Home team crest derivatives', () => {
	it('keeps the Coventry colour crest legible at 32px WebP', async () => {
		const derivative = await sharp('public/images/team-logos/COV.png')
			.resize(32, 32, { fit: 'contain' })
			.webp({ quality: 75 })
			.toBuffer()
		const { data } = await sharp(derivative)
			.ensureAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true })
		let opaquePixels = 0
		let colouredPixels = 0
		for (let offset = 0; offset < data.length; offset += 4) {
			const red = data[offset]
			const green = data[offset + 1]
			const blue = data[offset + 2]
			const alpha = data[offset + 3]
			if (alpha <= 32) continue
			opaquePixels += 1
			if (Math.max(red, green, blue) - Math.min(red, green, blue) > 20) {
				colouredPixels += 1
			}
		}

		assert.ok(opaquePixels > 400)
		assert.ok(colouredPixels / opaquePixels > 0.4)
		assert.ok(derivative.byteLength < 2_000)
	})
})
