import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	getLiveTournamentSelectionStorageKey,
	readLiveTournamentSelection,
	writeLiveTournamentSelection
} from '@/lib/tournament/live-selection'

const createStorage = () => {
	const values = new Map<string, string>()
	return {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => values.set(key, value)
	}
}

describe('live tournament selection cache', () => {
	it('scopes the preference by entry id', () => {
		assert.equal(
			getLiveTournamentSelectionStorageKey(6953),
			'letletme:live-tournament-selection:v1:6953'
		)
	})

	it('round-trips a trimmed tournament id', () => {
		const storage = createStorage()

		writeLiveTournamentSelection(storage, 6953, '  7  ')

		assert.equal(readLiveTournamentSelection(storage, 6953), '7')
		assert.equal(readLiveTournamentSelection(storage, 6954), null)
	})

	it('ignores invalid input and storage failures', () => {
		const storage = {
			getItem: () => {
				throw new Error('blocked')
			},
			setItem: () => {
				throw new Error('blocked')
			}
		}

		assert.equal(readLiveTournamentSelection(storage, 0), null)
		assert.equal(readLiveTournamentSelection(storage, 6953), null)
		assert.doesNotThrow(() => writeLiveTournamentSelection(storage, 6953, '7'))
		assert.doesNotThrow(() => writeLiveTournamentSelection(storage, 6953, ' '))
	})
})
