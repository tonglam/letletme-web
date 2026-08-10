import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { PlayerDirectoryOption } from '../components/player/PlayerDirectoryPicker'
import { sortDirectoryPlayers } from '../lib/player-directory-filters'

const players: PlayerDirectoryOption[] = [
	{
		id: '1',
		name: 'Alpha',
		position: 'MID',
		teamShortName: 'AAA',
		teamName: 'Alpha FC',
		totalPoints: null,
		form: null,
		selectedByPercent: 30
	},
	{
		id: '2',
		name: 'Bravo',
		position: 'MID',
		teamShortName: 'BBB',
		teamName: 'Bravo FC',
		totalPoints: 20,
		form: 4.2,
		selectedByPercent: 10
	}
]

describe('player directory sorting', () => {
	it('sorts current-season results by total or form without manufacturing zeroes', () => {
		assert.deepEqual(
			sortDirectoryPlayers(players, 'total_desc').map(player => player.id),
			['2', '1']
		)
		assert.deepEqual(
			sortDirectoryPlayers(players, 'form_desc').map(player => player.id),
			['2', '1']
		)
	})

	it('supports preseason ownership-first ordering', () => {
		assert.deepEqual(
			sortDirectoryPlayers(players, 'own_desc').map(player => player.id),
			['1', '2']
		)
	})
})
