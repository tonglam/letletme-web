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
			new URL(
				'../components/player/PlayerDirectoryPicker.tsx',
				import.meta.url
			),
			'utf8'
		)
		const seedGuard = source.slice(
			source.indexOf('if (initialSeedQueryKeyRef.current === playerQueryKey)'),
			source.indexOf(
				'let isCancelled = false',
				source.indexOf('if (initialSeedQueryKeyRef.current === playerQueryKey)')
			)
		)
		assert.match(seedGuard, /return/)
		assert.match(source, /PLAYER_PICKER_DEBOUNCE_MS = 300/)
		assert.match(source, /controller\.abort\(\)/)
		assert.match(source, /fetchError\.status === 429/)
		assert.match(source, /setRateLimitSeconds/)
		assert.match(
			source,
			/rateLimitedPlayerQueryKeyRef\.current = playerQueryKey/
		)
		assert.match(source, /setPlayerRetryNonce\(current => current \+ 1\)/)
	})

	it('uses the bootstrap directory and preserves scoped picker states', async () => {
		const [loaderSource, pickerSource] = await Promise.all([
			readFile(new URL('../lib/player-stats-seed.ts', import.meta.url), 'utf8'),
			readFile(
				new URL(
					'../components/player/PlayerDirectoryPicker.tsx',
					import.meta.url
				),
				'utf8'
			)
		])

		assert.match(loaderSource, /loadPlayerStatsBootstrap/)
		assert.match(loaderSource, /directorySeed:/)
		assert.match(loaderSource, /playersState:/)
		assert.match(pickerSource, /seed\?\.playersState === 'ready'/)
		assert.match(pickerSource, /seed\?\.teamsState === 'ready'/)
		assert.match(pickerSource, /onReady\?\.\(\)/)
		assert.match(pickerSource, /role="alert"/)
	})

	it('keeps complete stale Player Stats data visible with an explicit stale state', async () => {
		const [seedSource, clientSource, viewSource] = await Promise.all([
			readFile(new URL('../lib/player-stats-seed.ts', import.meta.url), 'utf8'),
			readFile(
				new URL(
					'../app/data/player-stats/PlayerStatsClient.tsx',
					import.meta.url
				),
				'utf8'
			),
			readFile(
				new URL(
					'../app/data/player-stats/_components/PlayerStatsView.tsx',
					import.meta.url
				),
				'utf8'
			)
		])

		assert.match(
			seedSource,
			/status === 'AVAILABLE' \|\|\s+statsContext\.status === 'STALE'/
		)
		assert.match(clientSource, /statsContext\.status === 'STALE'/)
		assert.match(viewSource, /STALE: t\('playerState\.coverage\.stale'\)/)
	})

	it('retries a deep-link hash after the detail target mounts', async () => {
		const source = await readFile(
			new URL('../app/data/player-stats/PlayerStatsClient.tsx', import.meta.url),
			'utf8'
		)
		assert.match(source, /playerStatsSectionFromHash\(window\.location\.hash\)/)
		assert.match(source, /document\.getElementById\(`ps-\$\{section\}`\)/)
		assert.match(source, /element\.scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/)
		assert.match(source, /attempts >= 20/)
		assert.match(source, /addEventListener\('hashchange', scheduleHashScroll\)/)
		assert.match(source, /addEventListener\('popstate', scheduleHashScroll\)/)
	})

	it('keeps a missing deep-link comparison visible as an actionable error', async () => {
		const [clientSource, initialDeskSource, viewSource] = await Promise.all([
			readFile(new URL('../app/data/player-stats/PlayerStatsClient.tsx', import.meta.url), 'utf8'),
			readFile(new URL('../app/data/player-stats/PlayerStatsInitialDesk.tsx', import.meta.url), 'utf8'),
			readFile(new URL('../app/data/player-stats/_components/PlayerStatsView.tsx', import.meta.url), 'utf8')
		])

		assert.match(clientSource, /const comparisonRequested = Boolean\([\s\S]*initialPlayerIds\.p2 != null\)/)
		assert.match(clientSource, /comparisonRequested=\{comparisonRequested\}/)
		assert.match(clientSource, /initialDeskSeedPromise/)
		assert.match(clientSource, /PlayerStatsInitialDesk/)
		const retryStart = clientSource.indexOf('retryPlayerData={() =>')
		const retryEnd = clientSource.indexOf('loadEvidence=', retryStart)
		const retry = clientSource.slice(retryStart, retryEnd)
		assert.match(retry, /secondSelectPlayerById\(initialPlayerIds\.p2[\s\S]*batchPlayerIds/)
		assert.match(initialDeskSource, /comparisonRequested: playerIds\.p2 != null/)
		assert.match(initialDeskSource, /comparisonError: playerIds\.p2 != null && !comparison/)
		assert.match(viewSource, /const comparisonMissing = comparisonRequested && !comparison/)
		assert.match(viewSource, /comparisonRequested && isComparisonLoading && comparisonMissing/)
	})
})
