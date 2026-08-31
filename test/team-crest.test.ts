import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { teamCrestSrc } from '@/lib/team-crest'

describe('teamCrestSrc', () => {
	it('normalizes a valid team short name', () => {
		assert.equal(teamCrestSrc(' ars '), '/images/team-logos/ARS.png')
	})

	it('uses the neutral kit for missing or unsafe team identities', () => {
		assert.equal(teamCrestSrc(''), '/images/squad-pitch/kits/DEFAULT.png')
		assert.equal(teamCrestSrc('../ARS'), '/images/squad-pitch/kits/DEFAULT.png')
	})
})
