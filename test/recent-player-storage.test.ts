import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	parseRecentPlayers,
	serializeRecentPlayers
} from '../app/data/player-stats/_lib/recent-player-storage'
import type { PlayerDirectoryOption } from '../components/player/PlayerDirectoryPicker'

const player = (id: number): PlayerDirectoryOption => ({
	id: String(id),
	name: `Player ${id}`,
	position: 'MID',
	teamShortName: 'ARS',
	teamName: 'Arsenal'
})

describe('recent player storage', () => {
	it('round-trips a bounded canonical array', () => {
		const encoded = serializeRecentPlayers(
			Array.from({ length: 7 }, (_, i) => player(i + 1))
		)
		const raw: unknown = JSON.parse(encoded)
		assert.equal(Array.isArray(raw), true)
		assert.deepEqual(parseRecentPlayers(encoded), [1, 2, 3, 4, 5].map(player))
	})

	it('treats object wrappers and malformed elements as no cache', () => {
		assert.deepEqual(
			parseRecentPlayers(JSON.stringify({ players: [player(1)] })),
			[]
		)
		assert.deepEqual(
			parseRecentPlayers(JSON.stringify([player(1), { id: '2' }])),
			[]
		)
		assert.deepEqual(parseRecentPlayers('{'), [])
	})
})
