import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { regionToFlagEmoji } from '@/lib/region-flag'

describe('regionToFlagEmoji', () => {
	it('converts ISO region codes to flags', () => {
		assert.equal(regionToFlagEmoji('AU'), '🇦🇺')
		assert.equal(regionToFlagEmoji('cn'), '🇨🇳')
	})

	it('converts upstream country names to flags', () => {
		assert.equal(regionToFlagEmoji('Australia'), '🇦🇺')
		assert.equal(regionToFlagEmoji('China'), '🇨🇳')
		assert.equal(regionToFlagEmoji('England'), '🇬🇧')
	})

	it('does not render a flag for missing or unsupported regions', () => {
		assert.equal(regionToFlagEmoji(null), null)
		assert.equal(regionToFlagEmoji(''), null)
		assert.equal(regionToFlagEmoji('International'), null)
	})
})
