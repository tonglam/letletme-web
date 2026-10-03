import assert from 'node:assert/strict'
import test from 'node:test'
import { eventResultFromManagerGameweek } from '../app/me/team/_lib/manager-review-projection'
import {
	canCommitSnapshotResponse,
	getEntryEventResultCached,
	peekEntrySnapshotMeta,
	seedEntrySnapshotMeta
} from '../app/me/team/_lib/team-stats-model'
import { managerGameweek, managerSnapshot } from '../e2e/fixtures/manager-review'

test('historical manager results retain their own snapshot revision', () => {
 for (const eventId of [1, 2, 3]) {
  const source = managerGameweek(eventId)
  const projected = eventResultFromManagerGameweek(source)
  assert.deepEqual(projected?.reviewSnapshot, {
   ...source.snapshotMeta, entryId: source.entry!.id
  })
 }
})

test('missing or mismatched snapshots cannot provide readiness identity', () => {
 const source = managerGameweek(1)
 for (const input of [
  { ...source, snapshotMeta: null },
  { ...source, snapshotMeta: managerSnapshot(2) },
  { ...source, eventId: 2 }
 ]) {
  const projected = eventResultFromManagerGameweek(input)
  assert.equal(projected?.reviewSnapshot, undefined)
  assert.equal(projected?.eventId, 1)
 }
})

test('missing manager identity or result cannot produce a ready projection', () => {
 const source = managerGameweek(1)
 assert.equal(eventResultFromManagerGameweek({ ...source, entry: null }), null)
 assert.equal(eventResultFromManagerGameweek({ ...source, result: null }), null)
})

 test('historical status keeps the selected publication dates and settlement', () => {
  const source = managerGameweek(1)
  source.snapshotMeta = { ...managerSnapshot(1), publishedAt: '2026-08-01T01:02:03Z', sourceMaxCheckedAt: '2026-08-01T00:00:00Z', settlementState: 'DELAYED' }
  const projected = eventResultFromManagerGameweek(source)
  assert.equal(projected?.reviewSnapshot?.publishedAt, source.snapshotMeta.publishedAt)
  assert.equal(projected?.reviewSnapshot?.sourceMaxCheckedAt, source.snapshotMeta.sourceMaxCheckedAt)
  assert.equal(projected?.reviewSnapshot?.settlementState, 'DELAYED')
 })

test('a pinned manager gameweek survives expired client snapshot metadata', async t => {
	const entryId = 7654321
	const originalNow = Date.now
	const originalFetch = globalThis.fetch
	const originalEndpoint = process.env.GRAPHQL_ENDPOINT
	const now = originalNow()
	t.after(() => {
		Date.now = originalNow
		globalThis.fetch = originalFetch
		if (originalEndpoint === undefined) delete process.env.GRAPHQL_ENDPOINT
		else process.env.GRAPHQL_ENDPOINT = originalEndpoint
	})
	Date.now = () => now
	process.env.GRAPHQL_ENDPOINT = 'http://127.0.0.1:4000/graphql'
	seedEntrySnapshotMeta(entryId, managerSnapshot(3))
	Date.now = () => now + 21 * 60_000
	assert.equal(peekEntrySnapshotMeta(entryId), undefined)
	const revision = managerSnapshot(3).revision
	assert.equal(canCommitSnapshotResponse(entryId, revision, revision), true)
	assert.equal(canCommitSnapshotResponse(entryId, revision, `${revision}:stale`), false)

	const gameweek = managerGameweek(3)
	globalThis.fetch = async (_input, init) => {
		const request = JSON.parse(String(init?.body))
		assert.equal(request.variables.snapshotRevision, gameweek.snapshotMeta?.revision)
		return new Response(
			JSON.stringify({
				data: {
					myFplManagerGameweek: {
						...gameweek,
						entry: { ...gameweek.entry!, id: entryId }
					}
				}
			}),
			{ status: 200, headers: { 'content-type': 'application/json' } }
		)
	}
	const result = await getEntryEventResultCached(entryId, 3, {
		snapshotRevision: gameweek.snapshotMeta!.revision
	})
	assert.equal(result?.eventId, 3)
	assert.equal(
		peekEntrySnapshotMeta(entryId)?.revision,
		gameweek.snapshotMeta!.revision
	)
})
