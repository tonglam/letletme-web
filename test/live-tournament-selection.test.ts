import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	getLiveTournamentSelectionStorageKey,
	readLiveTournamentSelection,
	resolveLiveTournamentSelection,
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

	it('restores storage before the server default when there is no URL choice', () => {
		assert.deepEqual(
			resolveLiveTournamentSelection({
				availableIds: ['1', '7'],
				cachedTournamentId: ' 7 ',
				initialTournamentId: '1'
			}),
			{
				selectedId: '7',
				source: 'storage',
				cachedId: '7'
			}
		)
	})

	it('keeps an explicit URL choice authoritative', () => {
		assert.deepEqual(
			resolveLiveTournamentSelection({
				availableIds: ['1', '7'],
				urlTournamentId: ' 1 ',
				cachedTournamentId: '7',
				initialTournamentId: '7'
			}),
			{
				selectedId: '1',
				source: 'url',
				cachedId: '7'
			}
		)
	})

	it('does not replace a cached id when the current list is incomplete', () => {
		assert.deepEqual(
			resolveLiveTournamentSelection({
				availableIds: ['1'],
				cachedTournamentId: '7',
				initialTournamentId: '1'
			}),
			{
				selectedId: '1',
				source: 'initial',
				cachedId: '7'
			}
		)
		assert.deepEqual(
			resolveLiveTournamentSelection({
				availableIds: ['1', '7'],
				cachedTournamentId: '7',
				initialTournamentId: '1'
			}),
			{
				selectedId: '7',
				source: 'storage',
				cachedId: '7'
			}
		)
	})

	it('treats an unknown URL choice as correctable instead of silently restoring storage', () => {
		assert.deepEqual(
			resolveLiveTournamentSelection({
				availableIds: ['1', '7'],
				urlTournamentId: '999',
				cachedTournamentId: '7',
				initialTournamentId: '1'
			}),
			{
				selectedId: null,
				source: 'unknown-url',
				cachedId: '7'
			}
		)
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
