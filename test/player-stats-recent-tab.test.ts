import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const source = readFileSync(
	'app/data/player-stats/_components/PlayerRecentGameweeks.tsx',
	'utf8'
)

describe('player stats recent tab hydration', () => {
	it('guards the pre-evidence render before recent rows are hydrated', () => {
		assert.match(source, /Array\.isArray\(player\.recentGameweeks\)/)
		assert.match(source, /recentGameweeks\.map\(row => \[row\.eventId, row\]\)/)
		assert.doesNotMatch(source, /player\.recentGameweeks\.map\(/)
	})
})
