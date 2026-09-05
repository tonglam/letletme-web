import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

describe('homepage highest score presentation', () => {
	it('keeps an official zero distinct from an unpublished null', async () => {
		const source = await readFile(
			new URL('../components/home/StatsSection.tsx', import.meta.url),
			'utf8'
		)

		assert.match(
			source,
			/overview\.highestPoints === null\s+\? t\('highestScorePending'\)\s+: overview\.highestPoints\.toString\(\)/
		)
		assert.doesNotMatch(source, /highestPoints\?\.toString\(\) \?\? '0'/)
	})
})
