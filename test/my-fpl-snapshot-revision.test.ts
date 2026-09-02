import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	canCommitSnapshotResponse,
	reviewRevisionForGameweek,
	seedEntrySnapshotMeta
} from '@/app/me/team/_lib/team-stats-model'
import type { MyFplSnapshotMeta } from '@/lib/graphql/operations/my-fpl'

const meta = (revision: string): MyFplSnapshotMeta => ({
	revision,
	eventId: 1,
	snapshotDate: '2026-08-23',
	sourceCheckedAt: '2026-08-23T01:00:00.000Z',
	publishedAt: '2026-08-23T01:01:00.000Z',
	settlementState: 'PROVISIONAL',
	coverageState: 'COMPLETE',
	timelinessState: 'CURRENT',
	expectedEntryCount: 1,
	observedEntryCount: 1,
	finalizationStartedAt: null,
	finalizationDueAt: null,
	scoreSource: 'FPL_EVENT_LIVE',
	livePublicationId: '00000000-0000-4000-8000-000000000007',
	liveRevision: '8',
	algorithmVersion: 'live-points-v2-algorithm-1',
	sourceMinCheckedAt: '2026-08-23T01:00:00.000Z',
	sourceMaxCheckedAt: '2026-08-23T01:01:00.000Z'
})

describe('My FPL snapshot revision rollover', () => {
	it('accepts the exact pinned revision', () => {
		seedEntrySnapshotMeta(900_001, meta('100'))
		assert.equal(canCommitSnapshotResponse(900_001, '100', '100'), true)
	})

	it('accepts a strictly newer revision so an expired pin can converge', () => {
		seedEntrySnapshotMeta(900_002, meta('100'))
		assert.equal(canCommitSnapshotResponse(900_002, '100', '101'), true)
		assert.equal(canCommitSnapshotResponse(900_002, '100', '000101'), true)
	})

	it('rejects older, malformed and missing revisions', () => {
		seedEntrySnapshotMeta(900_003, meta('100'))
		assert.equal(canCommitSnapshotResponse(900_003, '100', '99'), false)
		assert.equal(canCommitSnapshotResponse(900_003, '100', 'future'), false)
		assert.equal(canCommitSnapshotResponse(900_003, '100', null), false)
	})

	it('rejects an obsolete response after another request changed the session pin', () => {
		seedEntrySnapshotMeta(900_004, meta('102'))
		assert.equal(canCommitSnapshotResponse(900_004, '100', '103'), false)
	})

	it('never reuses a through-event revision for historical replay', () => {
		const reviewMeta = { ...meta('104'), eventId: 2 }
		assert.equal(reviewRevisionForGameweek(reviewMeta, 2), '104')
		assert.equal(reviewRevisionForGameweek(reviewMeta, 1), null)
	})
})
