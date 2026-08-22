import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	buildSeasonOverallSnapshot,
	type SeasonIdentity
} from '@/app/me/team/_lib/team-stats-model'
import type { EntryHistoryItem } from '@/lib/graphql/operations/entries'

const identity: SeasonIdentity = {
	teamName: 'Test team',
	playerName: 'Manager',
	region: 'AU',
	totalTransfers: 0,
	overallPoints: 0,
	overallRank: 0,
	teamValue: null,
	bank: null
}

const historyRow = (overrides: Partial<EntryHistoryItem> = {}) =>
	({
		eventId: 1,
		eventChip: 'NONE',
		eventPoints: 0,
		eventRank: null,
		overallPoints: 0,
		overallRank: 0,
		eventTransfers: 0,
		eventTransfersCost: 0,
		eventNetPoints: 0,
		eventBenchPoints: 0,
		eventCaptainPoints: 0,
		eventPlayedCaptain: null,
		teamValue: null,
		bank: null,
		...overrides
	}) as EntryHistoryItem

describe('buildSeasonOverallSnapshot', () => {
	it('maps an upstream preseason zero placeholder to null only without history', () => {
		const snapshot = buildSeasonOverallSnapshot(identity, [], {
			preseason: true
		})
		assert.equal(snapshot.overallPoints, null)
		assert.equal(snapshot.overallRank, null)
	})

	it('does not use the unverified identity snapshot without finalized history', () => {
		const snapshot = buildSeasonOverallSnapshot(identity, [])
		assert.equal(snapshot.overallPoints, null)
		assert.equal(snapshot.overallRank, null)
	})

	it('preserves zero values when a real history row exists in preseason', () => {
		const snapshot = buildSeasonOverallSnapshot(identity, [historyRow()], {
			preseason: true
		})
		assert.equal(snapshot.overallPoints, 0)
		assert.equal(snapshot.overallRank, 0)
	})
})
