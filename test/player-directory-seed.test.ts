import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

import { buildPlayerDirectoryQueryKey } from '@/lib/player-directory-seed'

describe('PlayerDirectorySeed', () => {
	it('uses a stable key for the default public directory query', () => {
		assert.equal(
			buildPlayerDirectoryQueryKey({
				search: null,
				teamId: null,
				position: null,
				maxPrice: null,
				sortBy: 'total_desc',
				ownBand: 'ANY'
			}),
			'{"search":null,"teamId":null,"position":null,"maxPrice":null,"sortBy":"total_desc","ownBand":"ANY"}'
		)
	})

	it('skips the mount request for a matching seed and cancels superseded searches', async () => {
		const source = await readFile(
			new URL('../components/player/PlayerDirectoryPicker.tsx', import.meta.url),
			'utf8'
		)
		const seedGuard = source.slice(
			source.indexOf('if (initialSeedQueryKeyRef.current === playerQueryKey)'),
			source.indexOf('let isCancelled = false', source.indexOf('if (initialSeedQueryKeyRef.current === playerQueryKey)'))
		)
		assert.match(seedGuard, /return/)
		assert.match(source, /PLAYER_PICKER_DEBOUNCE_MS = 300/)
		assert.match(source, /controller\.abort\(\)/)
		assert.match(source, /fetchError\.status === 429/)
		assert.match(source, /setRateLimitSeconds/)
	})
})
